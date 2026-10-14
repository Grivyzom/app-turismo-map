import parquesGeoJson from '../../coords/parques_valdivia.json';

interface ParkBoundary {
  parkId: string;
  name: string;
  ring: [number, number][];
  bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
}

/**
 * Algoritmo Point-in-Polygon (Ray-Casting) para anillos de coordenadas GeoJSON [lng, lat]
 */
function isPointInRing(lng: number, lat: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Bounding box index precalculado una sola vez en memoria (~20ms en arranque)
const PARK_BOUNDARIES: ParkBoundary[] = (() => {
  const boundaries: ParkBoundary[] = [];
  const features = (parquesGeoJson as any).features || [];

  for (let i = 0; i < features.length; i++) {
    const f = features[i];
    const idStr = (f.properties?.['@id'] || f.id || i).toString().replace(/\//g, '-');
    const parkId = `parque-${idStr}`;
    const name = f.properties?.name || 'Parque';

    const processRing = (ring: [number, number][]) => {
      if (!Array.isArray(ring) || ring.length < 3) return;
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;

      for (let k = 0; k < ring.length; k++) {
        const pt = ring[k];
        if (pt[0] < minX) minX = pt[0];
        if (pt[0] > maxX) maxX = pt[0];
        if (pt[1] < minY) minY = pt[1];
        if (pt[1] > maxY) maxY = pt[1];
      }
      boundaries.push({ parkId, name, ring, bbox: [minX, minY, maxX, maxY] });
    };

    if (f.geometry?.type === 'Polygon' && Array.isArray(f.geometry.coordinates?.[0])) {
      processRing(f.geometry.coordinates[0]);
    } else if (f.geometry?.type === 'MultiPolygon' && Array.isArray(f.geometry.coordinates)) {
      for (const poly of f.geometry.coordinates) {
        if (Array.isArray(poly?.[0])) {
          processRing(poly[0]);
        }
      }
    }
  }
  return boundaries;
})();

/**
 * Encuentra el parque o zona de reserva contenedor para unas coordenadas [lng, lat].
 * Retorna { parkId, parkName } si el punto está dentro del polígono del parque, o null si está en la calle/exterior.
 */
export function findEnclosingPark(
  longitude: number,
  latitude: number,
): { parkId: string; parkName: string } | null {
  for (let i = 0; i < PARK_BOUNDARIES.length; i++) {
    const p = PARK_BOUNDARIES[i];
    if (
      longitude < p.bbox[0] ||
      longitude > p.bbox[2] ||
      latitude < p.bbox[1] ||
      latitude > p.bbox[3]
    ) {
      continue;
    }
    if (isPointInRing(longitude, latitude, p.ring)) {
      return { parkId: p.parkId, parkName: p.name };
    }
  }
  return null;
}
