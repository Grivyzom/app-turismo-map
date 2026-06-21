import { TurismoEvent } from '../components/Map/types';
import data from '../../coords/parques_valdivia.json';
import { getPolygonCenter } from '../utils/locationUtils';
// We dynamically parse the geojson at runtime so that if the user updates the file with polygons, it will render them!
export const PARQUES_EVENTS: TurismoEvent[] = data.features.map((f: any, i: number) => {
  const event: TurismoEvent = {
    id: 'parque-' + (f.properties['@id'] || f.id || i).toString().replace(/\//g, '-'),
    title: f.properties.name || 'Parque',
    description:
      f.properties.description ||
      (f.properties['leisure'] === 'park' ? 'Parque público' : 'Área verde'),
    latitude: 0,
    longitude: 0,
    category: 'parque',
    organizer: f.properties.operator || 'Público',
    time: f.properties.opening_hours || '24/7',
    address: f.properties['addr:street'] || f.properties['object:street'] || '',
  };

  if (f.geometry.type === 'Point') {
    event.longitude = f.geometry.coordinates[0];
    event.latitude = f.geometry.coordinates[1];
  } else if (f.geometry.type === 'Polygon') {
    // Standard polygon from overpass 'out geom;'
    const ring = f.geometry.coordinates[0];
    event.polygon = ring.map((c: any) => ({ latitude: c[1], longitude: c[0] }));
  } else if (f.geometry.type === 'MultiPolygon') {
    const ring = f.geometry.coordinates[0][0];
    event.polygon = ring.map((c: any) => ({ latitude: c[1], longitude: c[0] }));
  } else if (f.geometry.type === 'LineString') {
    event.polygon = f.geometry.coordinates.map((c: any) => ({ latitude: c[1], longitude: c[0] }));
  }

  // Fallback if overpass exported geometry in properties (rare)
  if (f.properties.geometry && Array.isArray(f.properties.geometry)) {
    event.polygon = f.properties.geometry.map((c: any) => ({ latitude: c.lat, longitude: c.lon }));
  }

  // Centrar marcador en el centroide del área/línea
  if (event.polygon && event.polygon.length > 0) {
    const center = getPolygonCenter(event.polygon);
    event.latitude = center.latitude;
    event.longitude = center.longitude;
  }

  return event;
});
