package handlers

import (
	"backend/database"
	"backend/middleware"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
)

type Place struct {
	ID          string  `json:"id"`
	Title       string  `json:"title"`
	Description string  `json:"description"`
	Latitude    float64 `json:"latitude"`
	Longitude   float64 `json:"longitude"`
	Category    string  `json:"category"`
	Organizer   string  `json:"organizer"`
	Time        string  `json:"time"`
	ImageUrl    string  `json:"imageUrl,omitempty"`
	Address     string  `json:"address,omitempty"`
	SectorName  string  `json:"sectorName,omitempty"`
}

type PlacesResponse struct {
	Results []Place `json:"results"`
}

func PlacesSearchHandler(w http.ResponseWriter, r *http.Request) {
	queryParam := r.URL.Query().Get("q")
	followedParam := r.URL.Query().Get("followed")
	zoneIdParam := r.URL.Query().Get("zoneId")

	minLat := r.URL.Query().Get("minLat")
	maxLat := r.URL.Query().Get("maxLat")
	minLng := r.URL.Query().Get("minLng")
	maxLng := r.URL.Query().Get("maxLng")

	var rows *sql.Rows
	var err error

	if database.DB == nil {
		http.Error(w, "Base de datos no disponible", http.StatusInternalServerError)
		return
	}

	followedOnly := followedParam == "true"
	var userID int
	if followedOnly {
		claims, err := middleware.ExtractAndValidateToken(r)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"message": "Se requiere autenticación para filtrar por seguidos",
			})
			return
		}
		idFloat, ok := claims["id"].(float64)
		if !ok {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"message": "Token de usuario inválido",
			})
			return
		}
		userID = int(idFloat)
	}

	viewMode := r.URL.Query().Get("viewMode")
	if viewMode == "" {
		// Intentar obtener el viewMode del perfil del usuario autenticado
		claims, err := middleware.ExtractAndValidateToken(r)
		if err == nil {
			if idFloat, ok := claims["id"].(float64); ok {
				var dbViewMode string
				errDb := database.DB.QueryRow("SELECT current_view_mode FROM citizen_profiles WHERE user_id = $1", int(idFloat)).Scan(&dbViewMode)
				if errDb == nil {
					viewMode = dbViewMode
				}
			}
		}
	}

	sqlQuery := `
		SELECT id, title, description, lat, lng, category, organizer, address, time, image_url,
		       COALESCE((SELECT name FROM zones z WHERE z.id = ANY(u.containing_zone_ids) LIMIT 1), '') as sector_name
		FROM (
			SELECT
				'branch-' || b.id::text as id,
				b.branch_name as title,
				COALESCE(b.description, '') as description,
				ST_Y(b.geom::geometry) as lat,
				ST_X(b.geom::geometry) as lng,
				b.category,
				COALESCE(c.business_name, 'Empresa Local') as organizer,
				COALESCE(b.address, '') as address,
				'Abierto ahora' as time,
				b.geom,
				COALESCE(b.image_url, '') as image_url,
				b.company_id,
				b.containing_zone_ids,
				COALESCE(b.target_audience, 'all') as target_audience
			FROM company_branches b
			LEFT JOIN companies c ON b.company_id = c.id

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
				b.company_id,
				e.containing_zone_ids,
				COALESCE(e.target_audience, 'all') as target_audience
			FROM events e
			LEFT JOIN company_branches b ON e.branch_emitter_id = b.id
			LEFT JOIN companies c ON b.company_id = c.id

			UNION ALL

			SELECT
				'ext-' || ep.id::text as id,
				ep.name as title,
				CASE WHEN ep.rating IS NOT NULL
					THEN '⭐ ' || ep.rating::text || ' · ' || COALESCE(ep.address, '')
					ELSE COALESCE(ep.address, '')
				END as description,
				ep.lat,
				ep.lng,
				ep.category,
				CASE ep.category
					WHEN 'gastronomia' THEN 'Gastronomía'
					WHEN 'supermercado' THEN 'Supermercado'
					WHEN 'tienda' THEN 'Comercio'
					ELSE 'Google Places'
				END as organizer,
				COALESCE(ep.address, '') as address,
				'Establecimiento' as time,
				ep.geom,
				COALESCE(ep.image_url, '') as image_url,
				NULL::int as company_id,
				COALESCE(ep.containing_zone_ids, '{}'::int[]) as containing_zone_ids,
				ep.target_audience
			FROM external_places ep
		) u
		WHERE 1=1
	`

	var args []interface{}
	paramCount := 1

	if viewMode == "tourist" {
		sqlQuery += " AND u.target_audience IN ('tourist', 'all')"
	} else if viewMode == "local" {
		sqlQuery += " AND u.target_audience IN ('local', 'all')"
	}

	if queryParam != "" {
		sqlQuery += fmt.Sprintf(" AND (u.title ILIKE $%d OR u.description ILIKE $%d)", paramCount, paramCount)
		args = append(args, "%"+queryParam+"%")
		paramCount++
	}

	if minLat != "" && maxLat != "" && minLng != "" && maxLng != "" {
		sqlQuery += fmt.Sprintf(" AND ST_Intersects(u.geom, ST_MakeEnvelope($%d, $%d, $%d, $%d, 4326)::geography)",
			paramCount, paramCount+1, paramCount+2, paramCount+3)
		args = append(args, minLng, minLat, maxLng, maxLat)
		paramCount += 4
	}

	if followedOnly && userID > 0 {
		sqlQuery += fmt.Sprintf(" AND EXISTS (SELECT 1 FROM user_follows uf WHERE uf.user_id = $%d AND uf.company_id = u.company_id)", paramCount)
		args = append(args, userID)
		paramCount++
	}

	if zoneIdParam != "" {
		sqlQuery += fmt.Sprintf(" AND u.containing_zone_ids @> ARRAY[$%d::integer]", paramCount)
		args = append(args, zoneIdParam)
		paramCount++
	} else {
		sqlQuery += " AND NOT EXISTS (SELECT 1 FROM zones z WHERE z.id = ANY(u.containing_zone_ids) AND z.category IN ('edificio', 'reserva') AND z.is_active = true)"
	}

	sqlQuery += " LIMIT 500"

	rows, err = database.DB.Query(sqlQuery, args...)

	if err != nil {
		log.Printf("Error consultando lugares: %v\n", err)
		http.Error(w, "Error en la consulta", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	places := []Place{}
	for rows.Next() {
		var p Place
		if err := rows.Scan(&p.ID, &p.Title, &p.Description, &p.Latitude, &p.Longitude, &p.Category, &p.Organizer, &p.Address, &p.Time, &p.ImageUrl, &p.SectorName); err != nil {
			log.Printf("Error escaneando fila: %v\n", err)
			continue
		}
		places = append(places, p)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(PlacesResponse{Results: places})
}
