package handlers

import (
	"encoding/json"
	"net/http"
	"time"
)

type TimeResponse struct {
	CurrentTime string `json:"current_time"`
	Timestamp   int64  `json:"timestamp_ms"`
	Timezone    string `json:"timezone"`
}

// GetTimeHandler returns the current time in Chile down to the millisecond.
func GetTimeHandler(w http.ResponseWriter, r *http.Request) {
	loc, err := time.LoadLocation("America/Santiago")
	if err != nil {
		http.Error(w, "Error loading timezone", http.StatusInternalServerError)
		return
	}

	now := time.Now().In(loc)

	resp := TimeResponse{
		CurrentTime: now.Format("2006-01-02T15:04:05.000Z07:00"),
		Timestamp:   now.UnixNano() / int64(time.Millisecond),
		Timezone:    "America/Santiago",
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(resp)
}
