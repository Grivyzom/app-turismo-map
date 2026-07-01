package handlers

import (
	"backend/database"
	"backend/middleware"
	"encoding/json"
	"log"
	"net/http"

	"github.com/golang-jwt/jwt/v5"
	"github.com/lib/pq"
)

func RecommendationsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	userClaims, ok := r.Context().Value(middleware.UserContextKey).(jwt.MapClaims)
	if !ok {
		http.Error(w, "No autorizado", http.StatusUnauthorized)
		return
	}

	userIDFloat, ok := userClaims["id"].(float64)
	if !ok {
		http.Error(w, "ID de usuario inválido", http.StatusUnauthorized)
		return
	}
	userID := int(userIDFloat)

	if database.DB == nil {
		http.Error(w, "Base de datos no disponible", http.StatusInternalServerError)
		return
	}

	// 1. Obtener categorías y current_view_mode del usuario
	var categories []string
	var currentViewMode string
	err := database.DB.QueryRow(`
		SELECT 
			CASE 
				WHEN preferences->'categories' IS NOT NULL THEN ARRAY(SELECT jsonb_array_elements_text(preferences->'categories'))
				ELSE ARRAY[]::text[]
			END,
			COALESCE(current_view_mode, 'local')
		FROM citizen_profiles 
		WHERE user_id = $1
	`, userID).Scan(pq.Array(&categories), &currentViewMode)

	// 2. Si no tiene perfil o no hay categorías, obtener el top 3 global
	if err != nil || len(categories) == 0 {
		if currentViewMode == "" {
			currentViewMode = "local"
		}
		rows, err := database.DB.Query(`
			SELECT cat 
			FROM citizen_profiles, 
			jsonb_array_elements_text(preferences->'categories') AS cat 
			GROUP BY cat 
			ORDER BY count(*) DESC 
			LIMIT 3
		`)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var cat string
				if err := rows.Scan(&cat); err == nil {
					categories = append(categories, cat)
				}
			}
		}
	}

	// 3. Si aún no hay categorías (BD vacía), usar default
	if len(categories) == 0 {
		categories = []string{"naturaleza", "gastronomia", "cultura"}
	}

	// 4. Buscar lugares y eventos que coincidan con estas categorías y ordenar por relevancia
	// Y sumar notificaciones/novedades (Smart Notifications)
	sqlQuery := `
		SELECT id, title, description, lat, lng, category, organizer, address, time, image_url,
		       COALESCE((SELECT name FROM zones z WHERE z.id = ANY(u.containing_zone_ids) LIMIT 1), '') as sector_name,
		       u.is_smart_notification, u.recommendation_type
		FROM (
			SELECT 
				'branch-' || b.id::text as id, 
				b.branch_name as title, 
				COALESCE(b.description, '') as description, 
				ST_Y(b.geom::geometry) as lat, 
				ST_X(b.geom::geometry) as lng, 
				b.category, 
				c.business_name as organizer,
				COALESCE(b.address, '') as address,
				'Abierto ahora' as time,
				b.geom,
				COALESCE(b.image_url, '') as image_url,
				b.containing_zone_ids,
				COALESCE(b.target_audience, 'all') as target_audience,
				false as is_live,
				false as is_smart_notification,
				'none' as recommendation_type
			FROM company_branches b
			JOIN companies c ON b.company_id = c.id
			WHERE b.category = ANY($1)

			UNION ALL

			SELECT 
				'event-' || e.id::text as id, 
				e.title, 
				COALESCE(e.description, '') as description, 
				ST_Y(e.geom::geometry) as lat, 
				ST_X(e.geom::geometry) as lng, 
				e.category, 
				COALESCE(c.business_name, 'Organizador') as organizer,
				COALESCE(b.address, '') as address,
				'Evento programado' as time,
				e.geom,
				'' as image_url,
				e.containing_zone_ids,
				COALESCE(e.target_audience, 'all') as target_audience,
				COALESCE(e.is_live, false) as is_live,
				CASE WHEN e.category IN ('new_item', 'invitation_club', 'invitation_sports', 'new_spot') THEN true ELSE false END as is_smart_notification,
				CASE 
					WHEN e.category = 'new_item' THEN 'new_item'
					WHEN e.category = 'invitation_club' THEN 'invitation_club'
					WHEN e.category = 'invitation_sports' THEN 'invitation_sports'
					WHEN e.category = 'new_spot' THEN 'new_spot'
					ELSE 'none'
				END as recommendation_type
			FROM events e
			LEFT JOIN company_branches b ON e.branch_emitter_id = b.id
			LEFT JOIN companies c ON b.company_id = c.id
			WHERE (e.category = ANY($1) OR e.category IN ('new_item', 'invitation_club', 'invitation_sports', 'new_spot')) AND e.end_time > NOW()
		) u
		ORDER BY (
			-- Scoring algorithm based on currentViewMode and target_audience
			CASE 
				WHEN $2 = 'tourist' THEN 
					CASE WHEN u.target_audience = 'tourist' THEN 1.0 WHEN u.target_audience = 'all' THEN 0.7 ELSE 0.1 END
				WHEN $2 = 'local' THEN 
					CASE WHEN u.target_audience = 'local' THEN 1.0 WHEN u.target_audience = 'all' THEN 0.7 ELSE 0.1 END
				ELSE 0.5
			END +
			-- Live event bonus
			CASE WHEN u.is_live = true THEN 0.15 ELSE 0.0 END +
			-- Smart notification bonus (highest priority)
			CASE WHEN u.is_smart_notification = true THEN 2.0 ELSE 0.0 END
		) DESC, RANDOM()
		LIMIT 10
	`

	rows, err := database.DB.Query(sqlQuery, pq.Array(categories), currentViewMode)
	if err != nil {
		log.Printf("Error consultando recomendaciones: %v\n", err)
		http.Error(w, "Error en el algoritmo de recomendación", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	results := []Place{}
	for rows.Next() {
		var p Place
		if err := rows.Scan(&p.ID, &p.Title, &p.Description, &p.Latitude, &p.Longitude, &p.Category, &p.Organizer, &p.Address, &p.Time, &p.ImageUrl, &p.SectorName, &p.IsSmartNotification, &p.RecommendationType); err != nil {
			log.Printf("Error escaneando recomendación: %v\n", err)
			continue
		}
		results = append(results, p)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(PlacesResponse{Results: results})
}
