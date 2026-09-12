# OSM Places — Backend Implementation Plan (Plan 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve all OSM/Overpass datasets (parques, agua, humedales, universidades, hospitales, seguridad, estructuras, mobiliario, buildings) through a new `osm_places` table and the existing `/api/v1/places/search` endpoint, with normalized categories, raw-tag storage for future embeddings, and building-containment tracking — plus the shared frontend state (category enum, icons, mode/filter logic) that Plans 2 (web) and 3 (mobile) will consume.

**Architecture:** New Postgres table `osm_places`, populated once by a standalone Go import script that reads the existing bundled GeoJSON files. A Postgres trigger (mirroring the existing `fn_automatic_zone_assignment` pattern used for `company_branches`/`events`) computes `parent_building_id` at insert time so points inside a building/university footprint are flagged. `places_handler.go` gains a 4th `UNION ALL` branch, a `buildingId` query param, and a `geometry` field in the JSON response (needed by Plan 2 for building extrusion). On the frontend, `TurismoEvent.category`, `mapUtils.ts`, and `useHomeScreenState.ts` get the new categories and the mode/filter plumbing so mobiliario only shows in "Mapa" mode.

**Tech Stack:** Go 1.26 (`database/sql`, `lib/pq`), PostgreSQL + PostGIS, React Native/TypeScript (shared hook layer only — no map-rendering code in this plan).

**Spec:** `docs/superpowers/specs/2026-09-11-osm-places-categorization-design.md`

## Global Constraints

- Category values on every new row MUST come from the existing `TurismoEvent.category` union — no new taxonomy invented (spec "Objetivo").
- `osm_tags` JSONB stores raw OSM properties per feature — insumo for a future embeddings phase, but no embedding/vector work happens in this plan (spec "Fuera de alcance").
- Buildings never nest inside another building — `category IN ('edificio','universidad')` rows always have `parent_building_id = NULL` (spec "Fuera de alcance": no recursive nesting).
- Follow the codebase's real migration convention: schema changes go into the `queries []string` slice inside `database/db.go`'s `InitDB()` (executed idempotently on every server boot) — the `migrations/*.sql` files in `backend/migrations/` are not wired to any runner and must NOT be used for this work.
- Mobiliario categories (`banca`, `basurero`, `bebedero`, `bano`) belong ONLY in `MODE_CATEGORIES.mapa`, never in `turismo` or `comercial`.

---

## Task 1: `osm_places` table, indexes, and building-containment trigger

**Files:**
- Modify: `backend/database/db.go:634-635` (insert new entries into the `queries` slice, right before its closing `}` at line 635, i.e. immediately after the `fn_recalculate_all_zones` block that currently ends the slice)

**Interfaces:**
- Produces: table `osm_places(id, osm_id, source_layer, category, name, address, target_audience, lat, lng, geom, osm_tags, parent_building_id, created_at, updated_at)`, trigger `trg_assign_parent_building` (BEFORE INSERT/UPDATE on `osm_places`), trigger `trg_recalc_osm_building_containment` (AFTER INSERT/UPDATE on `osm_places`, fires only when the changed row is a building). Task 3 (import script) and Task 4 (`places_handler.go`) depend on this schema existing.

This task has no Go unit test (it's a SQL schema change) — verification is a live `psql` check against the dev database, matching how every other table in `db.go` is verified in this codebase (there is no test harness around `InitDB()`).

- [ ] **Step 1: Read the exact insertion point**

Open `backend/database/db.go` and confirm lines 628-635 look like this (the end of the `external_places`/`fn_recalculate_all_zones` block, right before the slice closes):

```go
		UPDATE public.external_places
		SET zone_id = CASE WHEN array_length(containing_zone_ids, 1) > 0 THEN containing_zone_ids[1] ELSE NULL END;
			RETURN NULL;
		END;
		$$ LANGUAGE plpgsql;`,
	}
```

- [ ] **Step 2: Insert the `osm_places` table + indexes**

Add immediately before the closing `}` (i.e. after the last `$$ LANGUAGE plpgsql;`, ` entry and before line 635's `}`):

```go
		// ── Tabla de Lugares OSM/Overpass (parques, humedales, universidades, mobiliario, buildings, etc.) ──
		`CREATE TABLE IF NOT EXISTS osm_places (
			id SERIAL PRIMARY KEY,
			osm_id VARCHAR(255) UNIQUE NOT NULL,
			source_layer VARCHAR(50) NOT NULL,
			category VARCHAR(100) NOT NULL,
			name VARCHAR(255),
			address TEXT,
			target_audience VARCHAR(50) DEFAULT 'all',
			lat DOUBLE PRECISION NOT NULL,
			lng DOUBLE PRECISION NOT NULL,
			geom GEOGRAPHY(Geometry, 4326) NOT NULL,
			osm_tags JSONB NOT NULL DEFAULT '{}'::jsonb,
			parent_building_id INT REFERENCES osm_places(id) ON DELETE SET NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE INDEX IF NOT EXISTS osm_places_geom_idx ON osm_places USING GIST (geom);`,
		`CREATE INDEX IF NOT EXISTS osm_places_category_idx ON osm_places (category);`,
		`CREATE INDEX IF NOT EXISTS osm_places_parent_building_idx ON osm_places (parent_building_id);`,
```

- [ ] **Step 3: Insert the building-containment trigger functions**

Right after the indexes from Step 2, still before the slice's closing `}`:

```go
		// ── Asignación automática de parent_building_id (un punto queda "adentro" del building/universidad más pequeño que lo contiene) ──
		`CREATE OR REPLACE FUNCTION fn_assign_parent_building()
		RETURNS TRIGGER AS $$
		BEGIN
			IF NEW.category IN ('edificio', 'universidad') THEN
				NEW.parent_building_id := NULL;
				RETURN NEW;
			END IF;

			SELECT b.id INTO NEW.parent_building_id
			FROM public.osm_places b
			WHERE b.category IN ('edificio', 'universidad')
			  AND b.id <> NEW.id
			  AND ST_GeometryType(b.geom::geometry) IN ('ST_Polygon', 'ST_MultiPolygon')
			  AND ST_Contains(b.geom::geometry, NEW.geom::geometry)
			ORDER BY ST_Area(b.geom::geometry) ASC
			LIMIT 1;

			RETURN NEW;
		END;
		$$ LANGUAGE plpgsql;`,

		`DROP TRIGGER IF EXISTS trg_assign_parent_building ON osm_places;`,
		`CREATE TRIGGER trg_assign_parent_building
		BEFORE INSERT OR UPDATE OF geom, category ON osm_places
		FOR EACH ROW
		EXECUTE FUNCTION fn_assign_parent_building();`,

		// ── Recalcular contención cuando un building/universidad se agrega o cambia de forma DESPUÉS de sus puntos ──
		`CREATE OR REPLACE FUNCTION fn_recalculate_osm_building_containment()
		RETURNS TRIGGER AS $$
		BEGIN
			UPDATE public.osm_places child
			SET parent_building_id = (
				SELECT b.id
				FROM public.osm_places b
				WHERE b.category IN ('edificio', 'universidad')
				  AND ST_GeometryType(b.geom::geometry) IN ('ST_Polygon', 'ST_MultiPolygon')
				  AND ST_Contains(b.geom::geometry, child.geom::geometry)
				ORDER BY ST_Area(b.geom::geometry) ASC
				LIMIT 1
			)
			WHERE child.category NOT IN ('edificio', 'universidad');
			RETURN NULL;
		END;
		$$ LANGUAGE plpgsql;`,

		`DROP TRIGGER IF EXISTS trg_recalc_osm_building_containment ON osm_places;`,
		`CREATE TRIGGER trg_recalc_osm_building_containment
		AFTER INSERT OR UPDATE OF geom, category ON osm_places
		FOR EACH ROW
		WHEN (NEW.category IN ('edificio', 'universidad'))
		EXECUTE FUNCTION fn_recalculate_osm_building_containment();`,
```

- [ ] **Step 4: Verify the file compiles**

Run: `cd backend && go build ./...`
Expected: no errors (this is a slice-of-strings change, so a compile failure here means a stray backtick/quote — check Steps 2-3 for unescaped backticks inside the SQL, since Go raw strings can't contain a literal backtick).

- [ ] **Step 5: Apply and verify against the dev database**

Run: `cd backend && go run .` (or however the dev server is normally started — check `README.md`/`Dockerfile` if unsure), let it boot once so `InitDB()` runs, then stop it. Verify with:

```bash
psql "$DATABASE_URL" -c "\d osm_places"
psql "$DATABASE_URL" -c "SELECT tgname FROM pg_trigger WHERE tgrelid = 'osm_places'::regclass;"
```

Expected: `\d osm_places` shows all 13 columns from Step 2; the trigger query returns `trg_assign_parent_building` and `trg_recalc_osm_building_containment`.

- [ ] **Step 6: Commit**

```bash
git add backend/database/db.go
git commit -m "$(cat <<'EOF'
feat: agregar tabla osm_places con trigger de contencion por building

Nueva tabla para unificar parques/humedales/universidades/mobiliario/buildings
bajo el mismo pipeline de /api/v1/places/search. parent_building_id se calcula
via trigger (mismo patron que fn_automatic_zone_assignment ya usado para
company_branches/events), no en la app.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `osmimport` category-mapping & tag-extraction library

**Files:**
- Create: `backend/scripts/osmimport/mapping.go`
- Test: `backend/scripts/osmimport/mapping_test.go`

**Interfaces:**
- Produces: `CategoryForLayer(sourceLayer string, props map[string]interface{}) string`, `BuildOsmTags(sourceLayer string, props map[string]interface{}) map[string]interface{}`, `PolygonCentroid(ring [][2]float64) (lat, lng float64)`, `ExtractOsmID(sourceLayer string, index int, props map[string]interface{}, topID interface{}) string`. Task 3 (import script) is the sole consumer.

- [ ] **Step 1: Write the failing tests for `CategoryForLayer`**

Create `backend/scripts/osmimport/mapping_test.go`:

```go
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
		{"falls back to properties.id prefixed by layer", "buildings", 0, map[string]interface{}{"id": float64(107909780)}, nil, "buildings-1.0779078e+08"},
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && go test ./scripts/osmimport/... -v`
Expected: FAIL — `mapping.go` doesn't exist yet, compile error `undefined: CategoryForLayer` etc.

- [ ] **Step 3: Implement `mapping.go`**

Create `backend/scripts/osmimport/mapping.go`:

```go
package osmimport

import (
	"fmt"
	"strings"
)

func str(v interface{}) string {
	s, _ := v.(string)
	return s
}

// CategoryForLayer mapea un feature crudo de Overpass a una categoria del
// enum TurismoEvent.category del frontend (app-turismo/src/components/Map/types.ts).
// Devuelve "" cuando el feature debe descartarse (hoy solo pasa en mobiliario
// con un amenity que no nos interesa).
func CategoryForLayer(sourceLayer string, props map[string]interface{}) string {
	switch sourceLayer {
	case "parques":
		return "parque"
	case "agua":
		return "agua"
	case "humedales":
		return "humedal"
	case "universidades":
		return "universidad"
	case "hospitales":
		if str(props["amenity"]) == "clinic" {
			return "clinica"
		}
		return "hospital"
	case "seguridad":
		switch str(props["amenity"]) {
		case "police":
			return "carabinero"
		case "fire_station":
			return "bombero"
		default:
			return "camara"
		}
	case "estructuras":
		tourism := str(props["tourism"])
		if tourism == "artwork" {
			switch str(props["artwork_type"]) {
			case "statue":
				return "estatua"
			case "sculpture":
				return "escultura"
			default:
				return "arte"
			}
		}
		if str(props["man_made"]) == "tower" || str(props["building"]) == "tower" {
			return "torreon"
		}
		return "arte"
	case "mobiliario":
		switch str(props["amenity"]) {
		case "bench":
			return "banca"
		case "waste_basket":
			return "basurero"
		case "drinking_water":
			return "bebedero"
		case "toilets":
			return "bano"
		default:
			return ""
		}
	case "buildings":
		if str(props["type"]) == "university" {
			return "universidad"
		}
		return "edificio"
	default:
		return ""
	}
}

var baseTagKeys = []string{
	"name", "operator", "opening_hours", "phone",
	"addr:street", "object:street",
	"amenity", "tourism", "artwork_type", "man_made", "building",
}

var buildingOnlyTagKeys = []string{"height", "levels", "type"}

// BuildOsmTags copia del feature original solo las propiedades OSM que la UI
// ya usa hoy, para servir de insumo estructurado a una fase futura de embeddings.
func BuildOsmTags(sourceLayer string, props map[string]interface{}) map[string]interface{} {
	tags := make(map[string]interface{})
	keys := baseTagKeys
	if sourceLayer == "buildings" {
		keys = append(append([]string{}, baseTagKeys...), buildingOnlyTagKeys...)
	}
	for _, k := range keys {
		if v, ok := props[k]; ok {
			tags[k] = v
		}
	}
	return tags
}

// PolygonCentroid promedia los vertices de un anillo [lng,lat], igual que
// getPolygonCenter en app-turismo/src/utils/locationUtils.ts:32-77 (omite el
// ultimo punto si el anillo viene cerrado, para no darle doble peso).
func PolygonCentroid(ring [][2]float64) (lat, lng float64) {
	if len(ring) == 0 {
		return 0, 0
	}
	limit := len(ring)
	first, last := ring[0], ring[limit-1]
	if limit > 1 && first[0] == last[0] && first[1] == last[1] {
		limit--
	}
	if limit <= 0 {
		return ring[0][1], ring[0][0]
	}
	var sumLat, sumLng float64
	for i := 0; i < limit; i++ {
		sumLng += ring[i][0]
		sumLat += ring[i][1]
	}
	return sumLat / float64(limit), sumLng / float64(limit)
}

// ExtractOsmID replica el fallback que usa el frontend
// (f.properties['@id'] || f.id || i, ver polygonsData.ts:14) y agrega un
// fallback extra a properties.id prefijado por sourceLayer, necesario porque
// valdivia_buildings.json no trae "@id" ni id de nivel superior, solo
// properties.id (un entero OSM crudo que podria colisionar entre capas).
func ExtractOsmID(sourceLayer string, index int, props map[string]interface{}, topID interface{}) string {
	if v, ok := props["@id"]; ok {
		if s := fmt.Sprintf("%v", v); s != "" {
			return strings.ReplaceAll(s, "/", "-")
		}
	}
	if topID != nil {
		if s := fmt.Sprintf("%v", topID); s != "" && s != "<nil>" {
			return strings.ReplaceAll(s, "/", "-")
		}
	}
	if v, ok := props["id"]; ok {
		if s := fmt.Sprintf("%v", v); s != "" {
			return fmt.Sprintf("%s-%s", sourceLayer, s)
		}
	}
	return fmt.Sprintf("%s-%d", sourceLayer, index)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && go test ./scripts/osmimport/... -v`
Expected: PASS for all `TestCategoryForLayer`, `TestBuildOsmTags`, `TestPolygonCentroid`, `TestExtractOsmID` subtests.

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/osmimport/
git commit -m "$(cat <<'EOF'
feat: agregar libreria osmimport para mapeo de categorias OSM

Funciones puras (sin DB) que portan 1:1 la logica de mapeo que hoy vive
duplicada en app-turismo/src/data/polygonsData.ts, con tests table-driven
por cada regla del spec.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `import_osm_places.go` — one-off import script

**Files:**
- Create: `backend/scripts/import_osm_places.go`

**Interfaces:**
- Consumes: `osmimport.CategoryForLayer`, `osmimport.BuildOsmTags`, `osmimport.PolygonCentroid`, `osmimport.ExtractOsmID` (Task 2); `database.InitDB()` / `database.DB` (`backend/database/db.go`, already includes the `osm_places` schema from Task 1 by the time this runs).
- Produces: populated `osm_places` table. No other task consumes this script directly — it's run manually once (and is re-runnable, upsert-based).

This task has no automated test (it's I/O-heavy: reads 9 JSON files, writes to Postgres). Verification is running it against the dev DB and checking row counts via `psql`, which is the only verification method available for scripts in this codebase (see `seed_business_accounts.go`, which also has no test).

- [ ] **Step 1: Write the script**

Create `backend/scripts/import_osm_places.go`:

```go
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

func importSource(src sourceFile) (imported, skipped int) {
	fc, err := loadFeatureCollection(src.path)
	if err != nil {
		log.Printf("[osm-import] no se pudo leer %s: %v (se omite esta capa)", src.path, err)
		return 0, 0
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
	return imported, skipped
}

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("Aviso: No se encontro archivo .env (se usaran variables del sistema)")
	}
	database.InitDB()

	totalImported, totalSkipped := 0, 0
	for _, src := range sources {
		imported, skipped := importSource(src)
		log.Printf("[osm-import] %-14s -> %4d importados, %4d omitidos", src.sourceLayer, imported, skipped)
		totalImported += imported
		totalSkipped += skipped
	}
	log.Printf("[osm-import] TOTAL: %d importados, %d omitidos", totalImported, totalSkipped)
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && go build -o /tmp/import_osm_places ./scripts/import_osm_places.go`
Expected: no errors. If `go build` complains about `scripts` not being a valid package layout (single-file `package main` alongside a subpackage `osmimport` under the same `scripts/` directory), move `import_osm_places.go` up to `backend/scripts/import_osm_places.go` (already the path above) — this is fine because `osmimport` lives in its own subdirectory (`backend/scripts/osmimport/`), separate Go package, so there's no conflict with the sibling files already in `backend/scripts/` (`seed_business_accounts.go`, also `package main`). If `go build ./...` complains about two `package main` files colliding in the same directory when building the whole module, build this file explicitly by path as shown above instead of via `./...`.

- [ ] **Step 3: Run against the dev database**

Run: `cd backend && go run ./scripts/import_osm_places.go`
Expected: one log line per source layer with an `importados` count > 0 for every layer except any missing/empty file, and a final `TOTAL` line. Expect roughly: buildings ~4146, universidades ~13, parques ~388, agua ~69, humedales ~673, hospitales ~19, seguridad ~87, estructuras ~7, mobiliario ~235 (170 bench + 61 waste_basket + 4 drinking_water skipped... note: mobiliario has 170 bench + 61 waste_basket + 4 drinking_water + 1 toilets = 236 rows in the source file per the earlier count — all 4 amenities map to a category, so `skipped` for mobiliario should be 0 unless the file has amenities beyond those 4).

- [ ] **Step 4: Verify row counts and the building-containment trigger**

```bash
psql "$DATABASE_URL" -c "SELECT category, COUNT(*) FROM osm_places GROUP BY category ORDER BY 2 DESC;"
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM osm_places WHERE parent_building_id IS NOT NULL;"
```

Expected: the first query shows all 21 categories from Task 2's mapping table with plausible counts; the second returns a number greater than 0 if any mobiliario/camara/etc. point genuinely falls inside a building or university polygon (0 is also a valid, if less interesting, result — it means no current point happens to sit inside a building footprint, which is possible depending on the real data).

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/import_osm_places.go
git commit -m "$(cat <<'EOF'
feat: agregar script de import one-off para osm_places

Lee los 9 archivos GeoJSON de coords/ y valdivia_buildings.json, aplica el
mapeo de osmimport y hace upsert por osm_id. Buildings se importan primero
para que el trigger de contencion los encuentre al insertar los puntos.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `places_handler.go` — 4th UNION branch, `buildingId`, and `geometry`

**Files:**
- Modify: `backend/handlers/places_handler.go`
- Test: `backend/handlers/places_handler_test.go` (new file)

**Interfaces:**
- Produces: `GET /api/v1/places/search` now also returns `osm_places` rows; accepts `?buildingId=<id>` to reveal only that building's nested rows (default: nested rows hidden); JSON now includes `"geometry"` (GeoJSON text of the row's `geom`, or omitted for point geometries — always present, Plan 2 decides whether to use it). Plan 2 (DeckGL3DContainer, MapLibreContainer) and Plan 3 (MapContainer.tsx) consume this response shape.

- [ ] **Step 1: Write the failing regression test**

Create `backend/handlers/places_handler_test.go`:

```go
package handlers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"backend/database"
)

func TestPlacesSearchHandler_NoDatabase(t *testing.T) {
	originalDB := database.DB
	database.DB = nil
	defer func() { database.DB = originalDB }()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/places/search", nil)
	rec := httptest.NewRecorder()

	PlacesSearchHandler(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("expected status %d, got %d", http.StatusInternalServerError, rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "Base de datos no disponible") {
		t.Fatalf("expected body to mention 'Base de datos no disponible', got %q", rec.Body.String())
	}
}
```

- [ ] **Step 2: Run the test to verify it currently passes (this is a regression guard, not a new-behavior test)**

Run: `cd backend && go test ./handlers/ -run TestPlacesSearchHandler_NoDatabase -v`
Expected: PASS (this behavior already exists at `places_handler.go:47-50`; the point of this test is to catch anything in the upcoming edit that accidentally moves or removes that early-return guard).

- [ ] **Step 3: Add the `buildingId` param and the `Geometry` field**

In `backend/handlers/places_handler.go`, modify the `Place` struct (lines 13-28) to add:

```go
type Place struct {
	ID                  string  `json:"id"`
	Title               string  `json:"title"`
	Description         string  `json:"description"`
	Latitude            float64 `json:"latitude"`
	Longitude           float64 `json:"longitude"`
	Category            string  `json:"category"`
	Organizer           string  `json:"organizer"`
	Time                string  `json:"time"`
	ImageUrl            string  `json:"imageUrl,omitempty"`
	Address             string  `json:"address,omitempty"`
	SectorName          string  `json:"sectorName,omitempty"`
	HasActiveUpdate     bool    `json:"hasActiveUpdate,omitempty"`
	RecommendationType  string  `json:"recommendationType,omitempty"`
	IsSmartNotification bool    `json:"isSmartNotification,omitempty"`
	Geometry            *string `json:"geometry,omitempty"`
	OsmTags             *string `json:"osmTags,omitempty"`
}
```

(Only the new `Geometry` field is added; every other field is unchanged.)

Add `buildingIdParam` next to `zoneIdParam` (line 37):

```go
	zoneIdParam := r.URL.Query().Get("zoneId")
	buildingIdParam := r.URL.Query().Get("buildingId")
```

- [ ] **Step 4: Add `parent_building_id` to the 3 existing UNION branches and the new `osm_places` branch**

Replace the entire `sqlQuery := \`...\`` block (lines 93-168) with:

```go
	sqlQuery := `
		SELECT id, title, description, lat, lng, category, organizer, address, time, image_url,
		       COALESCE((SELECT name FROM zones z WHERE z.id = ANY(u.containing_zone_ids) LIMIT 1), '') as sector_name,
		       has_active_update,
		       ST_AsGeoJSON(u.geom) as geometry,
		       u.osm_tags::text as osm_tags
		FROM (
			SELECT
				'branch-' || b.id::text as id,
				b.branch_name as title,
				COALESCE(b.description, '') as description,
				ST_Y(b.geom::geometry) as lat,
				ST_X(b.geom::geometry) as lng,
				b.category,
				COALESCE(c.business_name, 'Empresa Local') as organizer,
				COALESCE(b.address, '') as address,
				'Abierto ahora' as time,
				b.geom,
				COALESCE(b.image_url, '') as image_url,
				b.company_id,
				b.containing_zone_ids,
				COALESCE(b.target_audience, 'all') as target_audience,
				EXISTS (SELECT 1 FROM branch_updates bu WHERE bu.branch_id = b.id AND bu.is_active = true AND (bu.expires_at IS NULL OR bu.expires_at > CURRENT_TIMESTAMP)) as has_active_update,
				NULL::int as parent_building_id,
				NULL::jsonb as osm_tags
			FROM company_branches b
			LEFT JOIN companies c ON b.company_id = c.id

			UNION ALL

			SELECT
				'event-' || e.id::text as id,
				e.title,
				COALESCE(e.description, '') as description,
				ST_Y(e.geom::geometry) as lat,
				ST_X(e.geom::geometry) as lng,
				e.category,
				COALESCE(c.business_name, 'Organizador') as organizer,
				COALESCE(b.address, '') as address,
				'Evento programado' as time,
				e.geom,
				'' as image_url,
				b.company_id,
				e.containing_zone_ids,
				COALESCE(e.target_audience, 'all') as target_audience,
				false as has_active_update,
				NULL::int as parent_building_id,
				NULL::jsonb as osm_tags
			FROM events e
			LEFT JOIN company_branches b ON e.branch_emitter_id = b.id
			LEFT JOIN companies c ON b.company_id = c.id

			UNION ALL

			SELECT
				'ext-' || ep.id::text as id,
				ep.name as title,
				CASE WHEN ep.rating IS NOT NULL
					THEN '⭐ ' || ep.rating::text || ' · ' || COALESCE(ep.address, '')
					ELSE COALESCE(ep.address, '')
				END as description,
				ep.lat,
				ep.lng,
				ep.category,
				CASE ep.category
					WHEN 'gastronomia' THEN 'Gastronomía'
					WHEN 'supermercado' THEN 'Supermercado'
					WHEN 'tienda' THEN 'Comercio'
					ELSE 'Google Places'
				END as organizer,
				COALESCE(ep.address, '') as address,
				'Establecimiento' as time,
				ep.geom,
				COALESCE(ep.image_url, '') as image_url,
				NULL::int as company_id,
				COALESCE(ep.containing_zone_ids, '{}'::int[]) as containing_zone_ids,
				ep.target_audience,
				false as has_active_update,
				NULL::int as parent_building_id,
				NULL::jsonb as osm_tags
			FROM external_places ep

			UNION ALL

			SELECT
				'osm-' || op.id::text as id,
				op.name as title,
				'' as description,
				op.lat,
				op.lng,
				op.category,
				'OpenStreetMap' as organizer,
				COALESCE(op.address, '') as address,
				'24/7' as time,
				op.geom,
				'' as image_url,
				NULL::int as company_id,
				'{}'::int[] as containing_zone_ids,
				op.target_audience,
				false as has_active_update,
				op.parent_building_id,
				op.osm_tags
			FROM osm_places op
		) u
		WHERE 1=1
	`
```

- [ ] **Step 5: Add the `buildingId` filter after the existing `zoneId`/`NOT EXISTS zones` block**

Right after the existing block (was lines 198-204, now shifted down by the new UNION branch — find it by content, not line number):

```go
	if zoneIdParam != "" {
		sqlQuery += fmt.Sprintf(" AND u.containing_zone_ids @> ARRAY[$%d::integer]", paramCount)
		args = append(args, zoneIdParam)
		paramCount++
	} else {
		sqlQuery += " AND NOT EXISTS (SELECT 1 FROM zones z WHERE z.id = ANY(u.containing_zone_ids) AND z.category IN ('edificio', 'reserva') AND z.is_active = true)"
	}

	if buildingIdParam != "" {
		sqlQuery += fmt.Sprintf(" AND u.parent_building_id = $%d", paramCount)
		args = append(args, buildingIdParam)
		paramCount++
	} else {
		sqlQuery += " AND u.parent_building_id IS NULL"
	}

	sqlQuery += " LIMIT 500"
```

(This replaces the old `sqlQuery += " LIMIT 500"` line that used to come immediately after the `zoneId`/`NOT EXISTS` block — don't leave two `LIMIT 500` lines.)

- [ ] **Step 6: Update the `Scan` call**

Change (was line 220):

```go
		if err := rows.Scan(&p.ID, &p.Title, &p.Description, &p.Latitude, &p.Longitude, &p.Category, &p.Organizer, &p.Address, &p.Time, &p.ImageUrl, &p.SectorName, &p.HasActiveUpdate); err != nil {
```

to:

```go
		var geometryRaw sql.NullString
		var osmTagsRaw sql.NullString
		if err := rows.Scan(&p.ID, &p.Title, &p.Description, &p.Latitude, &p.Longitude, &p.Category, &p.Organizer, &p.Address, &p.Time, &p.ImageUrl, &p.SectorName, &p.HasActiveUpdate, &geometryRaw, &osmTagsRaw); err != nil {
			log.Printf("Error escaneando fila: %v\n", err)
			continue
		}
		if geometryRaw.Valid {
			p.Geometry = &geometryRaw.String
		}
		if osmTagsRaw.Valid {
			p.OsmTags = &osmTagsRaw.String
		}
```

(This replaces both the `Scan` line and the `if err := ...; err != nil { log...; continue }` block right after it — the `var geometryRaw`/`var osmTagsRaw` declarations need to go inside the `for rows.Next()` loop, right before the `Scan` call, and the old duplicate error-handling `if` that used to follow `Scan` is now merged into this one `if err := rows.Scan(...); err != nil` line above, so delete the old standalone `if err != nil { log.Printf(...); continue }` that immediately followed the original `Scan` call.)

- [ ] **Step 7: Run the regression test**

Run: `cd backend && go test ./handlers/ -run TestPlacesSearchHandler_NoDatabase -v`
Expected: PASS (unchanged behavior — the nil-DB guard runs before any of this new SQL is built).

- [ ] **Step 8: Compile-check the whole backend**

Run: `cd backend && go build ./...`
Expected: no errors.

- [ ] **Step 9: Manual verification against the dev database**

With the server running (`go run .`) and Task 3's import already done:

```bash
curl -s "http://localhost:8080/api/v1/places/search?minLat=-39.9&maxLat=-39.7&minLng=-73.3&maxLng=-73.15" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d['results'])); print([r for r in d['results'] if r['category']=='banca'][:1])"
```

Expected: a result count, and either an empty list (no `banca` in that bbox) or one `banca` object with `"organizer":"OpenStreetMap"`.

```bash
curl -s "http://localhost:8080/api/v1/places/search?minLat=-39.9&maxLat=-39.7&minLng=-73.3&maxLng=-73.15" | python3 -c "import json,sys; d=json.load(sys.stdin); print([r['id'] for r in d['results'] if r['category'] in ('edificio','universidad')][:1])"
```

Take one returned building id (e.g. `osm-42`, so numeric id `42`), then:

```bash
curl -s "http://localhost:8080/api/v1/places/search?minLat=-39.9&maxLat=-39.7&minLng=-73.3&maxLng=-73.15&buildingId=42" | python3 -m json.tool | head -20
```

Expected: this second call returns a different (likely smaller, possibly empty) set than the first — only rows whose `parent_building_id = 42`.

- [ ] **Step 10: Commit**

```bash
git add backend/handlers/places_handler.go backend/handlers/places_handler_test.go
git commit -m "$(cat <<'EOF'
feat: exponer osm_places en /api/v1/places/search con buildingId y geometry

Nueva rama UNION ALL para osm_places, parent_building_id propagado a las 4
ramas para poder ocultar/revelar pines anidados en un building via ?buildingId,
y geometry + osmTags (GeoJSON y tags crudos) agregados a la respuesta para que
el frontend pueda extruir poligonos reales con su altura real en vez de un
punto con altura generica.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Frontend category enum + colors/icons

**Files:**
- Modify: `app-turismo/src/components/Map/types.ts:47-85` (the `TurismoEvent.category` union)
- Modify: `app-turismo/src/utils/mapUtils.ts` (`getCategoryColor`, `getCategoryIcon`)

**Interfaces:**
- Produces: `TurismoEvent['category']` now accepts `'banca' | 'basurero' | 'bebedero' | 'bano'`; `getCategoryColor`/`getCategoryIcon` return a real value (not the `default`/fallback branch) for those 4. Plans 2 and 3 both render pins using these.

This is a pure type/lookup-table change with no test framework in this repo (`app-turismo/package.json` has no `test` script or Jest config) — verified via `tsc` and a manual visual check, matching how every other category in this file was added historically (no tests exist for any of the other ~30 categories either).

- [ ] **Step 1: Extend the category union**

In `app-turismo/src/components/Map/types.ts`, inside the `TurismoEvent.category` union (currently ending `| 'mercado';` around line 85), add before the closing `;`:

```ts
    | 'mercado'
    | 'banca'
    | 'basurero'
    | 'bebedero'
    | 'bano';
```

(Replace the existing final `| 'mercado';` line with these 5 lines — same list, just no longer terminating right after `mercado`.)

- [ ] **Step 2: Add colors**

In `app-turismo/src/utils/mapUtils.ts`, inside `getCategoryColor`'s `switch (category)` block, add 4 new `case`s right before the existing `default:` (after the `case 'arte':` block):

```ts
    case 'banca':
      return '#94A3B8'; // Gris pizarra — mobiliario neutro
    case 'basurero':
      return '#78716C'; // Gris piedra
    case 'bebedero':
      return '#38BDF8'; // Celeste agua
    case 'bano':
      return '#64748B'; // Slate
    default:
      return '#3B82F6';
```

(Only the 4 new `case` lines are added; the existing `default: return '#3B82F6';` stays as the last entry, unchanged in content.)

- [ ] **Step 3: Add icons**

In the same file, find `getCategoryIcon`'s `switch (category)` block (the second `switch`, further down in the file — search for `export const getCategoryIcon`). Add 4 new `case`s before its `default:`, using existing `MaterialIcons` names:

```ts
    case 'banca':
      return 'chair';
    case 'basurero':
      return 'delete';
    case 'bebedero':
      return 'water-drop';
    case 'bano':
      return 'wc';
```

(These 4 icon names are already used verbatim in `app-turismo/src/components/Map/Markers/FurnitureMarker.tsx:21-27` for the same 4 amenities, so they're guaranteed valid `MaterialIcons` names in this project.)

- [ ] **Step 4: Type-check**

Run: `cd app-turismo && npx tsc --noEmit`
Expected: no new errors (there may be pre-existing unrelated errors in the project — compare the error count/list before and after this change; this step is only checking you didn't introduce a new one, e.g. a typo in the union or a `MaterialIcons` name that doesn't exist).

- [ ] **Step 5: Manual visual check**

There's no live osm-fed banca/basurero/bebedero/bano pin yet (Plans 2/3 wire the rendering) — verify instead with a throwaway check: temporarily add `console.log(getCategoryColor('banca'), getCategoryIcon('banca'))` at the top of `app-turismo/src/hooks/useHomeScreenState.ts`, run the dev server, confirm the browser/Metro console prints `#94A3B8 chair` (not the `default` fallback `#3B82F6`), then remove the `console.log`.

- [ ] **Step 6: Commit**

```bash
git add app-turismo/src/components/Map/types.ts app-turismo/src/utils/mapUtils.ts
git commit -m "$(cat <<'EOF'
feat: agregar categorias de mobiliario urbano al enum y sistema de colores

banca/basurero/bebedero/bano ahora son categorias TurismoEvent de primera
clase (antes vivian en un tipo FurnitureAmenity separado, fuera del sistema
de colores/iconos del resto de la app).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `useHomeScreenState.ts` — mode/filter plumbing + `activeBuildingId`

**Files:**
- Modify: `app-turismo/src/hooks/useHomeScreenState.ts`

**Interfaces:**
- Consumes: `TurismoEvent['category']` (Task 5, already includes the 4 new categories).
- Produces: `MODE_CATEGORIES.mapa` includes the 4 mobiliario categories; new exported-from-hook value `visibleOsmCategories: string[]`; new pure function `isCategoryVisible(category: string, selectedCategories: CategoryFilter[], mapDisplayMode: MapDisplayMode): boolean` (also used internally by `filteredEvents`, replacing its inlined `matchesCategory` boolean expression 1:1 — same behavior, factored out so `visibleOsmCategories` can reuse the identical rule); `activeBuildingId: number | null` state + `setActiveBuildingId`. Plans 2 and 3 both destructure `visibleOsmCategories`, `activeBuildingId`, `setActiveBuildingId` from this hook's return value and pass them down to their respective map containers.

- [ ] **Step 1: Add the mobiliario categories to `MODE_CATEGORIES.mapa`**

In `app-turismo/src/hooks/useHomeScreenState.ts`, change (lines 44-53):

```ts
  mapa: [
    'hospital',
    'universidad',
    'bombero',
    'carabinero',
    'camara',
    'emergencia',
    'publico',
    'municipalidad',
  ],
```

to:

```ts
  mapa: [
    'hospital',
    'universidad',
    'bombero',
    'carabinero',
    'camara',
    'emergencia',
    'publico',
    'municipalidad',
    'banca',
    'basurero',
    'bebedero',
    'bano',
  ],
```

(`turismo` and `comercial` are NOT touched — the 4 mobiliario categories must stay absent from both, per the spec's rule that mobiliario only shows in Mapa mode.)

- [ ] **Step 2: Extract `isCategoryVisible` and reuse it in `filteredEvents`**

Add this function right after the `CATEGORY_ALIASES` constant (currently ends at line 95, right before `type MapPinchoState = {`):

```ts
function isCategoryVisible(
  category: string,
  selectedCategories: CategoryFilter[],
  mapDisplayMode: MapDisplayMode,
): boolean {
  const isEmergencyCategory = ['choque', 'incendio', 'accidente', 'calle_cortada'].includes(
    category,
  );
  if (selectedCategories.includes('ninguno')) {
    return false;
  }
  if (selectedCategories.includes('todos') || selectedCategories.length === 0) {
    return (
      isEmergencyCategory || MODE_CATEGORIES[mapDisplayMode].includes(category as CategoryFilter)
    );
  }
  return (
    (selectedCategories.includes('emergencia') && isEmergencyCategory) ||
    selectedCategories.includes(category as CategoryFilter) ||
    selectedCategories.some((cat) => CATEGORY_ALIASES[cat]?.includes(category))
  );
}
```

Then replace the `filteredEvents` body (lines 1019-1043) to use it instead of the inlined logic:

```ts
  const filteredEvents = useMemo(
    () =>
      events.filter((event) => {
        const matchesCategory = isCategoryVisible(event.category, selectedCategories, mapDisplayMode);
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          (event.title?.toLowerCase() || '').includes(query) ||
          (event.description?.toLowerCase() || '').includes(query) ||
          (event.organizer?.toLowerCase() || '').includes(query);
        return matchesCategory && matchesSearch;
      }),
    [events, selectedCategories, searchQuery, mapDisplayMode],
  );
```

- [ ] **Step 3: Add `visibleOsmCategories`**

The full universe of OSM categories (everything Plan 1's import script can produce) needs to be a constant so `visibleOsmCategories` can be filtered from it. Add right after the `isCategoryVisible` function from Step 2:

```ts
const ALL_OSM_CATEGORIES: CategoryFilter[] = [
  'parque', 'agua', 'humedal', 'universidad', 'hospital', 'clinica',
  'bombero', 'carabinero', 'camara', 'escultura', 'torreon', 'estatua',
  'arte', 'edificio', 'banca', 'basurero', 'bebedero', 'bano',
];
```

Then, inside `useHomeScreenState` (near where `filteredEvents` is defined, right after it), add:

```ts
  const visibleOsmCategories = useMemo(
    () =>
      ALL_OSM_CATEGORIES.filter((cat) => isCategoryVisible(cat, selectedCategories, mapDisplayMode)),
    [selectedCategories, mapDisplayMode],
  );
```

- [ ] **Step 4: Add `activeBuildingId` state**

Near the other map-interaction state (right after the `mapBounds` state declared around line 432-437), add:

```ts
  const [activeBuildingId, setActiveBuildingId] = useState<number | null>(null);
```

- [ ] **Step 5: Export the 3 new values from the hook's return statement**

Find the hook's `return { ... }` statement (it already returns `filteredEvents` at line 1570 and `mapDisplayMode`/`setMapDisplayMode` around lines 1579-1580) and add, near those:

```ts
    visibleOsmCategories,
    activeBuildingId,
    setActiveBuildingId,
```

- [ ] **Step 6: Type-check**

Run: `cd app-turismo && npx tsc --noEmit`
Expected: no new errors compared to before this task (see Task 5 Step 4 for how to compare).

- [ ] **Step 7: Manual verification of `isCategoryVisible`/`visibleOsmCategories`**

Temporarily add, right after the `visibleOsmCategories` `useMemo` from Step 3:

```ts
  console.log('[verify] mapDisplayMode=', mapDisplayMode, 'visibleOsmCategories=', visibleOsmCategories);
```

Run the dev server, open the app, and in the browser console confirm: with the default mode (`mapa`), the list includes `banca`, `basurero`, `bebedero`, `bano`, `hospital`, `universidad`, etc.; switch the top navbar to "Turismo" and confirm the list changes to `parque`, `agua`, `humedal`, `escultura`, `torreon`, `estatua`, `arte` and does NOT include `banca`/`basurero`/`bebedero`/`bano`; switch to "Comercial" and confirm the list is empty (none of `ALL_OSM_CATEGORIES` belong to `comercial`). Then remove the `console.log`.

- [ ] **Step 8: Commit**

```bash
git add app-turismo/src/hooks/useHomeScreenState.ts
git commit -m "$(cat <<'EOF'
feat: agregar visibleOsmCategories y activeBuildingId al hook de estado

isCategoryVisible factoriza la regla de matchesCategory que ya usaba
filteredEvents, reusada ahora para calcular que categorias OSM debe pintar
la capa nativa (Plan 2/3) segun Herramientas + modo Mapa/Turismo/Comercial.
Mobiliario urbano solo entra en MODE_CATEGORIES.mapa.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Thread the new state through `MapContainerProps` and `index.tsx`

**Files:**
- Modify: `app-turismo/src/components/Map/types.ts:203-262` (`MapContainerProps` interface)
- Modify: `app-turismo/app/(home)/index.tsx:992-1027` (the `<MapContainer>` invocation)

**Interfaces:**
- Consumes: `visibleOsmCategories`, `activeBuildingId`, `setActiveBuildingId` (Task 6).
- Produces: `MapContainerProps` gains `visibleOsmCategories?: string[]`, `mapDisplayMode?: MapDisplayMode`, `activeBuildingId?: number | null`, `onBuildingSelect?: (id: number | null) => void`. Plans 2 and 3 destructure these from their respective container's props (`MapLibreContainer.web.tsx`, `MapContainer.tsx`) — until those plans run, the props are passed but unused, which is harmless (TypeScript allows unused optional props; no runtime effect).

- [ ] **Step 1: Extend `MapContainerProps`**

In `app-turismo/src/components/Map/types.ts`, add to the `MapContainerProps` interface (right before its closing `}` at line 262, after the `cameraAnimationsEnabled?: boolean;` line):

```ts
  // Filtrado de pines OSM (Herramientas + modo Mapa/Turismo/Comercial)
  visibleOsmCategories?: string[];
  mapDisplayMode?: import('../MapUI/types').MapDisplayMode;

  // Disclosure progresiva: building 3D clickeado revela sus pines anidados
  activeBuildingId?: number | null;
  onBuildingSelect?: (id: number | null) => void;
```

(Using the inline `import('../MapUI/types').MapDisplayMode` type avoids adding a new top-level import to `types.ts` for a single field — check first whether `types.ts` already imports anything from `../MapUI/types`; if it does, use that existing import instead of the inline form for consistency.)

- [ ] **Step 2: Pass the new props from `index.tsx`**

In `app-turismo/app/(home)/index.tsx`, the `<MapContainer>` call (starts at line 992) already destructures `visibleOsmCategories`, `activeBuildingId`, `setActiveBuildingId` from `useHomeScreenState` (verify this — they come from the same destructuring assignment that already pulls out `filteredEvents`, `mapDisplayMode`, `selectedCategories`, etc., visible around lines 251-390). Add 3 new prop lines to the `<MapContainer>` JSX, right after the existing `cameraAnimationsEnabled={cameraAnimationsEnabled}` line:

```tsx
          cameraAnimationsEnabled={cameraAnimationsEnabled}
          visibleOsmCategories={visibleOsmCategories}
          mapDisplayMode={mapDisplayMode}
          activeBuildingId={activeBuildingId}
          onBuildingSelect={setActiveBuildingId}
        />
```

- [ ] **Step 3: Type-check**

Run: `cd app-turismo && npx tsc --noEmit`
Expected: no new errors. If `visibleOsmCategories`/`activeBuildingId`/`setActiveBuildingId` aren't already in scope inside `index.tsx` (i.e. `useHomeScreenState()`'s destructuring doesn't list them yet, since Task 6 added them to the hook's return value but `index.tsx`'s own destructuring is a separate line), add them there too — find the line that currently destructures `filteredEvents`, `mapDisplayMode`, `selectedCategories`, etc. from `useHomeScreenState(token)` and add `visibleOsmCategories, activeBuildingId, setActiveBuildingId,` to that same destructuring list.

- [ ] **Step 4: Manual verification**

Run the dev server, open React DevTools (or the browser's component inspector), select the `MapContainer` instance, and confirm its props panel shows `visibleOsmCategories` (an array), `mapDisplayMode` (`"mapa"` by default), `activeBuildingId` (`null`), and `onBuildingSelect` (a function) — even though nothing consumes them yet.

- [ ] **Step 5: Commit**

```bash
git add app-turismo/src/components/Map/types.ts "app-turismo/app/(home)/index.tsx"
git commit -m "$(cat <<'EOF'
feat: propagar visibleOsmCategories y activeBuildingId hasta MapContainer

Deja las props listas para que Plan 2 (web) y Plan 3 (mobile) las consuman
sin tocar useHomeScreenState.ts ni index.tsx de nuevo.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Remove the 7 OSM datasets from `INITIAL_EVENTS` (prevents duplicate pins)

**Files:**
- Modify: `app-turismo/src/data/mockEvents.ts:154-169`

**Interfaces:**
- Produces: `INITIAL_EVENTS` no longer includes `PARQUES_EVENTS`, `AGUA_EVENTS`, `HUMEDALES_EVENTS`, `UNIVERSIDADES_EVENTS`, `HOSPITALES_EVENTS`, `SEGURIDAD_EVENTS`, `ESTRUCTURAS_EVENTS`. Plan 2 (web) and Plan 3 (mobile) both depend on this: without it, the categories they render as new lightweight OSM layers/markers would ALSO still render through the old interactive `EventMarker`/`ArtisticMarker`/`renderPinMarker` pipeline (since that pipeline consumes `events`, which is seeded from `INITIAL_EVENTS`), producing duplicate pins on screen for every parque/hospital/universidad/etc.

This was found while writing Plan 2 (not in the original spec) — `polygonsData.ts`'s 7 bulk-OSM arrays feed `INITIAL_EVENTS` today, and the spec's instruction to stop using `polygonsData.ts` "como fuente de pines" only makes the duplication-avoidance requirement explicit once you trace where `INITIAL_EVENTS` is consumed.

- [ ] **Step 1: Remove the 7 spreads**

In `app-turismo/src/data/mockEvents.ts`, change:

```ts
export const INITIAL_EVENTS: TurismoEvent[] = [
  ...PARQUES_EVENTS,
  ...AGUA_EVENTS,
  ...HUMEDALES_EVENTS,
  ...UNIVERSIDADES_EVENTS,
  ...HOSPITALES_EVENTS,
  ...SEGURIDAD_EVENTS,
  ...ESTRUCTURAS_EVENTS,
  ...COMERCIAL_EVENTS,
  CASINO_DREAMS_EVENT,
  MUNICIPALIDAD_EVENT,
  FERIA_FLUVIAL_EVENT,
  PENDULO_VALDIVIA_EVENT,
  SUBMARINO_VALDIVIA_EVENT,
  MERCADO_MUNICIPAL_VALDIVIA_EVENT,
];
```

to:

```ts
export const INITIAL_EVENTS: TurismoEvent[] = [
  ...COMERCIAL_EVENTS,
  CASINO_DREAMS_EVENT,
  MUNICIPALIDAD_EVENT,
  FERIA_FLUVIAL_EVENT,
  PENDULO_VALDIVIA_EVENT,
  SUBMARINO_VALDIVIA_EVENT,
  MERCADO_MUNICIPAL_VALDIVIA_EVENT,
];
```

`COMERCIAL_EVENTS` and the 6 individually-named landmark events (`CASINO_DREAMS_EVENT`, `MUNICIPALIDAD_EVENT`, etc.) are hand-authored one-off content (real addresses, descriptions, `indoorMap` floors) — NOT generic bulk OSM data — so they stay untouched; only the 7 bulk-OSM spreads are removed.

- [ ] **Step 2: Remove the now-unused import**

At the top of `app-turismo/src/data/mockEvents.ts`, remove `PARQUES_EVENTS`, `AGUA_EVENTS`, `HUMEDALES_EVENTS`, `UNIVERSIDADES_EVENTS`, `HOSPITALES_EVENTS`, `SEGURIDAD_EVENTS`, `ESTRUCTURAS_EVENTS` from the `import { ... } from './polygonsData';` block (lines 4-18), keeping only the ones still used elsewhere in this file: `CASINO_DREAMS_EVENT`, `MUNICIPALIDAD_EVENT`, `FERIA_FLUVIAL_EVENT`, `PENDULO_VALDIVIA_EVENT`, `SUBMARINO_VALDIVIA_EVENT`, `MERCADO_MUNICIPAL_VALDIVIA_EVENT`. Run `grep -n "PARQUES_EVENTS\|AGUA_EVENTS\|HUMEDALES_EVENTS\|UNIVERSIDADES_EVENTS\|HOSPITALES_EVENTS\|SEGURIDAD_EVENTS\|ESTRUCTURAS_EVENTS" app-turismo/src/data/mockEvents.ts` first to confirm each only appears in the import and the removed spread (if any of these names appear a 3rd time elsewhere in the file, e.g. in `CATEGORY_ICONS` or a comment, leave that other usage alone — only touch the import and the spread).

- [ ] **Step 3: Type-check**

Run: `cd app-turismo && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manual verification**

Run the dev server, confirm on the web view that a known parque/hospital/universidad location shows exactly ONE pin (the new lightweight dot from Plan 2, once that plan is done) rather than two overlapping pins. If Plan 2/3 haven't run yet when this task executes, the visible effect is simply that those pins temporarily disappear from the map until Plan 2 (web) / Plan 3 (mobile) land — expected and correct given the dependency direction; don't treat that as a regression to fix here.

- [ ] **Step 5: Commit**

```bash
git add app-turismo/src/data/mockEvents.ts
git commit -m "$(cat <<'EOF'
fix: quitar los 7 datasets OSM masivos de INITIAL_EVENTS

Evita pines duplicados una vez que Plan 2 (web) y Plan 3 (mobile) rendericen
estas mismas categorias via la nueva capa liviana alimentada por osm_places.
Los eventos curados a mano (COMERCIAL_EVENTS, Casino Dreams, Municipalidad,
etc) no se tocan.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Notes

**Spec coverage:**
- Tabla `osm_places` + `osm_tags` para embeddings → Task 1.
- Reglas de mapeo de categoría por dataset → Task 2 (tests cubren cada fila de la tabla del spec).
- Import one-off, re-corrible (`ON CONFLICT (osm_id)`) → Task 3.
- `parent_building_id`, building nunca se auto-anida → Task 1 (trigger, con `category IN ('edificio','universidad')` excluido explícitamente).
- 4ta rama `UNION ALL`, filtro por defecto oculta anidados, `buildingId` los revela → Task 4.
- `geometry` y `osmTags` en la respuesta (necesarios para que Plan 2 extruya buildings reales con su altura real, gap que el spec no explicitó pero que su propio requisito de "DeckGL3DContainer recibe los buildings desde la API... reconstruye {height, levels, type} desde osm_tags" implica) → Task 4.
- Categorías nuevas de mobiliario en el enum + colores/iconos → Task 5.
- `MODE_CATEGORIES.mapa` + `isCategoryVisible`/`visibleOsmCategories` (fix del bug de Herramientas/mapDisplayMode) → Task 6.
- Props para `activeBuildingId` (disclosure progresiva) listas para Plan 2/3 → Task 7.
- Convención real de "migraciones" de este repo (`db.go`, no `migrations/*.sql`) → corregido en Task 1 tras revisar el código (el spec original asumía un archivo de migración aislado; esta es una corrección de implementación, no un cambio de comportamiento).
- `polygonsData.ts`/`mobiliarioData.ts` dejan de ser "fuente de pines" (spec, sección Frontend) → Task 8 corta la aggregación en `INITIAL_EVENTS`, gap encontrado al escribir Plan 2 que de otro modo produciría pines duplicados.

**Placeholder scan:** No TBD/TODO; cada step tiene código real o un comando real de verificación.

**Type consistency:** `osmimport.CategoryForLayer`/`BuildOsmTags`/`PolygonCentroid`/`ExtractOsmID` (Task 2) se usan con las mismas firmas en Task 3. `visibleOsmCategories`/`activeBuildingId`/`setActiveBuildingId` (Task 6) se pasan con esos mismos nombres en Task 7. `Geometry *string` y `OsmTags *string` (`json:"osmTags"`, Task 4) son los campos que Plan 2 lee (`r.geometry`, `r.osmTags`) para extruir buildings con su altura real.
