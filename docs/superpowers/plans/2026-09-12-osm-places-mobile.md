# OSM Places — Mobile Rendering Implementation Plan (Plan 3 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the native mobile map (`react-native-maps`) to parity with the web fix (Plan 2): every OSM category renders via a lightweight, non-interactive-by-default marker fed by `/api/v1/places/search` instead of bundled local JSON, and respects `visibleOsmCategories` (Herramientas + Mapa/Turismo/Comercial mode) — fixing the same bug found in `MapContainer.tsx` where `furnitureData` renders unconditionally regardless of any filter.

**Architecture:** `MapContainer.tsx` already fetches nothing for OSM data today — it imports the bundled `furnitureData` (from `mobiliarioData.ts`) directly and renders every item inside the current viewport, with zero connection to `selectedCategories`/`mapDisplayMode`. This plan replaces that with a bounds-driven fetch against the same endpoint Plan 1/2 use, splits the response into "mobiliario" (reuses the existing `FurnitureMarker`) and "other OSM points" (new `OsmPointMarker`, same visual pattern, driven by `getCategoryColor`/`getCategoryIcon`), and filters both by the `visibleOsmCategories` prop that Plan 1 already threaded onto `MapContainerProps`.

**Tech Stack:** `react-native-maps` (`<Marker>`), React Native `fetch`.

**Spec:** `docs/superpowers/specs/2026-09-11-osm-places-categorization-design.md`
**Depends on:** `docs/superpowers/plans/2026-09-12-osm-places-backend.md` (Plan 1) — needs `/api/v1/places/search` returning `osm_places` rows, `visibleOsmCategories` prop on `MapContainerProps`, and `INITIAL_EVENTS` no longer double-seeding these categories through the old interactive pipeline (Plan 1 Task 8).

## Global Constraints

- **Building click-to-reveal is explicitly OUT OF SCOPE for mobile.** The user's own answer during brainstorming named "el building 3D extruido" as the click surface, and `react-native-maps` has no 3D extrusion — there is no equivalent volume to tap. `activeBuildingId`/`onBuildingSelect` stay available on `MapContainerProps` (Plan 1) for a future mobile design, but this plan does not build any tap-to-reveal interaction; the mobile fetch always requests the default (non-`buildingId`) view.
- New markers stay non-interactive-by-default (no modal-opening `onPress` beyond the existing "show a small name tooltip" behavior `FurnitureMarker` already has) — matching the web behavior from Plan 2 and the spec's "el usuario quiere mantener exactamente este comportamiento... no migrarlos al sistema de pines interactivo".
- `banca`/`basurero`/`bebedero`/`bano` only render when `visibleOsmCategories` includes them (already restricted to `mapDisplayMode === 'mapa'` by Plan 1) — same rule as web, no separate logic to write here since `visibleOsmCategories` arrives pre-computed.

---

## Task 1: Fetch OSM places by bounds, replacing the bundled `furnitureData`

**Files:**
- Modify: `app-turismo/src/components/Map/MapContainer.tsx`

**Interfaces:**
- Consumes: `visibleOsmCategories?: string[]` (prop, Plan 1 Task 7 — add to `MapContainerInner`'s destructured props, which today does not list it even though `MapContainerProps` already declares it).
- Produces: state `osmPlaces: Array<{ id: string; category: string; title: string; latitude: number; longitude: number }>`, kept in sync with `currentBounds`. Task 2 (marker rendering) consumes this state.

- [ ] **Step 1: Add `visibleOsmCategories` to the destructured props**

In `app-turismo/src/components/Map/MapContainer.tsx`, the `MapContainerInner` function signature (starts at line 645) destructures many `MapContainerProps` fields but not this one. Add it, with a default:

```ts
  userLocation: propUserLocation,
  visibleOsmCategories = [],
}: MapContainerProps) {
```

(This replaces the closing `userLocation: propUserLocation,\n}: MapContainerProps) {` — i.e. add the new line right before the existing `}: MapContainerProps) {`.)

- [ ] **Step 2: Add `osmPlaces` state and the bounds-driven fetch**

Add near the other state declarations (right after `const [currentBounds, setCurrentBounds] = useState<...>(undefined);`, around line 717-725):

```ts
  const [osmPlaces, setOsmPlaces] = useState<
    Array<{ id: string; category: string; title: string; latitude: number; longitude: number }>
  >([]);
```

Add a new effect anywhere after `currentBounds` is declared (e.g. right after the "Effect to fetch the latest RainViewer radar path" effect, around line 728-732):

```ts
  useEffect(() => {
    if (!currentBounds) return;
    let cancelled = false;
    const baseUrl =
      process.env.EXPO_PUBLIC_BACKEND_URL ||
      process.env.EXPO_PUBLIC_API_URL ||
      'http://localhost:8080';

    const timer = setTimeout(() => {
      fetch(
        `${baseUrl}/api/v1/places/search?minLat=${currentBounds.minLat}&maxLat=${currentBounds.maxLat}&minLng=${currentBounds.minLng}&maxLng=${currentBounds.maxLng}`,
      )
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return;
          const osmResults = (data.results || [])
            .filter((r: any) => r.organizer === 'OpenStreetMap')
            .filter((r: any) => r.category !== 'edificio' && r.category !== 'universidad')
            .map((r: any) => ({
              id: r.id,
              category: r.category,
              title: r.title || '',
              latitude: r.latitude,
              longitude: r.longitude,
            }));
          setOsmPlaces(osmResults);
        })
        .catch((err) => console.warn('[MapContainer] Error fetching osm places:', err));
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [currentBounds]);
```

(`edificio`/`universidad` are excluded here for the same reason as Plan 2 Task 1 — buildings aren't rendered as point markers on any platform; mobile has no equivalent of the web's building-extrusion layer at all, so those rows are simply unused on this platform, matching this plan's explicit non-goal of building interaction. 400ms debounce mirrors the pattern already used for `fetchRealPlaces` in `useHomeScreenState.ts`.)

- [ ] **Step 3: Remove the old unfiltered `furnitureData` import**

Remove `import { furnitureData } from '../../data/mobiliarioData';` (line 40) — Task 2 replaces its only usage (the render block at lines 1470-1493).

- [ ] **Step 4: Type-check**

Run: `cd app-turismo && npx tsc --noEmit`
Expected: one new error at the old `furnitureData` usage (lines 1470-1493) since the import was removed but the render block wasn't touched yet — that's expected and gets fixed in Task 2. If there are OTHER new errors beyond that single block, stop and investigate before proceeding to Task 2.

- [ ] **Step 5: Commit**

Do not commit yet — Task 1 alone leaves the file in a non-compiling state (Step 4's expected error). Commit after Task 2 instead, as one unit (Task 2's Step 5 covers both).

---

## Task 2: Render OSM points via `visibleOsmCategories`-filtered markers

**Files:**
- Modify: `app-turismo/src/components/Map/MapContainer.tsx`
- Create: `app-turismo/src/components/Map/Markers/OsmPointMarker.tsx`

**Interfaces:**
- Consumes: `osmPlaces` state (Task 1), `visibleOsmCategories` prop (Task 1), `getCategoryColor`/`getCategoryIcon` (`app-turismo/src/utils/mapUtils.ts`, already imported in `MapContainer.tsx` line 31).
- Produces: `OsmPointMarker` component (new); the old `furnitureData`-driven render block replaced by two `visibleOsmCategories`-filtered blocks (mobiliario via the existing `FurnitureMarker`, everything else via `OsmPointMarker`).

- [ ] **Step 1: Write `OsmPointMarker.tsx`**

Create `app-turismo/src/components/Map/Markers/OsmPointMarker.tsx`, modeled directly on the existing `FurnitureMarker.tsx` (same 24px-circle + tooltip-on-select pattern), but driven by the shared category color/icon system instead of a hardcoded 4-way switch:

```tsx
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Animated, { ZoomIn, ZoomOut } from 'react-native-reanimated';

import { getCategoryColor, getCategoryIcon } from '../../../utils/mapUtils';

export interface OsmPoint {
  id: string;
  category: string;
  title: string;
  latitude: number;
  longitude: number;
}

interface OsmPointMarkerProps {
  item: OsmPoint;
  isDark?: boolean;
  isSelected?: boolean;
  onPress?: () => void;
}

export const OsmPointMarker: React.FC<OsmPointMarkerProps> = React.memo(
  ({ item, isDark = true, isSelected = false, onPress }) => {
    const color = getCategoryColor(item.category);
    const iconName = getCategoryIcon(item.category);

    const textColor = isDark ? '#F0F1F2' : '#191C1D';
    const bgColor = isDark ? 'rgba(34, 34, 34, 0.95)' : '#FFFFFF';
    const borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0,0,0,0.05)';

    return (
      <Marker
        coordinate={{ latitude: item.latitude, longitude: item.longitude }}
        tracksViewChanges={isSelected}
        anchor={{ x: 0.5, y: isSelected ? 1 : 0.5 }}
        style={{ zIndex: isSelected ? 9999 : 1 }}
        onPress={onPress}
      >
        <View style={styles.container}>
          {isSelected && item.title ? (
            <Animated.View
              entering={ZoomIn.duration(200)}
              exiting={ZoomOut.duration(150)}
              style={[styles.tooltipContainer, { backgroundColor: bgColor, borderColor }]}
            >
              <Text style={[styles.tooltipText, { color: textColor }]}>{item.title}</Text>
              <View style={[styles.pointer, { borderTopColor: bgColor }]} />
            </Animated.View>
          ) : null}
          <View
            style={[
              styles.dot,
              {
                backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.9)',
                borderColor: isSelected ? color : isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)',
              },
            ]}
          >
            <MaterialIcons name={iconName} size={14} color={color} />
          </View>
        </View>
      </Marker>
    );
  },
);
OsmPointMarker.displayName = 'OsmPointMarker';

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 8 },
  tooltipContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 6,
    position: 'relative',
    minWidth: 60,
    alignItems: 'center',
  },
  tooltipText: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  pointer: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    position: 'absolute',
    bottom: -6,
    alignSelf: 'center',
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});
```

- [ ] **Step 2: Replace the old `furnitureData` render block**

In `app-turismo/src/components/Map/MapContainer.tsx`, replace the block at lines 1470-1493 (`{/* ── Native Mobiliario Layer (Static High-Perf POIs) ── */} ... furnitureData.filter(...).map(...)`) with:

```tsx
        {/* ── OSM Places: mobiliario urbano (icono propio) ── */}
        {currentZoom >= 15 &&
          currentBounds &&
          osmPlaces
            .filter((p) => ['banca', 'basurero', 'bebedero', 'bano'].includes(p.category))
            .filter((p) => visibleOsmCategories.includes(p.category))
            .map((p) => (
              <FurnitureMarker
                key={p.id}
                item={{
                  id: p.id,
                  amenity:
                    p.category === 'banca'
                      ? 'bench'
                      : p.category === 'basurero'
                        ? 'waste_basket'
                        : p.category === 'bebedero'
                          ? 'drinking_water'
                          : 'toilets',
                  latitude: p.latitude,
                  longitude: p.longitude,
                }}
                isDark={isDark}
                isSelected={selectedFurnitureId === p.id}
                onPress={() => {
                  setSelectedFurnitureId(p.id === selectedFurnitureId ? null : p.id);
                  onSelectEvent(null);
                  setLocalLoboMarinoId(null);
                }}
              />
            ))}

        {/* ── OSM Places: resto de categorias (dot generico) ── */}
        {currentZoom >= 13 &&
          currentBounds &&
          osmPlaces
            .filter((p) => !['banca', 'basurero', 'bebedero', 'bano'].includes(p.category))
            .filter((p) => visibleOsmCategories.includes(p.category))
            .map((p) => (
              <OsmPointMarker
                key={p.id}
                item={p}
                isDark={isDark}
                isSelected={selectedFurnitureId === p.id}
                onPress={() => {
                  setSelectedFurnitureId(p.id === selectedFurnitureId ? null : p.id);
                  onSelectEvent(null);
                  setLocalLoboMarinoId(null);
                }}
              />
            ))}
```

(Reuses the existing `selectedFurnitureId` state for both marker types' tooltip-toggle — it was already generic enough, just previously only ever set from `FurnitureMarker`.)

- [ ] **Step 3: Add the import**

At the top of `MapContainer.tsx`, add next to the other `Markers/` imports (near `import { FurnitureMarker } from './Markers/FurnitureMarker';`, line 54):

```ts
import { OsmPointMarker } from './Markers/OsmPointMarker';
```

- [ ] **Step 4: Type-check**

Run: `cd app-turismo && npx tsc --noEmit`
Expected: no errors (the one expected from Task 1 Step 4 is now resolved).

- [ ] **Step 5: Manual verification**

Run the app on a simulator/device (or web preview of the RN screen if that's how this project is normally checked — see if a `run` skill config exists for this project, otherwise `cd app-turismo && npx expo start` and open on a device/simulator). Check:
1. Default mode (Mapa) at zoom ≥ 15 near known mobiliario coordinates — bench/waste/water/toilet icons appear via `FurnitureMarker`, same look as before.
2. At zoom ≥ 13 near a hospital/carabinero/parque location — a small colored dot with the matching `MaterialIcons` glyph appears via `OsmPointMarker`.
3. Switch to "Turismo" mode — mobiliario icons disappear, `parque`/`agua`/`humedal`/`escultura`/etc. dots stay visible.
4. Switch to "Comercial" mode — all OSM dots and mobiliario icons disappear (neither is in `MODE_CATEGORIES.comercial`).
5. Tap a dot — a small tooltip with its `title` appears above it (empty title shows no tooltip, which is expected — most raw OSM points have no `name` tag).

- [ ] **Step 6: Commit**

```bash
git add app-turismo/src/components/Map/MapContainer.tsx app-turismo/src/components/Map/Markers/OsmPointMarker.tsx
git commit -m "$(cat <<'EOF'
fix: filtrar pines OSM en mobile por Herramientas/modo, agregar OsmPointMarker

furnitureData se reemplaza por un fetch a /api/v1/places/search filtrado por
bounds; ambos FurnitureMarker (mobiliario) y el nuevo OsmPointMarker (resto
de categorias OSM) respetan visibleOsmCategories, igual que la version web
(Plan 2). Building tap-to-reveal queda fuera de alcance: no hay volumen 3D
que tocar en react-native-maps.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Notes

**Spec coverage:**
- Mismo comportamiento no-interactivo, mismo filtro Herramientas/modo que web, aplicado a mobile → Tasks 1-2.
- Mobiliario solo en modo Mapa → heredado gratis de `visibleOsmCategories` (Plan 1), sin lógica nueva que escribir aquí.
- Building click-to-reveal → explícitamente fuera de alcance (Global Constraints), decisión tomada con el usuario antes de escribir este plan.

**Placeholder scan:** ninguno.

**Type consistency:** `OsmPoint` (Task 2 Step 1) es el tipo de cada elemento de `osmPlaces` (Task 1 Step 2) — mismos campos (`id`, `category`, `title`, `latitude`, `longitude`). `visibleOsmCategories` se consume con el mismo nombre/tipo (`string[]`) que produce Plan 1 Task 6 y propaga Plan 1 Task 7.
