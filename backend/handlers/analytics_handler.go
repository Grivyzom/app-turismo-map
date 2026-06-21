package handlers

import (
	"backend/database"
	"backend/models"
	"encoding/json"
	"log"
	"net/http"
)

func GlobalTrendsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	if database.DB == nil {
		http.Error(w, "Base de datos no disponible", http.StatusInternalServerError)
		return
	}

	trends := models.GlobalTrends{
		TravelStyles:  make(map[string]int),
		StayDurations: make(map[string]int),
		ProfileTypes:  make(map[string]int),
	}

	// 1. Top Categories
	rows, err := database.DB.Query(`
		SELECT cat, COUNT(*) 
		FROM citizen_profiles, 
		jsonb_array_elements_text(preferences->'categories') AS cat 
		GROUP BY cat 
		ORDER BY count DESC 
		LIMIT 10
	`)
	if err != nil {
		log.Printf("Error obteniendo tendencias de categorías: %v\n", err)
	} else {
		defer rows.Close()
		for rows.Next() {
			var ct models.CategoryTrend
			if err := rows.Scan(&ct.Category, &ct.Count); err == nil {
				trends.TopCategories = append(trends.TopCategories, ct)
			}
		}
	}

	// 2. Travel Styles
	rows, err = database.DB.Query(`
		SELECT preferences->>'travelStyle', COUNT(*) 
		FROM citizen_profiles 
		WHERE preferences->>'travelStyle' IS NOT NULL 
		GROUP BY preferences->>'travelStyle'
	`)
	if err != nil {
		log.Printf("Error obteniendo tendencias de estilos de viaje: %v\n", err)
	} else {
		defer rows.Close()
		for rows.Next() {
			var style string
			var count int
			if err := rows.Scan(&style, &count); err == nil {
				trends.TravelStyles[style] = count
			}
		}
	}

	// 3. Stay Durations
	rows, err = database.DB.Query(`
		SELECT preferences->>'stayDuration', COUNT(*) 
		FROM citizen_profiles 
		WHERE preferences->>'stayDuration' IS NOT NULL 
		GROUP BY preferences->>'stayDuration'
	`)
	if err != nil {
		log.Printf("Error obteniendo tendencias de duración de estadía: %v\n", err)
	} else {
		defer rows.Close()
		for rows.Next() {
			var duration string
			var count int
			if err := rows.Scan(&duration, &count); err == nil {
				trends.StayDurations[duration] = count
			}
		}
	}

	// 4. Profile Types
	rows, err = database.DB.Query(`
		SELECT profile_type, COUNT(*) 
		FROM citizen_profiles 
		GROUP BY profile_type
	`)
	if err != nil {
		log.Printf("Error obteniendo tipos de perfil: %v\n", err)
	} else {
		defer rows.Close()
		for rows.Next() {
			var pType string
			var count int
			if err := rows.Scan(&pType, &count); err == nil {
				trends.ProfileTypes[pType] = count
			}
		}
	}

	// 5. Total with preferences
	err = database.DB.QueryRow(`
		SELECT COUNT(*) 
		FROM citizen_profiles 
		WHERE preferences IS NOT NULL
	`).Scan(&trends.TotalWithPrefs)
	if err != nil {
		log.Printf("Error obteniendo total de perfiles con preferencias: %v\n", err)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(trends)
}
