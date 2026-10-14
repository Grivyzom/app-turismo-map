/**
 * Bloque 5 — Zoom semántico, Lentes de Mapa, semántica de pines y decluttering.
 * Lógica pura: produce especificaciones (filtros, layout, paint) que el contenedor MapLibre aplica.
 */

// ---------------------------------------------------------------------------
// A. Matriz de zoom semántico
// ---------------------------------------------------------------------------

export type Tier = 1 | 2 | 3;
export type PinStyle = 'hero' | 'pill' | 'microdot';

export interface ZoomBand {
  minZoom: number;
  maxZoom: number; // exclusivo
  /** Máximo de etiquetas simultáneas (null = regulado solo por colisión). */
  maxLabels: number | null;
  /** Cómo se dibuja cada tier en esta banda. */
  tierStyle: Record<Tier, PinStyle | 'hidden'>;
  microdotRadiusPx: number;
}

export const ZOOM_BANDS: ZoomBand[] = [
  { minZoom: 11, maxZoom: 13, maxLabels: 8, tierStyle: { 1: 'hero', 2: 'hidden', 3: 'hidden' }, microdotRadiusPx: 0 },
  { minZoom: 13, maxZoom: 14.5, maxLabels: 10, tierStyle: { 1: 'hero', 2: 'pill', 3: 'microdot' }, microdotRadiusPx: 2.5 },
  { minZoom: 14.5, maxZoom: 16, maxLabels: 15, tierStyle: { 1: 'hero', 2: 'pill', 3: 'microdot' }, microdotRadiusPx: 3.5 },
  { minZoom: 16, maxZoom: Infinity, maxLabels: null, tierStyle: { 1: 'hero', 2: 'pill', 3: 'pill' }, microdotRadiusPx: 3 },
];

export function zoomBandFor(zoom: number): ZoomBand {
  const z = Math.max(ZOOM_BANDS[0].minZoom, zoom);
  return ZOOM_BANDS.find((b) => z >= b.minZoom && z < b.maxZoom) ?? ZOOM_BANDS[ZOOM_BANDS.length - 1];
}

/** Presupuesto absoluto de pines completos en viewport (Hick-Hyman). */
export const MAX_FULL_PINS = 15;

export function pinStyleFor(tier: Tier, zoom: number): PinStyle | 'hidden' {
  return zoomBandFor(zoom).tierStyle[tier];
}

/** Tras ordenar por score, cuántos reciben etiqueta completa; el resto cae a micro-dot. */
export function labelBudget(zoom: number): number {
  const b = zoomBandFor(zoom);
  return Math.min(b.maxLabels ?? MAX_FULL_PINS, MAX_FULL_PINS);
}

// ---------------------------------------------------------------------------
// B. Lentes de mapa
// ---------------------------------------------------------------------------

export type LensId = 'explore' | 'eat' | 'night' | 'nature';

export type ExprFilter = unknown[];

export interface BasemapMutation {
  layerId: string;
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
}

export interface MapLens {
  id: LensId;
  label: string;
  /** Filtro MapLibre sobre propiedades del POI (`category`, `is_open`, `closes_at_hour`). */
  poiFilter: ExprFilter;
  basemap: BasemapMutation[];
  theme: 'day' | 'obsidian-night';
}

export const MAP_LENSES: Record<LensId, MapLens> = {
  explore: {
    id: 'explore',
    label: '🧭 Explorar',
    poiFilter: [
      'any',
      ['==', ['get', 'tier'], 1],
      ['==', ['get', 'is_event_today'], true],
      ['all', ['==', ['get', 'group'], 'food'], ['==', ['get', 'is_open'], true]],
    ],
    basemap: [],
    theme: 'day',
  },
  eat: {
    id: 'eat',
    label: '🍽️ Comer y Beber',
    poiFilter: ['all', ['==', ['get', 'group'], 'food'], ['==', ['get', 'is_open'], true]],
    basemap: [{ layerId: 'food-corridor-casing', paint: { 'line-color': '#FDE68A', 'line-opacity': 1 } }],
    theme: 'day',
  },
  night: {
    id: 'night',
    label: '⚡ Eventos y Noche',
    poiFilter: [
      'any',
      ['==', ['get', 'group'], 'event'],
      ['==', ['get', 'category'], 'bar'],
      ['>=', ['coalesce', ['get', 'closes_at_hour'], 0], 23],
    ],
    basemap: [
      { layerId: 'background', paint: { 'background-color': '#0F172A' } },
      { layerId: 'road-major', paint: { 'line-color': '#334155' } },
      { layerId: 'road-pedestrian', paint: { 'line-color': '#38BDF8' } },
    ],
    theme: 'obsidian-night',
  },
  nature: {
    id: 'nature',
    label: '🌿 Naturaleza y Cultura',
    poiFilter: ['in', ['get', 'group'], ['literal', ['nature', 'culture']]],
    basemap: [
      { layerId: 'contours', layout: { visibility: 'visible' } },
      { layerId: 'hillshade', layout: { visibility: 'visible' } },
      { layerId: 'park-paths', layout: { visibility: 'visible' } },
      { layerId: 'river-routes', layout: { visibility: 'visible' } },
    ],
    theme: 'day',
  },
};

/** Estructura mínima del mapa para aplicar una lente en un solo lote. */
export interface LensTargetMap {
  getLayer(id: string): unknown;
  setFilter(id: string, filter: ExprFilter): void;
  setPaintProperty(id: string, prop: string, value: unknown): void;
  setLayoutProperty(id: string, prop: string, value: unknown): void;
}

export const FULL_PINS_LAYER = 'pins-full';
export const MICRODOTS_LAYER = 'pins-microdots';

/** Aplica la lente: filtros de ambas capas + mutación del basemap (omite capas inexistentes). */
export function applyLens(map: LensTargetMap, lens: MapLens): void {
  for (const id of [FULL_PINS_LAYER, MICRODOTS_LAYER]) {
    if (map.getLayer(id)) map.setFilter(id, lens.poiFilter);
  }
  for (const m of lens.basemap) {
    if (!map.getLayer(m.layerId)) continue;
    for (const [k, v] of Object.entries(m.paint ?? {})) map.setPaintProperty(m.layerId, k, v);
    for (const [k, v] of Object.entries(m.layout ?? {})) map.setLayoutProperty(m.layerId, k, v);
  }
}

// ---------------------------------------------------------------------------
// D. Semántica de pines
// ---------------------------------------------------------------------------

export type PinKind = 'nature' | 'culture' | 'restaurant' | 'brewery' | 'cafe' | 'event' | 'sos';

export interface PinSemantics {
  shape: 'drop' | 'capsule' | 'event-pill' | 'compact-circle';
  fill: string;
  border: string;
  animated: boolean;
}

export const PIN_SEMANTICS: Record<PinKind, PinSemantics> = {
  nature: { shape: 'drop', fill: '#059669', border: '#FFFFFF', animated: false },
  culture: { shape: 'drop', fill: '#1D4ED8', border: '#FFFFFF', animated: false },
  restaurant: { shape: 'capsule', fill: '#EA580C', border: '#FFFFFF', animated: false },
  brewery: { shape: 'capsule', fill: '#D97706', border: '#FFFFFF', animated: false },
  cafe: { shape: 'capsule', fill: '#78350F', border: '#FFFFFF', animated: false },
  event: { shape: 'event-pill', fill: '#E11D48', border: '#FFFFFF', animated: true },
  sos: { shape: 'compact-circle', fill: '#475569', border: '#FFFFFF', animated: false },
};

/** Solo los eventos activos o a <90 min de empezar pulsan (1.5 Hz). */
export function shouldPulse(kind: PinKind, startsInMin: number, isLive: boolean): boolean {
  return kind === 'event' && (isLive || (startsInMin >= 0 && startsInMin < 90));
}

export const CLOSED_DOT = { color: '#9CA3AF', radiusPx: 3 } as const; // 6px de diámetro

/** Etiqueta del pin: máx. 16 chars + 1 micro-atributo. */
export function truncateLabel(name: string, max = 16): string {
  return name.length <= max ? name : `${name.slice(0, max - 1).trimEnd()}…`;
}

// ---------------------------------------------------------------------------
// Capas hermanas (misma fuente, sin Supercluster)
// ---------------------------------------------------------------------------

/** symbol-sort-key: MapLibre dibuja primero los valores menores → negativo del score = mayor score gana. */
export const SORT_KEY_EXPR: ExprFilter = ['-', 0, ['get', 'priority_rank']];

export function fullPinsLayerSpec(source: string, sourceLayer?: string) {
  return {
    id: FULL_PINS_LAYER,
    type: 'symbol',
    source,
    ...(sourceLayer ? { 'source-layer': sourceLayer } : {}),
    minzoom: 11,
    layout: {
      'icon-image': ['get', 'icon'],
      'icon-allow-overlap': false,
      'icon-padding': 10,
      'text-field': ['get', 'label'],
      'text-optional': true,
      'text-allow-overlap': false,
      'text-size': 12.5,
      'symbol-sort-key': SORT_KEY_EXPR,
    },
    paint: { 'text-color': '#000000', 'text-halo-color': '#FFFFFF', 'text-halo-width': 2 },
  };
}

export function microdotsLayerSpec(source: string, sourceLayer?: string) {
  return {
    id: MICRODOTS_LAYER,
    type: 'circle',
    source,
    ...(sourceLayer ? { 'source-layer': sourceLayer } : {}),
    minzoom: 13,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 2.5, 15.9, 3.5],
      'circle-color': ['get', 'color'],
      'circle-stroke-width': 1,
      'circle-stroke-color': '#FFFFFF',
    },
  };
}

// ---------------------------------------------------------------------------
// E. Decluttering del basemap
// ---------------------------------------------------------------------------

const HIDDEN_LAYER_PATTERN = /(poi[_-]?label|highway[_-]?shield|shield|exit|fuel|gas[_-]?station|car[_-]?repair|bank|notary|cemetery|industrial)/i;
const SECONDARY_STREET_PATTERN = /(road|street|highway).*(label|name)|(label|name).*(road|street)/i;

export const SECONDARY_STREET_MIN_ZOOM = 15.2;
export const SECONDARY_STREET_COLOR = '#64748B';

export interface StyleLayerLike {
  id: string;
  type?: string;
  layout?: Record<string, unknown>;
  paint?: Record<string, unknown>;
  minzoom?: number;
  [k: string]: unknown;
}

/** Devuelve una copia del style.json con capas nativas ocultas y calles secundarias atenuadas. */
export function declutterStyleLayers<T extends StyleLayerLike>(layers: T[]): T[] {
  return layers.map((layer) => {
    if (HIDDEN_LAYER_PATTERN.test(layer.id)) {
      return { ...layer, layout: { ...layer.layout, visibility: 'none' } };
    }
    if (layer.type === 'symbol' && SECONDARY_STREET_PATTERN.test(layer.id)) {
      return {
        ...layer,
        minzoom: Math.max(layer.minzoom ?? 0, SECONDARY_STREET_MIN_ZOOM),
        paint: { ...layer.paint, 'text-color': SECONDARY_STREET_COLOR },
      };
    }
    return layer;
  });
}

// ---------------------------------------------------------------------------
// Presupuesto en cliente (fallback cuando no se confía solo en colisión GPU)
// ---------------------------------------------------------------------------

export interface RankedPoi {
  id: string;
  tier: Tier;
  priorityRank: number;
}

/** Reparte POIs visibles en pines completos / pills / micro-dots respetando el presupuesto. */
export function assignRenderStyles(
  pois: RankedPoi[],
  zoom: number
): Map<string, PinStyle | 'hidden'> {
  const budget = labelBudget(zoom);
  const sorted = [...pois].sort((a, b) => b.priorityRank - a.priorityRank);
  const out = new Map<string, PinStyle | 'hidden'>();
  let labelled = 0;
  for (const p of sorted) {
    const style = pinStyleFor(p.tier, zoom);
    if (style === 'hidden' || style === 'microdot') {
      out.set(p.id, style);
    } else if (labelled < budget || zoomBandFor(zoom).maxLabels === null) {
      out.set(p.id, style);
      labelled++;
    } else {
      out.set(p.id, 'microdot');
    }
  }
  return out;
}
