import fitnessGeoJson from '../../coords/maquinas_ejercicio.json';
import { TurismoEvent } from '../components/Map/types';
import { findEnclosingPark } from '../utils/parkZones';

export const FITNESS_EVENTS: TurismoEvent[] = (fitnessGeoJson as any).features.map(
  (f: any, i: number) => {
    const coords = f.geometry.coordinates;
    const name = f.properties?.name || 'Máquinas de Ejercicio';
    const street = f.properties?.['addr:street'] || 'Espacio público, Valdivia';
    const enclosing = findEnclosingPark(coords[0], coords[1]);
    return {
      id: f.id || `fitness-${i}`,
      title: name,
      description:
        f.properties?.description ||
        'Estación de calistenia y máquinas de ejercicio al aire libre. Acceso público y gratuito.',
      latitude: coords[1],
      longitude: coords[0],
      category: 'maquina_ejercicio' as const,
      organizer: f.properties?.operator || 'Municipalidad de Valdivia',
      time: 'Acceso libre 24/7',
      address: street,
      isFlat: true,
      shape: 'disc' as const,
      finish: 'solid' as const,
      ambient: 'none' as const,
      customColor: '#10B981',
      parkId: enclosing ? enclosing.parkId : undefined,
      parkName: enclosing ? enclosing.parkName : undefined,
    };
  },
);
