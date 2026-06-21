package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"

	"backend/database"
	"backend/models"
)

// GetRoutesHandler devuelve todas las rutas guardadas con sus puntos y el nombre del negocio creador.
// GET /api/v1/routes
func GetRoutesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	query := `
		SELECT 
			r.id, r.name, r.route_type, r.category, r.business_id, COALESCE(u.name, 'Negocio Local'), 
			r.target_audience, r.is_featured, r.rating_avg, r.created_at,
			rp.id, rp.latitude, rp.longitude, rp.order_index, rp.point_type, COALESCE(rp.name, '')
		FROM routes r
		LEFT JOIN users u ON r.business_id = u.id
		LEFT JOIN route_points rp ON r.id = rp.id
		ORDER BY r.is_featured DESC, r.id DESC, rp.order_index ASC;
	`

	rows, err := database.DB.Query(query)
	if err != nil {
		log.Printf("Error al consultar rutas: %v", err)
		http.Error(w, "Error interno del servidor", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	routesMap := make(map[int]*models.Route)
	var routeIDs []int

	for rows.Next() {
		var rID, bID int
		var rName, rCat, bName, rAudience, rCreatedAt string
		var rType models.RouteType
		var isFeatured bool
		var ratingAvg float64
		var pID int
		var pLat, pLng float64
		var pOrder int
		var pType models.PointType
		var pName string

		err := rows.Scan(
			&rID, &rName, &rType, &rCat, &bID, &bName,
			&rAudience, &isFeatured, &ratingAvg, &rCreatedAt,
			&pID, &pLat, &pLng, &pOrder, &pType, &pName,
		)
		if err != nil {
			log.Printf("Error al escanear ruta/punto: %v", err)
			continue
		}

		route, ok := routesMap[rID]
		if !ok {
			route = &models.Route{
				ID:             rID,
				Name:           rName,
				Type:           rType,
				Category:       rCat,
				BusinessID:     bID,
				BusinessName:   bName,
				TargetAudience: rAudience,
				IsFeatured:     isFeatured,
				RatingAvg:      ratingAvg,
				CreatedAt:      rCreatedAt,
				Points:         []models.RoutePoint{},
			}
			routesMap[rID] = route
			routeIDs = append(routeIDs, rID)
		}

		if pID != 0 {
			route.Points = append(route.Points, models.RoutePoint{
				ID:         pID,
				RouteID:    rID,
				Latitude:   pLat,
				Longitude:  pLng,
				OrderIndex: pOrder,
				PointType:  pType,
				Name:       pName,
			})
		}
	}

	routes := []models.Route{}
	for _, id := range routeIDs {
		routes = append(routes, *routesMap[id])
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(routes)
}

// CreateRouteHandler crea una nueva ruta y sus puntos asociados.
// POST /api/v1/routes
func CreateRouteHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	// Obtener ID de usuario del contexto (inyectado por AuthMiddleware)
	userID, ok := r.Context().Value("user_id").(int)
	if !ok {
		http.Error(w, "No autorizado", http.StatusUnauthorized)
		return
	}

	var req models.CreateRouteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Cuerpo de solicitud inválido", http.StatusBadRequest)
		return
	}

	tx, err := database.DB.Begin()
	if err != nil {
		log.Printf("Error al iniciar transacción: %v", err)
		http.Error(w, "Error interno", http.StatusInternalServerError)
		return
	}

	var routeID int
	err = tx.QueryRow(
		"INSERT INTO routes (name, route_type, category, business_id, target_audience) VALUES ($1, $2, $3, $4, $5) RETURNING id",
		req.Name, req.Type, req.Category, userID, req.TargetAudience,
	).Scan(&routeID)

	if err != nil {
		tx.Rollback()
		log.Printf("Error al insertar ruta: %v", err)
		http.Error(w, "Error al guardar ruta", http.StatusInternalServerError)
		return
	}

	for _, p := range req.Points {
		_, err = tx.Exec(
			"INSERT INTO route_points (route_id, latitude, longitude, order_index, point_type, name) VALUES ($1, $2, $3, $4, $5, $6)",
			routeID, p.Latitude, p.Longitude, p.OrderIndex, p.PointType, p.Name,
		)
		if err != nil {
			tx.Rollback()
			log.Printf("Error al insertar punto de ruta: %v", err)
			http.Error(w, "Error al guardar puntos de ruta", http.StatusInternalServerError)
			return
		}
	}

	if err := tx.Commit(); err != nil {
		log.Printf("Error al commitear transacción: %v", err)
		http.Error(w, "Error al finalizar guardado", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"id":      routeID,
		"message": "Ruta creada con éxito",
	})
}

// RateRouteHandler permite a un usuario calificar una ruta.
// POST /api/v1/routes/{id}/rate
func RateRouteHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	// Extraer ID de la ruta de la URL (ej: /api/v1/routes/15/rate)
	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 5 {
		http.Error(w, "ID de ruta inválido", http.StatusBadRequest)
		return
	}
	routeIDStr := pathParts[len(pathParts)-2]
	routeID, _ := strconv.Atoi(routeIDStr)

	userID, ok := r.Context().Value("user_id").(int)
	if !ok {
		http.Error(w, "No autorizado", http.StatusUnauthorized)
		return
	}

	var req models.RateRouteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Cuerpo inválido", http.StatusBadRequest)
		return
	}

	if req.Rating < 1 || req.Rating > 5 {
		http.Error(w, "La calificación debe estar entre 1 y 5", http.StatusBadRequest)
		return
	}

	tx, err := database.DB.Begin()
	if err != nil {
		http.Error(w, "Error interno", http.StatusInternalServerError)
		return
	}

	// Insertar o actualizar calificación (UPSERT)
	query := `
		INSERT INTO route_ratings (route_id, user_id, rating, comment)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (route_id, user_id) 
		DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, created_at = CURRENT_TIMESTAMP;
	`
	_, err = tx.Exec(query, routeID, userID, req.Rating, req.Comment)
	if err != nil {
		tx.Rollback()
		log.Printf("Error al guardar rating: %v", err)
		http.Error(w, "Error al guardar calificación", http.StatusInternalServerError)
		return
	}

	// Recalcular promedio en la tabla routes
	updateQuery := `
		UPDATE routes 
		SET rating_avg = (SELECT AVG(rating) FROM route_ratings WHERE route_id = $1)
		WHERE id = $1;
	`
	_, err = tx.Exec(updateQuery, routeID)
	if err != nil {
		tx.Rollback()
		log.Printf("Error al actualizar promedio: %v", err)
		http.Error(w, "Error al actualizar estadísticas", http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, "Error al finalizar", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Calificación guardada con éxito",
	})
}
