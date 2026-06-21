package handlers

import (
	"backend/database"
	"encoding/json"
	"net/http"
	"time"
)

type SurveyResponse struct {
	Categories   []string `json:"categories"`
	TravelStyle  string   `json:"travelStyle"`
	StayDuration string   `json:"stayDuration"`
	Timestamp    int64    `json:"timestamp"`
}

// CollectSurveyHandler collects survey responses in a lightweight and scalable way using Redis.
func CollectSurveyHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	var req SurveyResponse
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Request inválido", http.StatusBadRequest)
		return
	}
	req.Timestamp = time.Now().Unix()

	// Guardar de manera ligera y escalable en Redis
	if database.RDB != nil {
		data, err := json.Marshal(req)
		if err == nil {
			// Añadir a una lista de respuestas crudas
			database.RDB.RPush(database.Ctx, "survey_responses", string(data))

			// Incrementar contadores para analíticas rápidas y escalables
			for _, cat := range req.Categories {
				database.RDB.HIncrBy(database.Ctx, "survey_stats:categories", cat, 1)
			}
			if req.TravelStyle != "" {
				database.RDB.HIncrBy(database.Ctx, "survey_stats:travelStyle", req.TravelStyle, 1)
			}
			if req.StayDuration != "" {
				database.RDB.HIncrBy(database.Ctx, "survey_stats:stayDuration", req.StayDuration, 1)
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Preferencias recolectadas exitosamente",
	})
}
