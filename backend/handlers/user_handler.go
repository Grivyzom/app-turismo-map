package handlers

import (
	"backend/database"
	"backend/middleware"
	"backend/models"
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

func GetPublicProfileHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	targetIDStr := r.PathValue("id")
	targetID, err := strconv.Atoi(targetIDStr)
	if err != nil || targetID <= 0 {
		http.Error(w, `{"error":"Invalid user ID"}`, http.StatusBadRequest)
		return
	}

	if database.DB == nil {
		http.Error(w, `{"error":"Database unavailable"}`, http.StatusInternalServerError)
		return
	}

	var p models.PublicUserProfile
	var picture, bio sql.NullString
	err = database.DB.QueryRow(`
		SELECT u.id, u.name, u.picture, COALESCE(cp.bio, '')
		FROM users u
		LEFT JOIN citizen_profiles cp ON cp.user_id = u.id
		WHERE u.id = $1 AND u.status = 'active'`, targetID).Scan(
		&p.ID, &p.Name, &picture, &bio,
	)
	if err != nil {
		http.Error(w, `{"error":"User not found"}`, http.StatusNotFound)
		return
	}
	p.Picture = picture.String
	p.Bio = bio.String

	database.DB.QueryRow(
		`SELECT COUNT(*) FROM user_user_follows WHERE followed_id = $1`, targetID,
	).Scan(&p.FollowerCount)
	database.DB.QueryRow(
		`SELECT COUNT(*) FROM user_user_follows WHERE follower_id = $1`, targetID,
	).Scan(&p.FollowingCount)

	userClaims, ok := r.Context().Value(middleware.UserContextKey).(jwt.MapClaims)
	if ok {
		if requesterIDFloat, ok := userClaims["id"].(float64); ok {
			requesterID := int(requesterIDFloat)
			database.DB.QueryRow(
				`SELECT EXISTS(SELECT 1 FROM user_user_follows WHERE follower_id = $1 AND followed_id = $2)`,
				requesterID, targetID,
			).Scan(&p.IsFollowing)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(p)
}

func FollowUserHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	userClaims, ok := r.Context().Value(middleware.UserContextKey).(jwt.MapClaims)
	if !ok {
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}
	followerIDFloat, ok := userClaims["id"].(float64)
	if !ok {
		http.Error(w, `{"error":"Invalid token"}`, http.StatusUnauthorized)
		return
	}
	followerID := int(followerIDFloat)

	targetIDStr := r.PathValue("id")
	targetID, err := strconv.Atoi(targetIDStr)
	if err != nil || targetID <= 0 {
		http.Error(w, `{"error":"Invalid user ID"}`, http.StatusBadRequest)
		return
	}

	if followerID == targetID {
		http.Error(w, `{"error":"Cannot follow yourself"}`, http.StatusBadRequest)
		return
	}

	if database.DB == nil {
		http.Error(w, `{"error":"Database unavailable"}`, http.StatusInternalServerError)
		return
	}

	var exists bool
	database.DB.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM users WHERE id = $1 AND status = 'active')`, targetID,
	).Scan(&exists)
	if !exists {
		http.Error(w, `{"error":"User not found"}`, http.StatusNotFound)
		return
	}

	_, err = database.DB.Exec(
		`INSERT INTO user_user_follows (follower_id, followed_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		followerID, targetID,
	)
	if err != nil {
		http.Error(w, `{"error":"Database error"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":     true,
		"isFollowing": true,
	})
}

func UnfollowUserHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	userClaims, ok := r.Context().Value(middleware.UserContextKey).(jwt.MapClaims)
	if !ok {
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}
	followerIDFloat, ok := userClaims["id"].(float64)
	if !ok {
		http.Error(w, `{"error":"Invalid token"}`, http.StatusUnauthorized)
		return
	}
	followerID := int(followerIDFloat)

	targetIDStr := r.PathValue("id")
	targetID, err := strconv.Atoi(targetIDStr)
	if err != nil || targetID <= 0 {
		http.Error(w, `{"error":"Invalid user ID"}`, http.StatusBadRequest)
		return
	}

	if database.DB == nil {
		http.Error(w, `{"error":"Database unavailable"}`, http.StatusInternalServerError)
		return
	}

	_, err = database.DB.Exec(
		`DELETE FROM user_user_follows WHERE follower_id = $1 AND followed_id = $2`,
		followerID, targetID,
	)
	if err != nil {
		http.Error(w, `{"error":"Database error"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":     true,
		"isFollowing": false,
	})
}

func SearchUsersHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if len(q) < 2 {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode([]models.UserSearchResult{})
		return
	}

	if database.DB == nil {
		http.Error(w, `{"error":"Database unavailable"}`, http.StatusInternalServerError)
		return
	}

	var requesterID int
	userClaims, ok := r.Context().Value(middleware.UserContextKey).(jwt.MapClaims)
	if ok {
		if idFloat, ok := userClaims["id"].(float64); ok {
			requesterID = int(idFloat)
		}
	}

	rows, err := database.DB.Query(`
		SELECT u.id, u.name, COALESCE(u.picture, ''),
		       (SELECT COUNT(*) FROM user_user_follows WHERE followed_id = u.id) AS follower_count,
		       CASE WHEN $2 > 0 THEN EXISTS(
		           SELECT 1 FROM user_user_follows
		           WHERE follower_id = $2 AND followed_id = u.id
		       ) ELSE false END AS is_following
		FROM users u
		WHERE u.status = 'active'
		  AND u.user_type = 'citizen'
		  AND u.id != $2
		  AND u.name ILIKE '%' || $1 || '%'
		ORDER BY follower_count DESC, u.name ASC
		LIMIT 30`, q, requesterID)
	if err != nil {
		http.Error(w, `{"error":"Database error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	results := []models.UserSearchResult{}
	for rows.Next() {
		var item models.UserSearchResult
		if err := rows.Scan(&item.ID, &item.Name, &item.Picture, &item.FollowerCount, &item.IsFollowing); err != nil {
			continue
		}
		results = append(results, item)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}
