package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"backend/database"
	"backend/models"
)

// GetCyclewaysHandler devuelve todas las ciclovías.
// GET /api/v1/cycleways
func GetCyclewaysHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	query := `
		SELECT id, eje, inicio, fin, km, coordinates
		FROM cycleways
		ORDER BY eje ASC, id ASC;
	`

	rows, err := database.DB.Query(query)
	if err != nil {
		log.Printf("Error al consultar ciclovías: %v", err)
		http.Error(w, "Error interno del servidor", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	cycleways := []models.Cycleway{}
	for rows.Next() {
		var c models.Cycleway
		var coordsStr string
		err := rows.Scan(
			&c.ID,
			&c.Eje,
			&c.Inicio,
			&c.Fin,
			&c.KM,
			&coordsStr,
		)
		if err != nil {
			log.Printf("Error al escanear ciclovía: %v", err)
			continue
		}
		c.Coordinates = json.RawMessage(coordsStr)
		cycleways = append(cycleways, c)
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(cycleways); err != nil {
		log.Printf("Error al codificar respuesta de ciclovías: %v", err)
	}
}

// AdminSaveCyclewayHandler crea o actualiza una ciclovía.
// POST /admin/api/v1/cycleways
func AdminSaveCyclewayHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	var req models.Cycleway
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Request inválido", http.StatusBadRequest)
		return
	}

	if req.ID == "" || req.Eje == "" {
		http.Error(w, "ID y Eje son requeridos", http.StatusBadRequest)
		return
	}

	// Verificar si existe para hacer INSERT o UPDATE
	var exists bool
	err := database.DB.QueryRow("SELECT EXISTS(SELECT 1 FROM cycleways WHERE id = $1)", req.ID).Scan(&exists)
	if err != nil {
		log.Printf("Error checking cycleway existence: %v", err)
		http.Error(w, "Error interno", http.StatusInternalServerError)
		return
	}

	var query string
	if exists {
		query = "UPDATE cycleways SET eje = $1, inicio = $2, fin = $3, km = $4, coordinates = $5 WHERE id = $6"
		_, err = database.DB.Exec(query, req.Eje, req.Inicio, req.Fin, req.KM, string(req.Coordinates), req.ID)
	} else {
		query = "INSERT INTO cycleways (id, eje, inicio, fin, km, coordinates) VALUES ($1, $2, $3, $4, $5, $6)"
		_, err = database.DB.Exec(query, req.ID, req.Eje, req.Inicio, req.Fin, req.KM, string(req.Coordinates))
	}

	if err != nil {
		log.Printf("Error guardando ciclovía %s: %v", req.ID, err)
		http.Error(w, "Error al guardar en base de datos", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":   true,
		"message":   "Ciclovía guardada correctamente",
		"cycleway": req,
	})
}

// AdminDeleteCyclewayHandler elimina una ciclovía por ID.
// POST /admin/api/v1/cycleways/delete
func AdminDeleteCyclewayHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	type DeleteReq struct {
		ID string `json:"id"`
	}

	var req DeleteReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Request inválido", http.StatusBadRequest)
		return
	}

	if req.ID == "" {
		http.Error(w, "ID es requerido", http.StatusBadRequest)
		return
	}

	_, err := database.DB.Exec("DELETE FROM cycleways WHERE id = $1", req.ID)
	if err != nil {
		log.Printf("Error al eliminar ciclovía %s: %v", req.ID, err)
		http.Error(w, "Error al eliminar de la base de datos", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Ciclovía eliminada correctamente",
	})
}
