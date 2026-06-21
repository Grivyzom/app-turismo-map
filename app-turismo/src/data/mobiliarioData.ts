import mobiliarioGeoJson from '../../coords/mobiliario.json';

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
