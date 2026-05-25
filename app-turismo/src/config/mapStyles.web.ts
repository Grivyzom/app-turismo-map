import maplibregl from 'maplibre-gl';

import { MapLayer } from '../components/Map/types';

export const WEB_MAP_STYLES: Record<MapLayer, string | maplibregl.StyleSpecification> = {
  dark: 'https://tiles.openfreemap.org/styles/dark',
  streets: 'https://tiles.openfreemap.org/styles/liberty',
  satellite: {
    version: 8,
    sources: {
      esri: {
        type: 'raster',
        tiles: [
          'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        attribution: 'Tiles © Esri',
      },
    },
    layers: [
      {
        id: 'esri-imagery',
        type: 'raster',
        source: 'esri',
      },
    ],
  },
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
