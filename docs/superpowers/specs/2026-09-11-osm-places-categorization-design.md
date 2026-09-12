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
- **Reducir carga cognitiva sin borrar datos**: los pines OSM que caen geométricamente dentro de un edificio (los 4146 de `valdivia_buildings.json` + las 13 universidades) quedan ocultos por defecto y solo se muestran al hacer click sobre el volumen 3D de ese edificio específico. Nada se elimina — se redistribuye la revelación en el tiempo/interacción.

## Fuera de alcance

- Generar embeddings o vectores reales. Solo se deja la columna `osm_tags` + `category` como insumo.
- Cambiar el diseño visual (`pinDesignSystem.ts`) de categorías ya soportadas.
- Re-scraping o actualización periódica desde Overpass (import es one-off, re-corrible).
- Anidamiento recursivo (edificio dentro de edificio) — se resuelve al edificio contenedor más pequeño por área si hay ambigüedad, sin jerarquías multinivel.

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
  parent_building_id INT REFERENCES osm_places(id),    -- NULL = visible por defecto; seteado = oculto hasta click en ese building
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX osm_places_geom_idx ON osm_places USING GIST (geom);
CREATE INDEX osm_places_category_idx ON osm_places (category);
CREATE INDEX osm_places_parent_building_idx ON osm_places (parent_building_id);
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

**Paso final del import — calcular `parent_building_id`:** una vez insertadas todas las filas, un `UPDATE` recorre las filas de tipo punto (`ST_GeometryType(geom) = 'ST_Point'`) y para cada una busca la fila de categoría `edificio`/`universidad` cuyo polígono la contiene:

```sql
UPDATE osm_places op
SET parent_building_id = b.id
FROM (
  SELECT DISTINCT ON (child.id) child.id AS child_id, building.id AS building_id
  FROM osm_places child
  JOIN osm_places building
    ON building.category IN ('edificio', 'universidad')
   AND ST_GeometryType(building.geom::geometry) IN ('ST_Polygon', 'ST_MultiPolygon')
   AND ST_Contains(building.geom::geometry, child.geom::geometry)
  WHERE ST_GeometryType(child.geom::geometry) = 'ST_Point'
    AND child.category NOT IN ('edificio', 'universidad')
  ORDER BY child.id, ST_Area(building.geom::geometry) ASC  -- building contenedor más chico gana si hay solape
) b
WHERE op.id = b.child_id;
```

Un building nunca se auto-anida (`child.category NOT IN ('edificio','universidad')` lo excluye de ser hijo de otro building). Re-corrible: el `UPDATE` es idempotente sobre el estado final de la tabla.

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

**Filtro por defecto + nuevo param `buildingId`:** siguiendo el mismo patrón que ya existe para zonas (línea 203, `AND NOT EXISTS (... z.category IN ('edificio','reserva') ...)`), se agrega:

```go
if buildingId := r.URL.Query().Get("buildingId"); buildingId != "" {
    // Modo "dentro del edificio": solo lo anidado en ESE building
    sqlQuery += fmt.Sprintf(" AND op_ref.parent_building_id = $%d", paramCount)
    args = append(args, buildingId)
    paramCount++
} else {
    // Modo normal: oculta cualquier osm_place anidado en un building
    sqlQuery += " AND (op_ref.parent_building_id IS NULL OR op_ref.id IS NULL)"
}
```

(`op_ref` referencia la columna `parent_building_id` expuesta desde la subquery `osm_places`; el nombre exacto de la columna intermedia se resuelve en el plan de implementación — la subquery unificada `u` hoy no expone columnas por-fuente, así que `parent_building_id`/`id` de `osm_places` deben propagarse hasta `u` igual que se hace con `containing_zone_ids` para `company_branches`/`events`.) Buildings (`category IN ('edificio','universidad')`) siempre se devuelven sin importar `parent_building_id` — son el contenedor, no lo contenido.

### Frontend — render nativo, NO el pipeline interactivo

Corrección de alcance tras revisar con el usuario: los pines OSM actuales que le gustan (`mobiliario-layer`, `MapLibreContainer.web.tsx:661-684`) son una **layer nativa de MapLibre GL** (`type: 'symbol'`, WebGL, sin DOM) — círculo/icono chico, sin título visible, sin click handler, `minzoom: 15`. Esto NO es CSS y NO pasa por `renderPinMarker.ts`/`pinDesignSystem.ts` (esos son pines DOM interactivos con click `'full'`/`'toggle'`, family `plaque`/`shield`/etc). El usuario quiere mantener exactamente este comportamiento (liviano, fijo, no clickeable) para **todos** los datasets OSM, no migrarlos al sistema de pines interactivo.

Cambios:

- `mobiliario-layer` deja de leer `coords/mobiliario.json` local y de usar `['get', 'amenity']` crudo como `icon-image`. Pasa a leer un **nuevo source `osm-places-source`** poblado desde `/api/v1/places/search` (mismo fetch/debounce que ya hace `fetchRealPlaces` en `useHomeScreenState.ts`, filtrando client-side los resultados con `organizer === 'OpenStreetMap'` o exponiendo `source_layer` en la respuesta del handler para filtrar limpio), y usa `['get', 'category']` (valor normalizado del enum) como `icon-image`.
- Se generaliza el patrón de `addSvgImageToMap` (líneas 632-652) a las 13 categorías OSM en juego (parque, agua, humedal, universidad, hospital, clinica, bombero, carabinero, camara, escultura, estatua, torreon, arte, edificio, banca, basurero, bebedero, bano), reusando los mismos glifos que ya expone `getCategoryIcon` (`src/utils/mapUtils.ts`) para que el icono coincida visualmente con el resto del sistema de categorías. Un solo layer `symbol` con `icon-image: ['get','category']` reemplaza los 4 `addImage` hardcodeados actuales.
- Se agrega `text-field: ['get', 'name']` con `text-anchor: 'top'` / `icon-anchor: 'bottom'` (icono arriba, título debajo, como pidió el usuario), visible solo desde cierto zoom (`text-optional: true`, mismo `minzoom` o uno mayor para no saturar) para no repetir el problema de "mil pines" original.
- Sin `map.on('click', ...)` para esta layer — se mantiene no interactivo, igual que hoy.
- `app-turismo/src/data/polygonsData.ts` y `app-turismo/src/data/mobiliarioData.ts` se eliminan como fuente de datos bundleada; el JS/CSS de pines interactivos (`renderPinMarker.ts` y compañía) no cambia — nunca los usó, así que no hay riesgo de romper esa parte.
- `DeckGL3DContainer.web.tsx` deja de importar `valdivia_buildings.json`; recibe los buildings desde `/api/v1/places/search` (filtrando `source_layer === 'buildings'`) y reconstruye `{height, levels, type}` desde `osm_tags`. Los buildings siguen siendo polígonos extruidos (deck.gl), no pines — no pasan por `osm-places-source`/`mobiliario-layer`.
- `useHomeScreenState.ts` no cambia en su lógica de fetch — pero **si** al fix del bug de acumulación (pines que nunca se limpian al cambiar bounds, ver conversación previa) no se hace en este trabajo, hay que evitar que los resultados `osm_places` entren al mismo array acumulativo `events`; deben ir a un estado aparte alimentando `osm-places-source` directamente, para no heredar ese bug.

### Disclosure progresiva: click en edificio revela sus pines anidados

Estado nuevo, mismo patrón que `activeNestedZone` ya usado para zonas de negocio: `activeBuildingId: number | null` en `useHomeScreenState.ts`. Cuando tiene valor, el fetch de `osm-places-source` agrega `&buildingId=<id>` — trayendo *solo* lo anidado en ese building (el resto del mapa sigue mostrando todo lo no-anidado normalmente, sin necesidad de ocultar nada más). Al deseleccionar (click afuera, o click en otro building) vuelve a `null` y el source recarga sin `buildingId`.

Dos superficies de click sobre el volumen del edificio, hoy sin handler (ninguna rompe algo existente al agregarlo):

- **DeckGL3DContainer.web.tsx** (`buildings3DLayer`, línea 218-263): ya es `pickable: true` pero no tiene `onClick`. Se agrega:
  ```ts
  onClick: (info: any) => {
    if (info.object?.properties?.id) setActiveBuildingId(info.object.properties.id);
  }
  ```
  Requiere que el GeoJSON que alimenta esta layer (ahora viniendo de `/api/v1/places/search`, `source_layer === 'buildings'`) traiga el `id` numérico de `osm_places` en `properties`, no solo el `osm_id` original de Overpass.
- **MapLibreContainer.web.tsx** (vista 2D estándar): el layer `building-3d` existente es del basemap genérico (OpenMapTiles), sin nuestros IDs — hoy solo se usa para oclusión de pines (`queryRenderedFeatures`, línea 866). Para que el click funcione también en 2D se agrega un layer propio `osm-buildings-layer` (`fill-extrusion` o `fill`, según si hay pitch), sourced desde los mismos resultados `source_layer === 'buildings'`, con `map.on('click', 'osm-buildings-layer', (e) => setActiveBuildingId(e.features[0].properties.id))`. Este layer nuevo convive con `building-3d` (uno es visual/basemap, el otro es el hitbox + volumen real de nuestros datos).

Si un building no tiene nada anidado (la gran mayoría de los 4146 son residenciales sin mobiliario/POIs adentro), el click no revela nada nuevo — comportamiento correcto, no es un bug.

## Testing

- Backend: test de integración que corre el import script contra una DB de test con fixtures pequeños (2-3 features por layer) y verifica `category`/`osm_tags` resultantes por cada regla de la tabla de mapeo.
- Backend: test de `PlacesSearchHandler` verificando que un `osm_places` row aparece en `data.results` con bounds que lo incluyen/excluyen.
- Frontend: verificar manualmente en `DeckGL3DContainer` que los buildings siguen extruyendo con altura correcta tras el cambio de fuente de datos.
- Frontend: verificar que `osm-places-source`/`mobiliario-layer` sigue sin click handler y sin afectar performance al hacer zoom out (que no reaparezca el enjambre de pines de la conversación original).
- Verificar visualmente que las 4 categorías nuevas de mobiliario (`banca`/`basurero`/`bebedero`/`bano`) y el resto de categorías OSM tienen icono distinguible vía `icon-image: ['get','category']`.
- Backend: test que el `UPDATE` de `parent_building_id` asigna correctamente un punto dentro de un building con fixture controlado (polígono conocido + punto adentro/afuera), y que con dos buildings solapados gana el de menor área.
- Backend: test de `PlacesSearchHandler` con `buildingId` presente vs ausente — confirma que sin el param los anidados no aparecen, y con el param aparecen solo los de ese building.
- Frontend: click manual sobre un building con contenido conocido (ej. una universidad con bancas adentro) en ambos containers (`DeckGL3DContainer` y `MapLibreContainer.web.tsx`) y confirmar que `osm-places-source` se actualiza y vuelve a su estado normal al deseleccionar.

## Riesgos / decisiones abiertas para el plan de implementación

- Confirmar convención de carpeta de migraciones del backend (no se encontró aún — el plan de implementación debe revisarla antes de crear el archivo SQL).
- Confirmar si `PARQUES_EVENTS`/spots de parques (`parquesData.ts`, separado de `polygonsData.ts`) se mantienen intactos — no están en el alcance de este cambio, solo `polygonsData.ts` y `mobiliarioData.ts`.
- Propagar `parent_building_id`/`id` de `osm_places` hasta la subquery unificada `u` en `places_handler.go` sin romper el resto de columnas del `UNION ALL` (las otras 3 fuentes deben devolver `NULL::int as parent_building_id` para que las columnas calcen).
- Definir si `osm-buildings-layer` nuevo en `MapLibreContainer.web.tsx` usa `fill` o `fill-extrusion` (afecta si se ve "plano" vs con volumen en 2D) — decisión visual que el plan de implementación puede resolver probando ambas.
- Los 4146 buildings + polígonos de universidades viajan por `/api/v1/places/search` en cada bounds-fetch; evaluar si conviene cachear ese subconjunto client-side (cambia poco) en vez de re-pedirlo en cada pan, para no golpear la DB con `ST_Intersects` sobre polígonos grandes constantemente.
