package handlers

import (
	"backend/database"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"
)

const (
	googlePlacesNearbyURL = "https://places.googleapis.com/v1/places:searchNearby"
	cityLat               = -39.8142
	cityLng               = -73.2459
	searchRadius          = 3000.0
)

type gpLocation struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

type gpDisplayName struct {
	Text string `json:"text"`
}

type gpPhoto struct {
	Name string `json:"name"`
}

type gpPlace struct {
	ID                       string        `json:"id"`
	DisplayName              gpDisplayName `json:"displayName"`
	FormattedAddress         string        `json:"formattedAddress"`
	Location                 gpLocation    `json:"location"`
	Rating                   float64       `json:"rating"`
	PrimaryType              string        `json:"primaryType"`
	InternationalPhoneNumber string        `json:"internationalPhoneNumber"`
	Photos                   []gpPhoto     `json:"photos"`
}

type gpResponse struct {
	Places []gpPlace `json:"places"`
}

type gpRequest struct {
	IncludedTypes       []string `json:"includedTypes"`
	MaxResultCount      int      `json:"maxResultCount"`
	LocationRestriction struct {
		Circle struct {
			Center gpLocation `json:"center"`
			Radius float64    `json:"radius"`
		} `json:"circle"`
	} `json:"locationRestriction"`
}

var googleTypeGroups = []struct {
	types    []string
	category string
}{
	{[]string{"restaurant", "fast_food_restaurant"}, "gastronomia"},
	{[]string{"cafe", "coffee_shop"}, "gastronomia"},
	{[]string{"bakery"}, "gastronomia"},
	{[]string{"bar", "pub"}, "gastronomia"},
	{[]string{"meal_delivery", "meal_takeaway"}, "gastronomia"},
	{[]string{"supermarket", "grocery_store"}, "supermercado"},
	{[]string{"convenience_store"}, "tienda"},
}

func fetchGoogleNearbyPlaces(apiKey string, types []string) ([]gpPlace, error) {
	var req gpRequest
	req.IncludedTypes = types
	req.MaxResultCount = 20
	req.LocationRestriction.Circle.Center = gpLocation{Latitude: cityLat, Longitude: cityLng}
	req.LocationRestriction.Circle.Radius = searchRadius

	body, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}

	httpReq, err := http.NewRequest("POST", googlePlacesNearbyURL, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("X-Goog-Api-Key", apiKey)
	httpReq.Header.Set("X-Goog-FieldMask",
		"places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.primaryType,places.internationalPhoneNumber,places.photos")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Google Places API %d: %s", resp.StatusCode, string(raw))
	}

	var result gpResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return result.Places, nil
}

func upsertGooglePlace(p gpPlace, category, apiKey string) error {
	if database.DB == nil {
		return fmt.Errorf("database not available")
	}

	var imageURL *string
	if len(p.Photos) > 0 {
		url := fmt.Sprintf("https://places.googleapis.com/v1/%s/media?maxWidthPx=400&key=%s", p.Photos[0].Name, apiKey)
		imageURL = &url
	}

	var rating *float64
	if p.Rating > 0 {
		r := p.Rating
		rating = &r
	}

	_, err := database.DB.Exec(`
		INSERT INTO external_places
			(google_place_id, name, category, address, phone, rating, lat, lng, geom, image_url, synced_at)
		VALUES
			($1, $2, $3, $4, $5, $6, $7, $8,
			 ST_SetSRID(ST_MakePoint($8, $7), 4326)::geography,
			 $9, NOW())
		ON CONFLICT (google_place_id) DO UPDATE SET
			name      = EXCLUDED.name,
			category  = EXCLUDED.category,
			address   = EXCLUDED.address,
			phone     = EXCLUDED.phone,
			rating    = EXCLUDED.rating,
			lat       = EXCLUDED.lat,
			lng       = EXCLUDED.lng,
			geom      = EXCLUDED.geom,
			image_url = EXCLUDED.image_url,
			synced_at = NOW()
	`,
		p.ID,
		p.DisplayName.Text,
		category,
		p.FormattedAddress,
		p.InternationalPhoneNumber,
		rating,
		p.Location.Latitude,
		p.Location.Longitude,
		imageURL,
	)
	return err
}

// SyncGooglePlacesHandler llama a Google Places API y almacena los resultados en external_places.
// Ruta: POST /admin/api/v1/places/sync-google (requiere middleware.AdminMiddleware)
func SyncGooglePlacesHandler(w http.ResponseWriter, r *http.Request) {
	apiKey := os.Getenv("GOOGLE_PLACES_API_KEY")
	if apiKey == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Variable de entorno GOOGLE_PLACES_API_KEY no configurada",
		})
		return
	}

	totalSynced := 0
	var syncErrors []string

	for _, group := range googleTypeGroups {
		places, err := fetchGoogleNearbyPlaces(apiKey, group.types)
		if err != nil {
			log.Printf("[GooglePlaces] Error fetching tipos %v: %v", group.types, err)
			syncErrors = append(syncErrors, fmt.Sprintf("tipos %v: %v", group.types, err))
			continue
		}

		for _, place := range places {
			if err := upsertGooglePlace(place, group.category, apiKey); err != nil {
				log.Printf("[GooglePlaces] Error upsert place %s: %v", place.ID, err)
				continue
			}
			totalSynced++
		}

		// Respetar rate limits de Google Places API
		time.Sleep(250 * time.Millisecond)
	}

	w.Header().Set("Content-Type", "application/json")
	if len(syncErrors) > 0 {
		w.WriteHeader(http.StatusMultiStatus)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"synced":  totalSynced,
			"errors":  syncErrors,
		})
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"synced":  totalSynced,
		"message": fmt.Sprintf("Sincronización completada: %d lugares importados/actualizados", totalSynced),
	})
}

// GetExternalPlacesStatsHandler devuelve estadísticas de lugares externos sincronizados.
// Ruta: GET /admin/api/v1/places/external-stats (requiere middleware.AdminMiddleware)
func GetExternalPlacesStatsHandler(w http.ResponseWriter, r *http.Request) {
	if database.DB == nil {
		http.Error(w, "Database not available", http.StatusInternalServerError)
		return
	}

	rows, err := database.DB.Query(`
		SELECT category, COUNT(*) as count, MAX(synced_at) as last_sync
		FROM external_places
		GROUP BY category
		ORDER BY count DESC
	`)
	if err != nil {
		http.Error(w, "Error querying stats", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type stat struct {
		Category string `json:"category"`
		Count    int    `json:"count"`
		LastSync string `json:"lastSync"`
	}

	stats := []stat{}
	for rows.Next() {
		var s stat
		if err := rows.Scan(&s.Category, &s.Count, &s.LastSync); err != nil {
			continue
		}
		stats = append(stats, s)
	}

	var total int
	database.DB.QueryRow("SELECT COUNT(*) FROM external_places").Scan(&total)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"total":      total,
		"byCategory": stats,
	})
}
