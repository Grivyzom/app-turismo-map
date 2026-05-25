import maplibregl, { Map as MapLibreMap } from 'maplibre-gl';

import { MapLayer } from '../components/Map/types';

import { getCategoryColor } from './mapUtils';

export const addMissingStyleImage = (map: MapLibreMap, imageId: string, mapLayer: MapLayer) => {
  if (imageId !== 'wood-pattern' || map.hasImage(imageId)) {
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;

  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }

  // Colores dinámicos y elegantes según el estilo del mapa
  let backgroundColor = '#8B5E3C'; // Por defecto, marrón-madera
  let lightStroke = 'rgba(255, 241, 220, 0.18)';
  let darkStroke = 'rgba(62, 39, 20, 0.35)';

  if (mapLayer === 'dark') {
    // Oficial Google Maps Night Mode Style
    backgroundColor = '#263c3f';
    lightStroke = 'rgba(255, 255, 255, 0.02)';
    darkStroke = 'rgba(0, 0, 0, 0.1)';
  } else if (mapLayer === 'streets') {
    // Vista claro/calle estándar
    backgroundColor = '#d2eed0'; // Verde pastel de bosque clásico
    lightStroke = 'rgba(255, 255, 255, 0.4)';
    darkStroke = 'rgba(76, 175, 80, 0.08)';
  } else if (mapLayer === 'terrain') {
    // Relieve/topografía
    backgroundColor = '#dcf2d9';
    lightStroke = 'rgba(255, 255, 255, 0.3)';
    darkStroke = 'rgba(50, 130, 50, 0.06)';
  }

  context.fillStyle = backgroundColor;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = lightStroke;
  context.lineWidth = 3;
  for (let row = -8; row < canvas.height + 8; row += 12) {
    context.beginPath();
    context.moveTo(0, row);
    context.lineTo(canvas.width, row + 6);
    context.stroke();
  }

  context.strokeStyle = darkStroke;
  context.lineWidth = 2;
  for (let row = 6; row < canvas.height + 12; row += 16) {
    context.beginPath();
    context.moveTo(0, row);
    context.lineTo(canvas.width, row - 4);
    context.stroke();
  }

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  map.addImage(imageId, imageData, { pixelRatio: 1 });
};

export const ensureLayers = (map: MapLibreMap) => {
  if (!map.getSource('events')) {
    map.addSource('events', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
  }

  if (!map.getLayer('events-layer-halo')) {
    map.addLayer({
      id: 'events-layer-halo',
      type: 'circle',
      source: 'events',
      paint: {
        'circle-radius': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          18,
          ['boolean', ['get', 'isRealTime'], false],
          15,
          0,
        ],
        'circle-color': ['get', 'color'],
        'circle-opacity': 0.4,
        'circle-blur': 0.5,
      },
    });
  }

  if (!map.getLayer('events-layer')) {
    map.addLayer({
      id: 'events-layer',
      type: 'circle',
      source: 'events',
      paint: {
        'circle-radius': ['case', ['boolean', ['feature-state', 'selected'], false], 13, 10],
        'circle-color': ['get', 'color'],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#111827',
      },
    });
  }
};

export const applyDarkTheme = (map: MapLibreMap) => {
  // Fondo
  if (map.getLayer('background')) {
    map.setPaintProperty('background', 'background-color', '#242f3e');
  }

  // Agua
  if (map.getLayer('water')) {
    map.setPaintProperty('water', 'fill-color', '#17263c');
  }
  if (map.getLayer('waterway')) {
    map.setPaintProperty('waterway', 'line-color', '#17263c');
  }

  // Parques y vegetación
  if (map.getLayer('landuse_park')) {
    map.setPaintProperty('landuse_park', 'fill-color', '#263c3f');
  }

  // Edificios
  if (map.getLayer('building')) {
    map.setPaintProperty('building', 'fill-color', '#2f3948'); // Como transit
    map.setPaintProperty('building', 'fill-outline-color', '#242f3e');
  }

  // Calles y caminos menores
  if (map.getLayer('highway_minor')) {
    map.setPaintProperty('highway_minor', 'line-color', '#38414e');
  }

  // Calles Principales (Avenidas)
  if (map.getLayer('highway_major_inner')) {
    map.setPaintProperty('highway_major_inner', 'line-color', '#746855');
  }
  if (map.getLayer('highway_major_casing')) {
    map.setPaintProperty('highway_major_casing', 'line-color', '#1f2835');
  }

  // Autopistas / Vías Rápidas
  if (map.getLayer('highway_motorway_inner')) {
    map.setPaintProperty('highway_motorway_inner', 'line-color', '#746855');
  }
  if (map.getLayer('highway_motorway_casing')) {
    map.setPaintProperty('highway_motorway_casing', 'line-color', '#1f2835');
  }

  // Nombres de calles y lugares principales
  const defaultTextLayers = [
    'place_other',
    'place_suburb',
    'place_village',
    'place_town',
    'place_city',
    'place_city_large',
    'place_state',
  ];
  defaultTextLayers.forEach((layer) => {
    if (map.getLayer(layer)) {
      map.setPaintProperty(layer, 'text-color', '#d59563');
      map.setPaintProperty(layer, 'text-halo-color', '#242f3e');
      map.setPaintProperty(layer, 'text-halo-width', 2);
    }
  });

  const roadTextLayers = ['highway_name_other'];
  roadTextLayers.forEach((layer) => {
    if (map.getLayer(layer)) {
      map.setPaintProperty(layer, 'text-color', '#9ca5b3');
      map.setPaintProperty(layer, 'text-halo-color', '#242f3e');
      map.setPaintProperty(layer, 'text-halo-width', 2);
    }
  });

  const highwayTextLayers = ['highway_name_motorway'];
  highwayTextLayers.forEach((layer) => {
    if (map.getLayer(layer)) {
      map.setPaintProperty(layer, 'text-color', '#f3d19c');
      map.setPaintProperty(layer, 'text-halo-color', '#242f3e');
      map.setPaintProperty(layer, 'text-halo-width', 2);
    }
  });

  if (map.getLayer('water_name')) {
    map.setPaintProperty('water_name', 'text-color', '#515c6d');
    map.setPaintProperty('water_name', 'text-halo-color', '#17263c');
    map.setPaintProperty('water_name', 'text-halo-width', 2);
  }
};

export const updateMapGeoJSON = (map: MapLibreMap, events: any[]) => {
  if (!map || !map.isStyleLoaded()) return;

  ensureLayers(map);

  const geojsonData = {
    type: 'FeatureCollection',
    features: events.map((event) => ({
      type: 'Feature',
      id: event.id,
      geometry: {
        type: 'Point',
        coordinates: [event.longitude, event.latitude],
      },
      properties: {
        ...event,
        color: getCategoryColor(event.category),
      },
    })),
  };

  const source = map.getSource('events') as maplibregl.GeoJSONSource;
  if (source) {
    source.setData(geojsonData as any);
  }
};
