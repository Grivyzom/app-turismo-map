package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"backend/database"
	"backend/models"

	"github.com/lib/pq"
)

// GetZonesHandler devuelve todas las zonas delimitadas en formato GeoJSON adaptado.
// GET /api/v1/zones
func GetZonesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	zoneIdParam := r.URL.Query().Get("zoneId")

	var query string
	var args []interface{}

	if zoneIdParam != "" {
		query = `
			SELECT 
				z.id, 
				z.name, 
				COALESCE(z.description, ''), 
				COALESCE(z.category, 'Sector'), 
				COALESCE(z.color, '#10B981'),
				z.is_active,
				ST_AsGeoJSON(z.geom)::jsonb as geojson,
				COALESCE((SELECT COUNT(*) FROM events e WHERE z.id = ANY(e.containing_zone_ids)), 0) as events_count,
				z.rating,
				COALESCE(z.images, '{}'),
				COALESCE(z.opening_hours, ''),
				COALESCE(z.park_type, '')
			FROM zones z
			WHERE z.is_active = true
			AND z.id != $1
			AND EXISTS (
				SELECT 1 FROM zones parent
				WHERE parent.id = $1
				AND ST_Covers(parent.geom, z.geom)
			)
		`
		args = append(args, zoneIdParam)
	} else {
		query = `
			SELECT
				z.id,
				z.name,
				COALESCE(z.description, ''),
				COALESCE(z.category, 'Sector'),
				COALESCE(z.color, '#10B981'),
				z.is_active,
				ST_AsGeoJSON(z.geom)::jsonb as geojson,
				COALESCE((SELECT COUNT(*) FROM events e WHERE z.id = ANY(e.containing_zone_ids)), 0) as events_count,
				z.rating,
				COALESCE(z.images, '{}'),
				COALESCE(z.opening_hours, ''),
				COALESCE(z.park_type, '')
			FROM zones z
			WHERE z.is_active = true
			AND NOT EXISTS (
				SELECT 1 FROM zones parent 
				WHERE parent.category IN ('edificio', 'reserva')
				AND parent.id != z.id 
				AND ST_Covers(parent.geom, z.geom)
			)
		`
	}

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		log.Printf("Error al consultar zonas: %v", err)
		http.Error(w, "Error interno del servidor", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	zones := []models.Zone{}
	for rows.Next() {
		var z models.Zone
		err := rows.Scan(
			&z.ID,
			&z.Name,
			&z.Description,
			&z.Category,
			&z.Color,
			&z.IsActive,
			&z.GeoJSON,
			&z.EventsCount,
			&z.Rating,
			pq.Array(&z.Images),
			&z.OpeningHours,
			&z.ParkType,
		)
		if err != nil {
			log.Printf("Error al escanear zona: %v", err)
			continue
		}
		zones = append(zones, z)
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(zones); err != nil {
		log.Printf("Error al codificar respuesta de zonas: %v", err)
	}
}

// AdminListZonesHandler devuelve todas las zonas con detalles extendidos para el panel.
func AdminListZonesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	query := `
		SELECT
			z.id,
			z.name,
			COALESCE(z.description, ''),
			COALESCE(z.category, 'Sector'),
			COALESCE(z.color, '#10B981'),
			z.is_active,
			ST_AsGeoJSON(z.geom)::jsonb as geojson,
			COALESCE((SELECT COUNT(*) FROM events e WHERE z.id = ANY(e.containing_zone_ids)), 0) as events_count,
			z.rating,
			COALESCE(z.images, '{}'),
			COALESCE(z.opening_hours, ''),
			COALESCE(z.park_type, '')
		FROM zones z
		ORDER BY z.id ASC;
	`

	rows, err := database.DB.Query(query)
	if err != nil {
		log.Printf("Error al consultar zonas para admin: %v", err)
		http.Error(w, "Error interno", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	zones := []models.Zone{}
	for rows.Next() {
		var z models.Zone
		err := rows.Scan(
			&z.ID, &z.Name, &z.Description, &z.Category, &z.Color, &z.IsActive, &z.GeoJSON, &z.EventsCount,
			&z.Rating, pq.Array(&z.Images), &z.OpeningHours, &z.ParkType,
		)
		if err != nil {
			continue
		}
		zones = append(zones, z)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"zones":   zones,
	})
}

type ToggleZoneRequest struct {
	ZoneID   int  `json:"zoneId"`
	IsActive bool `json:"isActive"`
}

// AdminToggleZoneHandler activa o desactiva una zona (Sector).
func AdminToggleZoneHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	var req ToggleZoneRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Request inválido", http.StatusBadRequest)
		return
	}

	_, err := database.DB.Exec(
		"UPDATE zones SET is_active = $1 WHERE id = $2",
		req.IsActive, req.ZoneID,
	)
	if err != nil {
		log.Printf("Error al togglear zona %d: %v", req.ZoneID, err)
		http.Error(w, "Error al actualizar base de datos", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Estado de la zona actualizado correctamente",
	})
}

type CreateZoneRequest struct {
	Name         string              `json:"name"`
	Description  string              `json:"description,omitempty"`
	Category     string              `json:"category,omitempty"`
	Color        string              `json:"color,omitempty"`
	Points       []models.RoutePoint `json:"points,omitempty"`
	GeoJSON      interface{}         `json:"geojson,omitempty"`
	Rating       *float64            `json:"rating,omitempty"`
	Images       []string            `json:"images,omitempty"`
	OpeningHours string              `json:"openingHours,omitempty"`
	ParkType     string              `json:"parkType,omitempty"`
}

// CreateZoneHandler crea un nuevo sector (zona) en la base de datos a partir de puntos
// POST /api/v1/zones
func CreateZoneHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	var req CreateZoneRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Request inválido", http.StatusBadRequest)
		return
	}

	if req.Category == "" {
		req.Category = "Sector"
	}
	if req.Color == "" {
		req.Color = "#EC4899"
	}

	var newID int
	var err error

	if req.GeoJSON != nil {
		geoJSONBytes, errJSON := json.Marshal(req.GeoJSON)
		if errJSON != nil {
			http.Error(w, "GeoJSON inválido", http.StatusBadRequest)
			return
		}
		err = database.DB.QueryRow(
			`INSERT INTO zones (name, description, category, color, is_active, geom, rating, images, opening_hours, park_type)
			 VALUES ($1, $2, $3, $4, true, ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($5), 4326)), $6, $7, $8, $9) RETURNING id`,
			req.Name, req.Description, req.Category, req.Color, string(geoJSONBytes),
			req.Rating, pq.Array(req.Images), req.OpeningHours, req.ParkType,
		).Scan(&newID)
	} else {
		if len(req.Points) < 3 {
			http.Error(w, "Se requieren al menos 3 puntos o un GeoJSON válido para un polígono", http.StatusBadRequest)
			return
		}

		// Asegurarse de que el polígono esté cerrado
		first := req.Points[0]
		last := req.Points[len(req.Points)-1]
		if first.Latitude != last.Latitude || first.Longitude != last.Longitude {
			req.Points = append(req.Points, first)
		}

		polygonWKT := "POLYGON(("
		for i, p := range req.Points {
			if i > 0 {
				polygonWKT += ", "
			}
			polygonWKT += fmt.Sprintf("%f %f", p.Longitude, p.Latitude)
		}
		polygonWKT += "))"

		err = database.DB.QueryRow(
			`INSERT INTO zones (name, description, category, color, is_active, geom, rating, images, opening_hours, park_type)
			 VALUES ($1, $2, $3, $4, true, ST_Multi(ST_GeomFromText($5, 4326)), $6, $7, $8, $9) RETURNING id`,
			req.Name, req.Description, req.Category, req.Color, polygonWKT,
			req.Rating, pq.Array(req.Images), req.OpeningHours, req.ParkType,
		).Scan(&newID)
	}

	if err != nil {
		log.Printf("Error al crear zona: %v", err)
		http.Error(w, "Error al crear la zona en la base de datos", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"id":      newID,
		"message": "Zona (sector) creada correctamente",
	})
}

