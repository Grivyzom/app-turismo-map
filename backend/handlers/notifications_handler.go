package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"backend/database"
	"backend/middleware"
	"backend/models"

	"github.com/golang-jwt/jwt/v5"
)

// GetNotificationsHandler obtiene las notificaciones del usuario autenticado.
func GetNotificationsHandler(w http.ResponseWriter, r *http.Request) {
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
		http.Error(w, `{"error": "Invalid user ID"}`, http.StatusUnauthorized)
		return
	}
	userID := int(userIDFloat)

	rows, err := database.DB.Query(`
		SELECT id, user_id, type, reference_id, title, message, is_read, created_at
		FROM user_notifications
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT 50`, userID)
	
	if err != nil {
		log.Printf("Error fetching notifications: %v\n", err)
		http.Error(w, `{"error": "Database error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var notifications []models.UserNotification
	for rows.Next() {
		var n models.UserNotification
		var createdAt time.Time
		if err := rows.Scan(&n.ID, &n.UserID, &n.Type, &n.ReferenceID, &n.Title, &n.Message, &n.IsRead, &createdAt); err != nil {
			log.Printf("Error scanning notification: %v\n", err)
			continue
		}
		n.CreatedAt = createdAt.Format(time.RFC3339)
		notifications = append(notifications, n)
	}

	// Si es null, enviar array vacío
	if notifications == nil {
		notifications = []models.UserNotification{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":       true,
		"notifications": notifications,
	})
}

// MarkNotificationReadHandler marca una notificación como leída.
func MarkNotificationReadHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
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

	notificationID := r.PathValue("id")
	if notificationID == "" {
		http.Error(w, `{"error": "Notification ID is required"}`, http.StatusBadRequest)
		return
	}

	res, err := database.DB.Exec(`
		UPDATE user_notifications
		SET is_read = true
		WHERE id = $1 AND user_id = $2`, notificationID, userID)
	
	if err != nil {
		log.Printf("Error updating notification: %v\n", err)
		http.Error(w, `{"error": "Database error"}`, http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, `{"error": "Notification not found or not owned by user"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Notification marked as read",
	})
}
