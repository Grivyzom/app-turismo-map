package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"sync"
	"time"
)

type openMeteoResponse struct {
	CurrentWeather struct {
		Temperature float64 `json:"temperature"`
		WeatherCode int     `json:"weathercode"`
	} `json:"current_weather"`
}

var (
	weatherCacheMutex sync.RWMutex
	lastWeatherCheck  time.Time
	cachedIsRaining   bool
)

// IsRainingInValdivia consulta las condiciones climáticas de Valdivia con caché en memoria de 10 minutos
func IsRainingInValdivia() bool {
	weatherCacheMutex.RLock()
	if time.Since(lastWeatherCheck) < 10*time.Minute && !lastWeatherCheck.IsZero() {
		cached := cachedIsRaining
		weatherCacheMutex.RUnlock()
		return cached
	}
	weatherCacheMutex.RUnlock()

	weatherCacheMutex.Lock()
	defer weatherCacheMutex.Unlock()

	// Doble verificación dentro del lock
	if time.Since(lastWeatherCheck) < 10*time.Minute && !lastWeatherCheck.IsZero() {
		return cachedIsRaining
	}

	lat := "-39.81422"
	lon := "-73.24589"
	url := "https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lon + "&current_weather=true&timezone=America/Santiago"

	client := http.Client{
		Timeout: 3 * time.Second,
	}

	resp, err := client.Get(url)
	if err != nil {
		lastWeatherCheck = time.Now()
		return cachedIsRaining
	}
	defer resp.Body.Close()

	var data openMeteoResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		lastWeatherCheck = time.Now()
		return cachedIsRaining
	}

	code := data.CurrentWeather.WeatherCode
	// WMO codes: 51-57 (llovizna), 61-67 (lluvia), 80-82 (chubascos), 95-99 (tormenta)
	isRain := (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99)

	cachedIsRaining = isRain
	lastWeatherCheck = time.Now()
	return cachedIsRaining
}

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
