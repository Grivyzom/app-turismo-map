import { TurismoEvent } from '../components/Map/types';
import parquesData from '../../coords/parques_valdivia.json';
import aguaData from '../../coords/cuerpos_agua.json';
import humedalesData from '../../coords/humedales.json';
import universidadesData from '../../coords/universidades.json';
import hospitalesData from '../../coords/hospitales.json';
import seguridadData from '../../coords/Camaras_bomberos_pacos_etc.json';
import estructurasData from '../../coords/estructuras_importantes.json';
import { getPolygonCenter } from '../utils/locationUtils';

const parseGeoJSON = (data: any, defaultCategory: TurismoEvent['category']): TurismoEvent[] => {
  if (!data || !data.features) return [];
  return data.features.map((f: any, i: number) => {
    const idStr = (f.properties['@id'] || f.id || i).toString().replace(/\//g, '-');
    const event: TurismoEvent = {
      id: `${defaultCategory}-${idStr}`,
      title:
        f.properties.name || defaultCategory.charAt(0).toUpperCase() + defaultCategory.slice(1),
      description: f.properties.description || `Área de ${defaultCategory}`,
      latitude: 0,
      longitude: 0,
      category: defaultCategory,
      organizer: f.properties.operator || 'Público',
      time: f.properties.opening_hours || '24/7',
      address: f.properties['addr:street'] || f.properties['object:street'] || '',
    };

    if (f.geometry && f.geometry.type === 'Point') {
      event.longitude = f.geometry.coordinates[0];
      event.latitude = f.geometry.coordinates[1];
    } else if (f.geometry && f.geometry.type === 'Polygon') {
      const ring = f.geometry.coordinates[0];
      event.polygon = ring.map((c: any) => ({ latitude: c[1], longitude: c[0] }));
    } else if (f.geometry && f.geometry.type === 'MultiPolygon') {
      const ring = f.geometry.coordinates[0][0];
      event.polygon = ring.map((c: any) => ({ latitude: c[1], longitude: c[0] }));
    } else if (f.geometry && f.geometry.type === 'LineString') {
      event.polygon = f.geometry.coordinates.map((c: any) => ({ latitude: c[1], longitude: c[0] }));
    }

    if (f.properties.geometry && Array.isArray(f.properties.geometry)) {
      event.polygon = f.properties.geometry.map((c: any) => ({
        latitude: c.lat,
        longitude: c.lon,
      }));
    }

    if (event.polygon && event.polygon.length > 0) {
      const center = getPolygonCenter(event.polygon);
      event.latitude = center.latitude;
      event.longitude = center.longitude;
    }

    return event;
  });
};

export const PARQUES_EVENTS = parseGeoJSON(parquesData, 'parque');
export const AGUA_EVENTS = parseGeoJSON(aguaData, 'agua');
export const HUMEDALES_EVENTS = parseGeoJSON(humedalesData, 'humedal');
export const UNIVERSIDADES_EVENTS = parseGeoJSON(universidadesData, 'universidad');

const parseHospitalesData = (data: any): TurismoEvent[] => {
  if (!data || !data.features) return [];
  return data.features.map((f: any, i: number) => {
    let cat: TurismoEvent['category'] = 'hospital';
    if (f.properties?.amenity === 'clinic') cat = 'clinica';

    const idStr = (f.properties['@id'] || f.id || i).toString().replace(/\//g, '-');
    const event: TurismoEvent = {
      id: `${cat}-${idStr}`,
      title: f.properties.name || (cat === 'clinica' ? 'Clínica' : 'Hospital'),
      description:
        f.properties.description ||
        (cat === 'clinica' ? 'Centro de Salud / Clínica' : 'Hospital'),
      latitude: 0,
      longitude: 0,
      category: cat,
      organizer: f.properties.operator || 'Público',
      time: f.properties.opening_hours || '24/7',
      address: f.properties['addr:street'] || f.properties['object:street'] || '',
      contactPhone: f.properties.phone || '',
    };

    if (f.geometry && f.geometry.type === 'Point') {
      event.longitude = f.geometry.coordinates[0];
      event.latitude = f.geometry.coordinates[1];
    } else if (f.geometry && f.geometry.type === 'Polygon') {
      const ring = f.geometry.coordinates[0];
      event.polygon = ring.map((c: any) => ({ latitude: c[1], longitude: c[0] }));
    } else if (f.geometry && f.geometry.type === 'MultiPolygon') {
      const ring = f.geometry.coordinates[0][0];
      event.polygon = ring.map((c: any) => ({ latitude: c[1], longitude: c[0] }));
    } else if (f.geometry && f.geometry.type === 'LineString') {
      event.polygon = f.geometry.coordinates.map((c: any) => ({ latitude: c[1], longitude: c[0] }));
    }

    if (f.properties.geometry && Array.isArray(f.properties.geometry)) {
      event.polygon = f.properties.geometry.map((c: any) => ({
        latitude: c.lat,
        longitude: c.lon,
      }));
    }

    if (event.polygon && event.polygon.length > 0) {
      const center = getPolygonCenter(event.polygon);
      event.latitude = center.latitude;
      event.longitude = center.longitude;
    }

    return event;
  });
};

export const HOSPITALES_EVENTS = parseHospitalesData(hospitalesData);

const parseSeguridadData = (data: any): TurismoEvent[] => {
  if (!data || !data.features) return [];
  return data.features.map((f: any, i: number) => {
    let cat: TurismoEvent['category'] = 'camara';
    if (f.properties?.amenity === 'police') cat = 'carabinero';
    else if (f.properties?.amenity === 'fire_station') cat = 'bombero';

    const idStr = (f.properties['@id'] || f.id || i).toString().replace(/\//g, '-');
    const event: TurismoEvent = {
      id: `${cat}-${idStr}`,
      title: f.properties.name || cat.charAt(0).toUpperCase() + cat.slice(1),
      description:
        f.properties.description ||
        (cat === 'camara'
          ? 'Cámara de Seguridad'
          : cat === 'carabinero'
            ? 'Comisaría / Retén'
            : 'Bomberos'),
      latitude: 0,
      longitude: 0,
      category: cat,
      organizer:
        f.properties.operator ||
        (cat === 'carabinero'
          ? 'Carabineros de Chile'
          : cat === 'bombero'
            ? 'Bomberos'
            : 'Público'),
      time: f.properties.opening_hours || '24/7',
      address: f.properties['addr:street'] || f.properties['object:street'] || '',
    };

    if (f.geometry && f.geometry.type === 'Point') {
      event.longitude = f.geometry.coordinates[0];
      event.latitude = f.geometry.coordinates[1];
    } else if (f.geometry && f.geometry.type === 'Polygon') {
      const ring = f.geometry.coordinates[0];
      event.polygon = ring.map((c: any) => ({ latitude: c[1], longitude: c[0] }));
    } else if (f.geometry && f.geometry.type === 'MultiPolygon') {
      const ring = f.geometry.coordinates[0][0];
      event.polygon = ring.map((c: any) => ({ latitude: c[1], longitude: c[0] }));
    } else if (f.geometry && f.geometry.type === 'LineString') {
      event.polygon = f.geometry.coordinates.map((c: any) => ({ latitude: c[1], longitude: c[0] }));
    }

    if (f.properties.geometry && Array.isArray(f.properties.geometry)) {
      event.polygon = f.properties.geometry.map((c: any) => ({
        latitude: c.lat,
        longitude: c.lon,
      }));
    }

    if (event.polygon && event.polygon.length > 0) {
      const center = getPolygonCenter(event.polygon);
      event.latitude = center.latitude;
      event.longitude = center.longitude;
    }

    return event;
  });
};

export const SEGURIDAD_EVENTS = parseSeguridadData(seguridadData);

const parseEstructurasData = (data: any): TurismoEvent[] => {
  if (!data || !data.features) return [];
  return data.features.map((f: any, i: number) => {
    let cat: TurismoEvent['category'] = 'arte';
    const tourism = f.properties?.tourism;
    const artworkType = f.properties?.artwork_type;
    const manMade = f.properties?.man_made;
    const building = f.properties?.building;

    if (tourism === 'artwork') {
      if (artworkType === 'statue') {
        cat = 'estatua';
      } else if (artworkType === 'sculpture') {
        cat = 'escultura';
      } else {
        cat = 'arte';
      }
    } else if (manMade === 'tower' || building === 'tower') {
      cat = 'torreon';
    }

    const idStr = (f.properties['@id'] || f.id || i).toString().replace(/\//g, '-');
    const event: TurismoEvent = {
      id: `${cat}-${idStr}`,
      title: f.properties.name || cat.charAt(0).toUpperCase() + cat.slice(1),
      description:
        f.properties.description ||
        (cat === 'escultura'
          ? 'Escultura'
          : cat === 'estatua'
            ? 'Estatua'
            : cat === 'torreon'
              ? 'Torreón'
              : 'Obra de arte'),
      latitude: 0,
      longitude: 0,
      category: cat,
      organizer: f.properties.operator || 'Público',
      time: f.properties.opening_hours || '24/7',
      address: f.properties['addr:street'] || f.properties['object:street'] || '',
    };

    if (f.geometry && f.geometry.type === 'Point') {
      event.longitude = f.geometry.coordinates[0];
      event.latitude = f.geometry.coordinates[1];
    } else if (f.geometry && f.geometry.type === 'Polygon') {
      const ring = f.geometry.coordinates[0];
      event.polygon = ring.map((c: any) => ({ latitude: c[1], longitude: c[0] }));
    } else if (f.geometry && f.geometry.type === 'MultiPolygon') {
      const ring = f.geometry.coordinates[0][0];
      event.polygon = ring.map((c: any) => ({ latitude: c[1], longitude: c[0] }));
    } else if (f.geometry && f.geometry.type === 'LineString') {
      event.polygon = f.geometry.coordinates.map((c: any) => ({ latitude: c[1], longitude: c[0] }));
    }

    if (f.properties.geometry && Array.isArray(f.properties.geometry)) {
      event.polygon = f.properties.geometry.map((c: any) => ({
        latitude: c.lat,
        longitude: c.lon,
      }));
    }

    if (event.polygon && event.polygon.length > 0) {
      const center = getPolygonCenter(event.polygon);
      event.latitude = center.latitude;
      event.longitude = center.longitude;
    }

    return event;
  });
};

export const ESTRUCTURAS_EVENTS = parseEstructurasData(estructurasData);

export const CASINO_DREAMS_EVENT: TurismoEvent = {
  id: '85b23094-202f-44cd-ab96-86c82a59aec8',
  title: 'Casino Dreams Pedro de Valdivia',
  description: 'Slick quarters in a river-view lodging with a casino & a spa.',
  latitude: -39.811456,
  longitude: -73.2467,
  category: 'edificio',
  organizer: 'Mundo Dreams',
  time: '24/7',
  address: 'Carampangue 190, Valdivia',
  polygon: [
    { latitude: -39.8112, longitude: -73.247 },
    { latitude: -39.8112, longitude: -73.2464 },
    { latitude: -39.8118, longitude: -73.2464 },
    { latitude: -39.8118, longitude: -73.247 },
    { latitude: -39.8112, longitude: -73.247 },
  ],
  indoorMap: {
    defaultFloor: 1,
    floors: [
      { level: 12, label: 'Piso 12 (Skybar)' },
      { level: 3, label: 'Piso 3 (Habitaciones)' },
      { level: 2, label: 'Piso 2 (Restaurante)' },
      { level: 1, label: 'Piso 1 (Casino & Lobby)' },
      { level: -1, label: 'Subterráneo (Estacionamiento)' },
    ],
  },
};

export const MUNICIPALIDAD_EVENT: TurismoEvent = {
  id: 'municipalidad-valdivia',
  title: 'Ilustre Municipalidad de Valdivia',
  description: 'Esta es la máxima autoridad regional, por ende debe estar bien representado.\nTeléfono: +56 63 228 8723\nSitio web oficial: Ilustre Municipalidad de Valdivia',
  latitude: -39.8142,
  longitude: -73.2459,
  category: 'municipalidad',
  organizer: 'Gobierno',
  time: 'Lunes a Viernes de 08:30 a 14:00 horas',
  openingHours: 'Lu-Vi 08:30-14:00',
  contactPhone: '+56 63 228 8723',
  address: 'Independencia 455, Valdivia, Región de Los Ríos, Chile',
  polygon: [
    { latitude: -39.8140, longitude: -73.2461 },
    { latitude: -39.8140, longitude: -73.2457 },
    { latitude: -39.8144, longitude: -73.2457 },
    { latitude: -39.8144, longitude: -73.2461 },
    { latitude: -39.8140, longitude: -73.2461 },
  ],
  vineta: {
    type: 'calificacion',
    label: 'Autoridad',
    active: true
  }
};
