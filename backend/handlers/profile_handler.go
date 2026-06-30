package handlers

import (
	"backend/database"
	"backend/middleware"
	"backend/models"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func GetMyProfileHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	userClaims, ok := r.Context().Value(middleware.UserContextKey).(jwt.MapClaims)
	if !ok {
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}
	userIDFloat, ok := userClaims["id"].(float64)
	if !ok {
		http.Error(w, `{"error":"Invalid token"}`, http.StatusUnauthorized)
		return
	}
	userID := int(userIDFloat)

	if database.DB == nil {
		http.Error(w, `{"error":"Database unavailable"}`, http.StatusInternalServerError)
		return
	}

	var p models.MyProfile
	var picture, bio sql.NullString
	err := database.DB.QueryRow(`
		SELECT u.id, u.name, u.email, u.picture, u.user_type,
		       COALESCE(cp.bio, '')
		FROM users u
		LEFT JOIN citizen_profiles cp ON cp.user_id = u.id
		WHERE u.id = $1`, userID).Scan(
		&p.ID, &p.Name, &p.Email, &picture, &p.UserType, &bio,
	)
	if err != nil {
		http.Error(w, `{"error":"User not found"}`, http.StatusNotFound)
		return
	}
	p.Picture = picture.String
	p.Bio = bio.String

	database.DB.QueryRow(
		`SELECT COUNT(*) FROM user_user_follows WHERE followed_id = $1`, userID,
	).Scan(&p.FollowerCount)
	database.DB.QueryRow(
		`SELECT COUNT(*) FROM user_user_follows WHERE follower_id = $1`, userID,
	).Scan(&p.FollowingCount)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(p)
}

func UpdateProfileHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	userClaims, ok := r.Context().Value(middleware.UserContextKey).(jwt.MapClaims)
	if !ok {
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}
	userIDFloat, ok := userClaims["id"].(float64)
	if !ok {
		http.Error(w, `{"error":"Invalid token"}`, http.StatusUnauthorized)
		return
	}
	userID := int(userIDFloat)

	var req models.UpdateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		http.Error(w, `{"error":"Name is required"}`, http.StatusBadRequest)
		return
	}
	if len([]rune(req.Bio)) > 160 {
		req.Bio = string([]rune(req.Bio)[:160])
	}

	if database.DB == nil {
		http.Error(w, `{"error":"Database unavailable"}`, http.StatusInternalServerError)
		return
	}

	_, err := database.DB.Exec(`UPDATE users SET name = $1 WHERE id = $2`, req.Name, userID)
	if err != nil {
		log.Printf("[profile] Error updating name for user %d: %v", userID, err)
		http.Error(w, `{"error":"Database error"}`, http.StatusInternalServerError)
		return
	}

	_, err = database.DB.Exec(`
		INSERT INTO citizen_profiles (user_id, bio)
		VALUES ($1, $2)
		ON CONFLICT (user_id) DO UPDATE SET bio = EXCLUDED.bio`,
		userID, req.Bio,
	)
	if err != nil {
		log.Printf("[profile] Error updating bio for user %d: %v", userID, err)
		http.Error(w, `{"error":"Database error"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Perfil actualizado correctamente",
	})
}

func UploadAvatarHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	userClaims, ok := r.Context().Value(middleware.UserContextKey).(jwt.MapClaims)
	if !ok {
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}
	userIDFloat, ok := userClaims["id"].(float64)
	if !ok {
		http.Error(w, `{"error":"Invalid token"}`, http.StatusUnauthorized)
		return
	}
	userID := int(userIDFloat)

	const maxSize = 5 << 20 // 5 MB
	if err := r.ParseMultipartForm(maxSize); err != nil {
		http.Error(w, `{"error":"Imagen demasiado grande (máximo 5 MB)"}`, http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("avatar")
	if err != nil {
		http.Error(w, `{"error":"Falta el archivo de imagen"}`, http.StatusBadRequest)
		return
	}
	defer file.Close()

	if header.Size > maxSize {
		http.Error(w, `{"error":"Imagen demasiado grande (máximo 5 MB)"}`, http.StatusBadRequest)
		return
	}

	contentType := header.Header.Get("Content-Type")
	validTypes := map[string]string{
		"image/jpeg": ".jpg",
		"image/jpg":  ".jpg",
		"image/png":  ".png",
		"image/webp": ".webp",
		"image/gif":  ".gif",
	}
	ext, ok := validTypes[contentType]
	if !ok {
		http.Error(w, `{"error":"Tipo de archivo no permitido. Solo JPEG, PNG, WebP o GIF"}`, http.StatusBadRequest)
		return
	}

	// Leer bytes en memoria para poder pasarlos a la moderación antes de guardar
	imageBytes, err := io.ReadAll(file)
	if err != nil {
		log.Printf("[profile] Error leyendo bytes del avatar: %v", err)
		http.Error(w, `{"error":"Error al leer la imagen"}`, http.StatusInternalServerError)
		return
	}

	// Moderación de contenido — Google Cloud Vision SafeSearch
	safe, reason := checkAvatarSafety(imageBytes, contentType)
	if !safe {
		log.Printf("[profile] Avatar rechazado para usuario %d: %v", userID, reason)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnprocessableEntity)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error": "La imagen contiene contenido inapropiado y no puede ser usada como foto de perfil.",
		})
		return
	}

	filename := fmt.Sprintf("%d_%d%s", userID, time.Now().Unix(), ext)
	savePath := filepath.Join("uploads", "avatars", filename)

	if err := os.WriteFile(savePath, imageBytes, 0644); err != nil {
		log.Printf("[profile] Error guardando avatar: %v", err)
		http.Error(w, `{"error":"Error al guardar la imagen"}`, http.StatusInternalServerError)
		return
	}

	pictureURL := fmt.Sprintf("/static/avatars/%s", filename)

	if database.DB != nil {
		_, err = database.DB.Exec(`UPDATE users SET picture = $1 WHERE id = $2`, pictureURL, userID)
		if err != nil {
			log.Printf("[profile] Error actualizando picture para usuario %d: %v", userID, err)
			// Borrar archivo huérfano
			os.Remove(savePath)
			http.Error(w, `{"error":"Database error"}`, http.StatusInternalServerError)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":    true,
		"pictureUrl": pictureURL,
	})
}
