/**
 * Bloque 4 — Ranking contextual y "Walking & Glancing UX".
 * Lógica pura (sin React ni MapLibre) para poder testearla y reutilizarla en web/nativo.
 */

// ---------------------------------------------------------------------------
// Constantes de diseño (contraste solar, ergonomía de pulgar)
// ---------------------------------------------------------------------------

export const SOLAR_PALETTE = {
  blockFill: '#F3F0E6',
  street: '#FFFFFF',
  streetCasing: '#94A3B8',
  streetCasingWidth: 1.5,
  water: '#0284C7',
} as const;

export const SOLAR_LABEL = {
  fontWeight: 700,
  minSizePx: 12.5,
  haloWidth: 2.0,
  haloBlur: 0.5,
} as const;

export const THUMB_ZONE_HEIGHT_PX = 340;
export const MIN_TOUCH_TARGET_DP = 48;
export const PIN_HIT_BOX_PX = 52;

/** Línea punteada usuario → pin al abrir el Peek Card. */
export const WALK_LINE_DASHARRAY: [number, number] = [2, 2];

// ---------------------------------------------------------------------------
// Tobler
// ---------------------------------------------------------------------------

/** Velocidad de caminata (km/h) para una pendiente dada (tan θ = rise/run; 0.1 = 10%). */
export function toblerSpeedKmh(slope: number): number {
  return 6 * Math.exp(-3.5 * Math.abs(slope + 0.05));
}

/** Minutos para recorrer un tramo de `distanceM` metros con pendiente `slope`. */
export function toblerMinutes(distanceM: number, slope: number): number {
  const v = toblerSpeedKmh(slope); // km/h
  return (distanceM / 1000 / v) * 60;
}

export interface WalkSegment {
  distanceM: number;
  slope: number;
}

/** Tiempo total (min) sobre una ruta peatonal real segmentada. */
export function walkMinutesFromSegments(segments: WalkSegment[]): number {
  return segments.reduce((sum, s) => sum + toblerMinutes(s.distanceM, s.slope), 0);
}

// ---------------------------------------------------------------------------
// Fatiga y clima
// ---------------------------------------------------------------------------

export interface WeatherContext {
  rainMmH: number;
  windKmH: number;
  tempC: number;
}

export interface RankablePoi {
  baseQuality: number; // Q_base
  isIndoor?: boolean;
  hasHeatingOrCozy?: boolean;
  isOutdoorExposed?: boolean;
  /** Multiplicador por hora (M_hora), por defecto 1. */
  hourMultiplier?: number;
}

export function isAdverseWeather(w: WeatherContext): boolean {
  return w.rainMmH >= 0.4 || w.windKmH > 35 || w.tempC < 9;
}

/** λ(t): coeficiente de fatiga horaria. Lluvia/mal clima fuerza el sesgo de proximidad. */
export function fatigueLambda(date: Date, weather?: WeatherContext): number {
  const hour = date.getHours();
  const tired = hour >= 14 && hour <= 21;
  const wet = weather ? isAdverseWeather(weather) : false;
  return tired || wet ? 0.22 : 0.08;
}

export function weatherMultiplier(poi: RankablePoi, weather: WeatherContext): number {
  if (!isAdverseWeather(weather)) return 1;
  if (poi.isIndoor && poi.hasHeatingOrCozy) return 2.4;
  if (poi.isOutdoorExposed) return 0.15;
  return 1;
}

/** S = (Q · M_clima · M_hora) · e^(−λ · T_walk). `walkMinutes` debe venir de red peatonal real. */
export function contextualScore(
  poi: RankablePoi,
  walkMinutes: number,
  now: Date,
  weather: WeatherContext
): number {
  const q = poi.baseQuality * weatherMultiplier(poi, weather) * (poi.hourMultiplier ?? 1);
  return q * Math.exp(-fatigueLambda(now, weather) * walkMinutes);
}

// ---------------------------------------------------------------------------
// Presentación: solo minutos a pie sobre red peatonal (nunca línea recta)
// ---------------------------------------------------------------------------

/** Ej.: "🚶 7 min (520 m por Puente Pedro de Valdivia)". */
export function formatWalkLabel(minutes: number, routeMeters: number, via?: string): string {
  const min = Math.max(1, Math.round(minutes));
  const dist =
    routeMeters >= 1000 ? `${(routeMeters / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(routeMeters)} m`;
  return `🚶 ${min} min (${dist}${via ? ` por ${via}` : ''})`;
}

// ---------------------------------------------------------------------------
// Hit-test de pines (caja de 52x52 px, gana el mayor priority_rank)
// ---------------------------------------------------------------------------

/** Devuelve [[x1,y1],[x2,y2]] para `map.queryRenderedFeatures(bbox, ...)`. */
export function pinHitBox(x: number, y: number, size: number = PIN_HIT_BOX_PX): [[number, number], [number, number]] {
  const h = size / 2;
  return [
    [x - h, y - h],
    [x + h, y + h],
  ];
}

export function pickTopPriority<T extends { properties?: { priority_rank?: number } | null }>(
  features: T[]
): T | undefined {
  let best: T | undefined;
  let bestRank = -Infinity;
  for (const f of features) {
    const r = f.properties?.priority_rank ?? 0;
    if (r > bestRank) {
      best = f;
      bestRank = r;
    }
  }
  return best;
}
