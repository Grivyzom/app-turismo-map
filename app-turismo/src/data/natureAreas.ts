// ─────────────────────────────────────────────────────────────────────────────
// Áreas naturales (agua / humedal / parque) como CAPA DE CONTEXTO estática.
//
// Antes se dibujaban como polígonos-evento: cada pan/zoom reconstruía un
// GeoJSON de ~90k vértices y lo re-subía a MapLibre (re-tileado completo en el
// worker) y en nativo se montaban ~1.100 <Polygon> con todos sus vértices.
// Además sólo se usaba el anillo exterior del primer polígono, así que las
// islas (huecos) de los ríos se pintaban como agua y se perdían partes de los
// MultiPolygon.
//
// Aquí la geometría se construye UNA sola vez al cargar el módulo:
//   • se respetan huecos y todas las partes de los MultiPolygon,
//   • se simplifica (Douglas-Peucker, ~2 m) — invisible a escala de calle,
//   • se precalcula el bbox para descartar fuera de pantalla en nativo,
//   • se marca `interactive` sólo lo que aporta info al tocarlo
//     (parques siempre; agua/humedal sólo si tienen nombre).
// ─────────────────────────────────────────────────────────────────────────────
import parquesData from '../../coords/parques_valdivia.json';
import aguaData from '../../coords/cuerpos_agua.json';
import humedalesData from '../../coords/humedales.json';

export type NatureAreaCategory = 'agua' | 'humedal' | 'parque';
export const NATURE_AREA_CATEGORIES: NatureAreaCategory[] = ['agua', 'humedal', 'parque'];

export const isNatureAreaCategory = (cat?: string): cat is NatureAreaCategory =>
  !!cat && (NATURE_AREA_CATEGORIES as string[]).includes(cat);

type Position = [number, number];
type Ring = Position[];
type PolygonCoords = Ring[]; // [exterior, ...huecos]

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface NatureAreaShape {
  id: string;
  category: NatureAreaCategory;
  interactive: boolean;
  /** [minLng, minLat, maxLng, maxLat] */
  bbox: [number, number, number, number];
  /** Una entrada por parte del (Multi)Polygon, ya en formato react-native-maps. */
  parts: { coordinates: LatLng[]; holes: LatLng[][] }[];
}

// ~2 m en latitudes de Valdivia. Por debajo de esto la diferencia no se ve
// ni a zoom 18 y reduce los vértices a menos de la mitad.
const SIMPLIFY_TOLERANCE_DEG = 0.00002;

const sqSegDist = (p: Position, a: Position, b: Position): number => {
  let x = a[0];
  let y = a[1];
  let dx = b[0] - x;
  let dy = b[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = b[0];
      y = b[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = p[0] - x;
  dy = p[1] - y;
  return dx * dx + dy * dy;
};

// Douglas-Peucker iterativo (sin recursión para anillos largos).
export const simplifyRing = (ring: Ring, tolerance = SIMPLIFY_TOLERANCE_DEG): Ring => {
  if (ring.length <= 4) return ring;
  const sqTol = tolerance * tolerance;
  const keep = new Uint8Array(ring.length);
  keep[0] = 1;
  keep[ring.length - 1] = 1;
  const stack: [number, number][] = [[0, ring.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    let maxSqDist = sqTol;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const d = sqSegDist(ring[i], ring[first], ring[last]);
      if (d > maxSqDist) {
        index = i;
        maxSqDist = d;
      }
    }
    if (index !== -1) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  const out: Ring = [];
  for (let i = 0; i < ring.length; i++) if (keep[i]) out.push(ring[i]);
  // Un anillo válido necesita al menos 4 posiciones (triángulo cerrado).
  return out.length >= 4 ? out : ring;
};

const simplifyPolygon = (poly: PolygonCoords): PolygonCoords =>
  poly.map((ring) => simplifyRing(ring)).filter((ring) => ring.length >= 4);

const toLatLng = (ring: Ring): LatLng[] =>
  ring.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));

interface BuiltFeature {
  geojson: {
    type: 'Feature';
    properties: { id: string; category: NatureAreaCategory; interactive: boolean };
    geometry: { type: 'MultiPolygon'; coordinates: PolygonCoords[] };
  };
  shape: NatureAreaShape;
}

// Mismo esquema de id que parseGeoJSON (polygonsData.ts) para que la
// selección de un área apunte al TurismoEvent correspondiente.
const buildFeatures = (data: any, category: NatureAreaCategory): BuiltFeature[] => {
  if (!data?.features) return [];
  const out: BuiltFeature[] = [];
  data.features.forEach((f: any, i: number) => {
    const g = f.geometry;
    if (!g) return;
    let polys: PolygonCoords[] = [];
    if (g.type === 'Polygon') polys = [g.coordinates];
    else if (g.type === 'MultiPolygon') polys = g.coordinates;
    else return;

    polys = polys.map(simplifyPolygon).filter((p) => p.length > 0);
    if (polys.length === 0) return;

    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;
    for (const poly of polys) {
      for (const [lng, lat] of poly[0]) {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
    }

    const props = f.properties || {};
    const idStr = (props['@id'] || f.id || i).toString().replace(/\//g, '-');
    const id = `${category}-${idStr}`;
    const interactive = category === 'parque' || !!props.name;

    out.push({
      geojson: {
        type: 'Feature',
        properties: { id, category, interactive },
        geometry: { type: 'MultiPolygon', coordinates: polys },
      },
      shape: {
        id,
        category,
        interactive,
        bbox: [minLng, minLat, maxLng, maxLat],
        parts: polys.map(([outer, ...holes]) => ({
          coordinates: toLatLng(outer),
          holes: holes.map(toLatLng),
        })),
      },
    });
  });
  return out;
};

// Orden = orden de pintado: agua debajo, humedal, parque arriba.
const BUILT: BuiltFeature[] = [
  ...buildFeatures(aguaData, 'agua'),
  ...buildFeatures(humedalesData, 'humedal'),
  ...buildFeatures(parquesData, 'parque'),
];

export const NATURE_AREAS_GEOJSON = {
  type: 'FeatureCollection' as const,
  features: BUILT.map((b) => b.geojson),
};

export const NATURE_AREA_SHAPES: NatureAreaShape[] = BUILT.map((b) => b.shape);
