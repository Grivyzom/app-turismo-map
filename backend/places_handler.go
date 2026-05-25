package main

import (
	"encoding/json"
	"net/http"
)

type Place struct {
	Name string  `json:"name"`
	Lat  float64 `json:"lat"`
	Lng  float64 `json:"lng"`
}

type PlacesResponse struct {
	Results []Place `json:"results"`
}

func placesSearchHandler(w http.ResponseWriter, r *http.Request) {
	// Obtener el query param "q"
	query := r.URL.Query().Get("q")
	if query == "" {
		query = "Sin búsqueda"
	}

	// JSON falso simulando respuesta de Google Places API
	places := []Place{
		{Name: "Lugar de prueba 1 (" + query + ")", Lat: -34.603722, Lng: -58.381592},
		{Name: "Lugar de prueba 2 (" + query + ")", Lat: -34.608333, Lng: -58.371222},
	}

	response := PlacesResponse{Results: places}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
