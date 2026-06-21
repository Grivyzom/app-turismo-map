package handlers

import (
	"io"
	"net/http"
	"time"
)

// GetWeatherHandler obtains the current weather specifically for Valdivia, Chile,
// ignoring the user's location (e.g. if they use a VPN).
func GetWeatherHandler(w http.ResponseWriter, r *http.Request) {
	// Valdivia, Chile coordinates
	lat := "-39.81422"
	lon := "-73.24589"
	url := "https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lon + "&current_weather=true&timezone=America/Santiago"

	client := http.Client{
		Timeout: 5 * time.Second,
	}

	resp, err := client.Get(url)
	if err != nil {
		http.Error(w, "Error fetching weather data", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		http.Error(w, "Error reading weather data", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write(body)
}
