package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"backend/database"
	"backend/models"
)

// GetBuildingMediaHandler devuelve todos los medios de un edificio (zona).
// GET /api/v1/zones/{id}/media?floor=0
func GetBuildingMediaHandler(w http.ResponseWriter, r *http.Request) {
	zoneIDStr := r.PathValue("id")
	zoneID, err := strconv.Atoi(zoneIDStr)
	if err != nil {
		http.Error(w, `{"error": "ID de zona inválido"}`, http.StatusBadRequest)
		return
	}

	query := `
		SELECT id, zone_id, floor, type, url, COALESCE(thumbnail, ''), title, COALESCE(caption, ''), sort_order, created_at
		FROM building_media
		WHERE zone_id = $1`
	args := []interface{}{zoneID}

	floorParam := r.URL.Query().Get("floor")
	if floorParam != "" {
		floor, err := strconv.Atoi(floorParam)
		if err != nil {
			http.Error(w, `{"error": "Parámetro floor inválido"}`, http.StatusBadRequest)
			return
		}
		query += " AND floor = $2"
		args = append(args, floor)
	}

	query += " ORDER BY sort_order ASC, id ASC"

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		log.Printf("Error al consultar building_media para zona %d: %v", zoneID, err)
		http.Error(w, "Error interno del servidor", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	media := []models.BuildingMedia{}
	for rows.Next() {
		var m models.BuildingMedia
		err := rows.Scan(
			&m.ID, &m.ZoneID, &m.Floor, &m.Type, &m.URL,
			&m.Thumbnail, &m.Title, &m.Caption, &m.SortOrder, &m.CreatedAt,
		)
		if err != nil {
			log.Printf("Error al escanear building_media: %v", err)
			continue
		}
		media = append(media, m)
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(media); err != nil {
		log.Printf("Error al codificar respuesta de building_media: %v", err)
	}
}

// CreateBuildingMediaHandler crea una nueva entrada de medio para un edificio.
// POST /api/v1/zones/{id}/media
func CreateBuildingMediaHandler(w http.ResponseWriter, r *http.Request) {
	zoneIDStr := r.PathValue("id")
	zoneID, err := strconv.Atoi(zoneIDStr)
	if err != nil {
		http.Error(w, `{"error": "ID de zona inválido"}`, http.StatusBadRequest)
		return
	}

	var req models.CreateBuildingMediaRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error": "Request inválido"}`, http.StatusBadRequest)
		return
	}

	if req.URL == "" || req.Type == "" || req.Title == "" {
		http.Error(w, `{"error": "Campos url, type y title son requeridos"}`, http.StatusBadRequest)
		return
	}

	validTypes := map[string]bool{
		"photo": true, "video": true, "video360": true, "floorplan": true, "audio": true,
	}
	if !validTypes[req.Type] {
		http.Error(w, `{"error": "Tipo de medio inválido. Valores permitidos: photo, video, video360, floorplan, audio"}`, http.StatusBadRequest)
		return
	}

	var newID int
	err = database.DB.QueryRow(
		`INSERT INTO building_media (zone_id, floor, type, url, thumbnail, title, caption, sort_order)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		 RETURNING id`,
		zoneID, req.Floor, req.Type, req.URL, sql.NullString{String: req.Thumbnail, Valid: req.Thumbnail != ""},
		req.Title, sql.NullString{String: req.Caption, Valid: req.Caption != ""}, req.SortOrder,
	).Scan(&newID)
	if err != nil {
		log.Printf("Error al insertar building_media: %v", err)
		http.Error(w, "Error al crear el medio en la base de datos", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"id":      newID,
		"message": "Medio de edificio creado correctamente",
	})
}

// GetIndoorPOIsHandler devuelve todos los POIs interiores de una zona.
// GET /api/v1/zones/{id}/pois?floor=0
func GetIndoorPOIsHandler(w http.ResponseWriter, r *http.Request) {
	zoneIDStr := r.PathValue("id")
	zoneID, err := strconv.Atoi(zoneIDStr)
	if err != nil {
		http.Error(w, `{"error": "ID de zona inválido"}`, http.StatusBadRequest)
		return
	}

	query := `
		SELECT id, zone_id, floor, name, icon, lat, lng, COALESCE(description, ''), COALESCE(schedule, '')
		FROM indoor_pois
		WHERE zone_id = $1`
	args := []interface{}{zoneID}

	floorParam := r.URL.Query().Get("floor")
	if floorParam != "" {
		floor, err := strconv.Atoi(floorParam)
		if err != nil {
			http.Error(w, `{"error": "Parámetro floor inválido"}`, http.StatusBadRequest)
			return
		}
		query += " AND floor = $2"
		args = append(args, floor)
	}

	query += " ORDER BY name ASC"

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		log.Printf("Error al consultar indoor_pois para zona %d: %v", zoneID, err)
		http.Error(w, "Error interno del servidor", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	pois := []models.IndoorPOI{}
	for rows.Next() {
		var p models.IndoorPOI
		err := rows.Scan(
			&p.ID, &p.ZoneID, &p.Floor, &p.Name, &p.Icon,
			&p.Lat, &p.Lng, &p.Description, &p.Schedule,
		)
		if err != nil {
			log.Printf("Error al escanear indoor_poi: %v", err)
			continue
		}
		pois = append(pois, p)
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(pois); err != nil {
		log.Printf("Error al codificar respuesta de indoor_pois: %v", err)
	}
}

// CreateIndoorPOIHandler crea un nuevo punto de interés interior.
// POST /api/v1/zones/{id}/pois
func CreateIndoorPOIHandler(w http.ResponseWriter, r *http.Request) {
	zoneIDStr := r.PathValue("id")
	zoneID, err := strconv.Atoi(zoneIDStr)
	if err != nil {
		http.Error(w, `{"error": "ID de zona inválido"}`, http.StatusBadRequest)
		return
	}

	var req models.CreateIndoorPOIRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error": "Request inválido"}`, http.StatusBadRequest)
		return
	}

	if req.Name == "" || req.Icon == "" {
		http.Error(w, `{"error": "Campos name e icon son requeridos"}`, http.StatusBadRequest)
		return
	}

	var newID int
	err = database.DB.QueryRow(
		`INSERT INTO indoor_pois (zone_id, floor, name, icon, lat, lng, description, schedule)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		 RETURNING id`,
		zoneID, req.Floor, req.Name, req.Icon, req.Lat, req.Lng,
		sql.NullString{String: req.Description, Valid: req.Description != ""},
		sql.NullString{String: req.Schedule, Valid: req.Schedule != ""},
	).Scan(&newID)
	if err != nil {
		log.Printf("Error al insertar indoor_poi: %v", err)
		http.Error(w, "Error al crear el POI en la base de datos", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"id":      newID,
		"message": "Punto de interés interior creado correctamente",
	})
}
