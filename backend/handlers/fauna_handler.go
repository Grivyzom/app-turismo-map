package handlers

import (
	"backend/database"
	"encoding/json"
	"net/http"
)

type FaunaType struct {
	ID        int    `json:"id"`
	Name      string `json:"name"`
	CreatedAt string `json:"createdAt"`
}

func GetFaunaTypesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	rows, err := database.DB.Query("SELECT id, name, created_at FROM fauna_types ORDER BY name ASC")
	if err != nil {
		http.Error(w, "Error al obtener tipos de fauna", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var types []FaunaType
	for rows.Next() {
		var t FaunaType
		if err := rows.Scan(&t.ID, &t.Name, &t.CreatedAt); err == nil {
			types = append(types, t)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(types)
}

type CreateFaunaTypeRequest struct {
	Name string `json:"name"`
}

func CreateFaunaTypeHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	var req CreateFaunaTypeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Cuerpo inválido", http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		http.Error(w, "El nombre es obligatorio", http.StatusBadRequest)
		return
	}

	var newID int
	err := database.DB.QueryRow("INSERT INTO fauna_types (name) VALUES ($1) RETURNING id", req.Name).Scan(&newID)
	if err != nil {
		// Possibly conflict
		http.Error(w, "Error al crear tipo de fauna o ya existe", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Tipo de fauna creado exitosamente",
		"id":      newID,
	})
}
