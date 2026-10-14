import mobiliarioGeoJson from '../../coords/mobiliario.json';
import { TurismoEvent } from '../components/Map/types';
import { findEnclosingPark } from '../utils/parkZones';

export type FurnitureAmenity = 'bench' | 'waste_basket' | 'drinking_water' | 'toilets' | 'unknown';

export interface FurniturePOI {
  id: string;
  amenity: FurnitureAmenity;
  latitude: number;
  longitude: number;
}

export const MOBILIARIO_GEOJSON = mobiliarioGeoJson;

export const parseFurniture = (): FurniturePOI[] => {
  const features = (mobiliarioGeoJson as any).features || [];
  const pois: FurniturePOI[] = [];

  for (const f of features) {
    if (f.geometry?.type === 'Point' && f.geometry.coordinates) {
      const [lng, lat] = f.geometry.coordinates;
      let amenity: FurnitureAmenity = 'unknown';
      const propAmenity = f.properties?.amenity;

      if (propAmenity === 'bench') amenity = 'bench';
      else if (propAmenity === 'waste_basket') amenity = 'waste_basket';
      else if (propAmenity === 'drinking_water') amenity = 'drinking_water';
      else if (propAmenity === 'toilets') amenity = 'toilets';

      if (amenity !== 'unknown') {
        pois.push({
          id: f.id || f.properties?.['@id'] || `f-${Math.random()}`,
          amenity,
          latitude: lat,
          longitude: lng,
        });
      }
    }
  }

  return pois;
};

// Singleton array so we parse only once
export const furnitureData: FurniturePOI[] = parseFurniture();

export const MOBILIARIO_EVENTS: TurismoEvent[] = (mobiliarioGeoJson as any).features
  .filter((f: any) => f.geometry?.type === 'Point' && f.geometry.coordinates)
  .map((f: any, i: number) => {
    const [lng, lat] = f.geometry.coordinates;
    const amenity = f.properties?.amenity;
    const id = `mob-${f.id || f.properties?.['@id'] || i}`.replace(/\//g, '-');
    const enclosing = findEnclosingPark(lng, lat);
    const parkId = enclosing ? enclosing.parkId : undefined;
    const parkName = enclosing ? enclosing.parkName : undefined;

    if (amenity === 'bench') {
      return {
        id,
        title: 'Banca de Descanso',
        description: 'Banca pública para descansar y contemplar el entorno.',
        latitude: lat,
        longitude: lng,
        category: 'banca' as const,
        organizer: 'Espacio Público Valdivia',
        time: 'Acceso libre 24/7',
        address: f.properties?.['addr:street'] || 'Paseo público, Valdivia',
        isFlat: true,
        shape: 'plaque' as const,
        finish: 'pearl' as const,
        ambient: 'none' as const,
        customColor: '#94A3B8',
        parkId,
        parkName,
      };
    }
    if (amenity === 'drinking_water') {
      return {
        id,
        title: 'Bebedero de Agua Potable',
        description: 'Punto de agua potable gratuito y público para hidratación.',
        latitude: lat,
        longitude: lng,
        category: 'bebedero' as const,
        organizer: 'Municipalidad de Valdivia',
        time: '24/7',
        address: f.properties?.['addr:street'] || 'Costanera / Parque, Valdivia',
        isFlat: true,
        shape: 'disc' as const,
        finish: 'solid' as const,
        ambient: 'none' as const,
        customColor: '#0EA5E9',
        parkId,
        parkName,
      };
    }
    if (amenity === 'toilets') {
      return {
        id,
        title: 'Baño Público',
        description: 'Servicio higiénico público en la costanera / centro.',
        latitude: lat,
        longitude: lng,
        category: 'bano' as const,
        organizer: 'Municipalidad de Valdivia',
        time: f.properties?.opening_hours || '08:00 - 20:00',
        address: f.properties?.['addr:street'] || 'Costanera, Valdivia',
        isFlat: false,
        shape: 'shield' as const,
        finish: 'pearl' as const,
        ambient: 'halo' as const,
        customColor: '#8B5CF6',
        parkId,
        parkName,
      };
    }
    // waste_basket or other
    return {
      id,
      title: 'Punto Limpio / Basurero',
      description: 'Contenedor de residuos urbanos para mantener limpia la ciudad.',
      latitude: lat,
      longitude: lng,
      category: 'basurero' as const,
      organizer: 'Aseo y Ornato Valdivia',
      time: '24/7',
      address: f.properties?.['addr:street'] || 'Vía pública, Valdivia',
      isFlat: true,
      shape: 'disc' as const,
      finish: 'solid' as const,
      ambient: 'none' as const,
      customColor: '#64748B',
      parkId,
      parkName,
    };
  });
