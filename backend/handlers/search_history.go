package handlers

import (
	"backend/database"
	"encoding/json"
	"log"
	"net/http"
)

type SearchHistoryPayload struct {
	Query    string `json:"query"`
	Category string `json:"category"`
}

func SaveSearchHistoryHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	// Obtener ID del usuario desde el middleware AuthMiddleware
	userIDVal := r.Context().Value("userID")
	if userIDVal == nil {
		http.Error(w, "No autorizado", http.StatusUnauthorized)
		return
	}
	userID := userIDVal.(float64)

	var payload SearchHistoryPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Error al procesar la solicitud", http.StatusBadRequest)
		return
	}

	// Aquí insertamos el registro en la base de datos de historial de búsqueda
	query := `
		CREATE TABLE IF NOT EXISTS user_search_history (
			id SERIAL PRIMARY KEY,
			user_id INTEGER NOT NULL,
			query TEXT NOT NULL,
			category TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);
	`
	_, err := database.DB.Exec(query)
	if err != nil {
		log.Printf("Error al verificar/crear tabla user_search_history: %v\n", err)
	}

	insertQuery := `
		INSERT INTO user_search_history (user_id, query, category) 
		VALUES ($1, $2, $3)
	`
	_, err = database.DB.Exec(insertQuery, int(userID), payload.Query, payload.Category)
	if err != nil {
		log.Printf("Error al guardar historial de búsqueda: %v\n", err)
		http.Error(w, "Error al guardar el historial", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Historial guardado"})
}
