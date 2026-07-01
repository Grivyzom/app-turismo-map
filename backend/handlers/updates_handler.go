package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"backend/database"
	"backend/middleware"
	"backend/models"

	"github.com/golang-jwt/jwt/v5"
)

// CreateBranchUpdateHandler permite a un negocio publicar una nueva novedad (ej: ¡Sale pan caliente!).
func CreateBranchUpdateHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error": "Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	userClaims, ok := r.Context().Value(middleware.UserContextKey).(jwt.MapClaims)
	if !ok {
		http.Error(w, `{"error": "Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	userIDFloat, ok := userClaims["id"].(float64)
	if !ok {
		http.Error(w, `{"error": "Invalid user ID"}`, http.StatusUnauthorized)
		return
	}
	userID := int(userIDFloat)

	// Verificar a qué empresa pertenece
	var companyID int
	err := database.DB.QueryRow("SELECT company_id FROM company_members WHERE user_id = $1 LIMIT 1", userID).Scan(&companyID)
	if err == sql.ErrNoRows {
		http.Error(w, `{"error": "User does not belong to any company"}`, http.StatusForbidden)
		return
	} else if err != nil {
		log.Printf("Error checking company membership: %v\n", err)
		http.Error(w, `{"error": "Database error"}`, http.StatusInternalServerError)
		return
	}

	var req models.CreateBranchUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error": "Invalid payload"}`, http.StatusBadRequest)
		return
	}

	if req.Title == "" {
		http.Error(w, `{"error": "Title is required"}`, http.StatusBadRequest)
		return
	}

	expiresIn := req.ExpiresIn
	if expiresIn <= 0 {
		expiresIn = 24 // 24 horas por defecto
	}

	// Obtener la primera sucursal para publicarlo allí (podría mejorarse permitiendo elegir sucursal)
	var branchID int
	err = database.DB.QueryRow("SELECT id FROM company_branches WHERE company_id = $1 ORDER BY id ASC LIMIT 1", companyID).Scan(&branchID)
	if err == sql.ErrNoRows {
		http.Error(w, `{"error": "Company has no branches configured"}`, http.StatusBadRequest)
		return
	} else if err != nil {
		http.Error(w, `{"error": "Database error"}`, http.StatusInternalServerError)
		return
	}

	expiresAt := time.Now().Add(time.Duration(expiresIn) * time.Hour)

	// Insertar la novedad. El trigger de la BD automáticamente generará notificaciones a los seguidores.
	var updateID int
	err = database.DB.QueryRow(`
		INSERT INTO branch_updates (branch_id, title, description, expires_at)
		VALUES ($1, $2, $3, $4)
		RETURNING id`, branchID, req.Title, req.Description, expiresAt).Scan(&updateID)

	if err != nil {
		log.Printf("Error creating branch update: %v\n", err)
		http.Error(w, `{"error": "Error creating update"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Novedad publicada correctamente",
		"data": map[string]interface{}{
			"id":        updateID,
			"expiresAt": expiresAt,
		},
	})
}

// GetBranchUpdatesHandler obtiene las novedades activas de una sucursal.
func GetBranchUpdatesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error": "Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	branchIDStr := r.PathValue("id")
	if branchIDStr == "" {
		http.Error(w, `{"error": "Branch ID is required"}`, http.StatusBadRequest)
		return
	}

	rows, err := database.DB.Query(`
		SELECT id, branch_id, title, COALESCE(description, ''), is_active, expires_at, created_at
		FROM branch_updates
		WHERE branch_id = $1 AND is_active = true AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
		ORDER BY created_at DESC`, branchIDStr)
	
	if err != nil {
		log.Printf("Error fetching branch updates: %v\n", err)
		http.Error(w, `{"error": "Database error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var updates []models.BranchUpdate
	for rows.Next() {
		var u models.BranchUpdate
		var expiresAt sql.NullTime
		if err := rows.Scan(&u.ID, &u.BranchID, &u.Title, &u.Description, &u.IsActive, &expiresAt, &u.CreatedAt); err != nil {
			log.Printf("Error scanning branch update: %v\n", err)
			continue
		}
		if expiresAt.Valid {
			u.ExpiresAt = expiresAt.Time.Format(time.RFC3339)
		}
		updates = append(updates, u)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"updates": updates,
	})
}
