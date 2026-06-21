package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"backend/database"
	"backend/middleware"

	"github.com/golang-jwt/jwt/v5"
)

type FollowRequest struct {
	CompanyID int `json:"companyId"`
}

func FollowCompanyHandler(w http.ResponseWriter, r *http.Request) {
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
		http.Error(w, `{"error": "Invalid user ID format in token"}`, http.StatusUnauthorized)
		return
	}
	userID := int(userIDFloat)

	var req FollowRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error": "Invalid request"}`, http.StatusBadRequest)
		return
	}

	if req.CompanyID <= 0 {
		http.Error(w, `{"error": "Company ID is required"}`, http.StatusBadRequest)
		return
	}

	// Verify if the company exists
	var exists bool
	err := database.DB.QueryRow("SELECT EXISTS(SELECT 1 FROM companies WHERE id = $1)", req.CompanyID).Scan(&exists)
	if err != nil {
		http.Error(w, `{"error": "Database error"}`, http.StatusInternalServerError)
		return
	}
	if !exists {
		http.Error(w, `{"error": "Company not found"}`, http.StatusNotFound)
		return
	}

	// Insert follow
	_, err = database.DB.Exec("INSERT INTO user_follows (user_id, company_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", userID, req.CompanyID)
	if err != nil {
		http.Error(w, `{"error": "Database error"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Successfully followed company",
	})
}

func UnfollowCompanyHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
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
		http.Error(w, `{"error": "Invalid user ID format in token"}`, http.StatusUnauthorized)
		return
	}
	userID := int(userIDFloat)

	companyIDStr := r.PathValue("id")
	if companyIDStr == "" {
		http.Error(w, `{"error": "Company ID is required"}`, http.StatusBadRequest)
		return
	}

	companyID, err := strconv.Atoi(companyIDStr)
	if err != nil {
		http.Error(w, `{"error": "Invalid company ID"}`, http.StatusBadRequest)
		return
	}

	_, err = database.DB.Exec("DELETE FROM user_follows WHERE user_id = $1 AND company_id = $2", userID, companyID)
	if err != nil {
		http.Error(w, `{"error": "Database error"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Successfully unfollowed company",
	})
}

func ListFollowedCompaniesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
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
		http.Error(w, `{"error": "Invalid user ID format in token"}`, http.StatusUnauthorized)
		return
	}
	userID := int(userIDFloat)

	rows, err := database.DB.Query(`
		SELECT c.id, c.business_name, c.entity_type, COALESCE(c.category, ''), c.is_verified_badge, COALESCE(c.phone, '')
		FROM companies c
		JOIN user_follows uf ON c.id = uf.company_id
		WHERE uf.user_id = $1
		ORDER BY uf.created_at DESC`, userID)
	if err != nil {
		http.Error(w, `{"error": "Database error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type CompanyItem struct {
		ID              int    `json:"id"`
		BusinessName    string `json:"businessName"`
		EntityType      string `json:"entityType"`
		Category        string `json:"category"`
		IsVerifiedBadge bool   `json:"isVerifiedBadge"`
		Phone           string `json:"phone"`
	}

	items := []CompanyItem{}
	for rows.Next() {
		var c CompanyItem
		if err := rows.Scan(&c.ID, &c.BusinessName, &c.EntityType, &c.Category, &c.IsVerifiedBadge, &c.Phone); err != nil {
			continue
		}
		items = append(items, c)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":   true,
		"companies": items,
	})
}
