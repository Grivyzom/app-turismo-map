import { useMemo } from 'react';
import Supercluster from 'supercluster';

import { TurismoEvent, Cluster, MapItem } from '../components/Map/types';

import { getCategoryColor } from './mapUtils';

/**
 * Calcula el color dominante de un cluster basado en la categoría más frecuente.
 */
export function getClusterDominantColor(events: TurismoEvent[]): string {
  if (events.length === 0) return '#3B82F6';
  if (events.length === 1) return getCategoryColor(events[0].category, events[0].musicStyle);

  // Contar frecuencia de cada categoría
  const freq: Record<string, number> = {};
  for (const e of events) {
    freq[e.category] = (freq[e.category] || 0) + 1;
  }

  // Encontrar categoría más frecuente
  let maxCount = 0;
  let dominantCategory = events[0].category;
  let dominantMusicStyle = events[0].musicStyle;
  for (const [cat, count] of Object.entries(freq)) {
    if (count > maxCount) {
      maxCount = count;
      dominantCategory = cat as TurismoEvent['category'];
      // Buscar el musicStyle del primer evento de esa categoría
      dominantMusicStyle = events.find((e) => e.category === cat)?.musicStyle;
    }
  }

  return getCategoryColor(dominantCategory, dominantMusicStyle);
}

const HIGH_PRIORITY_CATEGORIES = [
  'choque',
  'incendio',
  'accidente',
  'calle_cortada',
  'coliseo',
  'puerto',
  'fauna',
];
const MEDIUM_PRIORITY_CATEGORIES = [
  ...HIGH_PRIORITY_CATEGORIES,
  'cultura',
  'naturaleza',
  'publico',
  'museo',
  'teatro',
  'deportes',
  'tienda',
];
// LOW_PRIORITY includes everything else (gastronomia, musica)

const CATEGORY_WEIGHTS: Record<string, number> = {
  choque: 100,
  incendio: 100,
  accidente: 100,
  calle_cortada: 100,
  coliseo: 90,
  puerto: 90,
  fauna: 90,
  embarcacion: 85,
  cultura: 70,
  naturaleza: 70,
  museo: 70,
  teatro: 70,
  tienda: 50,
  publico: 60,
  deportes: 60,
  gastronomia: 40,
  musica: 40,
};

function getCategoryWeight(category: string): number {
  return CATEGORY_WEIGHTS[category] || 10;
}

const COLLISION_TOLERANCE_PIXELS = 45; // Distancia en píxeles para considerar colisión

// Calcula la distancia en píxeles aproximada entre dos coordenadas dados un nivel de zoom
function getPixelDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  zoom: number,
): number {
  const worldSize = 256 * Math.pow(2, zoom);

  const x1 = ((lon1 + 180) / 360) * worldSize;
  const x2 = ((lon2 + 180) / 360) * worldSize;

  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;

  const y1 = ((1 - Math.log(Math.tan(lat1Rad) + 1 / Math.cos(lat1Rad)) / Math.PI) / 2) * worldSize;
  const y2 = ((1 - Math.log(Math.tan(lat2Rad) + 1 / Math.cos(lat2Rad)) / Math.PI) / 2) * worldSize;

  return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
}

/**
 * Filtra los eventos que colisionan visualmente dejando solo los de mayor peso.
 */
function declutterEvents(events: TurismoEvent[], zoom: number): TurismoEvent[] {
  // Ordenar por peso descendente para procesar los más importantes primero
  const sorted = [...events].sort(
    (a, b) => getCategoryWeight(b.category) - getCategoryWeight(a.category),
  );
  const visible: TurismoEvent[] = [];

  for (const event of sorted) {
    let collides = false;
    for (const v of visible) {
      if (
        getPixelDistance(event.latitude, event.longitude, v.latitude, v.longitude, zoom) <
        COLLISION_TOLERANCE_PIXELS
      ) {
        collides = true;
        break;
      }
    }
    if (!collides) {
      visible.push(event);
    }
  }

  return visible;
}

/**
 * Hook para optimizar el agrupamiento de eventos usando Supercluster (QuadTree).
 * Implementa un sistema de Nivel de Detalle (LOD) basado en el zoom.
 * @param events Lista de eventos.
 * @param zoom Nivel de zoom actual.
 * @param bounds (opcional) Limites del mapa. Si no se provee, asume el mundo entero.
 * @returns Lista de marcadores y clusters a renderizar.
 */
export function useSuperclusterEvents(
  events: TurismoEvent[],
  zoom: number,
  bounds?: { minLat: number; maxLat: number; minLng: number; maxLng: number },
): MapItem[] {
  // Determinar el tier de Nivel de Detalle (LOD)
  // 1: Zoom Lejano (Ciudad) - Solo emergencias y lugares clave
  // 2: Zoom Medio (Barrios) - Se suman museos, parques, etc.
  // 3: Zoom Cercano (Calles) - Se muestran todos los pines (cafeterias, etc.)
  const lodTier = useMemo(() => {
    if (zoom < 11) return 1;
    if (zoom < 14) return 2;
    return 3;
  }, [zoom]); // Recalcula si cambia el zoom

  const visibleEventsForTier = useMemo(() => {
    return events.filter((e) => {
      if (['agua', 'humedal'].includes(e.category)) return false;
      if (e.category === 'embarcacion') return true; // Siempre visibles

      const cat = e.category?.toLowerCase() || '';
      if (cat === 'camara') {
        return zoom >= 17;
      }

      if (lodTier === 1) {
        return HIGH_PRIORITY_CATEGORIES.includes(e.category);
      }
      if (lodTier === 2) {
        return MEDIUM_PRIORITY_CATEGORIES.includes(e.category);
      }
      return true; // Tier 3 muestra todos
    });
  }, [events, lodTier, zoom]);

  // Instanciar y cargar datos en el QuadTree solo si cambian los eventos filtrados por LOD
  const superclusterInstance = useMemo(() => {
    const sc = new Supercluster<TurismoEvent, any>({
      radius: 100,
      maxZoom: 18,
    });

    const points: Supercluster.PointFeature<TurismoEvent>[] = visibleEventsForTier
      .filter((e) => {
        const cat = e.category?.toLowerCase() || '';
        return (
          cat !== 'embarcacion' &&
          cat !== 'parque' &&
          cat !== 'reserva' &&
          cat !== 'reservas' &&
          cat !== 'naturaleza' &&
          cat !== 'camara'
        );
      })
      .map((event) => ({
        type: 'Feature',
        properties: { ...event, cluster: false } as any,
        geometry: {
          type: 'Point',
          coordinates: [event.longitude, event.latitude],
        },
      }));

    sc.load(points);
    return { sc, id: Math.random().toString(36).substring(2, 9) };
  }, [visibleEventsForTier]);

  // Extraer los clusters para el zoom actual
  const clusteredItems = useMemo(() => {
    const bbox: [number, number, number, number] = bounds
      ? [bounds.minLng, bounds.minLat, bounds.maxLng, bounds.maxLat]
      : [-180, -85, 180, 85]; // Mundo por defecto si no hay bounds

    // Los barcos, parques/reservas y camaras siempre se devuelven como items individuales (sin clustering)
    const unclusteredEvents = visibleEventsForTier.filter((e) => {
      const cat = e.category?.toLowerCase() || '';
      const isUnclustered =
        cat === 'embarcacion' ||
        cat === 'parque' ||
        cat === 'reserva' ||
        cat === 'reservas' ||
        cat === 'naturaleza' ||
        cat === 'camara';
      if (!isUnclustered) return false;

      // Optimización crítica: solo cargar elementos de la zona visible (bbox) para evitar sobrecarga de marcadores fuera de pantalla
      return (
        e.longitude >= bbox[0] &&
        e.longitude <= bbox[2] &&
        e.latitude >= bbox[1] &&
        e.latitude <= bbox[3]
      );
    });

    // Si el zoom es muy alto, desactivamos el clustering para el resto
    if (zoom >= 17) {
      const visibleClusteredCandidates = visibleEventsForTier
        .filter((e) => {
          const cat = e.category?.toLowerCase() || '';
          return (
            cat !== 'embarcacion' &&
            cat !== 'parque' &&
            cat !== 'reserva' &&
            cat !== 'reservas' &&
            cat !== 'naturaleza' &&
            cat !== 'camara'
          );
        })
        .filter(
          (event) =>
            event.longitude >= bbox[0] &&
            event.longitude <= bbox[2] &&
            event.latitude >= bbox[1] &&
            event.latitude <= bbox[3],
        );

      // Aplicar Decluttering (Tolerancia a colisiones) basado en pesos para evitar superposición visual
      const decluttered = declutterEvents(visibleClusteredCandidates, zoom);

      return [...decluttered, ...unclusteredEvents];
    }

    const scClusters = superclusterInstance.sc.getClusters(bbox, zoom);

    // Mapear la salida de supercluster de vuelta a nuestro formato MapItem (TurismoEvent | Cluster)
    const items = scClusters.map((cluster): MapItem => {
      if (cluster.properties.cluster) {
        const clusterId = `cluster-${superclusterInstance.id}-${cluster.properties.cluster_id}`;
        const leaves = superclusterInstance.sc.getLeaves(cluster.properties.cluster_id, 50, 0);
        const originalEvents = leaves.map((l) => l.properties as unknown as TurismoEvent);

        return {
          id: clusterId,
          latitude: cluster.geometry.coordinates[1],
          longitude: cluster.geometry.coordinates[0],
          isCluster: true,
          events: originalEvents,
        } as Cluster;
      }
      return cluster.properties as unknown as TurismoEvent;
    });

    return [...items, ...unclusteredEvents];
  }, [superclusterInstance, zoom, bounds, visibleEventsForTier]);

  return clusteredItems;
}
