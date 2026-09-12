package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"

	"backend/database"
	"backend/scripts/osmimport"

	"github.com/joho/godotenv"
)

type geoGeometry struct {
	Type        string          `json:"type"`
	Coordinates json.RawMessage `json:"coordinates"`
}

type geoFeature struct {
	ID         interface{}            `json:"id"`
	Properties map[string]interface{} `json:"properties"`
	Geometry   geoGeometry            `json:"geometry"`
}

type geoFeatureCollection struct {
	Features []geoFeature `json:"features"`
}

type sourceFile struct {
	path        string
	sourceLayer string
}

// Orden importante: buildings y universidades primero, para que el trigger
// BEFORE INSERT (fn_assign_parent_building) encuentre el building ya insertado
// cuando llegan los puntos (mobiliario, camaras, etc.) que caen adentro.
var sources = []sourceFile{
	{"../app-turismo/src/data/valdivia_buildings.json", "buildings"},
	{"../app-turismo/coords/universidades.json", "universidades"},
	{"../app-turismo/coords/parques_valdivia.json", "parques"},
	{"../app-turismo/coords/cuerpos_agua.json", "agua"},
	{"../app-turismo/coords/humedales.json", "humedales"},
	{"../app-turismo/coords/hospitales.json", "hospitales"},
	{"../app-turismo/coords/Camaras_bomberos_pacos_etc.json", "seguridad"},
	{"../app-turismo/coords/estructuras_importantes.json", "estructuras"},
	{"../app-turismo/coords/mobiliario.json", "mobiliario"},
}

func loadFeatureCollection(path string) (geoFeatureCollection, error) {
	var fc geoFeatureCollection
	raw, err := os.ReadFile(path)
	if err != nil {
		return fc, err
	}
	if err := json.Unmarshal(raw, &fc); err != nil {
		return fc, err
	}
	return fc, nil
}

// pointFromGeometry devuelve (lat, lng, geoJSON) para el geom que se va a
// guardar. Point usa las coordenadas directas; Polygon/MultiPolygon usa el
// primer anillo del primer poligono para el centro (misma logica que
// PolygonCentroid) pero conserva la geometria ORIGINAL completa para el geom,
// asi el frontend puede extruir el poligono real, no solo un punto.
func pointFromGeometry(geom geoGeometry) (lat, lng float64, geoJSON string, ok bool) {
	switch geom.Type {
	case "Point":
		var coords [2]float64
		if err := json.Unmarshal(geom.Coordinates, &coords); err != nil {
			return 0, 0, "", false
		}
		lng, lat = coords[0], coords[1]
	case "Polygon":
		var rings [][][2]float64
		if err := json.Unmarshal(geom.Coordinates, &rings); err != nil || len(rings) == 0 {
			return 0, 0, "", false
		}
		lat, lng = osmimport.PolygonCentroid(rings[0])
	case "MultiPolygon":
		var polys [][][][2]float64
		if err := json.Unmarshal(geom.Coordinates, &polys); err != nil || len(polys) == 0 || len(polys[0]) == 0 {
			return 0, 0, "", false
		}
		lat, lng = osmimport.PolygonCentroid(polys[0][0])
	default:
		return 0, 0, "", false
	}
	geoJSON = fmt.Sprintf(`{"type":%q,"coordinates":%s}`, geom.Type, string(geom.Coordinates))
	return lat, lng, geoJSON, true
}

// importSource devuelve (importados, omitidos, loadErr). loadErr != nil significa
// que la CAPA ENTERA se omitió (archivo faltante o JSON inválido), caso muy distinto
// de "se leyó bien pero ninguna feature calificó" — main() lo reporta aparte para que
// una capa que no se cargó no se confunda con una capa legítimamente vacía.
func importSource(src sourceFile) (imported, skipped int, loadErr error) {
	fc, err := loadFeatureCollection(src.path)
	if err != nil {
		log.Printf("[osm-import] no se pudo leer %s: %v (se omite esta capa)", src.path, err)
		return 0, 0, err
	}

	for i, f := range fc.Features {
		category := osmimport.CategoryForLayer(src.sourceLayer, f.Properties)
		if category == "" {
			skipped++
			continue
		}
		lat, lng, geoJSON, ok := pointFromGeometry(f.Geometry)
		if !ok {
			skipped++
			continue
		}
		osmID := osmimport.ExtractOsmID(src.sourceLayer, i, f.Properties, f.ID)
		tags := osmimport.BuildOsmTags(src.sourceLayer, f.Properties)
		tagsJSON, err := json.Marshal(tags)
		if err != nil {
			log.Printf("[osm-import] error serializando tags para %s: %v", osmID, err)
			skipped++
			continue
		}
		name, _ := f.Properties["name"].(string)

		_, err = database.DB.Exec(`
			INSERT INTO osm_places (osm_id, source_layer, category, name, address, lat, lng, geom, osm_tags)
			VALUES ($1, $2, $3, $4, '', $5, $6, ST_SetSRID(ST_GeomFromGeoJSON($7), 4326)::geography, $8::jsonb)
			ON CONFLICT (osm_id) DO UPDATE SET
				source_layer = EXCLUDED.source_layer,
				category     = EXCLUDED.category,
				name         = EXCLUDED.name,
				lat          = EXCLUDED.lat,
				lng          = EXCLUDED.lng,
				geom         = EXCLUDED.geom,
				osm_tags     = EXCLUDED.osm_tags,
				updated_at   = CURRENT_TIMESTAMP
		`, osmID, src.sourceLayer, category, name, lat, lng, geoJSON, string(tagsJSON))
		if err != nil {
			log.Printf("[osm-import] error insertando %s (%s): %v", osmID, src.sourceLayer, err)
			skipped++
			continue
		}
		imported++
	}
	return imported, skipped, nil
}

// recalculateContainment corrige parent_building_id de una sola pasada al final del
// import: los puntos que se insertaron ANTES de que existiera el building que los
// contiene no pudieron resolverse en el trigger BEFORE INSERT. Reemplaza al viejo
// trigger AFTER por fila (fn_recalculate_osm_building_containment), que reescribía
// miles de hijos por cada building tocado. Solo geometrías ST_Point pueden anidarse:
// un parque/humedal (polígono) siempre queda con parent_building_id NULL.
func recalculateContainment() {
	_, err := database.DB.Exec(`
		UPDATE osm_places child
		SET parent_building_id = (
			SELECT b.id
			FROM osm_places b
			WHERE b.category IN ('edificio', 'universidad')
			  AND ST_GeometryType(b.geom::geometry) IN ('ST_Polygon', 'ST_MultiPolygon')
			  AND ST_GeometryType(child.geom::geometry) = 'ST_Point'
			  AND ST_Contains(b.geom::geometry, child.geom::geometry)
			ORDER BY ST_Area(b.geom::geometry) ASC
			LIMIT 1
		)
		WHERE child.category NOT IN ('edificio', 'universidad')
	`)
	if err != nil {
		log.Printf("[osm-import] error recalculando parent_building_id: %v", err)
		return
	}

	var nested int
	if err := database.DB.QueryRow(
		`SELECT COUNT(*) FROM osm_places WHERE parent_building_id IS NOT NULL`,
	).Scan(&nested); err != nil {
		log.Printf("[osm-import] recalculo de parent_building_id OK (no se pudo contar: %v)", err)
		return
	}
	log.Printf("[osm-import] recalculo de contencion OK: %d filas con parent_building_id no nulo", nested)
}

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("Aviso: No se encontro archivo .env (se usaran variables del sistema)")
	}
	database.InitDB()

	totalImported, totalSkipped := 0, 0
	var failedLayers []string
	for _, src := range sources {
		imported, skipped, loadErr := importSource(src)
		if loadErr != nil {
			failedLayers = append(failedLayers, src.sourceLayer)
		}
		log.Printf("[osm-import] %-14s -> %4d importados, %4d omitidos", src.sourceLayer, imported, skipped)
		totalImported += imported
		totalSkipped += skipped
	}

	recalculateContainment()

	log.Printf("[osm-import] TOTAL: %d importados, %d omitidos", totalImported, totalSkipped)
	if len(failedLayers) > 0 {
		log.Printf("[osm-import] ATENCION: %d capas no se pudieron cargar: %v", len(failedLayers), failedLayers)
	}
}
