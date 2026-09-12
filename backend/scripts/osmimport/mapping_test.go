package osmimport

import "testing"

func TestCategoryForLayer(t *testing.T) {
	tests := []struct {
		name        string
		sourceLayer string
		props       map[string]interface{}
		want        string
	}{
		{"parques fijo", "parques", map[string]interface{}{}, "parque"},
		{"agua fijo", "agua", map[string]interface{}{}, "agua"},
		{"humedales fijo", "humedales", map[string]interface{}{}, "humedal"},
		{"universidades fijo", "universidades", map[string]interface{}{}, "universidad"},
		{"hospitales clinic", "hospitales", map[string]interface{}{"amenity": "clinic"}, "clinica"},
		{"hospitales default", "hospitales", map[string]interface{}{"amenity": "hospital"}, "hospital"},
		{"seguridad police", "seguridad", map[string]interface{}{"amenity": "police"}, "carabinero"},
		{"seguridad fire_station", "seguridad", map[string]interface{}{"amenity": "fire_station"}, "bombero"},
		{"seguridad default", "seguridad", map[string]interface{}{"amenity": "surveillance"}, "camara"},
		{"estructuras statue", "estructuras", map[string]interface{}{"tourism": "artwork", "artwork_type": "statue"}, "estatua"},
		{"estructuras sculpture", "estructuras", map[string]interface{}{"tourism": "artwork", "artwork_type": "sculpture"}, "escultura"},
		{"estructuras artwork default", "estructuras", map[string]interface{}{"tourism": "artwork"}, "arte"},
		{"estructuras tower man_made", "estructuras", map[string]interface{}{"man_made": "tower"}, "torreon"},
		{"estructuras tower building", "estructuras", map[string]interface{}{"building": "tower"}, "torreon"},
		{"estructuras fallback", "estructuras", map[string]interface{}{}, "arte"},
		{"mobiliario bench", "mobiliario", map[string]interface{}{"amenity": "bench"}, "banca"},
		{"mobiliario waste_basket", "mobiliario", map[string]interface{}{"amenity": "waste_basket"}, "basurero"},
		{"mobiliario drinking_water", "mobiliario", map[string]interface{}{"amenity": "drinking_water"}, "bebedero"},
		{"mobiliario toilets", "mobiliario", map[string]interface{}{"amenity": "toilets"}, "bano"},
		{"mobiliario discarded", "mobiliario", map[string]interface{}{"amenity": "something_else"}, ""},
		{"buildings university", "buildings", map[string]interface{}{"type": "university"}, "universidad"},
		{"buildings default", "buildings", map[string]interface{}{"type": "residential"}, "edificio"},
		{"unknown layer", "no-existe", map[string]interface{}{}, ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CategoryForLayer(tt.sourceLayer, tt.props)
			if got != tt.want {
				t.Errorf("CategoryForLayer(%q, %v) = %q, want %q", tt.sourceLayer, tt.props, got, tt.want)
			}
		})
	}
}

func TestBuildOsmTags(t *testing.T) {
	props := map[string]interface{}{
		"name":     "Plaza de la Republica",
		"operator": "Municipalidad",
		"amenity":  "bench",
		"unused":   "should not appear",
	}
	tags := BuildOsmTags("mobiliario", props)
	if tags["name"] != "Plaza de la Republica" {
		t.Errorf("expected name to be copied, got %v", tags["name"])
	}
	if _, ok := tags["unused"]; ok {
		t.Errorf("expected 'unused' to be filtered out, got present")
	}

	buildingProps := map[string]interface{}{"height": 12.5, "levels": 4.0, "type": "university"}
	buildingTags := BuildOsmTags("buildings", buildingProps)
	if buildingTags["height"] != 12.5 || buildingTags["levels"] != 4.0 || buildingTags["type"] != "university" {
		t.Errorf("expected height/levels/type to be copied for buildings, got %v", buildingTags)
	}

	nonBuildingTags := BuildOsmTags("mobiliario", buildingProps)
	if _, ok := nonBuildingTags["height"]; ok {
		t.Errorf("expected height NOT to be copied for non-building layer, got present")
	}
}

func TestPolygonCentroid(t *testing.T) {
	// Cuadrado cerrado (primer y ultimo punto iguales) de [lng,lat]
	square := [][2]float64{
		{-73.0, -39.0},
		{-73.0, -40.0},
		{-72.0, -40.0},
		{-72.0, -39.0},
		{-73.0, -39.0},
	}
	lat, lng := PolygonCentroid(square)
	wantLat, wantLng := -39.5, -72.5
	if lat != wantLat || lng != wantLng {
		t.Errorf("PolygonCentroid(square) = (%v, %v), want (%v, %v)", lat, lng, wantLat, wantLng)
	}
}

func TestExtractOsmID(t *testing.T) {
	tests := []struct {
		name        string
		sourceLayer string
		index       int
		props       map[string]interface{}
		topID       interface{}
		want        string
	}{
		{"prefers @id", "parques", 0, map[string]interface{}{"@id": "way/123"}, nil, "way-123"},
		{"falls back to top-level id", "parques", 0, map[string]interface{}{}, "node/456", "node-456"},
		{"falls back to properties.id prefixed by layer", "buildings", 0, map[string]interface{}{"id": float64(107909780)}, nil, "buildings-1.0790978e+08"},
		{"falls back to index", "parques", 3, map[string]interface{}{}, nil, "parques-3"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ExtractOsmID(tt.sourceLayer, tt.index, tt.props, tt.topID)
			if got != tt.want {
				t.Errorf("ExtractOsmID(...) = %q, want %q", got, tt.want)
			}
		})
	}
}
