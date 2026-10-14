import maplibregl, { Map as MapLibreMap } from 'maplibre-gl';

import { MapLayer } from '../components/Map/types';

import { getCategoryColor } from './mapUtils';

export const addMissingStyleImage = (map: MapLibreMap, imageId: string, mapLayer: MapLayer) => {
  if (map.hasImage(imageId)) {
    return;
  }

  if (imageId !== 'wood-pattern') {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d');
    if (context) {
      context.fillStyle = 'rgba(0,0,0,0)';
      context.fillRect(0, 0, 1, 1);
      const imageData = context.getImageData(0, 0, 1, 1);
      map.addImage(imageId, imageData, { pixelRatio: 1 });
    }
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

  if (!map.getLayer('relief-extrusion')) {
    map.addLayer({
      id: 'relief-extrusion',
      type: 'fill-extrusion',
      source: 'events',
      paint: {
        'fill-extrusion-color': ['get', 'color'],
        'fill-extrusion-height': ['coalesce', ['get', 'extrusionHeight'], 0],
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.8,
      },
    });
  }
};

// El estilo base solo trae la capa 'waterway' como una línea delgada de
// ancho fijo (heredado del vector tile), sin grosor por zoom — por eso un
// río se ve como líneas sueltas en vez de comunicar "esto es un río".
// Solo se tocan color/ancho (paint) de la capa YA existente: es gratis,
// el layer ya se paga en el render base. Nada de capa duplicada ni joins
// redondeados — 'waterway' es la red completa de ríos/arroyos/canales del
// mundo sin minzoom/filtro, y un 'line-join: round' triangula un arco en
// cada vértice (mucho más caro que el 'miter' por defecto); duplicar esa
// capa entera para simular casing prácticamente duplicó el costo de
// renderizar la red de agua completa y causó una caída de rendimiento
// drástica al probarlo.
export const applyRiverStyling = (map: MapLibreMap, isDark: boolean) => {
  if (!map.getLayer('waterway')) return;

  const innerColor = isDark ? '#3b82f6' : '#4a90d9';

  try {
    map.setPaintProperty('waterway', 'line-color', innerColor);
    map.setPaintProperty('waterway', 'line-width', [
      'interpolate', ['linear'], ['zoom'], 10, 0.8, 14, 2, 17, 4.5,
    ]);
  } catch {}
};

// Paleta de material real de 'building-3d', factorizada para que la
// comparta tanto applyDarkTheme() como el LOD/animación de "construcción"
// en MapLibreContainer.web.tsx (que la re-aplica al terminar de crecer).
export const applyBuildingMaterialColors = (map: MapLibreMap, isDark: boolean) => {
  if (!map.getLayer('building-3d')) return;
  const heightExpr: any = ['coalesce', ['get', 'render_height'], ['get', 'height'], 8];
  const color = isDark
    ? [
        'interpolate', ['linear'], heightExpr,
         0,  '#0d1f3c',
        10,  '#0f2d52',
        25,  '#1a4875',
        50,  '#1a6595',
        80,  '#0f8fbe',
        150, '#00c4d4',
      ]
    : [
        'interpolate', ['linear'], heightExpr,
         0,  '#e8dfd0',
        10,  '#d8c9b0',
        25,  '#c8b090',
        50,  '#b89878',
        80,  '#a88060',
        150, '#8a6244',
      ];
  try {
    map.setPaintProperty('building-3d', 'fill-extrusion-color', color as any);
    map.setPaintProperty('building-3d', 'fill-extrusion-opacity', isDark ? 1.0 : 0.95);
    map.setPaintProperty('building-3d', 'fill-extrusion-vertical-gradient', true);
  } catch {}
};

export const applyDarkTheme = (map: MapLibreMap) => {
  // ── Fondo ──────────────────────────────────────────────────────────
  const bg = map.getLayer('background');
  if (bg) map.setPaintProperty('background', 'background-color', '#13181f');

  // ── Agua ───────────────────────────────────────────────────────────
  if (map.getLayer('water')) map.setPaintProperty('water', 'fill-color', '#0d1520');
  // El color/grosor de 'waterway' lo maneja applyRiverStyling().

  // ── Terreno / land cover ───────────────────────────────────────────
  const landLayers = [
    'landuse_residential', 'landcover_wood', 'landuse_park',
    'landcover_ice_shelf', 'landcover_glacier', 'aeroway-area',
  ];
  const landColors: Record<string, string> = {
    landuse_residential: '#161b22',
    landcover_wood: '#1a2a1a',
    landuse_park: '#1a2e20',
    landcover_ice_shelf: '#1a1f28',
    landcover_glacier: '#1a1f28',
    'aeroway-area': '#1c2130',
  };
  landLayers.forEach((id) => {
    if (map.getLayer(id)) {
      map.setPaintProperty(id, 'fill-color', landColors[id] ?? '#13181f');
      try { map.setPaintProperty(id, 'fill-opacity', id === 'landcover_wood' ? 0.6 : 1); } catch {}
    }
  });

  // ── Edificios 2D (footprint plano, zoom < 14) ──────────────────────
  if (map.getLayer('building')) {
    map.setPaintProperty('building', 'fill-color', '#1e2530');
    map.setPaintProperty('building', 'fill-outline-color', '#242f3e');
  }

  // ── Edificios 3D (fill-extrusion — capa nativa de liberty) ─────────
  // Degradado de altura: navy profundo en la base → cian eléctrico en
  // rascacielos. Totalmente opaco para que los pines/símbolos del mapa no
  // se vean a través de los edificios cuando moveLayer los coloque debajo.
  applyBuildingMaterialColors(map, true);

  // ── Calles ─────────────────────────────────────────────────────────
  // Versiones más oscuras para no deslumbrar en modo noche
  const roadMap: Record<string, string> = {
    highway_path:             '#131925',
    highway_minor:            '#181e2d',
    highway_major_casing:     '#0d1119',
    highway_major_inner:      '#221c0e',
    highway_major_subtle:     '#181e2d',
    highway_motorway_casing:  '#0d1119',
    highway_motorway_inner:   '#2d2315',
    highway_motorway_subtle:  '#181e2d',
    road_area_pier:           '#111726',
    road_pier:                '#181e2d',
    railway_transit:          '#181e2d',
    railway_transit_dashline: '#0d1119',
    railway_minor:            '#181e2d',
    railway_minor_dashline:   '#0d1119',
    railway:                  '#181e2d',
    railway_dashline:         '#0d1119',
    'aeroway-taxiway':        '#111726',
    'aeroway-runway-casing':  '#0a0f17',
    'aeroway-runway':         '#111726',
  };
  Object.entries(roadMap).forEach(([id, color]) => {
    if (map.getLayer(id)) {
      const type = map.getLayer(id)?.type;
      if (type === 'line') map.setPaintProperty(id, 'line-color', color);
      else if (type === 'fill') map.setPaintProperty(id, 'fill-color', color);
    }
  });

  // ── Nombres de lugares ─────────────────────────────────────────────
  [
    'place_other', 'place_suburb', 'place_village',
    'place_town', 'place_city', 'place_city_large', 'place_state',
    'place_country_other', 'place_country_minor', 'place_country_major',
  ].forEach((id) => {
    if (map.getLayer(id)) {
      map.setPaintProperty(id, 'text-color', '#c8aa6e');
      map.setPaintProperty(id, 'text-halo-color', '#13181f');
      map.setPaintProperty(id, 'text-halo-width', 2);
    }
  });

  // ── Nombres de calles ──────────────────────────────────────────────
  ['highway_name_other', 'road_oneway', 'road_oneway_opposite'].forEach((id) => {
    if (map.getLayer(id)) {
      try { map.setPaintProperty(id, 'text-color', '#8a9bb5'); } catch {}
      try { map.setPaintProperty(id, 'text-halo-color', '#13181f'); } catch {}
    }
  });
  if (map.getLayer('highway_name_motorway')) {
    map.setPaintProperty('highway_name_motorway', 'text-color', '#f3d19c');
    map.setPaintProperty('highway_name_motorway', 'text-halo-color', '#13181f');
  }

  // ── Agua (texto) ───────────────────────────────────────────────────
  if (map.getLayer('water_name')) {
    map.setPaintProperty('water_name', 'text-color', '#3a5068');
    map.setPaintProperty('water_name', 'text-halo-color', '#0d1520');
    map.setPaintProperty('water_name', 'text-halo-width', 2);
  }

  // ── Fronteras ──────────────────────────────────────────────────────
  ['boundary_state', 'boundary_2', 'boundary_3',
   'boundary_country_z0-4', 'boundary_country_z5-', 'boundary_disputed'].forEach((id) => {
    if (map.getLayer(id)) {
      try { map.setPaintProperty(id, 'line-color', '#2a3a50'); } catch {}
    }
  });

  // ── Suprimir fill-pattern en capas de parques/humedales/ríos ───────
  // Evita que los patrones SVG del sprite sangren visualmente a través
  // de los edificios. Se sustituye el patrón por color sólido oscuro.
  const patternLayers: Record<string, string> = {
    landcover_wood:    '#1a2a1a',
    landuse_park:      '#1a2e20',
    landuse_residential: '#161b22',
    landcover_ice_shelf: '#1a1f28',
    landcover_glacier:   '#1a1f28',
    'aeroway-area':      '#1c2130',
  };
  Object.entries(patternLayers).forEach(([id, solidColor]) => {
    if (map.getLayer(id)) {
      try { map.setPaintProperty(id, 'fill-pattern', null); } catch {}
      try { map.setPaintProperty(id, 'fill-color', solidColor); } catch {}
    }
  });

  // ── Elevar building-3d al tope del stack WebGL ─────────────────────
  // Esto hace que los pines/símbolos del propio estilo del mapa queden
  // por debajo de los edificios. Los marcadores React (maplibregl.Marker
  // con occludedOpacity: 0) se gestionan automáticamente por MapLibre.
  if (map.getLayer('building-3d')) {
    try { map.moveLayer('building-3d'); } catch {}
  }

  // ── Subir POI nativos SOBRE building-3d ────────────────────────────
  // Evita el efecto "pin cortado" cuando el icono queda parcialmente
  // dentro del volumen del edificio. Los pines quedan visibles encima
  // del edificio (sin atravesarlo). Los maplibregl.Marker propios usan
  // occludedOpacity: 0 para ocultarse completamente detrás de edificios.
  ['poi_r20', 'poi_r7', 'poi_r1', 'poi_transit', 'airport'].forEach((id) => {
    if (map.getLayer(id)) {
      try { map.moveLayer(id); } catch {}
    }
  });
};

export const updateMapGeoJSON = (map: MapLibreMap, events: any[]) => {
  if (!map || !map.isStyleLoaded()) return;

  ensureLayers(map);

  const features = events.map((event) => {
    // Si el evento tiene un polígono definido, lo usamos para el relieve/extrusion
    const geometry =
      event.polygon && event.polygon.length > 2
        ? {
            type: 'Polygon',
            coordinates: [
              [
                ...event.polygon.map((p: any) => [p.longitude, p.latitude]),
                [event.polygon[0].longitude, event.polygon[0].latitude], // Cerrar el polígono
              ],
            ],
          }
        : {
            type: 'Point',
            coordinates: [event.longitude, event.latitude],
          };

    return {
      type: 'Feature',
      id: event.id,
      geometry,
      properties: {
        ...event,
        color: getCategoryColor(event.category, event.musicStyle),
      },
    };
  });

  const geojsonData = {
    type: 'FeatureCollection',
    features,
  };

  const source = map.getSource('events') as maplibregl.GeoJSONSource;
  if (source) {
    source.setData(geojsonData as any);
  }
};

/**
 * Oculta las capas de POIs (puntos de interés) predeterminadas de OpenFreeMap / OpenMapTiles.
 * Esto silencia los iconos y textos no interactivos del mapa base (tiendas, restaurantes, bancos, paradas, etc.)
 * permitiendo que todos los marcadores del mapa sean controlados dinámicamente por la aplicación.
 */
export const hideBaseMapPOIs = (map: MapLibreMap) => {
  try {
    const style = map.getStyle();
    if (!style || !style.layers) return;
    for (const layer of style.layers) {
      const layerId = layer.id || '';
      const sourceLayer = (layer as any)['source-layer'] || '';
      if (
        layerId.startsWith('poi_') ||
        sourceLayer === 'poi' ||
        layerId === 'airport' ||
        layerId.includes('transit') ||
        layerId === 'label_other'
      ) {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, 'visibility', 'none');
        }
      }
    }
  } catch (err) {
    console.warn('[MapLibre] Error silenciando POIs del mapa base:', err);
  }
};

