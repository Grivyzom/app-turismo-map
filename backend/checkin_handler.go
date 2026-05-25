package main

import (
	"encoding/json"
	"net/http"
)

type CheckinRequest struct {
	EventID  string  `json:"eventId"`
	Lat      float64 `json:"lat"`
	Lng      float64 `json:"lng"`
	Accuracy float64 `json:"accuracy"`
}

type CheckinResponse struct {
	Success           bool    `json:"success"`
	Message           string  `json:"message"`
	DistanceTolerance float64 `json:"distance_tolerance"`
}

func checkinHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	var req CheckinRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Payload inválido", http.StatusBadRequest)
		return
	}

	// Simulación del query SQL:
	// SELECT ST_DWithin(ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, geom, 50 + $3) FROM events WHERE id = $4
	
	resp := CheckinResponse{
		Success:           true,
		Message:           "Check-in válido",
		DistanceTolerance: 50.0 + req.Accuracy,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(resp)
}
