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
  latitude: -39.812864,
  longitude: -73.246993,
  category: 'municipalidad',
  organizer: 'Gobierno',
  time: 'Lunes a Viernes de 08:30 a 14:00 horas',
  openingHours: 'Lu-Vi 08:30-14:00',
  contactPhone: '+56 63 228 8723',
  address: 'Independencia 455, Valdivia, Región de Los Ríos, Chile',
  polygon: [
    { latitude: -39.813027, longitude: -73.246623 },
    { latitude: -39.812805, longitude: -73.246581 },
    { latitude: -39.812688, longitude: -73.247352 },
    { latitude: -39.812935, longitude: -73.247417 },
    { latitude: -39.813027, longitude: -73.246623 },
  ],
  vineta: {
    type: 'calificacion',
    label: 'Autoridad',
    active: true
  }
};

export const FERIA_FLUVIAL_EVENT: TurismoEvent = {
  id: 'feria-fluvial-valdivia',
  title: 'Feria Fluvial de Valdivia',
  description: 'Mercado tradicional a orillas del río Calle-Calle con pescados, mariscos y productos locales.\nTeléfono: +56 63 221 3000',
  latitude: -39.812851,
  longitude: -73.248370,
  category: 'gastronomia',
  organizer: 'Municipalidad de Valdivia',
  time: 'Lunes a Domingo 08:00 - 18:00',
  openingHours: 'Lu-Do 08:00-18:00',
  address: 'Av. Arturo Prat s/n, Valdivia',
  polygon: [
    { latitude: -39.813177, longitude: -73.248591 },
    { latitude: -39.813212, longitude: -73.248384 },
    { latitude: -39.812524, longitude: -73.248146 },
    { latitude: -39.812489, longitude: -73.248358 },
    { latitude: -39.813177, longitude: -73.248591 },
  ],
  vineta: {
    type: 'calificacion',
    label: 'Mercado',
    active: true
  }
};

export const PENDULO_VALDIVIA_EVENT: TurismoEvent = {
  id: 'pendulo-valdivia',
  title: 'Péndulo de Valdivia',
  description: 'Escultura cinética icónica ubicada en el centro de Valdivia.',
  latitude: -39.814060,
  longitude: -73.248595,
  category: 'escultura',
  organizer: 'Municipalidad de Valdivia',
  time: 'Acceso libre',
  address: 'Centro, Valdivia',
};

export const SUBMARINO_VALDIVIA_EVENT: TurismoEvent = {
  id: 'submarino-valdivia',
  title: 'Submarino de Valdivia',
  description: 'Monumento histórico en forma de submarino ubicado a orillas del río.',
  latitude: -39.816053,
  longitude: -73.249304,
  category: 'estatua',
  organizer: 'Municipalidad de Valdivia',
  time: 'Acceso libre',
  address: 'Ribera, Valdivia',
};

export const MERCADO_MUNICIPAL_VALDIVIA_EVENT: TurismoEvent = {
  id: 'mercado-municipal-valdivia',
  title: 'Mercado Municipal de Valdivia',
  description: 'Mercado municipal con productos locales, frutas, verduras y artículos diversos.',
  latitude: -39.812963,
  longitude: -73.247765,
  category: 'mercado',
  organizer: 'Municipalidad de Valdivia',
  time: 'Lunes a Domingo 08:00 - 18:00',
  openingHours: 'Lu-Do 08:00-18:00',
  address: 'Valdivia',
  polygon: [
    { latitude: -39.812791, longitude: -73.247944 },
    { latitude: -39.812855, longitude: -73.247541 },
    { latitude: -39.813116, longitude: -73.247588 },
    { latitude: -39.813057, longitude: -73.248026 },
    { latitude: -39.812791, longitude: -73.247944 },
  ],
};
