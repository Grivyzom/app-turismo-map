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

export const WEB_MAP_STYLES: Record<MapLayer, string | maplibregl.StyleSpecification> = {
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  streets: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
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
};

export const getActiveMapStyles = () => WEB_MAP_STYLES;
