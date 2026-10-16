import { calculateDistance } from '../../utils/locationUtils';
import type { Coordinate, PlaceWithDistance } from '../hooks/usePlacesData';
import { WALK_SPEED_MPS, walkMinutes } from '../hooks/usePlacesData';
import type { DayRhythm } from '../hooks/useMobilePreferences';

import { quickCategoryOf } from './categories';

export interface RouteStop {
  place: PlaceWithDistance;
  /** Hora estimada de llegada "HH:MM". */
  eta: string;
}

export interface RecommendedRoute {
  id: string;
  title: string;
  stops: RouteStop[];
  totalMinutes: number;
  totalMeters: number;
}

const STOPS_BY_RHYTHM: Record<DayRhythm, number> = { tranquilo: 2, moderado: 3, intenso: 4 };
const MINUTES_PER_STOP: Record<DayRhythm, number> = { tranquilo: 60, moderado: 40, intenso: 25 };
const MAX_RADIUS_M = 4000;
const RHYTHM_TITLES: Record<DayRhythm, (sector: string) => string> = {
  tranquilo: (s) => `${s} sin apuro`,
  moderado: (s) => `Lo mejor de ${s}`,
  intenso: (s) => `${s} a fondo`,
};

/** Categorías al aire libre o con pendiente que se evitan con lluvia / movilidad reducida. */
const OUTDOOR = new Set(['naturaleza', 'parque', 'humedal', 'bosque', 'sendero', 'agua', 'fauna']);
const STEEP = new Set(['sendero', 'bosque']);

function addMinutes(base: Date, minutes: number): string {
  const d = new Date(base.getTime() + minutes * 60_000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatDurationShort(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Ruta de una sola parada para reutilizar la navegación de "Rutas" (mapa, ficha de evento). */
export function singleStopRoute(place: PlaceWithDistance): RecommendedRoute {
  const minutes = walkMinutes(place.distanceMeters);
  return {
    id: `go-${place.id}`,
    title: place.title,
    stops: [{ place, eta: addMinutes(new Date(), minutes) }],
    totalMinutes: minutes,
    totalMeters: place.distanceMeters,
  };
}

/**
 * Arma una ruta a pie con paradas de categorías distintas, ordenadas por vecino más cercano.
 * Es una heurística local (sin backend) que respeta ritmo, clima y movilidad reducida.
 */
export function buildRecommendedRoute(
  places: PlaceWithDistance[],
  origin: Coordinate,
  options: { rhythm: DayRhythm; isRainy: boolean; reducedMobility: boolean; sectorName: string },
): RecommendedRoute | null {
  const target = STOPS_BY_RHYTHM[options.rhythm];
  const pool = places.filter((p) => {
    if (p.distanceMeters > MAX_RADIUS_M) return false;
    if (options.isRainy && OUTDOOR.has(p.category)) return false;
    if (options.reducedMobility && STEEP.has(p.category)) return false;
    return quickCategoryOf(p.category) !== null;
  });
  if (pool.length === 0) return null;

  // Una parada por grupo de categoría mientras se pueda, para que la ruta sea variada
  const chosen: PlaceWithDistance[] = [];
  const usedGroups = new Set<string>();
  for (const p of pool) {
    const group = quickCategoryOf(p.category)!;
    if (!usedGroups.has(group)) {
      chosen.push(p);
      usedGroups.add(group);
    }
    if (chosen.length === target) break;
  }
  for (const p of pool) {
    if (chosen.length >= target) break;
    if (!chosen.includes(p)) chosen.push(p);
  }

  // Orden por vecino más cercano desde el origen
  const ordered: PlaceWithDistance[] = [];
  const remaining = [...chosen];
  let cursor = origin;
  let totalMeters = 0;
  while (remaining.length) {
    let bestIdx = 0;
    let bestDist = Infinity;
    remaining.forEach((p, i) => {
      const d = calculateDistance(cursor.latitude, cursor.longitude, p.latitude, p.longitude);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    });
    const [next] = remaining.splice(bestIdx, 1);
    ordered.push(next);
    totalMeters += bestDist;
    cursor = next;
  }

  const now = new Date();
  let elapsed = 0;
  let prev = origin;
  const stops: RouteStop[] = ordered.map((place) => {
    const leg = calculateDistance(prev.latitude, prev.longitude, place.latitude, place.longitude);
    elapsed += Math.round(leg / WALK_SPEED_MPS / 60);
    const stop = { place, eta: addMinutes(now, elapsed) };
    elapsed += MINUTES_PER_STOP[options.rhythm];
    prev = place;
    return stop;
  });

  const title = options.isRainy
    ? `${options.sectorName} bajo techo`
    : RHYTHM_TITLES[options.rhythm](options.sectorName);

  return {
    id: ordered.map((p) => p.id).join('-'),
    title,
    stops,
    totalMinutes: elapsed,
    totalMeters,
  };
}
