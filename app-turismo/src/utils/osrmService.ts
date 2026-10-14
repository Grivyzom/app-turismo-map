export type TransportMode = 'foot' | 'bike' | 'car';

export interface OsrmStep {
  instruction: string;
  distance: number; // metros
  duration: number; // segundos
  maneuverType: string;
  modifier?: string;
  streetName: string;
  iconName: string; // MaterialIcons name
  exit?: number;
}

export interface SnappedWaypoint {
  latitude: number;
  longitude: number;
  name?: string;
  distanceToRoad: number; // metros desde el punto del click a la calle OSM
}

export interface OsrmRoute {
  geojson: GeoJSON.LineString;
  distance: number; // metros
  duration: number; // segundos
  steps: OsrmStep[];
  mode: TransportMode;
  label?: string; // 'Recomendada' | 'Más rápida' | 'Más corta'
  confidence?: number; // 0 - 100
  alternatives?: OsrmRoute[];
  snappedWaypoints?: SnappedWaypoint[];
}

export interface OptimizedTripResult {
  route: OsrmRoute;
  orderedIndices: number[];
  orderedWaypoints: Array<{ latitude: number; longitude: number; name?: string }>;
  distanceSavedMeters: number;
}

export interface RouteOptions {
  includeAlternatives?: boolean;
  maxAlternatives?: number;
  snapRadiusMeters?: number;
  signal?: AbortSignal;
}

// Endpoints principales OSRM
const OSRM_PRIMARY_SERVERS: Record<TransportMode, string> = {
  foot: 'https://router.project-osrm.org/route/v1/foot',
  bike: 'https://router.project-osrm.org/route/v1/bike',
  car: 'https://router.project-osrm.org/route/v1/driving',
};

// Mirrors de alta disponibilidad (FOSSGIS / OpenStreetMap)
const OSRM_MIRROR_SERVERS: Record<TransportMode, string> = {
  foot: 'https://routing.openstreetmap.de/routed-foot/route/v1/driving',
  bike: 'https://routing.openstreetmap.de/routed-bike/route/v1/driving',
  car: 'https://routing.openstreetmap.de/routed-car/route/v1/driving',
};

// Endpoints TSP / Trip Optimization
const OSRM_TRIP_SERVERS: Record<TransportMode, string> = {
  foot: 'https://router.project-osrm.org/trip/v1/foot',
  bike: 'https://router.project-osrm.org/trip/v1/bike',
  car: 'https://router.project-osrm.org/trip/v1/driving',
};

const DEFAULT_SNAPPING_RADII: Record<TransportMode, number> = {
  foot: 45,  // peatón: tolera parques, plazas, veredas
  bike: 65,  // ciclista: tolera ciclovías en veredas o parques
  car: 90,   // auto: busca calzada vehicular
};

const MANEUVER_LABELS: Record<string, string> = {
  depart:           'Sal hacia',
  arrive:           'Llegaste a tu destino',
  turn:             'Gira',
  'new name':       'Continúa por',
  continue:         'Continúa recto por',
  merge:            'Incorpórate a',
  'on ramp':        'Toma el acceso a',
  'off ramp':       'Toma la salida hacia',
  fork:             'En la bifurcación, toma',
  'end of road':    'Al final de la calle, gira',
  roundabout:       'En la rotonda, toma la',
  rotary:           'En la glorieta, toma la',
  'roundabout turn':'En la rotonda, gira',
  notification:     'Continúa',
};

const MODIFIER_LABELS: Record<string, string> = {
  'uturn':          'en U',
  'sharp right':    'bruscamente a la derecha',
  'right':          'a la derecha',
  'slight right':   'levemente a la derecha',
  straight:         'recto',
  'slight left':    'levemente a la izquierda',
  left:             'a la izquierda',
  'sharp left':     'bruscamente a la izquierda',
};

/**
 * Retorna el icono apropiado de MaterialIcons según el tipo de maniobra y modificador
 */
export function getManeuverIcon(maneuverType: string, modifier?: string): string {
  if (maneuverType === 'arrive') return 'place';
  if (maneuverType === 'depart') return 'navigation';
  if (maneuverType === 'roundabout' || maneuverType === 'rotary' || maneuverType === 'roundabout turn') {
    return 'roundabout-right';
  }
  if (modifier === 'uturn') return 'u-turn-left';
  if (modifier === 'sharp right' || modifier === 'right') return 'turn-right';
  if (modifier === 'slight right') return 'arrow-forward';
  if (modifier === 'sharp left' || modifier === 'left') return 'turn-left';
  if (modifier === 'slight left') return 'arrow-back';
  if (maneuverType === 'fork') return 'call-split';
  if (maneuverType === 'merge') return 'merge-type';
  if (maneuverType === 'on ramp') return 'trending-up';
  if (maneuverType === 'off ramp') return 'trending-down';
  return 'straight';
}

function buildInstruction(type: string, modifier?: string, name?: string, exit?: number): string {
  const street = name && name.trim() !== '' ? ` por ${name}` : '';
  const mod = modifier ? (MODIFIER_LABELS[modifier] ?? '') : '';

  if (type === 'roundabout' || type === 'rotary') {
    const exitText = exit ? ` ${exit}ª salida` : ' salida';
    return `En la rotonda, toma la${exitText}${street}`.trim();
  }

  if (type === 'arrive') {
    return name ? `Llegaste a tu destino en ${name}` : 'Llegaste a tu destino';
  }

  if (type === 'depart') {
    return name ? `Sal hacia ${name}` : 'Inicia el recorrido';
  }

  const base = MANEUVER_LABELS[type] ?? 'Continúa';
  return [base, mod, street].filter(Boolean).join(' ').trim();
}

/**
 * Mapea una ruta individual del json de OSRM a nuestra estructura OsrmRoute
 */
function parseOsrmRoute(
  routeData: any,
  mode: TransportMode,
  snappedWaypoints?: SnappedWaypoint[],
  label: string = 'Recomendada',
): OsrmRoute {
  const legs = routeData.legs ?? [];
  const steps: OsrmStep[] = legs.flatMap((leg: any) =>
    (leg.steps ?? []).map((s: any) => ({
      instruction: buildInstruction(
        s.maneuver?.type ?? 'continue',
        s.maneuver?.modifier,
        s.name,
        s.maneuver?.exit,
      ),
      distance: s.distance ?? 0,
      duration: s.duration ?? 0,
      maneuverType: s.maneuver?.type ?? 'continue',
      modifier: s.maneuver?.modifier,
      streetName: s.name ?? '',
      iconName: getManeuverIcon(s.maneuver?.type ?? 'continue', s.maneuver?.modifier),
      exit: s.maneuver?.exit,
    })),
  );

  // Calcular score de confianza (0 - 100)
  let confidence = 98;
  if (snappedWaypoints && snappedWaypoints.length > 0) {
    const avgSnapDist =
      snappedWaypoints.reduce((acc, wp) => acc + wp.distanceToRoad, 0) /
      snappedWaypoints.length;
    if (avgSnapDist > 80) confidence = Math.max(60, 98 - Math.round(avgSnapDist / 4));
  }

  return {
    geojson: routeData.geometry as GeoJSON.LineString,
    distance: Math.round(routeData.distance),
    duration: Math.round(routeData.duration),
    steps,
    mode,
    label,
    confidence,
    snappedWaypoints,
  };
}

/**
 * Calcula un score inteligente para ordenar alternativas de rutas
 * Menor puntaje = mejor ruta integral (balanceando tiempo, distancia y maniobras complejas)
 */
function calculateRouteScore(routeData: any, mode: TransportMode): number {
  const distKm = (routeData.distance ?? 0) / 1000;
  const durMin = (routeData.duration ?? 0) / 60;

  let turnPenalty = 0;
  const legs = routeData.legs ?? [];
  for (const leg of legs) {
    for (const step of leg.steps ?? []) {
      const type = step.maneuver?.type;
      const mod = step.maneuver?.modifier;
      if (mod === 'uturn') turnPenalty += 3;
      if (mod === 'sharp left' || mod === 'sharp right') turnPenalty += 1.5;
      if (type === 'turn') turnPenalty += 0.5;
    }
  }

  if (mode === 'bike') {
    return durMin * 1.0 + distKm * 0.8 + turnPenalty * 0.7;
  } else if (mode === 'foot') {
    return distKm * 1.5 + durMin * 0.8 + turnPenalty * 0.2;
  } else {
    return durMin * 1.5 + distKm * 0.6 + turnPenalty * 0.9;
  }
}

/**
 * Realiza un fetch con timeout y soporte para AbortSignal externo
 */
async function fetchWithTimeout(url: string, timeoutMs: number = 8000, externalSignal?: AbortSignal): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  if (externalSignal) {
    externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Construye la URL de consulta con parámetros de máxima precisión
 */
function buildOsrmUrl(
  baseUrl: string,
  waypoints: Array<{ latitude: number; longitude: number }>,
  mode: TransportMode,
  options?: RouteOptions,
  radiusOverride?: number,
): string {
  const coordsParam = waypoints
    .map((wp) => `${wp.longitude},${wp.latitude}`)
    .join(';');

  const snapRadius = radiusOverride ?? options?.snapRadiusMeters ?? DEFAULT_SNAPPING_RADII[mode];
  const radiusesParam = waypoints.map(() => snapRadius).join(';');

  const params = new URLSearchParams({
    geometries: 'geojson',
    steps: 'true',
    overview: 'full',
    annotations: 'false',
    continue_straight: 'default',
    radiuses: radiusesParam,
  });

  if (options?.includeAlternatives !== false && waypoints.length === 2) {
    params.set('alternatives', 'true');
  }

  return `${baseUrl}/${coordsParam}?${params.toString()}`;
}

/**
 * Ejecuta la consulta probando el servidor primario y realizando failover
 * al mirror secundario y ajuste dinámico de radio de snapping si es necesario.
 */
async function executePrecisionOsrmQuery(
  waypoints: Array<{ latitude: number; longitude: number; name?: string }>,
  mode: TransportMode,
  options?: RouteOptions,
): Promise<{ rawData: any; usedMode: TransportMode }> {
  const primaryBase = OSRM_PRIMARY_SERVERS[mode];
  const mirrorBase = OSRM_MIRROR_SERVERS[mode];

  // Intento 1: Servidor primario con radio estándar
  const primaryUrl = buildOsrmUrl(primaryBase, waypoints, mode, options);
  try {
    const res = await fetchWithTimeout(primaryUrl, 7500, options?.signal);
    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && data.routes?.length) {
        return { rawData: data, usedMode: mode };
      }
    }
  } catch (err) {
    console.warn(`[OSRM Precision] Primary query failed for mode=${mode}, trying adaptive snap or mirror`, err);
  }

  // Intento 2: Radio de snapping relajado (por si el pin cayó dentro de un parque o costanera)
  const relaxedRadius = (options?.snapRadiusMeters ?? DEFAULT_SNAPPING_RADII[mode]) * 2.5;
  const relaxedUrl = buildOsrmUrl(primaryBase, waypoints, mode, options, relaxedRadius);
  try {
    const res = await fetchWithTimeout(relaxedUrl, 6500, options?.signal);
    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && data.routes?.length) {
        return { rawData: data, usedMode: mode };
      }
    }
  } catch (err) {
    console.warn(`[OSRM Precision] Relaxed radius failed for mode=${mode}`, err);
  }

  // Intento 3: Servidor Mirror OSM
  const mirrorUrl = buildOsrmUrl(mirrorBase, waypoints, mode, options, relaxedRadius);
  try {
    const res = await fetchWithTimeout(mirrorUrl, 7000, options?.signal);
    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && data.routes?.length) {
        return { rawData: data, usedMode: mode };
      }
    }
  } catch (err) {
    console.warn(`[OSRM Precision] Mirror query failed for mode=${mode}`, err);
  }

  // Intento 4: Fallback inteligente de modo de transporte
  if (mode === 'bike') {
    console.log('[OSRM Precision] Fallback de bike a foot con máxima tolerancia...');
    return executePrecisionOsrmQuery(waypoints, 'foot', options);
  }

  if (mode === 'car') {
    console.log('[OSRM Precision] Fallback de car a foot con máxima tolerancia...');
    return executePrecisionOsrmQuery(waypoints, 'foot', options);
  }

  throw new Error('No se pudo encontrar una ruta navegable con las coordenadas seleccionadas');
}

/**
 * Calcula una ruta multi-parada (Multi-Stop) o punto a punto con motor de alta inteligencia.
 * Evalúa alternativas, calcula distancias de snapping exactas y clasifica la mejor ruta.
 */
export async function fetchOsrmMultiRoute(
  waypoints: Array<{ latitude: number; longitude: number; name?: string }>,
  mode: TransportMode = 'foot',
  options?: RouteOptions,
): Promise<OsrmRoute> {
  if (waypoints.length < 2) {
    throw new Error('Se requieren al menos 2 waypoints para calcular una ruta');
  }

  const { rawData, usedMode } = await executePrecisionOsrmQuery(waypoints, mode, options);

  // Extraer información de snapping de waypoints
  const snappedWaypoints: SnappedWaypoint[] = (rawData.waypoints ?? []).map((wp: any, idx: number) => ({
    latitude: wp.location ? wp.location[1] : waypoints[idx].latitude,
    longitude: wp.location ? wp.location[0] : waypoints[idx].longitude,
    name: wp.name || waypoints[idx]?.name || '',
    distanceToRoad: Math.round(wp.distance ?? 0),
  }));

  const candidateRoutes = rawData.routes ?? [];
  if (candidateRoutes.length === 0) {
    throw new Error('OSRM no encontró segmentos conectados para esta ruta');
  }

  // Si hay más de una ruta candidata (alternatives=true), ordenarlas inteligentemente
  if (candidateRoutes.length > 1) {
    candidateRoutes.sort((a: any, b: any) => {
      return calculateRouteScore(a, usedMode) - calculateRouteScore(b, usedMode);
    });
  }

  // La mejor ruta según nuestro modelo de scoring
  const bestRawRoute = candidateRoutes[0];
  const primaryRoute = parseOsrmRoute(bestRawRoute, usedMode, snappedWaypoints, 'Recomendada');

  // Si existen alternativas, mapearlas para que el usuario pueda alternar
  if (candidateRoutes.length > 1) {
    primaryRoute.alternatives = candidateRoutes.slice(1).map((alt: any, idx: number) => {
      const isShortest = alt.distance < bestRawRoute.distance;
      const isFastest = alt.duration < bestRawRoute.duration;
      let altLabel = `Alternativa ${idx + 1}`;
      if (isShortest) altLabel = 'Más corta';
      else if (isFastest) altLabel = 'Más rápida';

      return parseOsrmRoute(alt, usedMode, snappedWaypoints, altLabel);
    });
  }

  return primaryRoute;
}

/**
 * Calcula una ruta punto a punto de máxima precisión entre origen y destino.
 */
export async function fetchOsrmRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  mode: TransportMode = 'foot',
  options?: RouteOptions,
): Promise<OsrmRoute> {
  return fetchOsrmMultiRoute(
    [
      { latitude: originLat, longitude: originLng },
      { latitude: destLat, longitude: destLng },
    ],
    mode,
    options,
  );
}

/**
 * Optimización de Itinerarios Multi-Parada (Traveling Salesperson Problem - TSP)
 * Ordena de manera matemáticamente óptima las paradas intermedias entre el Punto A
 * (Origen) y el Punto B (Destino final) para minimizar la distancia total recorrida.
 */
export async function fetchOptimizedTrip(
  waypoints: Array<{ latitude: number; longitude: number; name?: string }>,
  mode: TransportMode = 'foot',
  options?: RouteOptions,
): Promise<OptimizedTripResult> {
  if (waypoints.length < 3) {
    const route = await fetchOsrmMultiRoute(waypoints, mode, options);
    return {
      route,
      orderedIndices: waypoints.map((_, i) => i),
      orderedWaypoints: waypoints,
      distanceSavedMeters: 0,
    };
  }

  const serverBase = OSRM_TRIP_SERVERS[mode] ?? OSRM_TRIP_SERVERS.foot;
  const coordsParam = waypoints
    .map((wp) => `${wp.longitude},${wp.latitude}`)
    .join(';');

  // Fijamos el primer punto como origen y el último como destino final
  const url = `${serverBase}/${coordsParam}?source=first&destination=last&roundtrip=false&geometries=geojson&steps=true&overview=full`;

  try {
    const res = await fetchWithTimeout(url, 9000, options?.signal);
    if (!res.ok) {
      throw new Error(`OSRM Trip service returned status ${res.status}`);
    }

    const data = await res.json();
    if (data.code !== 'Ok' || !data.trips?.length) {
      throw new Error(data.message || 'No se pudo optimizar el itinerario');
    }

    const trip = data.trips[0];
    const tripWaypoints = data.waypoints ?? [];

    // Ordenar los puntos según waypoint_index
    const orderedWaypointsWithIndex = tripWaypoints
      .map((wp: any, originalIdx: number) => ({
        originalIdx,
        tripIndex: wp.waypoint_index,
        waypoint: waypoints[originalIdx],
      }))
      .sort((a: any, b: any) => a.tripIndex - b.tripIndex);

    const orderedIndices = orderedWaypointsWithIndex.map((w: any) => w.originalIdx);
    const orderedWaypoints = orderedWaypointsWithIndex.map((w: any) => w.waypoint);

    const snappedWaypoints: SnappedWaypoint[] = tripWaypoints.map((wp: any, idx: number) => ({
      latitude: wp.location ? wp.location[1] : waypoints[idx].latitude,
      longitude: wp.location ? wp.location[0] : waypoints[idx].longitude,
      name: wp.name || waypoints[idx]?.name,
      distanceToRoad: Math.round(wp.distance ?? 0),
    }));

    const optimizedRoute = parseOsrmRoute(trip, mode, snappedWaypoints, 'Ruta Optimizada (Mínima Distancia)');

    // Calcular ahorro comparando con ruta secuencial no optimizada
    let originalSeqDist = 0;
    try {
      const naiveRoute = await fetchOsrmMultiRoute(waypoints, mode, { includeAlternatives: false });
      originalSeqDist = naiveRoute.distance;
    } catch {
      originalSeqDist = optimizedRoute.distance;
    }

    const distanceSavedMeters = Math.max(0, originalSeqDist - optimizedRoute.distance);

    return {
      route: optimizedRoute,
      orderedIndices,
      orderedWaypoints,
      distanceSavedMeters,
    };
  } catch (err) {
    console.warn('[OSRM Trip Optimization] Fallback a ruta multi-stop secuencial:', err);
    const fallbackRoute = await fetchOsrmMultiRoute(waypoints, mode, options);
    return {
      route: fallbackRoute,
      orderedIndices: waypoints.map((_, i) => i),
      orderedWaypoints: waypoints,
      distanceSavedMeters: 0,
    };
  }
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

