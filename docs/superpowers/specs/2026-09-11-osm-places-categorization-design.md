# Unificación de pines OSM al sistema de categorías + prep. embeddings

Fecha: 2026-09-11

## Problema

Los pines cargados desde OSM/Overpass viven en dos formas distintas, ninguna alineada con el sistema de categorías/diseño visual del resto del mapa:

1. **Ya pasan por `TurismoEvent.category`** pero vía parsers ad-hoc en `app-turismo/src/data/polygonsData.ts` (parques, agua, humedales, universidades, hospitales, seguridad, estructuras) — funcionan, pero son 7 datasets JSON estáticos bundleados (~11MB) con lógica de mapeo duplicada por archivo.
2. **Fuera del sistema por completo**:
   - `app-turismo/src/data/mobiliarioData.ts` usa un tipo propio (`FurnitureAmenity`: bench/waste_basket/drinking_water/toilets) que no es `TurismoEvent.category`, sin shape/color/icono del `pinDesignSystem.ts`.
   - `app-turismo/src/data/valdivia_buildings.json` (4146 features) no pasa por ningún parser hacia `TurismoEvent`; se importa crudo solo en `DeckGL3DContainer.web.tsx` para extrusión 3D.

Además no existe ningún campo estructurado que sirva de insumo para generar embeddings semánticos más adelante (búsqueda "restaurantes cerca del río", recomendaciones, etc).

## Objetivo

- Todos los datasets OSM (parques, agua, humedales, universidades, hospitales, seguridad, estructuras, mobiliario, buildings) sirven pines a través del **mismo pipeline** que ya usa el resto de la app: `GET /api/v1/places/search` (`backend/handlers/places_handler.go`), con `category` perteneciente al enum existente `TurismoEvent.category`.
- Cada pin queda con datos crudos estructurados (`osm_tags` JSONB) suficientes para, en una fase posterior no cubierta por este spec, generar texto y vectorizarlo.
- El frontend deja de bundlear los JSON de `coords/*.json` y `valdivia_buildings.json` como fuente de pines.

## Fuera de alcance

- Generar embeddings o vectores reales. Solo se deja la columna `osm_tags` + `category` como insumo.
- Cambiar el diseño visual (`pinDesignSystem.ts`) de categorías ya soportadas.
- Re-scraping o actualización periódica desde Overpass (import es one-off, re-corrible).

## Arquitectura

### Tabla nueva: `osm_places`

```sql
CREATE TABLE osm_places (
  id              SERIAL PRIMARY KEY,
  osm_id          TEXT UNIQUE NOT NULL,        -- properties['@id'] de Overpass; fallback índice si falta
  source_layer    TEXT NOT NULL,               -- 'parques','agua','humedales','universidades','hospitales',
                                                -- 'seguridad','estructuras','mobiliario','buildings'
  category        TEXT NOT NULL,               -- valor de TurismoEvent.category
  name            TEXT,
  address         TEXT,
  target_audience TEXT NOT NULL DEFAULT 'all',
  lat             DOUBLE PRECISION NOT NULL,
  lng             DOUBLE PRECISION NOT NULL,
  geom            geography(Geometry, 4326) NOT NULL,  -- Point o Polygon según feature original
  osm_tags        JSONB NOT NULL DEFAULT '{}'::jsonb,  -- properties OSM relevantes, ver mapeo abajo
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX osm_places_geom_idx ON osm_places USING GIST (geom);
CREATE INDEX osm_places_category_idx ON osm_places (category);
```

Migración vive en `backend/database/migrations/` siguiendo la convención existente del repo (revisar carpeta antes de nombrar el archivo).

### Extensión del enum de categoría

`app-turismo/src/components/Map/types.ts` (`TurismoEvent.category`) suma 4 valores nuevos para mobiliario:

```ts
| 'banca'
| 'basurero'
| 'bebedero'
| 'bano'
```

`app-turismo/src/utils/mapUtils.ts` (`getCategoryColor`, `getCategoryIcon`) suma un caso para cada uno de los 4. `pinDesignSystem.ts` no necesita cambios estructurales — solo entra a los `switch`/mapas existentes por categoría igual que las demás.

Todas las demás categorías (parque, agua, humedal, universidad, hospital, clinica, bombero, carabinero, camara, escultura, estatua, torreon, arte, edificio) ya existen — se reusan tal cual.

### Reglas de mapeo categoría (portadas 1:1 desde `polygonsData.ts`)

| source_layer | Regla | category |
|---|---|---|
| parques | fijo | `parque` |
| agua | fijo | `agua` |
| humedales | fijo | `humedal` |
| universidades | fijo | `universidad` |
| hospitales | `amenity === 'clinic'` → `clinica`, si no | `hospital` |
| seguridad | `amenity === 'police'` → `carabinero`, `amenity === 'fire_station'` → `bombero`, si no | `camara` |
| estructuras | `tourism === 'artwork'` + `artwork_type === 'statue'` → `estatua`, `=== 'sculpture'` → `escultura`, si no artwork → `arte`; `man_made === 'tower' \|\| building === 'tower'` → `torreon` | ver `polygonsData.ts:181-201` |
| mobiliario | `amenity === 'bench'` → `banca`, `'waste_basket'` → `basurero`, `'drinking_water'` → `bebedero`, `'toilets'` → `bano`; otros se descartan (igual que hoy en `mobiliarioData.ts:21-28`) | — |
| buildings | `properties.type === 'university'` → `universidad`, si no | `edificio` |

`osm_tags` guarda, por feature, las properties OSM relevantes ya usadas hoy en la UI: `name`, `operator`, `opening_hours`, `phone`, `addr:street`/`object:street`, `amenity`, `tourism`, `artwork_type`, `man_made`, `building`, y para buildings además `height`, `levels`, `type`.

### Import (script one-off)

`backend/scripts/import_osm_places.go`, mismo patrón que `seed_business_accounts.go`: lee cada JSON desde `app-turismo/coords/*.json` y `app-turismo/src/data/valdivia_buildings.json`, aplica la tabla de mapeo de arriba, hace `INSERT ... ON CONFLICT (osm_id) DO UPDATE` (igual patrón que `upsertGooglePlace` en `google_places_handler.go`). Se corre manualmente una vez (`go run scripts/import_osm_places.go`); re-corrible sin duplicar porque el conflicto es sobre `osm_id`.

Para Point: `lat/lng` = coordinates directas. Para Polygon/MultiPolygon: centro vía la misma lógica que `getPolygonCenter` (portada a Go o pre-calculada). El `geom` guarda la geometría original (Point o Polygon) para que `ST_Intersects` con el bounding box del mapa siga funcionando igual que con `company_branches`/`events`.

### Integración con `places_handler.go`

Se agrega una 4ta rama `UNION ALL` al query existente (líneas 93-166), leyendo de `osm_places`:

```sql
SELECT
  'osm-' || op.id::text as id,
  op.name as title,
  '' as description,
  op.lat, op.lng,
  op.category,
  'OpenStreetMap' as organizer,
  COALESCE(op.address, '') as address,
  '24/7' as time,
  op.geom,
  '' as image_url,
  NULL::int as company_id,
  '{}'::int[] as containing_zone_ids,
  op.target_audience,
  false as has_active_update
FROM osm_places op
```

El resto del query (filtro `viewMode`, búsqueda por texto, bounds, `zoneId`) aplica sin cambios adicionales — ya opera sobre la vista unificada `u`.

### Frontend

- `app-turismo/src/data/polygonsData.ts` y `app-turismo/src/data/mobiliarioData.ts` se eliminan como fuente de pines. Si `PARQUES_EVENTS`/`Spot[]` u otro export de esos archivos se usa para algo más que pintar pines (revisar antes de borrar: polígonos de sectores, spots dentro de parques), esa parte se preserva o migra por separado — no tocar sin verificar todos los usos.
- `DeckGL3DContainer.web.tsx` deja de importar `valdivia_buildings.json`; recibe los buildings desde la respuesta de `/api/v1/places/search` (filtrando `category IN ('edificio','universidad')` y `source_layer === 'buildings'` si necesitamos distinguir de otros edificios reales de `company_branches`) y reconstruye `{height, levels, type}` desde `osm_tags`.
- `useHomeScreenState.ts` no cambia — ya consume `/api/v1/places/search` y agrupa por `data.results`.

## Testing

- Backend: test de integración que corre el import script contra una DB de test con fixtures pequeños (2-3 features por layer) y verifica `category`/`osm_tags` resultantes por cada regla de la tabla de mapeo.
- Backend: test de `PlacesSearchHandler` verificando que un `osm_places` row aparece en `data.results` con bounds que lo incluyen/excluyen.
- Frontend: verificar manualmente en `DeckGL3DContainer` que los buildings siguen extruyendo con altura correcta tras el cambio de fuente de datos.
- Verificar visualmente que `banca`/`basurero`/`bebedero`/`bano` tienen pin distinguible (no caen en el color/icono default).

## Riesgos / decisiones abiertas para el plan de implementación

- Confirmar convención de carpeta de migraciones del backend (no se encontró aún — el plan de implementación debe revisarla antes de crear el archivo SQL).
- Confirmar si `PARQUES_EVENTS`/spots de parques (`parquesData.ts`, separado de `polygonsData.ts`) se mantienen intactos — no están en el alcance de este cambio, solo `polygonsData.ts` y `mobiliarioData.ts`.
