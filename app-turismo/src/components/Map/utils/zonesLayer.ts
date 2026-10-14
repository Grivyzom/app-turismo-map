import type maplibregl from 'maplibre-gl';
import { getBeforeBridgesOrBuildingLayerId } from './mapHelpers';

interface ZonesSyncOptions {
  getMap: () => maplibregl.Map | null;
  getSectors: () => any[] | null | undefined;
  getVisibleSectorIds: () => any[] | null | undefined;
  getLayerMode: () => string;
  getShowSectors: () => boolean;
}

/**
 * Sincroniza la fuente y capas de zonas/sectores ('zones-*') con el mapa.
 * Carga las zonas del backend si no vienen por props.
 */
export function createZonesSync({
  getMap,
  getSectors,
  getVisibleSectorIds,
  getLayerMode,
  getShowSectors,
}: ZonesSyncOptions) {
  const syncZones = async () => {
    const map = getMap();
    if (!map || typeof map.isStyleLoaded !== 'function' || !map.isStyleLoaded()) return;

    try {
      let zones = getSectors();
      if (!zones || zones.length === 0) {
        const baseUrl =
          process.env.EXPO_PUBLIC_BACKEND_URL ||
          process.env.EXPO_PUBLIC_API_URL ||
          'http://localhost:8080';
        const response = await fetch(`${baseUrl}/api/v1/zones`);
        if (!response.ok) throw new Error('Error al cargar zonas');
        zones = await response.json();
      }

      if (!map.hasImage('reserva-pattern')) {
        const isDark = getLayerMode() === 'dark';
        const rLine = isDark ? 'rgba(52,211,153,0.2)' : 'rgba(5,150,105,0.2)';
        const rFill = isDark ? 'rgba(16,185,129,0.3)' : 'rgba(6,78,59,0.3)';
        const svgStringReserva = `<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
          <line x1="-10" y1="50" x2="50" y2="-10" stroke="${rLine}" stroke-width="1.5"/>
          <line x1="-10" y1="30" x2="30" y2="-10" stroke="${rLine}" stroke-width="1.5"/>
          <line x1="10" y1="50" x2="50" y2="10" stroke="${rLine}" stroke-width="1.5"/>
          <path d="M 15 15 C 10 10, 20 5, 20 15 C 25 20, 15 25, 15 15" fill="${rFill}"/>
          <path d="M 30 30 C 25 25, 35 20, 35 30 C 40 35, 30 40, 30 30" fill="${rFill}"/>
        </svg>`;
        const imgReserva = new Image(40, 40);
        imgReserva.src =
          'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStringReserva);
        imgReserva.onload = () => {
          if (
            map &&
            typeof map.hasImage === 'function' &&
            !map.hasImage('reserva-pattern')
          ) {
            map.addImage('reserva-pattern', imgReserva);
            syncZones();
          }
        };
      }

      const currentVisibleIds = getVisibleSectorIds();
      const activeZones = currentVisibleIds
        ? (Array.isArray(zones) ? zones : []).filter((z: any) => currentVisibleIds.includes(z.id))
        : Array.isArray(zones)
          ? zones
          : [];

      // Ordenar las zonas para que 'edificio' se renderice al final (encima de 'ciudad' y 'reserva')
      const sortedZones = [...(Array.isArray(activeZones) ? activeZones : [])].sort((a, b) => {
        const getPriority = (cat: string) => {
          if (cat === 'edificio') return 3;
          if (cat === 'reserva') return 2;
          return 1;
        };
        return getPriority(a.category || 'ciudad') - getPriority(b.category || 'ciudad');
      });

      // Convertir array de zonas a un FeatureCollection de GeoJSON
      const featureCollection = {
        type: 'FeatureCollection',
        features: sortedZones.map((z: any) => ({
          type: 'Feature',
          properties: {
            id: z.id,
            name: z.name,
            color: z.color || '#10B981',
            category: z.category || 'ciudad',
          },
          geometry: typeof z.geojson === 'string' ? JSON.parse(z.geojson) : z.geojson,
        })),
      };

      if (map.getSource('zones-source')) {
        (map.getSource('zones-source') as maplibregl.GeoJSONSource).setData(
          featureCollection as any,
        );
      } else {
        map.addSource('zones-source', {
          type: 'geojson',
          data: featureCollection as any,
        });

        // Bajo puentes y bajo 'building-3d': un puente sobre un río/lago/
        // reserva debe verse encima del relleno, y un edificio 3D debe
        // tapar la zona en vez de dejarla ver a través.
        const beforeId = getBeforeBridgesOrBuildingLayerId(map);

        // Capa de Relleno (Fill) diferenciada por tipo
        map.addLayer(
          {
            id: 'zones-fill',
            type: 'fill',
            source: 'zones-source',
            layout: {
              visibility: getShowSectors() ? 'visible' : 'none',
            },
            paint: {
              'fill-color': ['get', 'color'],
              'fill-opacity': [
                'step',
                ['zoom'],
                ['match', ['get', 'category'], 'edificio', 0, 'reserva', 0, 0.08],
                11.5,
                ['match', ['get', 'category'], 'edificio', 0, 'reserva', 0, 0.08],
                14,
                ['match', ['get', 'category'], 'edificio', 0.35, 'reserva', 0, 0.08],
              ],
            },
          },
          beforeId,
        );

        // Capa de patrón específico para reservas
        map.addLayer(
          {
            id: 'zones-reserva-pattern',
            type: 'fill',
            source: 'zones-source',
            filter: ['==', ['get', 'category'], 'reserva'],
            layout: {
              visibility: getShowSectors() ? 'visible' : 'none',
            },
            paint: {
              'fill-pattern': 'reserva-pattern',
              'fill-opacity': 0.8,
            },
          },
          beforeId,
        );

        // Respaldo plano para reservas en pitch alto — ver patternPitchT
        // en updateAesthetics.
        map.addLayer(
          {
            id: 'zones-reserva-flat-fallback',
            type: 'fill',
            source: 'zones-source',
            filter: ['==', ['get', 'category'], 'reserva'],
            layout: {
              visibility: getShowSectors() ? 'visible' : 'none',
            },
            paint: {
              'fill-color': ['get', 'color'],
              'fill-opacity': 0,
            },
          },
          beforeId,
        );

        // Capa de Borde diferenciada por tipo
        map.addLayer(
          {
            id: 'zones-outline',
            type: 'line',
            source: 'zones-source',
            layout: {
              visibility: getShowSectors() ? 'visible' : 'none',
            },
            paint: {
              'line-color': ['get', 'color'],
              'line-width': [
                'match',
                ['get', 'category'],
                'edificio',
                3,
                'reserva',
                2,
                1.5, // Ciudad
              ],
              'line-blur': 1,
              'line-opacity': [
                'step',
                ['zoom'],
                ['match', ['get', 'category'], 'edificio', 0, 'reserva', 0, 0.4],
                11.5,
                ['match', ['get', 'category'], 'edificio', 0, 'reserva', 0, 0.4],
                11.5,
                ['match', ['get', 'category'], 'edificio', 0, 'reserva', 0, 0.4],
                14,
                ['match', ['get', 'category'], 'edificio', 0.9, 'reserva', 0, 0.4],
              ],
              'line-dasharray': [
                'match',
                ['get', 'category'],
                'reserva',
                ['literal', [4, 4]], // dashed para reservas
                'ciudad',
                ['literal', [2, 4]], // dotted/dashed espaciado para ciudad
                ['literal', [1]], // solid para edificio
              ],
            },
          },
          beforeId,
        );
      }
    } catch (error: any) {
      if (error && error.message && error.message.includes('Style is not done loading')) {
        // Ignorar silenciosamente: el estilo se está cargando y se reintentará en el evento style.load
        return;
      }
      console.error('Error sincronizando zonas:', error);
    } finally {
      if (map.getLayer('cluster-circles')) {
        map.moveLayer('cluster-circles', map.getLayer('building-3d') ? 'building-3d' : undefined);
      }
      if (map.getLayer('cluster-labels')) {
        map.moveLayer('cluster-labels', map.getLayer('building-3d') ? 'building-3d' : undefined);
      }
    }
  };

  return syncZones;
}
