package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"

	"backend/database"
	"backend/models"
)

// scanRoutes executa una consulta y agrupa las rutas con sus puntos asociados
func scanRoutes(query string, args ...interface{}) ([]models.Route, error) {
	rows, err := database.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	routesMap := make(map[int]*models.Route)
	var routeIDs []int

	for rows.Next() {
		var rID int
		var rName, rTypeStr, rCat, bName, uName, rAudience, rCreatedAt string
		var isFeatured, isSystem bool
		var ratingAvg float64
		var nullBizID, nullUserID, nullOrigRouteID sql.NullInt64
		var visibility, shareToken, transportMode string
		var nullGeom sql.NullString
		var pID, pOrder int
		var pLat, pLng float64
		var pTypeStr, pName string

		err := rows.Scan(
			&rID, &rName, &rTypeStr, &rCat, &nullBizID, &nullUserID,
			&bName, &uName, &rAudience, &isFeatured, &ratingAvg,
			&visibility, &shareToken, &isSystem, &nullOrigRouteID,
			&transportMode, &nullGeom, &rCreatedAt,
			&pID, &pLat, &pLng, &pOrder, &pTypeStr, &pName,
		)
		if err != nil {
			log.Printf("Error al escanear fila de ruta: %v", err)
			continue
		}

		route, ok := routesMap[rID]
		if !ok {
			route = &models.Route{
				ID:             rID,
				Name:           rName,
				Type:           models.RouteType(rTypeStr),
				Category:       rCat,
				BusinessName:   bName,
				UserName:       uName,
				TargetAudience: rAudience,
				IsFeatured:     isFeatured,
				RatingAvg:      ratingAvg,
				Visibility:     models.RouteVisibility(visibility),
				ShareToken:     shareToken,
				IsSystemRoute:  isSystem,
				TransportMode:  transportMode,
				CreatedAt:      rCreatedAt,
				Points:         []models.RoutePoint{},
			}

			if nullBizID.Valid {
				bizVal := int(nullBizID.Int64)
				route.BusinessID = &bizVal
			}
			if nullUserID.Valid {
				usrVal := int(nullUserID.Int64)
				route.UserID = &usrVal
			}
			if nullOrigRouteID.Valid {
				origVal := int(nullOrigRouteID.Int64)
				route.OriginalRouteID = &origVal
			}
			if nullGeom.Valid && nullGeom.String != "" {
				route.GeomGeoJSON = &nullGeom.String
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
				PointType:  models.PointType(pTypeStr),
				Name:       pName,
			})
		}
	}

	routes := make([]models.Route, 0, len(routeIDs))
	for _, id := range routeIDs {
		routes = append(routes, *routesMap[id])
	}
	return routes, nil
}

const baseRouteSelect = `
	SELECT 
		r.id, r.name, r.route_type, r.category, r.business_id, r.user_id,
		COALESCE(u_biz.name, 'Comunidad'), COALESCE(u_user.name, ''),
		r.target_audience, r.is_featured, r.rating_avg,
		COALESCE(r.visibility, 'public'), COALESCE(r.share_token::text, ''),
		COALESCE(r.is_system_route, false), r.original_route_id,
		COALESCE(r.transport_mode, 'foot'),
		ST_AsGeoJSON(r.geom), r.created_at,
		COALESCE(rp.id, 0), COALESCE(rp.latitude, 0), COALESCE(rp.longitude, 0),
		COALESCE(rp.order_index, 0), COALESCE(rp.point_type, ''), COALESCE(rp.name, '')
	FROM routes r
	LEFT JOIN users u_biz ON r.business_id = u_biz.id
	LEFT JOIN users u_user ON r.user_id = u_user.id
	LEFT JOIN route_points rp ON r.id = rp.route_id
`

// GetRoutesHandler devuelve las rutas públicas con sus puntos y geometría.
// GET /api/v1/routes
func GetRoutesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	query := baseRouteSelect + `
		WHERE COALESCE(r.visibility, 'public') = 'public'
		ORDER BY r.is_featured DESC, r.rating_avg DESC, r.id DESC, rp.order_index ASC;
	`

	routes, err := scanRoutes(query)
	if err != nil {
		log.Printf("Error al consultar rutas públicas: %v", err)
		http.Error(w, "Error interno del servidor", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(routes)
}

// insertRouteCommon inserta una ruta y sus puntos dentro de una transacción
func insertRouteCommon(tx *sql.Tx, req models.CreateRouteRequest, userID int, asPartner bool) (int, string, error) {
	if req.Visibility == "" {
		if asPartner {
			req.Visibility = models.RouteVisibilityPublic
		} else {
			req.Visibility = models.RouteVisibilityPrivate
		}
	}
	if req.TransportMode == "" {
		req.TransportMode = "foot"
	}
	if req.TargetAudience == "" {
		req.TargetAudience = "all"
	}

	var bizID *int
	if asPartner {
		bizID = &userID
	}

	var routeID int
	var shareToken string

	var query string
	var err error
	if req.GeomGeoJSON != "" {
		query = `
			INSERT INTO routes (
				name, route_type, category, business_id, user_id, 
				target_audience, visibility, transport_mode, geom
			) 
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ST_SetSRID(ST_GeomFromGeoJSON($9), 4326)) 
			RETURNING id, share_token;
		`
		err = tx.QueryRow(query, req.Name, req.Type, req.Category, bizID, userID, req.TargetAudience, req.Visibility, req.TransportMode, req.GeomGeoJSON).Scan(&routeID, &shareToken)
	} else {
		query = `
			INSERT INTO routes (
				name, route_type, category, business_id, user_id, 
				target_audience, visibility, transport_mode
			) 
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
			RETURNING id, share_token;
		`
		err = tx.QueryRow(query, req.Name, req.Type, req.Category, bizID, userID, req.TargetAudience, req.Visibility, req.TransportMode).Scan(&routeID, &shareToken)
	}

	if err != nil {
		return 0, "", err
	}

	for _, p := range req.Points {
		_, err = tx.Exec(
			"INSERT INTO route_points (route_id, latitude, longitude, order_index, point_type, name) VALUES ($1, $2, $3, $4, $5, $6)",
			routeID, p.Latitude, p.Longitude, p.OrderIndex, p.PointType, p.Name,
		)
		if err != nil {
			return 0, "", err
		}
	}

	return routeID, shareToken, nil
}

// CreateRouteHandler crea una ruta general / de comercio.
// POST /api/v1/routes
func CreateRouteHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

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
		http.Error(w, "Error interno", http.StatusInternalServerError)
		return
	}

	routeID, shareToken, err := insertRouteCommon(tx, req, userID, true)
	if err != nil {
		tx.Rollback()
		log.Printf("Error al guardar ruta: %v", err)
		http.Error(w, "Error al guardar ruta", http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, "Error al finalizar guardado", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":    true,
		"id":         routeID,
		"shareToken": shareToken,
		"message":    "Ruta creada con éxito",
	})
}

// CreateUserRouteHandler crea una ruta personal planificada por un ciudadano.
// POST /api/v1/user/routes
func CreateUserRouteHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

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
		http.Error(w, "Error interno", http.StatusInternalServerError)
		return
	}

	routeID, shareToken, err := insertRouteCommon(tx, req, userID, false)
	if err != nil {
		tx.Rollback()
		log.Printf("Error al guardar ruta de usuario: %v", err)
		http.Error(w, "Error al guardar ruta", http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, "Error al finalizar guardado", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":    true,
		"id":         routeID,
		"shareToken": shareToken,
		"message":    "Ruta de usuario creada con éxito",
	})
}

// GetUserRoutesHandler devuelve las rutas creadas por el usuario y las guardadas en su lista.
// GET /api/v1/user/routes
func GetUserRoutesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	userID, ok := r.Context().Value("user_id").(int)
	if !ok {
		http.Error(w, "No autorizado", http.StatusUnauthorized)
		return
	}

	// 1. Rutas creadas por el usuario
	createdQuery := baseRouteSelect + `
		WHERE r.user_id = $1 OR r.business_id = $1
		ORDER BY r.id DESC, rp.order_index ASC;
	`
	createdRoutes, err := scanRoutes(createdQuery, userID)
	if err != nil {
		log.Printf("Error al consultar rutas creadas por usuario: %v", err)
		http.Error(w, "Error al obtener rutas", http.StatusInternalServerError)
		return
	}

	// 2. Rutas guardadas ("para después" / completadas)
	savedQuery := `
		SELECT 
			usr.id, usr.user_id, usr.route_id, usr.status, 
			COALESCE(usr.completed_at::text, ''), usr.created_at,
			r.name, r.route_type, r.category, r.target_audience, r.rating_avg,
			COALESCE(r.transport_mode, 'foot'), ST_AsGeoJSON(r.geom),
			COALESCE(r.share_token::text, ''), COALESCE(u.name, 'Comunidad')
		FROM user_saved_routes usr
		JOIN routes r ON usr.route_id = r.id
		LEFT JOIN users u ON r.user_id = u.id
		WHERE usr.user_id = $1
		ORDER BY usr.created_at DESC;
	`
	savedRows, err := database.DB.Query(savedQuery, userID)
	if err != nil {
		log.Printf("Error al consultar rutas guardadas: %v", err)
		http.Error(w, "Error al obtener rutas guardadas", http.StatusInternalServerError)
		return
	}
	defer savedRows.Close()

	type SavedRouteSummary struct {
		ID            int     `json:"id"`
		RouteID       int     `json:"routeId"`
		Status        string  `json:"status"`
		CompletedAt   string  `json:"completedAt,omitempty"`
		CreatedAt     string  `json:"createdAt"`
		Name          string  `json:"name"`
		Type          string  `json:"type"`
		Category      string  `json:"category"`
		TargetAudience string `json:"targetAudience"`
		RatingAvg     float64 `json:"ratingAvg"`
		TransportMode string  `json:"transportMode"`
		GeomGeoJSON   *string `json:"geomGeojson,omitempty"`
		ShareToken    string  `json:"shareToken"`
		AuthorName    string  `json:"authorName"`
	}

	savedRoutes := []SavedRouteSummary{}
	for savedRows.Next() {
		var s SavedRouteSummary
		var nullGeom sql.NullString
		err := savedRows.Scan(
			&s.ID, &s.RouteID, &s.Status, &s.CompletedAt, &s.CreatedAt,
			&s.Name, &s.Type, &s.Category, &s.TargetAudience, &s.RatingAvg,
			&s.TransportMode, &nullGeom, &s.ShareToken, &s.AuthorName,
		)
		if err != nil {
			log.Printf("Error al escanear ruta guardada: %v", err)
			continue
		}
		if nullGeom.Valid && nullGeom.String != "" {
			s.GeomGeoJSON = &nullGeom.String
		}
		savedRoutes = append(savedRoutes, s)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"created": createdRoutes,
		"saved":   savedRoutes,
	})
}

// GetSharedRouteHandler devuelve una ruta accesible mediante su share_token único.
// GET /api/v1/routes/shared/{token}
func GetSharedRouteHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	token := r.PathValue("token")
	if token == "" {
		pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		if len(pathParts) > 0 {
			token = pathParts[len(pathParts)-1]
		}
	}
	if token == "" {
		http.Error(w, "Token inválido", http.StatusBadRequest)
		return
	}

	query := baseRouteSelect + `
		WHERE r.share_token::text = $1 AND COALESCE(r.visibility, 'public') IN ('public', 'unlisted', 'private')
		ORDER BY rp.order_index ASC;
	`

	routes, err := scanRoutes(query, token)
	if err != nil || len(routes) == 0 {
		http.Error(w, "Ruta no encontrada", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(routes[0])
}

// ShareRouteHandler genera o confirma el enlace compartido y permite compartir 1 a 1 con otro usuario.
// POST /api/v1/routes/{id}/share
func ShareRouteHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	routeIDStr := r.PathValue("id")
	if routeIDStr == "" {
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		if len(parts) >= 2 {
			routeIDStr = parts[len(parts)-2]
		}
	}
	routeID, _ := strconv.Atoi(routeIDStr)

	userID, ok := r.Context().Value("user_id").(int)
	if !ok {
		http.Error(w, "No autorizado", http.StatusUnauthorized)
		return
	}

	var req models.ShareRouteRequest
	_ = json.NewDecoder(r.Body).Decode(&req)

	// Verificar propiedad de la ruta
	var shareToken, currentVisibility string
	var ownerUserID, ownerBizID sql.NullInt64
	err := database.DB.QueryRow(
		"SELECT share_token::text, visibility, user_id, business_id FROM routes WHERE id = $1",
		routeID,
	).Scan(&shareToken, &currentVisibility, &ownerUserID, &ownerBizID)

	if err != nil {
		http.Error(w, "Ruta no encontrada", http.StatusNotFound)
		return
	}

	isOwner := (ownerUserID.Valid && int(ownerUserID.Int64) == userID) || (ownerBizID.Valid && int(ownerBizID.Int64) == userID)
	if !isOwner {
		http.Error(w, "No tienes permiso para compartir esta ruta", http.StatusForbidden)
		return
	}

	// Si estaba privada, la pasamos a 'unlisted' para que el enlace sea accesible
	if currentVisibility == "private" {
		_, _ = database.DB.Exec("UPDATE routes SET visibility = 'unlisted' WHERE id = $1", routeID)
		currentVisibility = "unlisted"
	}

	// Si se indicó un usuario destino específico
	if req.SharedWithUserID > 0 {
		perm := "view"
		if req.Permission == "edit" {
			perm = "edit"
		}
		_, _ = database.DB.Exec(`
			INSERT INTO route_shares (route_id, shared_with_user_id, permission)
			VALUES ($1, $2, $3)
			ON CONFLICT (route_id, shared_with_user_id) 
			DO UPDATE SET permission = EXCLUDED.permission;
		`, routeID, req.SharedWithUserID, perm)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":    true,
		"routeId":    routeID,
		"shareToken": shareToken,
		"visibility": currentVisibility,
		"message":    "Enlace de compartición activo",
	})
}

// BookmarkRouteHandler guarda o retira una ruta de la lista personal del usuario ("Mis Planes").
// POST /api/v1/routes/{id}/bookmark
func BookmarkRouteHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	routeIDStr := r.PathValue("id")
	if routeIDStr == "" {
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		if len(parts) >= 2 {
			routeIDStr = parts[len(parts)-2]
		}
	}
	routeID, _ := strconv.Atoi(routeIDStr)

	userID, ok := r.Context().Value("user_id").(int)
	if !ok {
		http.Error(w, "No autorizado", http.StatusUnauthorized)
		return
	}

	var req models.BookmarkRouteRequest
	_ = json.NewDecoder(r.Body).Decode(&req)

	status := "planned"
	if req.Status == "completed" {
		status = "completed"
	}

	// Verificar si ya existe
	var existingStatus string
	err := database.DB.QueryRow(
		"SELECT status FROM user_saved_routes WHERE user_id = $1 AND route_id = $2",
		userID, routeID,
	).Scan(&existingStatus)

	if err == nil {
		if req.Status == "" || req.Status == existingStatus {
			// Toggle: si ya estaba y no se cambió el status, desmarcar
			_, _ = database.DB.Exec("DELETE FROM user_saved_routes WHERE user_id = $1 AND route_id = $2", userID, routeID)
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": true,
				"isSaved": false,
				"message": "Ruta eliminada de tus guardados",
			})
			return
		}

		// Actualizar estado (ej: marcar como completada)
		var completedAt interface{}
		if status == "completed" {
			_, _ = database.DB.Exec("UPDATE user_saved_routes SET status = $1, completed_at = NOW() WHERE user_id = $2 AND route_id = $3", status, userID, routeID)
		} else {
			_, _ = database.DB.Exec("UPDATE user_saved_routes SET status = $1, completed_at = NULL WHERE user_id = $2 AND route_id = $3", status, userID, routeID)
		}
		_ = completedAt
	} else {
		// Insertar nuevo registro
		if status == "completed" {
			_, err = database.DB.Exec(`
				INSERT INTO user_saved_routes (user_id, route_id, status, completed_at)
				VALUES ($1, $2, $3, NOW())
			`, userID, routeID, status)
		} else {
			_, err = database.DB.Exec(`
				INSERT INTO user_saved_routes (user_id, route_id, status)
				VALUES ($1, $2, $3)
			`, userID, routeID, status)
		}
		if err != nil {
			log.Printf("Error al guardar ruta de usuario: %v", err)
			http.Error(w, "Error al guardar en favoritos", http.StatusInternalServerError)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"isSaved": true,
		"status":  status,
		"message": "Ruta guardada en tus planes",
	})
}

// RateRouteHandler permite a un usuario calificar una ruta.
// POST /api/v1/routes/{id}/rate
func RateRouteHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	routeIDStr := r.PathValue("id")
	if routeIDStr == "" {
		pathParts := strings.Split(r.URL.Path, "/")
		if len(pathParts) >= 5 {
			routeIDStr = pathParts[len(pathParts)-2]
		}
	}
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
