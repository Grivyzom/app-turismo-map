package handlers

import (
	"backend/database"
	"backend/middleware"
	"backend/models"
	"encoding/json"
	"log"
	"net/http"

	"github.com/golang-jwt/jwt/v5"
)

func GetPreferencesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	userClaims, ok := r.Context().Value(middleware.UserContextKey).(jwt.MapClaims)
	if !ok {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(models.AuthResponse{
			Success: false,
			Message: "No autorizado",
		})
		return
	}

	userIDFloat, ok := userClaims["id"].(float64)
	if !ok {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(models.AuthResponse{
			Success: false,
			Message: "ID de usuario inválido en token",
		})
		return
	}
	userID := int(userIDFloat)

	if database.DB == nil {
		http.Error(w, "Base de datos no disponible", http.StatusInternalServerError)
		return
	}

	var preferencesJSON []byte
	err := database.DB.QueryRow("SELECT preferences FROM citizen_profiles WHERE user_id = $1", userID).Scan(&preferencesJSON)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if len(preferencesJSON) == 0 {
		w.Write([]byte("{}"))
	} else {
		w.Write(preferencesJSON)
	}
}

func UpdatePreferencesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch && r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	userClaims, ok := r.Context().Value(middleware.UserContextKey).(jwt.MapClaims)
	if !ok {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(models.AuthResponse{
			Success: false,
			Message: "No autorizado",
		})
		return
	}

	userIDFloat, ok := userClaims["id"].(float64)
	if !ok {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(models.AuthResponse{
			Success: false,
			Message: "ID de usuario inválido en token",
		})
		return
	}
	userID := int(userIDFloat)

	var req models.PreferencesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(models.AuthResponse{
			Success: false,
			Message: "Request de preferencias inválido",
		})
		return
	}

	if database.DB == nil {
		http.Error(w, "Base de datos no disponible", http.StatusInternalServerError)
		return
	}

	// Recuperar preferencias existentes del usuario para realizar fusión no destructiva
	var existingJSON []byte
	err := database.DB.QueryRow("SELECT preferences FROM citizen_profiles WHERE user_id = $1", userID).Scan(&existingJSON)
	if err == nil && len(existingJSON) > 0 {
		var mergedPreferences map[string]interface{}
		if err := json.Unmarshal(existingJSON, &mergedPreferences); err == nil {
			for k, v := range req {
				mergedPreferences[k] = v
			}
			req = mergedPreferences
		}
	}

	preferencesJSON, err := json.Marshal(req)
	if err != nil {
		log.Printf("Error serializando preferencias: %v\n", err)
		http.Error(w, "Error procesando preferencias", http.StatusInternalServerError)
		return
	}

	_, err = database.DB.Exec(
		`INSERT INTO citizen_profiles (user_id, preferences) 
		 VALUES ($1, $2)
		 ON CONFLICT (user_id) 
		 DO UPDATE SET preferences = EXCLUDED.preferences`,
		userID, string(preferencesJSON),
	)

	if err != nil {
		log.Printf("Error guardando preferencias del usuario %d: %v\n", userID, err)
		http.Error(w, "Error en la base de datos", http.StatusInternalServerError)
		return
	}

	log.Printf("Preferencias del usuario %d actualizadas correctamente\n", userID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}{
		Success: true,
		Message: "Preferencias actualizadas correctamente",
	})
}


func UpdateViewModeHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	userClaims, ok := r.Context().Value(middleware.UserContextKey).(jwt.MapClaims)
	if !ok {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(models.AuthResponse{
			Success: false,
			Message: "No autorizado",
		})
		return
	}

	userIDFloat, ok := userClaims["id"].(float64)
	if !ok {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(models.AuthResponse{
			Success: false,
			Message: "ID de usuario inválido en token",
		})
		return
	}
	userID := int(userIDFloat)

	var req struct {
		ViewMode string `json:"viewMode"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(models.AuthResponse{
			Success: false,
			Message: "Request inválido",
		})
		return
	}

	if req.ViewMode != "local" && req.ViewMode != "tourist" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(models.AuthResponse{
			Success: false,
			Message: "Modo de vista inválido (debe ser 'local' o 'tourist')",
		})
		return
	}

	if database.DB == nil {
		http.Error(w, "Base de datos no disponible", http.StatusInternalServerError)
		return
	}

	_, err := database.DB.Exec(
		`INSERT INTO citizen_profiles (user_id, current_view_mode) 
		 VALUES ($1, $2)
		 ON CONFLICT (user_id) 
		 DO UPDATE SET current_view_mode = EXCLUDED.current_view_mode`,
		userID, req.ViewMode,
	)

	if err != nil {
		log.Printf("Error guardando view_mode del usuario %d: %v\n", userID, err)
		http.Error(w, "Error en la base de datos", http.StatusInternalServerError)
		return
	}

	log.Printf("Modo de vista del usuario %d actualizado a %s\n", userID, req.ViewMode)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}{
		Success: true,
		Message: "Modo de vista actualizado correctamente",
	})
}

