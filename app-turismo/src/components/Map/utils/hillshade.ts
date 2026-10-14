/**
 * Relieve sombreado (hillshade) para que se lea la pendiente de las calles.
 * Fuente DEM: AWS Terrain Tiles (Terrarium), gratuita y sin API key.
 * Se inserta bajo calles/puentes/edificios para no restar contraste a pines y vías.
 */

const DEM_SOURCE_ID = 'relief-dem';
const HILLSHADE_LAYER_ID = 'relief-hillshade';

/** Estilos que ya traen su propio relieve o son imagen: no se les agrega. */
const SKIP_LAYERS = new Set(['satellite', 'terrain', 'google3d']);

export const HILLSHADE_MIN_ZOOM = 12;
export const HILLSHADE_FULL_ZOOM = 14;
export const HILLSHADE_MAX_ZOOM = 17.5;

/** Primer layer de calles/puentes/edificios: el hillshade va justo debajo. */
function getBeforeRoadsLayerId(map: any): string | undefined {
  const layers = map.getStyle()?.layers;
  if (!layers) return undefined;
  const hit = layers.find(
    (l: any) =>
      typeof l.id === 'string' &&
      l.type !== 'background' &&
      /^(road|bridge|tunnel|highway|building|aeroway|waterway|boundary)/i.test(l.id),
  );
  return hit?.id;
}

export function applyHillshade(map: any, mapLayer: string, isDark: boolean): void {
  if (!map || SKIP_LAYERS.has(mapLayer)) return;
  try {
    if (!map.getSource(DEM_SOURCE_ID)) {
      map.addSource(DEM_SOURCE_ID, {
        type: 'raster-dem',
        tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        encoding: 'terrarium',
        tileSize: 256,
        maxzoom: 15,
        attribution: 'Terrain © Mapzen, AWS Terrain Tiles',
      });
    }
    if (map.getLayer(HILLSHADE_LAYER_ID)) {
      map.removeLayer(HILLSHADE_LAYER_ID);
    }
    map.addLayer(
      {
        id: HILLSHADE_LAYER_ID,
        type: 'hillshade',
        source: DEM_SOURCE_ID,
        minzoom: HILLSHADE_MIN_ZOOM,
        maxzoom: HILLSHADE_MAX_ZOOM,
        paint: {
          'hillshade-exaggeration': [
            'interpolate', ['linear'], ['zoom'],
            HILLSHADE_MIN_ZOOM, 0,
            HILLSHADE_FULL_ZOOM, isDark ? 0.45 : 0.35,
            HILLSHADE_MAX_ZOOM, isDark ? 0.3 : 0.22,
          ],
          'hillshade-illumination-direction': 315,
          'hillshade-illumination-anchor': 'map',
          'hillshade-shadow-color': isDark ? '#000000' : '#475569',
          'hillshade-highlight-color': isDark ? '#334155' : '#FFFFFF',
          'hillshade-accent-color': isDark ? '#0F172A' : '#64748B',
        },
      },
      getBeforeRoadsLayerId(map),
    );
  } catch {}
}
