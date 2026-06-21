package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"backend/database"
	"backend/middleware"
	"backend/models"

	"github.com/golang-jwt/jwt/v5"
)

// CreateCollectionHandler maneja la creación de una nueva colección.
func CreateCollectionHandler(w http.ResponseWriter, r *http.Request) {
	// Extraemos el user_id del contexto (agregado por auth_middleware)
	userClaims, ok := r.Context().Value(middleware.UserContextKey).(jwt.MapClaims)
	if !ok {
		http.Error(w, `{"error": "Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	userIDFloat, ok := userClaims["id"].(float64)
	if !ok {
		http.Error(w, `{"error": "Invalid user ID format in token"}`, http.StatusUnauthorized)
		return
	}
	userID := int(userIDFloat)

	var req models.CreateCollectionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error": "Invalid request"}`, http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		http.Error(w, `{"error": "Name is required"}`, http.StatusBadRequest)
		return
	}

	visibility := "private"
	if req.Visibility == "public" {
		visibility = "public"
	}

	query := `
		INSERT INTO collections (user_id, name, description, visibility, created_at, updated_at) 
		VALUES ($1, $2, $3, $4, $5, $6) 
		RETURNING id, created_at, updated_at`
	
	now := time.Now()
	
	var col models.Collection
	err := database.DB.QueryRow(query, userID, req.Name, req.Description, visibility, now, now).Scan(&col.ID, &col.CreatedAt, &col.UpdatedAt)
	if err != nil {
		http.Error(w, `{"error": "Database error"}`, http.StatusInternalServerError)
		return
	}

	col.UserID = userID
	col.Name = req.Name
	col.Description = req.Description
	col.Visibility = visibility

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(col)
}

// GetCollectionsHandler obtiene las colecciones del usuario autenticado.
func GetCollectionsHandler(w http.ResponseWriter, r *http.Request) {
	userClaims, ok := r.Context().Value(middleware.UserContextKey).(jwt.MapClaims)
	if !ok {
		http.Error(w, `{"error": "Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	userIDFloat, ok := userClaims["id"].(float64)
	if !ok {
		http.Error(w, `{"error": "Invalid user ID format in token"}`, http.StatusUnauthorized)
		return
	}
	userID := int(userIDFloat)

	query := `
		SELECT c.id, c.user_id, c.name, c.description, c.visibility, c.created_at, c.updated_at,
		       COUNT(s.id) as item_count
		FROM collections c
		LEFT JOIN saved_locations s ON c.id = s.collection_id
		WHERE c.user_id = $1
		GROUP BY c.id
		ORDER BY c.created_at DESC`
	
	rows, err := database.DB.Query(query, userID)
	if err != nil {
		http.Error(w, `{"error": "Database error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var collections []models.Collection
	for rows.Next() {
		var col models.Collection
		var desc sqlNullString
		var created, updated time.Time
		var itemCount int

		if err := rows.Scan(&col.ID, &col.UserID, &col.Name, &desc, &col.Visibility, &created, &updated, &itemCount); err != nil {
			continue
		}
		col.Description = desc.String
		col.CreatedAt = created.Format(time.RFC3339)
		col.UpdatedAt = updated.Format(time.RFC3339)
		col.ItemCount = itemCount
		collections = append(collections, col)
	}

	if collections == nil {
		collections = []models.Collection{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(collections)
}

// Helper para escanear descripciones nulas
type sqlNullString struct {
	String string
	Valid  bool
}
func (ns *sqlNullString) Scan(value interface{}) error {
	if value == nil {
		ns.String, ns.Valid = "", false
		return nil
	}
	ns.Valid = true
	switch v := value.(type) {
	case string:
		ns.String = v
	case []byte:
		ns.String = string(v)
	}
	return nil
}

// SaveLocationHandler guarda una ubicación en una colección específica.
func SaveLocationHandler(w http.ResponseWriter, r *http.Request) {
	userClaims, ok := r.Context().Value(middleware.UserContextKey).(jwt.MapClaims)
	if !ok {
		http.Error(w, `{"error": "Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	userIDFloat, ok := userClaims["id"].(float64)
	if !ok {
		http.Error(w, `{"error": "Invalid user ID format in token"}`, http.StatusUnauthorized)
		return
	}
	userID := int(userIDFloat)

	var req models.SaveLocationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error": "Invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.CollectionID == 0 || req.LocationType == "" || req.Title == "" {
		http.Error(w, `{"error": "collectionId, locationType and title are required"}`, http.StatusBadRequest)
		return
	}

	// Verificar que la colección pertenezca al usuario
	var ownerID int
	err := database.DB.QueryRow("SELECT user_id FROM collections WHERE id = $1", req.CollectionID).Scan(&ownerID)
	if err != nil {
		http.Error(w, `{"error": "Collection not found"}`, http.StatusNotFound)
		return
	}
	if ownerID != userID {
		http.Error(w, `{"error": "Forbidden: You don't own this collection"}`, http.StatusForbidden)
		return
	}

	query := `
		INSERT INTO saved_locations (collection_id, location_type, ref_id, latitude, longitude, title, notes, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at`
	
	now := time.Now()
	var loc models.SavedLocation
	err = database.DB.QueryRow(query, req.CollectionID, req.LocationType, req.RefID, req.Latitude, req.Longitude, req.Title, req.Notes, now).Scan(&loc.ID, &loc.CreatedAt)
	if err != nil {
		http.Error(w, `{"error": "Database error while saving location"}`, http.StatusInternalServerError)
		return
	}

	loc.CollectionID = req.CollectionID
	loc.LocationType = req.LocationType
	loc.RefID = req.RefID
	loc.Latitude = req.Latitude
	loc.Longitude = req.Longitude
	loc.Title = req.Title
	loc.Notes = req.Notes

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(loc)
}

// GetSavedLocationsHandler obtiene las ubicaciones guardadas en una colección.
func GetSavedLocationsHandler(w http.ResponseWriter, r *http.Request) {
	userClaims, ok := r.Context().Value(middleware.UserContextKey).(jwt.MapClaims)
	if !ok {
		http.Error(w, `{"error": "Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	userIDFloat, ok := userClaims["id"].(float64)
	if !ok {
		http.Error(w, `{"error": "Invalid user ID format in token"}`, http.StatusUnauthorized)
		return
	}
	userID := int(userIDFloat)

	collectionIDStr := r.PathValue("id")
	collectionID, err := strconv.Atoi(collectionIDStr)
	if err != nil {
		http.Error(w, `{"error": "Invalid collection ID"}`, http.StatusBadRequest)
		return
	}

	// Verificar propiedad
	var ownerID int
	err = database.DB.QueryRow("SELECT user_id FROM collections WHERE id = $1", collectionID).Scan(&ownerID)
	if err != nil {
		http.Error(w, `{"error": "Collection not found"}`, http.StatusNotFound)
		return
	}
	if ownerID != userID {
		http.Error(w, `{"error": "Forbidden: You don't own this collection"}`, http.StatusForbidden)
		return
	}

	query := `
		SELECT id, collection_id, location_type, ref_id, latitude, longitude, title, notes, created_at
		FROM saved_locations
		WHERE collection_id = $1
		ORDER BY created_at DESC`
	
	rows, err := database.DB.Query(query, collectionID)
	if err != nil {
		http.Error(w, `{"error": "Database error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var locations []models.SavedLocation
	for rows.Next() {
		var loc models.SavedLocation
		var refID, notes sqlNullString
		var created time.Time

		if err := rows.Scan(&loc.ID, &loc.CollectionID, &loc.LocationType, &refID, &loc.Latitude, &loc.Longitude, &loc.Title, &notes, &created); err != nil {
			continue
		}
		loc.RefID = refID.String
		loc.Notes = notes.String
		loc.CreatedAt = created.Format(time.RFC3339)
		locations = append(locations, loc)
	}

	if locations == nil {
		locations = []models.SavedLocation{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(locations)
}
