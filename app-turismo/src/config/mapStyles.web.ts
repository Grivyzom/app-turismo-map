import maplibregl from 'maplibre-gl';

import { MapLayer } from '../components/Map/types';

/** Protocol prefix for the intelligent tile cache */
export const HD_ESRI_PROTOCOL = 'hd-esri';

/** Original ESRI tile URL template */
export const ESRI_TILE_URL =
  'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

/** Cached ESRI tile URL template (routed through addProtocol handler) */
export const CACHED_ESRI_TILE_URL = `${HD_ESRI_PROTOCOL}://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`;

/**
 * Genera el StyleSpecification para satélite.
 * @param useCachedProtocol Si true, usa el protocolo hd-esri:// con caché inteligente.
 */
export const getSatelliteStyle = (useCachedProtocol: boolean): maplibregl.StyleSpecification => ({
  version: 8,
  sources: {
    esri: {
      type: 'raster',
      tiles: [useCachedProtocol ? CACHED_ESRI_TILE_URL : ESRI_TILE_URL],
      tileSize: 256,
      maxzoom: 19, // ESRI World Imagery: nativo hasta ~19 en zonas urbanas de Sudamérica
      attribution: 'Tiles © Esri',
    },
  },
  layers: [
    {
      id: 'esri-imagery',
      type: 'raster',
      source: 'esri',
      paint: {
        'raster-resampling': 'linear', // Interpolación bilineal para overscaling suave
        'raster-fade-duration': 150,
      },
    },
  ],
});

/** CARTO API Key para eliminar marcas de agua en teselas vectoriales y raster */
export const CARTO_API_KEY =
  process.env.EXPO_PUBLIC_CARTO_API_KEY ||
  process.env.CARTO_API_KEY ||
  '';

export const withCartoKey = (url: string): string => {
  if (!CARTO_API_KEY) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}api_key=${CARTO_API_KEY}`;
};

export const WEB_MAP_STYLES: Record<MapLayer, string | maplibregl.StyleSpecification> = {
  // Para el modo Noche usamos 'liberty' como base (que ya incluye building-3d nativo)
  // y luego applyDarkTheme() lo oscurece completamente en style.load.
  dark: CARTO_API_KEY
    ? withCartoKey('https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json')
    : 'https://tiles.openfreemap.org/styles/liberty',
  streets: CARTO_API_KEY
    ? withCartoKey('https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json')
    : 'https://tiles.openfreemap.org/styles/liberty',
  light: CARTO_API_KEY
    ? withCartoKey('https://basemaps.cartocdn.com/gl/positron-gl-style/style.json')
    : 'https://tiles.openfreemap.org/styles/positron',
  satellite: getSatelliteStyle(false), // Default: sin caché (se activa dinámicamente con HD mode)
  terrain: {
    version: 8,
    sources: {
      opentopo: {
        type: 'raster',
        tiles: ['https://tile.opentopomap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 17,
        attribution: 'Map data © OpenStreetMap contributors, map style © OpenTopoMap',
      },
    },
    layers: [
      {
        id: 'opentopo-relief',
        type: 'raster',
        source: 'opentopo',
      },
    ],
  },
  '3d': CARTO_API_KEY
    ? withCartoKey('https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json')
    : 'https://tiles.openfreemap.org/styles/liberty',
  google3d: CARTO_API_KEY
    ? withCartoKey('https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json')
    : 'https://tiles.openfreemap.org/styles/liberty',
};

export const getActiveMapStyles = () => WEB_MAP_STYLES;
