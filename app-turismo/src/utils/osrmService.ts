const OSRM_BASE = 'https://router.project-osrm.org/route/v1/foot';

export interface OsrmStep {
  instruction: string;
  distance: number; // metros
  duration: number; // segundos
  maneuverType: string;
  streetName: string;
}

export interface OsrmRoute {
  geojson: GeoJSON.LineString;
  distance: number; // metros
  duration: number; // segundos
  steps: OsrmStep[];
}

const MANEUVER_LABELS: Record<string, string> = {
  depart:         'Sal hacia',
  arrive:         'Llegaste a tu destino',
  turn:           'Gira',
  'new name':     'Continúa por',
  continue:       'Continúa por',
  merge:          'Incorpórate a',
  'on ramp':      'Toma el acceso a',
  'off ramp':     'Toma la salida hacia',
  fork:           'En el cruce, toma',
  'end of road':  'Al final de la calle, gira',
  roundabout:     'En la rotonda, toma la salida',
  rotary:         'En la glorieta, toma la salida',
  notification:   'Continúa',
};

const MODIFIER_LABELS: Record<string, string> = {
  'uturn':        'en U',
  'sharp right':  'bruscamente a la derecha',
  'right':        'a la derecha',
  'slight right': 'levemente a la derecha',
  straight:       'recto',
  'slight left':  'levemente a la izquierda',
  left:           'a la izquierda',
  'sharp left':   'bruscamente a la izquierda',
};

function buildInstruction(type: string, modifier?: string, name?: string): string {
  const base = MANEUVER_LABELS[type] ?? 'Continúa';
  const mod = modifier ? (MODIFIER_LABELS[modifier] ?? '') : '';
  const street = name ? ` por ${name}` : '';
  return [base, mod, street].filter(Boolean).join(' ').trim();
}

export async function fetchOsrmRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
): Promise<OsrmRoute> {
  // Nota: el servidor demo público de OSRM NO acepta `language=es`
  // (devuelve InvalidQuery). Las instrucciones se traducen localmente.
  const url =
    `${OSRM_BASE}/${originLng},${originLat};${destLng},${destLat}` +
    '?geometries=geojson&steps=true&overview=full';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`OSRM error ${res.status}`);

  const data = await res.json();
  if (!data.routes?.length) throw new Error('OSRM: sin ruta disponible');

  const route = data.routes[0];
  const legs = route.legs ?? [];

  const steps: OsrmStep[] = legs.flatMap((leg: any) =>
    (leg.steps ?? []).map((s: any) => ({
      instruction: buildInstruction(
        s.maneuver?.type ?? 'continue',
        s.maneuver?.modifier,
        s.name,
      ),
      distance: s.distance ?? 0,
      duration: s.duration ?? 0,
      maneuverType: s.maneuver?.type ?? 'continue',
      streetName: s.name ?? '',
    })),
  );

  return {
    geojson: route.geometry as GeoJSON.LineString,
    distance: route.distance,
    duration: route.duration,
    steps,
  };
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
