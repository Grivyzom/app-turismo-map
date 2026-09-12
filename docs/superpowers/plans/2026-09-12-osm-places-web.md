# OSM Places — Web Rendering Implementation Plan (Plan 2 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the web (MapLibre GL + optional DeckGL 3D view), render every OSM/Overpass category through fast, non-interactive native WebGL layers fed by `/api/v1/places/search` instead of bundled local JSON — respecting the Herramientas/mode filter (`visibleOsmCategories`) and hiding pins nested inside a building until that building's 3D volume is clicked (`activeBuildingId`).

**Architecture:** `MapLibreContainer.web.tsx` fetches OSM places for the current viewport, splits the result into two GeoJSON sources (points vs. buildings), and renders 4 native layers: mobiliario icons, colored-dot points, text labels, and building fill-extrusions. A `map.setFilter` call reacts to `visibleOsmCategories` changes with no re-fetch. Clicking a building layer calls `onBuildingSelect`, which Plan 1 already wired back into `useHomeScreenState.ts` as `activeBuildingId` — the next fetch includes `&buildingId=<id>` to reveal what's nested inside. `DeckGL3DContainer.web.tsx` gets the same building data (its own fetch, since it's a separate component) and a click handler on its existing `buildings3DLayer`.

**Tech Stack:** MapLibre GL JS (native `symbol`/`circle`/`fill-extrusion` layers), deck.gl (`GeoJsonLayer`), fetch API against the Go backend from Plan 1.

**Spec:** `docs/superpowers/specs/2026-09-11-osm-places-categorization-design.md`
**Depends on:** `docs/superpowers/plans/2026-09-12-osm-places-backend.md` (Plan 1) — needs `/api/v1/places/search` returning `osm_places` rows with `geometry`, and `visibleOsmCategories`/`activeBuildingId`/`onBuildingSelect`/`mapDisplayMode` already threaded onto `MapContainerProps`.

## Global Constraints

- The layers built here stay **non-interactive except the building layer** — no click handler, no hover tooltip, on any point/icon/label layer (spec: "el usuario quiere mantener exactamente este comportamiento... no migrarlos al sistema de pines interactivo").
- `banca`/`basurero`/`bebedero`/`bano` only render when `visibleOsmCategories` includes them (Plan 1 already restricts that to `mapDisplayMode === 'mapa'`) — this must be a `map.setFilter` call, not a re-fetch, so toggling Herramientas is instant.
- Buildings never render as icons/dots — only as filled polygons via `osm-buildings-layer`.
- Every new source/layer added in the initial `map.on('load', ...)` setup must ALSO be re-added in the `map.on('style.load', ...)` handler (the existing `mobiliario-source`/`mobiliario-layer` this replaces did NOT do this — a latent bug where switching base map style silently drops it. Fix it while touching this code, per "include targeted improvements as part of the design" — don't leave the bug in the new version).

---

## Task 1: Replace `mobiliario-layer` with `osm-places-source` + point/label/mobiliario-icon layers

**Files:**
- Modify: `app-turismo/src/components/Map/MapLibreContainer.web.tsx`

**Interfaces:**
- Consumes: `visibleOsmCategories: string[]`, `mapDisplayMode` (props from `MapContainerProps`, Plan 1 Task 7), `getCategoryColor` (`app-turismo/src/utils/mapUtils.ts`, already imported at line 7), `API_URL`-equivalent (this file currently hardcodes `http://localhost:8080` as a fallback at line ~1413-1415 for `syncZones`; reuse the same `process.env.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080'` pattern for consistency with the rest of this file rather than importing `API_URL` from `config/api.ts`, which this file doesn't currently import).
- Produces: MapLibre source `osm-places-source` (GeoJSON, point-geometry OSM categories only — excludes `edificio`/`universidad`), layers `osm-mobiliario-layer` (symbol, icon-image, the 4 existing bench/waste/water/toilet glyphs), `osm-points-layer` (circle, colored dot for the other 12 point categories), `osm-labels-layer` (symbol, text-only). Task 2 (buildings) is a sibling addition in the same component; Task 3 (DeckGL) is independent and doesn't consume anything from this task.

This file has no test harness (see Plan 1 Task 5's note — `app-turismo` has no Jest config). Verification is running the dev server and visually confirming behavior in the browser, using the `run` skill or a manual `npx expo start --web` session.

- [ ] **Step 1: Remove the old mobiliario source/layer block**

In `app-turismo/src/components/Map/MapLibreContainer.web.tsx`, delete lines 631-684 (the `addSvgImageToMap` helper through the `mobiliario-layer` `map.addLayer` call) — everything from:

```ts
      // ── Native Mobiliario Layer (Static High-Perf POIs) ──
      const addSvgImageToMap = (id: string, svgString: string) => {
```

through the closing of:

```ts
        map.addLayer(
          {
            id: 'mobiliario-layer',
            ...
          },
          buildingBeforeId,
        );
      }
```

Keep the `buildingBeforeId` declaration (line 659, `const buildingBeforeId = map.getLayer('building-3d') ? 'building-3d' : undefined;`) — it's reused by the cluster layers right after and by Task 2's building layer.

Also remove the now-unused import `import { MOBILIARIO_GEOJSON } from '../../data/mobiliarioData';` (line 17) — nothing else in this file uses it after this deletion (confirm with `grep -n MOBILIARIO_GEOJSON app-turismo/src/components/Map/MapLibreContainer.web.tsx` before deleting the import; it should show zero remaining matches).

- [ ] **Step 2: Add the new props to the component signature**

In the `MapLibreContainer` function's destructured props (starts at line 90), add after the existing `cameraAnimationsEnabled` prop (search for it — it's one of the later props in the list, added when the GTA-V camera feature landed):

```ts
  visibleOsmCategories = [],
  mapDisplayMode,
  activeBuildingId = null,
  onBuildingSelect,
```

- [ ] **Step 3: Add the 4 mobiliario icon images, keyed by category (not raw amenity)**

Add this block right where the deleted block used to start (inside `map.on('load', () => { ... })`, right after the `mapReadyRef.current = true;` / spawn-check block and before the (now Task 2's) building-containment layer code):

```ts
      // ── OSM Places: iconos de mobiliario urbano (los 4 unicos con pictograma propio) ──
      const isDark = mapLayerRef.current === 'dark' || mapLayerRef.current === 'satellite';
      const svgColor = isDark ? '#A0AEC0' : '#4A5568';

      const addSvgImageToMap = (id: string, svgString: string) => {
        if (map.hasImage(id)) return;
        const img = new Image(32, 32);
        img.onload = () => {
          map.addImage(id, img, { pixelRatio: 2 });
        };
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
      };

      addSvgImageToMap(
        'banca',
        `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="${svgColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2"/><path d="M2 18h20"/><path d="M6 12v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>`,
      );
      addSvgImageToMap(
        'basurero',
        `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="${svgColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
      );
      addSvgImageToMap(
        'bebedero',
        `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#63B3ED" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>`,
      );
      addSvgImageToMap(
        'bano',
        `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="${svgColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"/><path d="M18 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"/><path d="M5 8v12"/><path d="M11 8v12"/><path d="M5 13h6"/><path d="M13 8l2 12"/><path d="M19 8l-2 12"/><path d="M14 13h4"/></svg>`,
      );
```

(These are the exact same 4 SVGs that were deleted in Step 1, just re-keyed by category name instead of raw OSM `amenity` value — `banca` was `bench`, `basurero` was `waste_basket`, `bebedero` was `drinking_water`, `bano` was `toilets`.)

- [ ] **Step 4: Add the `osm-places-source` and its 3 layers**

Right after Step 3's 4 `addSvgImageToMap` calls, still inside `map.on('load', ...)`:

```ts
      const buildingBeforeId = map.getLayer('building-3d') ? 'building-3d' : undefined;

      const OSM_POINT_COLORS: Record<string, string> = {
        agua: '#3B82F6',
        humedal: '#6B5A47',
        hospital: '#DC2626',
        clinica: '#F87171',
        bombero: '#E53E3E',
        carabinero: '#2B6CB0',
        camara: '#718096',
        escultura: '#6B7280',
        estatua: '#8B7355',
        torreon: '#92400E',
        arte: '#D97706',
        parque: '#10B981',
      };

      if (!map.getSource('osm-places-source')) {
        map.addSource('osm-places-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });

        map.addLayer(
          {
            id: 'osm-points-layer',
            type: 'circle',
            source: 'osm-places-source',
            minzoom: 13,
            filter: ['!', ['in', ['get', 'category'], ['literal', ['banca', 'basurero', 'bebedero', 'bano']]]],
            paint: {
              'circle-radius': 5,
              'circle-color': [
                'match',
                ['get', 'category'],
                ...Object.entries(OSM_POINT_COLORS).flatMap(([cat, color]) => [cat, color]),
                '#3B82F6',
              ],
              'circle-stroke-width': 1.5,
              'circle-stroke-color': '#ffffff',
              'circle-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 13.5, 1],
              'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 13.5, 1],
            },
          },
          buildingBeforeId,
        );

        map.addLayer(
          {
            id: 'osm-mobiliario-layer',
            type: 'symbol',
            source: 'osm-places-source',
            minzoom: 15,
            filter: ['in', ['get', 'category'], ['literal', ['banca', 'basurero', 'bebedero', 'bano']]],
            layout: {
              'icon-image': ['get', 'category'],
              'icon-size': 0.8,
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
            },
            paint: {
              'icon-opacity': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.5, 1],
            },
          },
          buildingBeforeId,
        );

        map.addLayer(
          {
            id: 'osm-labels-layer',
            type: 'symbol',
            source: 'osm-places-source',
            minzoom: 16,
            layout: {
              'text-field': ['get', 'name'],
              'text-size': 10,
              'text-anchor': 'top',
              'text-offset': [0, 0.6],
              'text-optional': true,
              'text-allow-overlap': false,
            },
            paint: {
              'text-color': isDark ? '#E2E8F0' : '#1F2937',
              'text-halo-color': isDark ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.85)',
              'text-halo-width': 1.2,
            },
          },
          buildingBeforeId,
        );
      }
```

- [ ] **Step 5: Add the fetch effect that populates `osm-places-source`**

Add a new `useEffect`, placed near the other `useEffect`s in this component (any location after the main map-setup `useEffect` is fine — this one is independent and only needs `mapRef.current` to exist):

```ts
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current || !currentBounds) return;

    let cancelled = false;
    const baseUrl =
      process.env.EXPO_PUBLIC_BACKEND_URL ||
      process.env.EXPO_PUBLIC_API_URL ||
      'http://localhost:8080';

    const fetchOsmPlaces = async () => {
      try {
        const boundsQuery = `minLat=${currentBounds.minLat}&maxLat=${currentBounds.maxLat}&minLng=${currentBounds.minLng}&maxLng=${currentBounds.maxLng}`;
        const urls = [`${baseUrl}/api/v1/places/search?${boundsQuery}`];
        if (activeBuildingId) {
          urls.push(`${baseUrl}/api/v1/places/search?${boundsQuery}&buildingId=${activeBuildingId}`);
        }

        const responses = await Promise.all(
          urls.map((u) => fetch(u).then((r) => r.json()).catch(() => ({ results: [] }))),
        );
        if (cancelled) return;

        const osmResults = responses
          .flatMap((r) => r.results || [])
          .filter((r: any) => r.organizer === 'OpenStreetMap');

        const pointFeatures = osmResults
          .filter((r: any) => r.category !== 'edificio' && r.category !== 'universidad')
          .map((r: any) => ({
            type: 'Feature',
            properties: { category: r.category, name: r.title || '' },
            geometry: r.geometry
              ? JSON.parse(r.geometry)
              : { type: 'Point', coordinates: [r.longitude, r.latitude] },
          }));

        const source = map.getSource('osm-places-source') as maplibregl.GeoJSONSource | undefined;
        if (source) {
          source.setData({ type: 'FeatureCollection', features: pointFeatures } as any);
        }

        if (syncOsmBuildingsRef.current) {
          syncOsmBuildingsRef.current(osmResults);
        }
      } catch (err) {
        console.warn('[MapLibreContainer] Error fetching osm places:', err);
      }
    };

    fetchOsmPlaces();
    return () => {
      cancelled = true;
    };
  }, [currentBounds, activeBuildingId]);
```

(`syncOsmBuildingsRef` is defined and assigned in Task 2 — it receives the SAME fetch response so buildings don't need a second network round-trip. Task 2 must be done before this compiles; if doing Task 1 in isolation, temporarily stub `const syncOsmBuildingsRef = useRef<(results: any[]) => void>(() => {});` near the other `xxxRef` declarations from Step 6 below, and Task 2 will replace the stub's assignment.)

- [ ] **Step 6: Add the filter effect for `visibleOsmCategories`**

Add another `useEffect`, right after Step 5's:

```ts
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;
    if (!map.getLayer('osm-points-layer') || !map.getLayer('osm-mobiliario-layer')) return;

    const categories = visibleOsmCategories.length > 0 ? visibleOsmCategories : ['__none__'];
    const categoryFilter = ['in', ['get', 'category'], ['literal', categories]];

    map.setFilter('osm-points-layer', [
      'all',
      categoryFilter,
      ['!', ['in', ['get', 'category'], ['literal', ['banca', 'basurero', 'bebedero', 'bano']]]],
    ] as any);
    map.setFilter('osm-mobiliario-layer', [
      'all',
      categoryFilter,
      ['in', ['get', 'category'], ['literal', ['banca', 'basurero', 'bebedero', 'bano']]],
    ] as any);
    map.setFilter('osm-labels-layer', categoryFilter as any);
  }, [visibleOsmCategories]);
```

(`['__none__']` as the fallback when `visibleOsmCategories` is empty — e.g. Herramientas "Ocultar Pines" — guarantees the `in` filter matches nothing, rather than an empty `['literal', []]` array which MapLibre may treat differently across versions; this is the same defensive trick used implicitly by the rest of the filter logic in this file.)

- [ ] **Step 7: Re-add everything in `map.on('style.load', ...)`**

Find the `map.on('style.load', () => { ... })` handler (starts at line 1328) and its "Re-add cluster source+layers after style change" block (line 1349-1395). Add, right after that block's closing `}` and before `// Immediately sync cluster data after style reload`:

```ts
      // Re-add OSM places source+layers after style change (base map switch)
      if (!map.getSource('osm-places-source')) {
        const reloadBuildingBeforeId = map.getLayer('building-3d') ? 'building-3d' : undefined;
        map.addSource('osm-places-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        map.addLayer(
          {
            id: 'osm-points-layer',
            type: 'circle',
            source: 'osm-places-source',
            minzoom: 13,
            filter: ['!', ['in', ['get', 'category'], ['literal', ['banca', 'basurero', 'bebedero', 'bano']]]],
            paint: {
              'circle-radius': 5,
              'circle-color': [
                'match',
                ['get', 'category'],
                ...Object.entries(OSM_POINT_COLORS_RELOAD).flatMap(([cat, color]) => [cat, color]),
                '#3B82F6',
              ],
              'circle-stroke-width': 1.5,
              'circle-stroke-color': '#ffffff',
            },
          },
          reloadBuildingBeforeId,
        );
        map.addLayer(
          {
            id: 'osm-mobiliario-layer',
            type: 'symbol',
            source: 'osm-places-source',
            minzoom: 15,
            filter: ['in', ['get', 'category'], ['literal', ['banca', 'basurero', 'bebedero', 'bano']]],
            layout: { 'icon-image': ['get', 'category'], 'icon-size': 0.8, 'icon-allow-overlap': true, 'icon-ignore-placement': true },
          },
          reloadBuildingBeforeId,
        );
        map.addLayer(
          {
            id: 'osm-labels-layer',
            type: 'symbol',
            source: 'osm-places-source',
            minzoom: 16,
            layout: { 'text-field': ['get', 'name'], 'text-size': 10, 'text-anchor': 'top', 'text-offset': [0, 0.6], 'text-optional': true },
          },
          reloadBuildingBeforeId,
        );
      }
      if (syncOsmPlacesRef.current) {
        syncOsmPlacesRef.current();
      }
```

Since `OSM_POINT_COLORS` from Step 4 is a local `const` scoped inside the `map.on('load', ...)` callback, it isn't in scope inside the separate `map.on('style.load', ...)` callback. Move the `OSM_POINT_COLORS` declaration (Step 4) to component scope instead — right after the component's other top-of-body constants, before the `useEffect` that contains `map.on('load', ...)` — so both callbacks can reference it directly as `OSM_POINT_COLORS` (delete the `_RELOAD` suffix used above, it was only there to flag this fix; use plain `OSM_POINT_COLORS` in both places once it's moved to component scope).

Add `syncOsmPlacesRef` near the other `xxxRef` declarations (alongside `syncClustersRef` etc, Step 6's list around line 204-211):

```ts
  const syncOsmPlacesRef = useRef<() => void>(() => {});
```

Assign it right after the fetch `useEffect` from Step 5 — actually since `fetchOsmPlaces` is defined inside that `useEffect`'s closure, expose it via the ref by wrapping: change Step 5's `useEffect` body so `fetchOsmPlaces` is also stored on the ref before being called:

```ts
    syncOsmPlacesRef.current = fetchOsmPlaces;
    fetchOsmPlaces();
```

(Insert that `syncOsmPlacesRef.current = fetchOsmPlaces;` line immediately before the existing `fetchOsmPlaces();` call at the end of Step 5's `useEffect` body.)

- [ ] **Step 8: Manual verification**

Run the dev server (`cd app-turismo && npx expo start --web`, or use the `run` skill if configured for this project), open the map, and check:
1. Zoom into a park or the riverbank at street level (zoom ≥ 13) — colored dots for `agua`/`parque`/etc. appear.
2. Zoom further (≥ 15) near a known bench/waste-basket cluster (check `coords/mobiliario.json` for a real lat/lng to navigate to) — the bench/basurero icons appear.
3. Zoom further (≥ 16) — text labels appear below icons/dots (only for features that have a `name` in OSM; most benches won't).
4. Open "Herramientas", switch to "Comercial" mode — all OSM dots/icons/labels disappear instantly (no network request in the browser's Network tab — confirms `map.setFilter` is client-side, not triggering the fetch effect).
5. Switch back to "Mapa" mode — mobiliario icons + hospital/carabinero/etc. dots reappear; switch to "Turismo" — mobiliario disappears but `parque`/`agua`/`humedal`/`escultura`/etc. dots stay.
6. Switch the map style (dark/light/satellite via the layer picker) — confirm the OSM dots/icons/labels are still visible after the style finishes loading (this is the style.load regression check from Step 7).

- [ ] **Step 9: Commit**

```bash
git add app-turismo/src/components/Map/MapLibreContainer.web.tsx
git commit -m "$(cat <<'EOF'
feat: reemplazar mobiliario-layer por osm-places-source generalizado

Todas las categorias OSM (no solo mobiliario) ahora se pintan como capas
nativas de MapLibre (circle + symbol), alimentadas por /api/v1/places/search
y filtradas client-side via map.setFilter reactivo a visibleOsmCategories.
Se corrige tambien un bug preexistente: la capa desaparecia al cambiar el
estilo del mapa porque no se re-agregaba en style.load.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `osm-buildings-layer` — click reveals nested pins

**Files:**
- Modify: `app-turismo/src/components/Map/MapLibreContainer.web.tsx`

**Interfaces:**
- Consumes: `osmResults` array passed by Task 1's fetch effect via `syncOsmBuildingsRef.current(osmResults)`; `onBuildingSelect` prop (Plan 1 Task 7).
- Produces: MapLibre source `osm-buildings-source` (GeoJSON, `category IN ('edificio','universidad')` only, real Polygon geometry), layer `osm-buildings-layer` (`fill-extrusion`), a `map.on('click', 'osm-buildings-layer', ...)` handler that calls `onBuildingSelect(numericId)` / `onBuildingSelect(null)` on toggle.

- [ ] **Step 1: Replace the `syncOsmBuildingsRef` stub with the real implementation**

Add `syncOsmBuildingsRef` next to `syncOsmPlacesRef` (Task 1 Step 7):

```ts
  const syncOsmBuildingsRef = useRef<(results: any[]) => void>(() => {});
```

Inside `map.on('load', () => { ... })`, right after Task 1 Step 4's 3 layers (`osm-points-layer`, `osm-mobiliario-layer`, `osm-labels-layer`), add:

```ts
      if (!map.getSource('osm-buildings-source')) {
        map.addSource('osm-buildings-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        map.addLayer(
          {
            id: 'osm-buildings-layer',
            type: 'fill-extrusion',
            source: 'osm-buildings-source',
            minzoom: 14,
            paint: {
              'fill-extrusion-color': '#475569',
              'fill-extrusion-height': ['coalesce', ['get', 'height'], 8],
              'fill-extrusion-opacity': 0.35,
            },
          },
          buildingBeforeId,
        );
      }

      syncOsmBuildingsRef.current = (osmResults: any[]) => {
        const buildingFeatures = osmResults
          .filter((r: any) => r.category === 'edificio' || r.category === 'universidad')
          .map((r: any) => ({
            type: 'Feature',
            properties: {
              id: Number(String(r.id).replace('osm-', '')),
              category: r.category,
              name: r.title || '',
            },
            geometry: r.geometry
              ? JSON.parse(r.geometry)
              : { type: 'Point', coordinates: [r.longitude, r.latitude] },
          }))
          .filter((f: any) => f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon');

        const source = map.getSource('osm-buildings-source') as maplibregl.GeoJSONSource | undefined;
        if (source) {
          source.setData({ type: 'FeatureCollection', features: buildingFeatures } as any);
        }
      };

      map.on('click', 'osm-buildings-layer', (e) => {
        if (!e.features || e.features.length === 0) return;
        const id = e.features[0].properties?.id;
        if (typeof id !== 'number' || !onBuildingSelect) return;
        onBuildingSelect(activeBuildingIdRef.current === id ? null : id);
      });
```

`activeBuildingIdRef` mirrors the existing `mapLayerRef`/`sectorsDataRef` "ref shadowing a prop so event handlers registered once can read the latest value" pattern already used throughout this file. Add it near those other `xxxRef` prop-mirrors (search for `mapLayerRef.current = mapLayer` inside a `useEffect` to find that pattern) and mirror it the same way:

```ts
  const activeBuildingIdRef = useRef<number | null>(activeBuildingId);
  useEffect(() => {
    activeBuildingIdRef.current = activeBuildingId;
  }, [activeBuildingId]);
```

- [ ] **Step 2: Change the cursor on hover over a building (affordance)**

Right after the `map.on('click', 'osm-buildings-layer', ...)` handler from Step 1:

```ts
      map.on('mouseenter', 'osm-buildings-layer', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'osm-buildings-layer', () => {
        map.getCanvas().style.cursor = '';
      });
```

- [ ] **Step 3: Re-add in `map.on('style.load', ...)`**

Right after Task 1 Step 7's re-added `osm-labels-layer`, still inside the `if (!map.getSource('osm-places-source')) { ... }` block's sibling scope (i.e. its own `if`, since it's a separate source):

```ts
      if (!map.getSource('osm-buildings-source')) {
        const reloadBuildingBeforeId = map.getLayer('building-3d') ? 'building-3d' : undefined;
        map.addSource('osm-buildings-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        map.addLayer(
          {
            id: 'osm-buildings-layer',
            type: 'fill-extrusion',
            source: 'osm-buildings-source',
            minzoom: 14,
            paint: {
              'fill-extrusion-color': '#475569',
              'fill-extrusion-height': ['coalesce', ['get', 'height'], 8],
              'fill-extrusion-opacity': 0.35,
            },
          },
          reloadBuildingBeforeId,
        );
      }
```

(The click/hover handlers from Steps 1-2 are registered once via `map.on(...)` outside any `if (!map.getSource(...))` guard, so they survive a style reload without needing to be re-registered — MapLibre event listeners bound via `map.on('click', 'layer-id', ...)` re-attach automatically once the named layer exists again after `style.load`.)

- [ ] **Step 4: Type-check**

Run: `cd app-turismo && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Manual verification**

Run the dev server, navigate to a building with known nested content if the import (Plan 1 Task 3) found any (check via `psql "$DATABASE_URL" -c "SELECT id, name FROM osm_places WHERE parent_building_id IS NOT NULL LIMIT 1;"` then `psql ... -c "SELECT name FROM osm_places WHERE id = (SELECT parent_building_id FROM osm_places WHERE parent_building_id IS NOT NULL LIMIT 1);"` to find that building's name/location). At zoom ≥ 14, hover over that building — cursor becomes a pointer. Click it — confirm the nested category (e.g. a `banca` icon) appears inside/near the building footprint that wasn't visible before the click. Click the same building again — it disappears (toggle-off). Click a different building with nothing nested — nothing new appears, no error in console.

- [ ] **Step 6: Commit**

```bash
git add app-turismo/src/components/Map/MapLibreContainer.web.tsx
git commit -m "$(cat <<'EOF'
feat: agregar osm-buildings-layer con click para revelar pines anidados

fill-extrusion clickeable poblado desde el mismo fetch de osm-places-source
(sin round-trip extra). Toggle: click de nuevo sobre el mismo building lo
deselecciona.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `DeckGL3DContainer.web.tsx` — swap local JSON for the API, add building click

**Files:**
- Modify: `app-turismo/src/components/Map/DeckGL3DContainer.web.tsx`

**Interfaces:**
- Consumes: `activeBuildingId`, `onBuildingSelect` (new props this task adds to whatever prop type this component uses — check its prop interface definition near its function signature; it's a sibling component to `MapLibreContainer`, not necessarily sharing the exact same `MapContainerProps`, so verify before assuming the name matches).
- Produces: `buildings3DLayer` now sources from the API instead of the bundled `valdivia_buildings.json`, and has an `onClick` handler.

- [ ] **Step 1: Confirm this component's prop interface**

Run: `grep -n "interface.*Props\|DeckGL3DContainer(" app-turismo/src/components/Map/DeckGL3DContainer.web.tsx`

If it has its own local props interface (not `MapContainerProps` from `./types`), add `activeBuildingId?: number | null;` and `onBuildingSelect?: (id: number | null) => void;` to that interface, and find wherever `DeckGL3DContainer` is instantiated (parent component) to pass those 2 props through — likely conditionally rendered as an alternative to `MapLibreContainer`/`MapContainer` when `mapLayer === 'google3d'` or similar; search `grep -rn "<DeckGL3DContainer" app-turismo/src` to find the call site and thread the props the same way Plan 1 Task 7 threaded them onto `<MapContainer>`.

- [ ] **Step 2: Remove the local JSON import, add a fetch-backed buildings state**

Remove `import valdiviaBuildings from '../../data/valdivia_buildings.json';` (line 12).

Add a new state + effect near the component's other state (`showBuildings`, `showRealTerrain`, etc.):

```ts
  const [osmBuildings, setOsmBuildings] = useState<any>({ type: 'FeatureCollection', features: [] });

  useEffect(() => {
    if (!showBuildings) return;
    let cancelled = false;
    const baseUrl =
      process.env.EXPO_PUBLIC_BACKEND_URL ||
      process.env.EXPO_PUBLIC_API_URL ||
      'http://localhost:8080';

    fetch(`${baseUrl}/api/v1/places/search?minLat=-39.9&maxLat=-39.7&minLng=-73.3&maxLng=-73.15`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const features = (data.results || [])
          .filter((r: any) => r.organizer === 'OpenStreetMap' && (r.category === 'edificio' || r.category === 'universidad'))
          .map((r: any) => {
            let tags: any = {};
            try {
              tags = r.osmTags ? JSON.parse(r.osmTags) : {};
            } catch {
              tags = {};
            }
            return {
              type: 'Feature',
              properties: {
                id: Number(String(r.id).replace('osm-', '')),
                name: r.title || '',
                height: typeof tags.height === 'number' && tags.height > 0 ? tags.height : 10,
                levels: typeof tags.levels === 'number' && tags.levels > 0 ? tags.levels : 2,
                type: tags.type || (r.category === 'universidad' ? 'university' : undefined),
              },
              geometry: r.geometry ? JSON.parse(r.geometry) : null,
            };
          })
          .filter((f: any) => f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'));
        setOsmBuildings({ type: 'FeatureCollection', features });
      })
      .catch((err) => console.warn('[DeckGL3DContainer] Error fetching buildings:', err));

    return () => {
      cancelled = true;
    };
  }, [showBuildings]);
```

`height`/`levels` come from `r.osmTags` (Plan 1 Task 4's `OsmTags` field, raw JSON text of the row's `osm_tags` column) — this preserves the real per-building height that `valdivia_buildings.json` had (e.g. `{"height": 7.0, "levels": 2, "type": "university"}`), falling back to `10`/`2` only when a building has no `height`/`levels` tag in OSM (same fallback `buildings3DLayer`'s `getElevation` already used for the old local-JSON data, at line 231: `typeof h === 'number' && h > 0 ? h : 10`).

The fixed bounding box (`-39.9,-39.7,-73.3,-73.15`, roughly all of Valdivia) is used here instead of `currentBounds`-style viewport tracking because this component doesn't currently track map bounds the way `MapLibreContainer.web.tsx` does — fetching the whole city's ~4146 buildings once when `showBuildings` turns on matches the toggle-based UX already in place (see the "Riesgos" section of the spec, which flagged this exact perf question as open; fetching once per toggle rather than per pan is the simplest correct choice here and can be revisited later if it proves slow).

- [ ] **Step 3: Point `buildings3DLayer` at the fetched data and add `onClick`**

In `buildings3DLayer`'s `useMemo` (lines 218-263), change:

```ts
      data: valdiviaBuildings as any,
```

to:

```ts
      data: osmBuildings,
```

and add its dependency to the `useMemo`'s dependency array (currently `[showBuildings, showRealTerrain, baseStyle]`, becomes `[showBuildings, showRealTerrain, baseStyle, osmBuildings, activeBuildingId]`), and add an `onClick` handler right after the existing `highlightColor` line:

```ts
      onClick: (info: any) => {
        const id = info.object?.properties?.id;
        if (typeof id !== 'number' || !onBuildingSelect) return;
        onBuildingSelect(activeBuildingId === id ? null : id);
      },
```

- [ ] **Step 4: Type-check**

Run: `cd app-turismo && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Manual verification**

Switch the map to whichever `mapLayer` value renders `DeckGL3DContainer` (check `MAX_ZOOM_PER_LAYER`/the layer picker in Herramientas — likely `'3d'` or `'google3d'`), confirm buildings still extrude and are colored by height as before, click one — confirm `onBuildingSelect` fires (add a temporary `console.log` in the parent's `onBuildingSelect`/`setActiveBuildingId` call if it's not already visibly wired to anything yet, then remove the log).

- [ ] **Step 6: Commit**

```bash
git add app-turismo/src/components/Map/DeckGL3DContainer.web.tsx
git commit -m "$(cat <<'EOF'
feat: DeckGL3DContainer consume buildings desde la API, agrega click

Reemplaza el import local de valdivia_buildings.json por un fetch a
/api/v1/places/search. height/levels se leen de osmTags para no perder la
altura real por edificio.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Notes

**Spec coverage:**
- Layer nativa generalizada, no interactiva, icon+texto debajo → Task 1.
- Filtro `map.setFilter` reactivo a Herramientas/modo, sin re-fetch → Task 1 Step 6.
- Fix del bug de `style.load` no re-agregando la capa → Task 1 Step 7 (mejora dirigida sobre código existente que se estaba tocando de todas formas).
- Click en building 3D revela pines anidados, ambos containers (2D MapLibre y DeckGL) → Tasks 2 y 3.
- Buildings nunca se pintan como icono/punto → Task 1 (`osm-places-source` excluye `edificio`/`universidad` explícitamente) + Task 2 (fuente separada `osm-buildings-source`).

**Gap encontrado durante la escritura del plan, corregido en Plan 1:** al escribir Task 3 se detectó que `places_handler.go` no exponía `osm_tags` en la respuesta JSON, lo que habría forzado una altura fija (10m/2 pisos) para los 4146 buildings en vez de su altura real de OSM. Se agregó `OsmTags *string` (`json:"osmTags"`) a Plan 1 Task 4 (campo, columna en la rama `osm_places`, `NULL::jsonb` en las otras 3 ramas, y el `Scan` correspondiente) para que Task 3 pueda leer `height`/`levels` reales — no requirió tocar el spec ni pedir aprobación de nuevo porque es un detalle de implementación que preserva el comportamiento ya prometido por el spec ("reconstruye {height, levels, type} desde osm_tags"), no un cambio de alcance.

**Placeholder scan:** ninguno — cada step tiene código real o comandos de verificación real.

**Type consistency:** `syncOsmPlacesRef`/`syncOsmBuildingsRef` (Task 1/2) coinciden en firma; `onBuildingSelect(id: number | null)` es la misma firma en `MapLibreContainer` (Task 2) y `DeckGL3DContainer` (Task 3), coincidiendo con `onBuildingSelect?: (id: number | null) => void` definido en Plan 1 Task 7.
