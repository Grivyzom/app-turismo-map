import React, { useEffect, useRef, useCallback, useState } from 'react';
import maplibregl, { Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { StyleSheet, View } from 'react-native';
import { VALDIVIA_LAT, VALDIVIA_LNG } from '../../constants/location';
import { getCategoryColor, getCategoryIcon } from '../../utils/mapUtils';
import { addMissingStyleImage, applyDarkTheme } from '../../utils/mapWebUtils';
import { getActiveMapStyles, getSatelliteStyle } from '../../config/mapStyles.web';
import { SatelliteTileCache } from '../../utils/satelliteTileCache';
import { TrafficTileCache, TRAFFIC_PROTOCOL } from '../../utils/trafficTileCache';
import { useSuperclusterEvents, getClusterDominantColor } from '../../utils/clusterUtils';
import { radialMenuRegistry } from '../../utils/radialMenuRegistry';
import { getLatestRadarPath } from '../../utils/weatherUtils';
import { useRainEffect } from '../../utils/useRainEffect';
import { CICLOVIAS_GEOJSON } from '../../data/ciclovias';
import { MOBILIARIO_GEOJSON } from '../../data/mobiliarioData';
import { FloorSelector } from '../MapUI/FloorSelector';

import {
  MapContainerProps,
  MAX_ZOOM_PER_LAYER,
  MAX_WEATHER_ZOOM,
  MAX_RAINVIEWER_ZOOM,
  TurismoEvent,
  Cluster,
} from './types';


// ─── Extracted utility modules ────────────────────────────────────────────────
import {
  hexToRgba,
  getAccuracyRadiusAtZoom,
  WAVE_PERIOD_MS,
  WAVE_MIN_RADIUS_PX,
  WAVE_STROKE_WIDTH,
  getUserWaveColor,
} from './utils/markerHelpers';
import { detectSurfaceType, detectSurfaceTypeForBoat } from './utils/surfaceDetection';
import { createSvgIcon } from './utils/svgIcons';
import { getBeforeRoadsOrLabelsLayerId, updateMarkerDomRefs } from './utils/mapHelpers';
import { renderBoatFlatMarker, renderBoatMarker } from './markers/render/renderBoatMarkers';
import { renderFlatMarker } from './markers/render/renderFlatMarker';
import { renderLoboMarinoMarker } from './markers/render/renderLoboMarinoMarker';
import { renderHospitalMarker, renderClinicaMarker } from './markers/render/renderHospitalMarker';
import { renderBomberoMarker } from './markers/render/renderBomberoMarker';
import { renderCarabineroMarker } from './markers/render/renderCarabineroMarker';
import { renderCamaraMarker } from './markers/render/renderCamaraMarker';
import { renderUniversityMarker } from './markers/render/renderUniversityMarker';
import { renderPinMarker } from './markers/render/renderPinMarker';
import { updateMapLibreStoreModal } from './aesthetics/updateMapLibreStoreModal';
import { updateMapLibreRadialMenu } from './aesthetics/updateMapLibreRadialMenu';
import { CloudShadows } from './CloudShadows';

// URL de estilo público vectorial de CARTO - Dark Matter (Selva Valdiviana Base)
const CARTO_VECTOR_STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const mapStyles = getActiveMapStyles();



export function MapLibreContainer({
  events,
  selectedEvent,
  onSelectEvent,
  mapLayer,
  userLocation,
  centerTrigger,
  tacticalMode,
  onTacticalLocationChange,
  onMapPincho,
  mapPincho,
  onMapMove,
  zoom = 13,
  onZoomChange,
  showTraffic = false,
  showCycleways = false,
  cyclewaysData = [],
  showSectors = true,
  sectorsData,
  visibleSectorIds,
  showWeather = false,
  weatherType = 'precipitation',
  onSaveLocation,
  onSectorPress,
  activeNestedZone,
  activeFloor,
  isMagicWandActive = false,
  onMagicWandSelect,
  navRouteGeojson,
}: MapContainerProps) {
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const pinMarkerRef = useRef<{ marker: maplibregl.Marker; el: HTMLDivElement } | null>(null);
  const [currentBounds, setCurrentBounds] = useState<
    | {
        minLat: number;
        maxLat: number;
        minLng: number;
        maxLng: number;
      }
    | undefined
  >(undefined);
  const [radarPath, setRadarPath] = useState<string | null>(null);
  const [internalFloor, setInternalFloor] = useState<number | null>(null);

  useEffect(() => {
    if (selectedEvent?.indoorMap) {
      setInternalFloor(selectedEvent.indoorMap.defaultFloor);
    } else {
      setInternalFloor(null);
    }
  }, [selectedEvent]);

  // Track our DOM markers
  const markersRef = useRef<{
    [id: string]: {
      pinMarker: maplibregl.Marker;
      pinEl: HTMLDivElement;
      flatMarker?: maplibregl.Marker;
      flatEl?: HTMLDivElement;
      isCluster?: boolean;
      event?: TurismoEvent;
      closeTimeout?: any;
      unsubRegistry?: () => void;
      domRefs?: {
        pinWrapper: HTMLDivElement | null;
        pin: HTMLDivElement | null;
        stem: HTMLDivElement | null;
        stemCamara: HTMLDivElement | null;
        lensContainer: HTMLDivElement | null;
        icon: HTMLDivElement | null;
        flatContainer: HTMLDivElement | null;
        shadowPin: HTMLDivElement | null;
        shadowStem: HTMLDivElement | null;
        puncture: HTMLDivElement | null;
        ripples: NodeListOf<HTMLDivElement> | null;
        storeModal: HTMLDivElement | null;
        notesContainer: HTMLDivElement | null;
        badgeEl: HTMLDivElement | null;
        loboSVG: SVGElement | null;
        boatBody: HTMLDivElement | null;
        wakeContainer: HTMLDivElement | null;
      };
    };
  }>({});
  const userMarkerRef = useRef<{ marker: maplibregl.Marker; el: HTMLDivElement } | null>(null);
  const userAccuracyRef = useRef<{ accuracyMeters: number; latitude: number } | null>(null);
  const latestUserLocationRef = useRef(userLocation);
  const onSectorPressRef = useRef(onSectorPress);
  const activeNestedZoneRef = useRef(activeNestedZone);
  const isMagicWandActiveRef = useRef(isMagicWandActive);
  const onMagicWandSelectRef = useRef(onMagicWandSelect);

  // Refs to avoid stale closures in map event listeners
  const eventsRef = useRef(events);
  const onSelectEventRef = useRef(onSelectEvent);
  const onSaveLocationRef = useRef(onSaveLocation);
  const selectedEventRef = useRef(selectedEvent);
  const mapLayerRef = useRef(mapLayer);
  const onZoomChangeRef = useRef(onZoomChange);
  const onMapPinchoRef = useRef(onMapPincho);
  const onMapMoveRef = useRef(onMapMove);
  const isDraggingRef = useRef(false);
  const updateAestheticsRef = useRef<() => void>(() => {});
  const tileCacheRef = useRef<SatelliteTileCache | null>(null);
  const trafficCacheRef = useRef<TrafficTileCache | null>(null);
  const syncUserLocationRef = useRef<() => void>(() => {});
  const syncTrafficRef = useRef<() => void>(() => {});
  const syncWeatherRef = useRef<() => void>(() => {});
  const syncZonesRef = useRef<() => void>(() => {});
  const syncCyclewaysRef = useRef<() => void>(() => {});
  const syncClustersRef = useRef<() => void>(() => {});
  const syncEventPolygonsRef = useRef<() => void>(() => {});

  const sectorsDataRef = useRef(sectorsData);
  const visibleSectorIdsRef = useRef(visibleSectorIds);
  const showSectorsRef = useRef(showSectors);

  useEffect(() => {
    isMagicWandActiveRef.current = isMagicWandActive;
    onMagicWandSelectRef.current = onMagicWandSelect;
  }, [isMagicWandActive, onMagicWandSelect]);

  useEffect(() => {
    sectorsDataRef.current = sectorsData;
    visibleSectorIdsRef.current = visibleSectorIds;
    showSectorsRef.current = showSectors;
    eventsRef.current = events;
    onSelectEventRef.current = onSelectEvent;
    onSaveLocationRef.current = onSaveLocation;
    // Only override selectedEventRef with the external prop if there's no locally-selected minimodal event
    const hasLocalMiniModal = Object.values(markersRef.current).some(
      (m) =>
        ['hospital', 'clinica', 'universidad', 'bombero', 'carabinero', 'camara'].includes(
          m.event?.category?.toLowerCase() || '',
        ) && m.pinEl.dataset.localSelected === 'true',
    );
    if (!hasLocalMiniModal) {
      selectedEventRef.current = selectedEvent;
    }
    mapLayerRef.current = mapLayer;
    onZoomChangeRef.current = onZoomChange;
    onMapPinchoRef.current = onMapPincho;
    onMapMoveRef.current = onMapMove;
    latestUserLocationRef.current = userLocation;
    onSectorPressRef.current = onSectorPress;
    activeNestedZoneRef.current = activeNestedZone;

    if (updateAestheticsRef.current) {
      updateAestheticsRef.current();
    }
    if (syncEventPolygonsRef.current) {
      syncEventPolygonsRef.current();
    }
  }, [
    events,
    onSelectEvent,
    selectedEvent,
    mapLayer,
    onZoomChange,
    onMapPincho,
    onMapMove,
    userLocation,
    sectorsData,
    visibleSectorIds,
    onSectorPress,
    activeNestedZone,
  ]);

  // Rain effect that activates based on weather data
  useRainEffect(mapNodeRef.current, mapRef);

  // Effect to fetch the latest RainViewer radar path when weather is enabled
  useEffect(() => {
    if (showWeather && weatherType === 'precipitation' && !radarPath) {
      getLatestRadarPath().then(setRadarPath);
    }
  }, [showWeather, weatherType, radarPath]);

  // --- Nested Zone Camera Animation & Interaction Lock ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (activeNestedZone && activeNestedZone.geojson) {
      // Guardar el maxZoom original de la capa actual para restaurarlo después
      const originalMaxZoom = MAX_ZOOM_PER_LAYER[mapLayerRef.current] || 18;

      // Permitir zoom mucho más cercano al edificio (nivel "indoor")
      map.setMaxZoom(21);

      // Deshabilitar TODA interacción del usuario con el mapa
      map.dragPan.disable();
      map.scrollZoom.disable();
      map.boxZoom.disable();
      map.dragRotate.disable();
      map.keyboard.disable();
      map.doubleClickZoom.disable();
      map.touchZoomRotate.disable();
      // Bloquear el canvas para que no capture eventos de puntero
      map.getCanvas().style.pointerEvents = 'none';
      map.getCanvasContainer().style.pointerEvents = 'none';

      const geojson =
        typeof activeNestedZone.geojson === 'string'
          ? JSON.parse(activeNestedZone.geojson)
          : activeNestedZone.geojson;

      if (geojson.type === 'Polygon' && geojson.coordinates && geojson.coordinates[0]) {
        let minLat = 90,
          maxLat = -90,
          minLng = 180,
          maxLng = -180;

        geojson.coordinates[0].forEach((coord: [number, number]) => {
          if (coord[1] < minLat) minLat = coord[1];
          if (coord[1] > maxLat) maxLat = coord[1];
          if (coord[0] < minLng) minLng = coord[0];
          if (coord[0] > maxLng) maxLng = coord[0];
        });

        // Primero resetear pitch y bearing a vista cenital
        map.easeTo({
          pitch: 0,
          bearing: 0,
          duration: 400,
        });

        // Luego ajustar los bounds del edificio con animación y zoom alto
        setTimeout(() => {
          if (!mapRef.current) return;
          mapRef.current.fitBounds(
            [
              [minLng, minLat],
              [maxLng, maxLat],
            ],
            { padding: 120, duration: 800, maxZoom: 21 },
          );
        }, 450);
      }

      return () => {
        // Cleanup: rehabilitar interacción y restaurar maxZoom original
        if (mapRef.current) {
          const m = mapRef.current;
          m.setMaxZoom(originalMaxZoom);
          m.dragPan.enable();
          m.scrollZoom.enable();
          m.boxZoom.enable();
          m.dragRotate.enable();
          m.keyboard.enable();
          m.doubleClickZoom.enable();
          m.touchZoomRotate.enable();
          m.getCanvas().style.pointerEvents = 'auto';
          m.getCanvasContainer().style.pointerEvents = 'auto';
        }
      };
    } else {
      // No hay zona activa: asegurar que la interacción esté habilitada
      map.dragPan.enable();
      map.scrollZoom.enable();
      map.boxZoom.enable();
      map.dragRotate.enable();
      map.keyboard.enable();
      map.doubleClickZoom.enable();
      map.touchZoomRotate.enable();
      map.getCanvas().style.pointerEvents = 'auto';
      map.getCanvasContainer().style.pointerEvents = 'auto';
    }
  }, [activeNestedZone]);

  // --- Indoor Floor Plans Effect ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const sourceId = 'indoor-floorplan-source';
    const layerId = 'indoor-floorplan-layer';

    if (
      activeNestedZone &&
      activeNestedZone.geojson &&
      activeFloor !== null &&
      activeFloor !== undefined
    ) {
      // In Phase 2 prototype, we use a placeholder image if activeFloor > 0
      // In production, we would fetch the floor plan URL and bounds from the API

      const geojson =
        typeof activeNestedZone.geojson === 'string'
          ? JSON.parse(activeNestedZone.geojson)
          : activeNestedZone.geojson;

      if (geojson.type === 'Polygon' && geojson.coordinates && geojson.coordinates[0]) {
        let minLat = 90,
          maxLat = -90,
          minLng = 180,
          maxLng = -180;

        geojson.coordinates[0].forEach((coord: [number, number]) => {
          if (coord[1] < minLat) minLat = coord[1];
          if (coord[1] > maxLat) maxLat = coord[1];
          if (coord[0] < minLng) minLng = coord[0];
          if (coord[0] > maxLng) maxLng = coord[0];
        });

        const coordinates = [
          [minLng, maxLat], // Top left (NW)
          [maxLng, maxLat], // Top right (NE)
          [maxLng, minLat], // Bottom right (SE)
          [minLng, minLat], // Bottom left (SW)
        ];

        // En producción, obtenemos la URL del plano de la base de datos (BuildingMedia donde type='floorplan')
        // Si el negocio no ha subido ningún plano, floorplanUrl será null y no se mostrará nada.
        const floorplanUrl: string | null = null; // TODO: Fetch from API

        if (floorplanUrl) {
          if (map.getSource(sourceId)) {
            // MapLibre requires removing layer/source to update URL
            if (map.getLayer(layerId)) map.removeLayer(layerId);
            map.removeSource(sourceId);
          }

          map.addSource(sourceId, {
            type: 'image',
            url: floorplanUrl,
            coordinates: coordinates as any,
          });

          map.addLayer({
            id: layerId,
            type: 'raster',
            source: sourceId,
            paint: {
              'raster-opacity': 0.85,
              'raster-fade-duration': 300,
            },
          });
        } else {
          // Remove if no URL
          if (map.getLayer(layerId)) map.removeLayer(layerId);
          if (map.getSource(sourceId)) map.removeSource(sourceId);
        }
      }
    } else {
      // Remove layer if not in building or no active floor
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    }

    return () => {
      // Don't remove on unmount to prevent flickering during floor changes,
      // it is handled by the else branch or parent unmount
    };
  }, [activeNestedZone, activeFloor]);

  // Sector Visibility Effect
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const visibility = showSectors ? 'visible' : 'none';
    if (map.getLayer('zones-fill')) {
      map.setLayoutProperty('zones-fill', 'visibility', visibility);
    }
    if (map.getLayer('zones-outline')) {
      map.setLayoutProperty('zones-outline', 'visibility', visibility);
    }
  }, [showSectors]);

  // Initialization
  useEffect(() => {
    if (!mapNodeRef.current || mapRef.current) return;

    // Registrar siempre el protocolo de caché de tiles satelitales
    const cache = SatelliteTileCache.getInstance();
    cache.registerProtocol();
    tileCacheRef.current = cache;

    // Registrar caché de tráfico
    const trafficCache = TrafficTileCache.getInstance();
    trafficCache.registerProtocol();
    trafficCacheRef.current = trafficCache;

    // Determinar estilo inicial
    const initialLayer = mapLayerRef.current;
    const initialMaxZoom = MAX_ZOOM_PER_LAYER[initialLayer] || 18;
    // Satélite siempre usa el protocolo cacheado para Ultra HD automático
    const initialStyle =
      initialLayer === 'satellite'
        ? getSatelliteStyle(true)
        : mapStyles[initialLayer] || CARTO_VECTOR_STYLE_URL;

    const map = new maplibregl.Map({
      container: mapNodeRef.current,
      style: initialStyle,
      center: [VALDIVIA_LNG, VALDIVIA_LAT],
      zoom: 13,
      maxZoom: initialMaxZoom,
      attributionControl: false,
    });

    mapRef.current = map;

    // Setup ResizeObserver for responsive layout updates
    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
    });
    if (mapNodeRef.current) {
      resizeObserver.observe(mapNodeRef.current);
    }

    // Calcular bounds estables basados en centro + zoom, ignorando pitch.
    // map.getBounds() cambia drásticamente al inclinar la cámara (ves hasta el horizonte),
    // lo que causa que Supercluster recalcule agrupaciones completamente distintas
    // con centroides diferentes, haciendo que los clusters "salten" de posición.
    const getStableBounds = () => {
      const center = map.getCenter();
      const z = map.getZoom();
      // Calcular el span geográfico teórico para este zoom (sin pitch)
      // A zoom 0, se ven ~360° de longitud. Cada nivel de zoom reduce el span a la mitad.
      // Añadimos 1.5x padding para evitar pop-in en bordes.
      const latSpan = (180 / Math.pow(2, z)) * 1.5;
      const lngSpan = (360 / Math.pow(2, z)) * 1.5;
      return {
        minLat: Math.max(-85, center.lat - latSpan),
        maxLat: Math.min(85, center.lat + latSpan),
        minLng: Math.max(-180, center.lng - lngSpan),
        maxLng: Math.min(180, center.lng + lngSpan),
      };
    };

    // Track last center+zoom to avoid re-clustering on pure rotation/pitch
    let lastStableCenter = { lat: 0, lng: 0 };
    let lastStableZoom = -1;

    let boundsTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedUpdateBounds = () => {
      if (boundsTimer) clearTimeout(boundsTimer);
      boundsTimer = setTimeout(() => {
        const center = map.getCenter();
        const z = map.getZoom();
        // Solo recalcular si el centro o zoom cambiaron significativamente
        const centerDelta =
          Math.abs(center.lat - lastStableCenter.lat) + Math.abs(center.lng - lastStableCenter.lng);
        const zoomDelta = Math.abs(z - lastStableZoom);
        if (centerDelta < 0.0001 && zoomDelta < 0.01) return; // Sin cambio real

        lastStableCenter = { lat: center.lat, lng: center.lng };
        lastStableZoom = z;
        setCurrentBounds(getStableBounds());
      }, 80);
    };

    map.on('load', () => {
      const center = map.getCenter();
      lastStableCenter = { lat: center.lat, lng: center.lng };
      lastStableZoom = map.getZoom();
      setCurrentBounds(getStableBounds());

      // ── Native Mobiliario Layer (Static High-Perf POIs) ──
      const addSvgImageToMap = (id: string, svgString: string) => {
        if (map.hasImage(id)) return;
        const img = new Image(32, 32);
        img.onload = () => {
          map.addImage(id, img, { pixelRatio: 2 });
        };
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
      };

      const isDark = mapLayerRef.current === 'dark' || mapLayerRef.current === 'satellite';
      const svgColor = isDark ? '#A0AEC0' : '#4A5568';

      const svgBench = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="${svgColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2"/><path d="M2 18h20"/><path d="M6 12v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>`;
      const svgWaste = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="${svgColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
      const svgWater = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#63B3ED" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>`;
      const svgToilet = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="${svgColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"/><path d="M18 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"/><path d="M5 8v12"/><path d="M11 8v12"/><path d="M5 13h6"/><path d="M13 8l2 12"/><path d="M19 8l-2 12"/><path d="M14 13h4"/></svg>`;

      addSvgImageToMap('bench', svgBench);
      addSvgImageToMap('waste_basket', svgWaste);
      addSvgImageToMap('drinking_water', svgWater);
      addSvgImageToMap('toilets', svgToilet);

      if (!map.getSource('mobiliario-source')) {
        map.addSource('mobiliario-source', {
          type: 'geojson',
          data: MOBILIARIO_GEOJSON as any,
        });
        map.addLayer({
          id: 'mobiliario-layer',
          type: 'symbol',
          source: 'mobiliario-source',
          minzoom: 15,
          layout: {
            'icon-image': ['get', 'amenity'],
            'icon-size': 0.8,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          },
          paint: {
            'icon-opacity': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.5, 1],
          },
        });
      }

      // ── Native Cluster Layers (rendered on WebGL canvas, not DOM) ──
      if (!map.getSource('clusters-source')) {
        map.addSource('clusters-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });

        // Circle background layer - pitch-aligned to map surface
        map.addLayer({
          id: 'cluster-circles',
          type: 'circle',
          source: 'clusters-source',
          paint: {
            'circle-color': ['get', 'color'],
            'circle-radius': ['get', 'radius'],
            'circle-stroke-width': 2,
            'circle-stroke-color': 'rgba(255, 255, 255, 0.85)',
            'circle-pitch-alignment': 'map',
            'circle-opacity': 1,
            'circle-stroke-opacity': 1,
          },
        });

        // Text label layer - also pitch-aligned to map surface
        map.addLayer({
          id: 'cluster-labels',
          type: 'symbol',
          source: 'clusters-source',
          layout: {
            'text-field': ['get', 'count'],
            'text-size': ['get', 'fontSize'],
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-allow-overlap': false,
            'text-ignore-placement': false,
            'text-pitch-alignment': 'map',
            'text-rotation-alignment': 'map',
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': 'rgba(0,0,0,0.2)',
            'text-halo-width': 1,
          },
        });
      }

      // Click handler for cluster circles
      map.on('click', 'cluster-circles', (e) => {
        if (!e.features || e.features.length === 0) return;
        const feature = e.features[0];
        const props = feature.properties;
        if (!props) return;

        const centroidLng = props.centroidLng as number;
        const centroidLat = props.centroidLat as number;
        const maxPossibleZoom = MAX_ZOOM_PER_LAYER[mapLayerRef.current] || 18;
        const nextZoom = Math.min(map.getZoom() + 3, maxPossibleZoom - 1);
        if (onZoomChangeRef.current) {
          onZoomChangeRef.current(nextZoom);
        }
        map.easeTo({
          center: [centroidLng, centroidLat],
          zoom: nextZoom,
          duration: 600,
        });
      });

      // Cursor feedback for clusters
      map.on('mouseenter', 'cluster-circles', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'cluster-circles', () => {
        map.getCanvas().style.cursor = '';
      });
    });
    map.on('moveend', debouncedUpdateBounds);
    map.on('zoomend', debouncedUpdateBounds);

    // Inyectar estilos personalizados para hacer la atribución ultra-discreta y estética
    const styleId = 'maplibre-custom-attribution-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `
        .maplibregl-ctrl-attrib {
          opacity: 0.25 !important;
          transition: opacity 0.2s ease !important;
          background-color: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }
        .maplibregl-ctrl-attrib:hover {
          opacity: 0.85 !important;
        }
        .maplibregl-ctrl-attrib-button {
          background-color: rgba(34, 34, 34, 0.6) !important;
          border-radius: 50% !important;
        }
        @keyframes webPublicPulse {
          0% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(var(--max-scale, 3)); opacity: 0.3; }
          100% { transform: scale(calc(var(--max-scale, 3) * 0.4)); opacity: 0; }
        }
        @keyframes popularAuraPulse {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes clusterDataRing {
          0% { transform: scale(1) rotate(0deg); opacity: 0.6; }
          50% { transform: scale(1.6) rotate(180deg); opacity: 0.3; }
          100% { transform: scale(1.1) rotate(360deg); opacity: 0; }
        }
        @keyframes rewardPop {
          0% { transform: translate(-50%, 0) scale(0.5); opacity: 0; }
          50% { transform: translate(-50%, -20px) scale(1.2); opacity: 1; }
          100% { transform: translate(-50%, -30px) scale(1); opacity: 0; }
        }
        @keyframes emergencyPerimeterRotate {
          0% { transform: rotateZ(0deg); }
          100% { transform: rotateZ(360deg); }
        }
        @keyframes emergencyPerimeterFlash {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.8; }
        }
        .marker-3d-pin.emergency-pin::after {
          content: '';
          position: absolute;
          top: -2px; left: -2px; right: -2px; bottom: -2px;
          border-radius: inherit;
          border: 2px solid var(--emergency-color, #EF4444);
          animation: emergencyRipple 1.5s infinite cubic-bezier(0.25, 1, 0.5, 1);
          pointer-events: none;
        }
        @keyframes emergencyRipple {
          0% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.4); opacity: 0.4; }
          100% { transform: scale(1.1); opacity: 0; }
        }
        @keyframes floatNote1 {
          0% { transform: translate(-50%, 0) translateY(0) scale(0.6) rotate(0deg); opacity: 0; }
          15% { opacity: 0.85; }
          85% { opacity: 0.85; }
          100% { transform: translate(-50%, 0) translateY(-65px) translateX(-18px) scale(1.1) rotate(-15deg); opacity: 0; }
        }
        @keyframes floatNote2 {
          0% { transform: translate(-50%, 0) translateY(0) scale(0.6) rotate(0deg); opacity: 0; }
          15% { opacity: 0.85; }
          85% { opacity: 0.85; }
          100% { transform: translate(-50%, 0) translateY(-75px) translateX(18px) scale(1) rotate(15deg); opacity: 0; }
        }
        @keyframes floatNote3 {
          0% { transform: translate(-50%, 0) translateY(0) scale(0.6) rotate(0deg); opacity: 0; }
          15% { opacity: 0.85; }
          85% { opacity: 0.85; }
          100% { transform: translate(-50%, 0) translateY(-55px) translateX(-5px) scale(1.2) rotate(5deg); opacity: 0; }
        }
        .marker-note {
          position: absolute;
          bottom: 12px;
          left: 50%;
          font-size: 14px;
          color: inherit;
          text-shadow: 0 0 3px rgba(0,0,0,0.6);
          pointer-events: none;
          opacity: 0;
          transform-origin: bottom center;
        }
        @keyframes webClusterPulse {
          0% { transform: scale(1); opacity: 0.65; }
          50% { transform: scale(2.0); opacity: 0.3; }
          100% { transform: scale(1.2); opacity: 0; }
        }
        .cluster-marker-container {
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease;
        }
        .cluster-marker-entering {
          animation: clusterEnter 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        @keyframes clusterEnter {
          0% { transform: scale(0); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes pinBobbing {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-1px); }
        }
        .marker-bobbing {
          animation: pinBobbing 2.2s infinite ease-in-out !important;
        }
        @keyframes iconBreathing {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); opacity: 0.9; }
        }
        @keyframes fireRise {
          0% { transform: translateY(0) scale(1) rotate(0deg); opacity: 0.8; background: #fb923c; }
          50% { transform: translateY(-10px) scale(1.2) rotate(15deg); opacity: 0.9; background: #ef4444; }
          100% { transform: translateY(-20px) scale(0.5) rotate(-15deg); opacity: 0; background: #b91c1c; }
        }
        .marker-fire-particle {
          position: absolute;
          bottom: 16px;
          left: 50%;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          transform-origin: center;
          filter: blur(1px);
        }
        .fire-particle-1 { animation: fireRise 1.2s infinite ease-in; margin-left: -4px; }
        .fire-particle-2 { animation: fireRise 1.4s infinite ease-in 0.3s; margin-left: -1px; width: 10px; height: 10px; }
        .fire-particle-3 { animation: fireRise 1.1s infinite ease-in 0.6s; margin-left: 2px; }

        @keyframes smokeRise {
          0% { transform: translateY(0) scale(1); opacity: 0.7; }
          100% { transform: translateY(-25px) scale(2.5); opacity: 0; }
        }
        .marker-smoke-particle {
          position: absolute;
          bottom: 16px;
          left: 50%;
          width: 10px;
          height: 10px;
          background: #94a3b8;
          border-radius: 50%;
          filter: blur(2px);
        }
        .smoke-particle-1 { animation: smokeRise 1.5s infinite ease-out; margin-left: -5px; }
        .smoke-particle-2 { animation: smokeRise 1.8s infinite ease-out 0.4s; margin-left: -2px; }
        .smoke-particle-3 { animation: smokeRise 1.6s infinite ease-out 0.8s; margin-left: 3px; }
        @keyframes boatBobbing {
          0%, 100% { transform: translateZ(0); }
          50% { transform: translateZ(1.5px) rotateX(0.5deg) rotateY(0.5deg); }
        }
        .marker-boat-bobbing {
          animation: boatBobbing 3s infinite ease-in-out !important;
          transform-style: preserve-3d;
        }
        @keyframes cloudMove {
          0% { transform: translate(-120%, -120%) scale(1); opacity: 0; }
          10% { opacity: 0.15; }
          90% { opacity: 0.15; }
          100% { transform: translate(250%, 250%) scale(1.5); opacity: 0; }
        }
        .cloud-shadows-container {
          position: absolute;
          top: 0; left: 0; width: 100%; height: 100%;
          overflow: hidden;
          pointer-events: none;
          z-index: 5;
        }
        .cloud-shadow {
          position: absolute;
          background: rgba(0, 0, 0, 0.2);
          filter: blur(80px);
          border-radius: 50%;
          width: 600px;
          height: 400px;
          animation: cloudMove 60s infinite linear;
        }
        @keyframes waterRipple {
          0% { transform: scale(0.3); opacity: 0.8; }
          50% { transform: scale(1.4); opacity: 0.4; }
          100% { transform: scale(0.9); opacity: 0; }
        }
        .water-ripple {
          position: absolute;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 1.5px solid #60A5FA;
          pointer-events: none;
          animation: waterRipple 2.4s infinite cubic-bezier(0.215, 0.61, 0.355, 1);
          transform-origin: center center;
          z-index: 1;
          display: none; /* hidden by default, toggled in JS */
        }
        .water-ripple-delay {
          animation-delay: 1.2s;
        }
        @keyframes boatWakeLeft {
          0% { transform: scale(0.5, 0.5) translate(0, 0) rotate(10deg); opacity: 0; }
          20% { opacity: 0.6; }
          100% { transform: scale(1.5, 3.0) translate(-18px, 45px) rotate(20deg); opacity: 0; }
        }
        @keyframes boatWakeRight {
          0% { transform: scale(0.5, 0.5) translate(0, 0) rotate(-10deg); opacity: 0; }
          20% { opacity: 0.6; }
          100% { transform: scale(1.5, 3.0) translate(18px, 45px) rotate(-20deg); opacity: 0; }
        }
        @keyframes boatBowWave {
          0% { transform: scale(0.4) translateX(-50%); opacity: 0; }
          30% { opacity: 0.4; }
          100% { transform: scale(1.4) translateX(-50%); opacity: 0; }
        }
        @keyframes boatFoam {
          0% { transform: scale(0.7) translate(-50%, 0); opacity: 0.7; }
          100% { transform: scale(2.2) translate(-50%, 25px); opacity: 0; }
        }
        .boat-bow-wave {
          position: absolute;
          top: -4px;
          left: 50%;
          width: 24px;
          height: 12px;
          border-top: 2px solid rgba(255, 255, 255, 0.4);
          border-radius: 50% 50% 0 0;
          transform: translateX(-50%);
          filter: blur(1.5px);
          animation: boatBowWave 2.8s infinite ease-out;
          pointer-events: none;
          z-index: 1;
        }
        .marker-flat-container {
          overflow: visible; /* Fix: allow waves to expand beyond 28px without clipping */
        }

        /* ─── Selected Pin Glow Animation ───────────────────────────── */
        @keyframes selectedPinPulse {
          0% { box-shadow: 0 0 0 0px var(--selected-glow-color, rgba(59, 130, 246, 0.6)); }
          100% { box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
        }
        .marker-3d-pin.selected-pin-glow::before {
          content: '';
          position: absolute;
          top: -4px; left: -4px; right: -4px; bottom: -4px;
          border-radius: inherit;
          border: 1.5px solid var(--selected-glow-color, #3B82F6);
          animation: selectedPinPulse 1.8s infinite cubic-bezier(0.25, 1, 0.5, 1);
          pointer-events: none;
          z-index: -1;
        }

        /* ─── Viñeta (Badge) Animations ─────────────────────────────── */
        @keyframes vinetaEnter {
          0% { transform: translateX(-50%) scale(0); opacity: 0; }
          60% { transform: translateX(-50%) scale(1.15); opacity: 1; }
          100% { transform: translateX(-50%) scale(1); opacity: 1; }
        }
        @keyframes vinetaPulse {
          0%, 100% { transform: translateX(-50%) scale(1); opacity: 1; }
          50% { transform: translateX(-50%) scale(1.12); opacity: 0.85; }
        }
        @keyframes vinetaGlowRing {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes vinetaGoldShine {
          0% { background-position: 0% center; }
          100% { background-position: 200% center; }
        }
        @keyframes vinetaHeartbeat {
          0%, 100% { transform: translateX(-50%) scale(1); }
          14% { transform: translateX(-50%) scale(1.15); }
          28% { transform: translateX(-50%) scale(1); }
          42% { transform: translateX(-50%) scale(1.15); }
          70% { transform: translateX(-50%) scale(1); }
        }
        @keyframes vinetaCriticalPulse {
          0%, 100% { transform: translateX(-50%) scale(1); box-shadow: 0 2px 8px rgba(220, 38, 38, 0.6), 0 0 0 1.5px rgba(0,0,0,0.3); }
          50% { transform: translateX(-50%) scale(1.15); box-shadow: 0 2px 12px rgba(220, 38, 38, 0.95), 0 0 0 1.5px rgba(220,38,38,0.5); }
        }
        .vineta-badge {
          transition: width 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), 
                      padding 0.35s ease, 
                      border-radius 0.35s ease, 
                      transform 0.2s ease, 
                      box-shadow 0.2s ease;
        }
        .vineta-label {
          transition: opacity 0.2s ease, max-width 0.35s cubic-bezier(0.25, 1, 0.5, 1), margin-left 0.35s ease;
          display: inline-block;
          max-width: 0;
          opacity: 0;
          overflow: hidden;
          vertical-align: middle;
          white-space: nowrap;
        }
        .vineta-badge.vineta-expanded .vineta-label {
          max-width: 80px;
          opacity: 1;
          margin-left: 2px;
        }
        .vineta-en_vivo {
          animation: vinetaPulse 1.8s infinite ease-in-out !important;
        }
        .vineta-gold-sparkle {
          background-size: 200% auto !important;
          animation: vinetaGoldShine 2.5s infinite linear, vinetaEnter 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards !important;
        }
        .vineta-heartbeat {
          animation: vinetaHeartbeat 2s infinite ease-in-out !important;
        }
        .vineta-critical-pulse {
          animation: vinetaCriticalPulse 1.2s infinite ease-in-out !important;
        }
      `;
      document.head.appendChild(style);
    }

    // Agregar atribución compacta de forma segura en la esquina inferior izquierda
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

    const updateAesthetics = () => {
      const z = map.getZoom();
      const pitch = map.getPitch();
      const accuracyState = userAccuracyRef.current;
      if (accuracyState && map.getLayer('user-wave-layer')) {
        userAccuracyRef.current = { ...accuracyState, latitude: accuracyState.latitude };
      }

      Object.keys(markersRef.current).forEach((id) => {
        const markerObj = markersRef.current[id];
        if (!markerObj) return;

        if (markerObj.isCluster) {
          // Clusters are now rendered as native MapLibre layers — skip DOM handling
          return;
        }

        const pinEl = markerObj.pinEl;
        const flatEl = markerObj.flatEl;
        const isSelected =
          selectedEventRef.current?.id === id || pinEl.dataset.localSelected === 'true';

        const cat = pinEl.dataset.category || '';
        const isEmergencyState = ['choque', 'incendio', 'accidente', 'calle_cortada'].includes(cat);
        const rotateTransform = isEmergencyState ? 'rotate(45deg)' : '';

        // 1. Zoom Adaptation
        let zoomScale = 1;
        let zoomOpacity = 1;
        let showIcon = true;
        let isVisible = true;

        const isBoat = cat === 'embarcacion';
        const boatVisibilityThreshold = 14;

        if (isBoat && z < boatVisibilityThreshold) {
          isVisible = false;
          zoomScale = 0;
          zoomOpacity = 0;
        }

        // Apply visibility and pointer-events
        pinEl.style.visibility = isVisible ? 'visible' : 'hidden';
        pinEl.style.pointerEvents = isVisible ? 'auto' : 'none';

        // Update z-index dynamically: selected or hovered pins get high priority
        const isHovered = pinEl.dataset.hovered === 'true';
        const baseZ = isBoat ? '1' : '10';
        pinEl.style.zIndex = isSelected || isHovered ? '9999' : baseZ;

        const flatScale = 1;

        const surface = pinEl.dataset.surface || 'land';

        // Pitch 3D Effect Calculation

        // Dynamic Elevation: Selected pin floats even higher into the sky as zoom increases
        // to emphasize the 3D landmark pop-out effect.
        const isCamara = cat === 'camara';

        const baseMaxElevation = isBoat ? 0 : isCamara ? 0 : isSelected ? 26 : isHovered ? 22 : 18;
        const elevationGrow = isSelected && !isCamara && z > 13 ? (z - 13) * 5.0 : 0;
        const maxElevation = baseMaxElevation + elevationGrow;

        const elevation = isVisible
          ? Math.sin((pitch * Math.PI) / 180) * maxElevation * zoomScale
          : 0;

        let selectedZoomGrow = 1.0;
        if (isSelected && !isCamara && z > 13) {
          selectedZoomGrow = 1.0 + (z - 13) * 0.38;
        }
        const baseScale = isCamara ? 1.0 : isSelected ? 1.25 * selectedZoomGrow : isHovered ? 1.15 : 1.0;
        const finalScale = baseScale * zoomScale;

        if (!markerObj.domRefs) {
          updateMarkerDomRefs(markerObj);
        }
        const domRefs = markerObj.domRefs!;
        const pinWrapper = domRefs.pinWrapper;
        const pin = domRefs.pin;
        const stem = domRefs.stem;
        const icon = domRefs.icon;

        if (flatEl) {
          flatEl.style.visibility = isVisible ? 'visible' : 'hidden';
          flatEl.style.pointerEvents = isVisible ? 'auto' : 'none';

          // Update flat container scale/opacity based on zoom
          const flatContainer = domRefs.flatContainer;
          if (flatContainer) {
            flatContainer.style.opacity = `${zoomOpacity}`;
            flatContainer.style.transform = `scale(${flatScale})`;
          }

          // Fetch shadow/puncture/ripple elements
          const shadowPin = domRefs.shadowPin;
          const shadowStem = domRefs.shadowStem;
          const puncture = domRefs.puncture;
          const ripples = domRefs.ripples;

          if (surface === 'water') {
            // Water layout
            if (puncture) puncture.style.display = 'none';
            if (shadowStem) shadowStem.style.display = 'none';
            if (ripples) {
              ripples.forEach((r) => (r.style.display = isVisible ? 'block' : 'none'));
            }

            if (shadowPin) {
              shadowPin.style.display = isVisible ? 'block' : 'none';
              // Faint, circular refracted shadow under water
              shadowPin.style.backgroundColor = 'rgba(17, 24, 39, 0.15)';
              shadowPin.style.filter = 'blur(2.5px)';
              shadowPin.style.transform = `translateY(0px) scale(${finalScale * 0.75})`;
              shadowPin.style.opacity = `${zoomOpacity}`;
            }

            if (pin) {
              if (isBoat) {
                pin.classList.remove('marker-bobbing');
                pin.classList.add('marker-boat-bobbing');
              } else {
                pin.classList.add('marker-bobbing');
                pin.classList.remove('marker-boat-bobbing');
              }
            }
            if (stem) {
              stem.style.height = '0px';
              stem.style.opacity = '0';
            }
          } else {
            // Land layout
            if (puncture) puncture.style.display = isVisible ? 'block' : 'none';
            if (shadowStem) {
              shadowStem.style.display = isVisible ? 'block' : 'none';
              shadowStem.style.opacity = isVisible ? `${(pitch / 60) * 0.55}` : '0';
              // Stretch the stem shadow backwards on the ground
              shadowStem.style.height = `${elevation * 0.8}px`;
            }
            if (ripples) {
              ripples.forEach((r) => (r.style.display = 'none'));
            }

            if (shadowPin) {
              shadowPin.style.display = isVisible ? 'block' : 'none';
              shadowPin.style.backgroundColor = 'rgba(0, 0, 0, 0.45)';
              shadowPin.style.filter = 'blur(1.5px)';
              // The flex layout pushes shadowPin upward, we just need scale
              shadowPin.style.transform = `scale(${finalScale})`;
              shadowPin.style.opacity = isVisible ? `${zoomOpacity * 0.9}` : '0';
            }

            if (pin) {
              pin.classList.remove('marker-bobbing');
            }

            // Standing metallic needle stretches to the center of the elevated pin
            if (stem) {
              if (pitch > 0 && isVisible) {
                // Height to reach center of elevated pin: elevation + 14 * finalScale
                stem.style.height = `${elevation + 14 * finalScale}px`;
                stem.style.opacity = `${(pitch / 60) * 0.95}`;
              } else {
                stem.style.height = '0px';
                stem.style.opacity = '0';
              }
            }

            // Stem de cámara — llena el gap entre lente (elevada) y el suelo
            const stemCamara = domRefs.stemCamara;
            if (stemCamara) {
              if (pitch > 0 && isVisible && elevation > 0) {
                // Mismo elevation que el pinWrapper para conectar exacto
                stemCamara.style.height = `${elevation + 12}px`;
                stemCamara.style.opacity = `${Math.min(0.85, (pitch / 60) * 0.9)}`;
              } else {
                stemCamara.style.height = '0px';
                stemCamara.style.opacity = '0';
              }
            }
          }
        }

        // Apply wrapper translation/scaling
        if (pinWrapper) {
          if (cat === 'camara') {
            // Cámara: sin elevation (tooltip no sube) y sin scale (no crece al seleccionar)
            pinWrapper.style.transform = 'translateY(0px) scale(1)';
          } else {
            pinWrapper.style.transform = `translateY(-${elevation}px) scale(${finalScale})`;
          }
          pinWrapper.style.opacity = `${zoomOpacity}`;
        }

        // Apply translation to store modal container without scaling it
        let storeModal = domRefs.storeModal;
        if (!storeModal) {
          storeModal = pinEl.querySelector('.store-modal-container') as HTMLDivElement | null;
          if (storeModal) domRefs.storeModal = storeModal;
        }
        if (storeModal) {
          storeModal.style.transform = `translateY(-${elevation}px)`;
        }

        // Apply rotation, glow, and border styles to the inner pin
        if (pin) {
          pin.style.transform = rotateTransform;
          pin.style.opacity = `${zoomOpacity}`;

          // Professional Designer glow enhancement for interactive selection/hover
          const eventColor = markerObj.event
            ? getCategoryColor(markerObj.event.category, markerObj.event.musicStyle)
            : '#3B82F6';

          if (isSelected) {
            pin.classList.add('selected-pin-glow');
            pin.style.setProperty('--selected-glow-color', eventColor);
            pin.style.boxShadow = `0 0 24px ${hexToRgba(eventColor, 0.85)}, 0 8px 28px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.3)`;
            pin.style.borderColor = eventColor;
            pin.style.borderWidth = '2.5px';
          } else {
            pin.classList.remove('selected-pin-glow');
            pin.style.boxShadow = isEmergencyState
              ? '0px 2px 4px rgba(0,0,0,0.5)'
              : '0px 6px 16px rgba(0,0,0,0.4)';
            pin.style.borderColor = isEmergencyState ? '#111827' : hexToRgba(eventColor, 0.6);
            pin.style.borderWidth = isEmergencyState ? '2px' : '1.5px';
          }
        }

        const notesContainer = domRefs.notesContainer;
        if (notesContainer) {
          notesContainer.style.display = (z >= 15 || isSelected) && isVisible ? 'block' : 'none';
        }

        if (icon) {
          icon.style.opacity = showIcon ? '1' : '0';
        }

        // Dynamically update smart badge (viñeta) expansion
        const badgeEl = domRefs.badgeEl;
        if (badgeEl) {
          const isWideLabel = badgeEl.dataset.wideLabel === 'true';
          const type = badgeEl.dataset.vinetaType || '';

          // Smart Badge Expansion Rules:
          // 1. If the pin is selected or hovered, ALWAYS expand.
          // 2. High zoom (z >= 16) auto-expands ALL badges for glanceability.
          // 3. Medium zoom (14.5 <= z < 16) auto-expands only high priority badges (en_vivo, oferta).
          // 4. Otherwise, keep it collapsed (icon only) to avoid clutter.
          const isHighPriority = type === 'en_vivo' || type === 'oferta';
          const shouldExpand = isSelected || isHovered || z >= 16 || (z >= 14.5 && isHighPriority);

          if (shouldExpand) {
            badgeEl.classList.add('vineta-expanded');
            badgeEl.style.width = isWideLabel ? 'auto' : '16px';
            badgeEl.style.padding = isWideLabel ? '0 6px' : '0';
            badgeEl.style.borderRadius = isWideLabel ? '10px' : '50%';
          } else {
            badgeEl.classList.remove('vineta-expanded');
            badgeEl.style.width = '16px';
            badgeEl.style.padding = '0';
            badgeEl.style.borderRadius = '50%';
          }
        }

        // Dynamically update contextual radial menu or store modal for the pin
        if (markerObj.event) {
          const loboSVG = domRefs.loboSVG;
          if (loboSVG) {
            loboSVG.setAttribute('fill', isSelected ? '#3B82F6' : '#2D3748');
          }

          const categoryLower = markerObj.event.category?.toLowerCase() || '';
          if (
            [
              'tienda',
              'fauna',
              'hospital',
              'universidad',
              'bombero',
              'carabinero',
              'camara',
            ].includes(categoryLower)
          ) {
            // Cámara: modal sale del anchor centrado en la lente, no del pinEl
            const camaraAnchor = pinEl.querySelector('.camara-modal-anchor') as HTMLDivElement | null;
            updateMapLibreStoreModal(
              camaraAnchor ?? pinEl,
              markerObj.event,
              isSelected,
              isHovered,
              mapLayer === 'light' || mapLayer === 'streets',
            );
          } else {
            updateMapLibreRadialMenu(
              pinEl,
              markerObj.event,
              isSelected && isVisible,
              isHovered && isVisible,
              onSelectEventRef.current,
              `maplibre-pin-${markerObj.event.id}`,
              onSaveLocationRef.current,
            );
          }
        }
      });
    };

    updateAestheticsRef.current = updateAesthetics;

    // Throttle via rAF to avoid redundant DOM mutations during rapid gestures
    let aestheticsRafId: number | null = null;
    const throttledUpdateAesthetics = () => {
      if (aestheticsRafId !== null) return;
      aestheticsRafId = requestAnimationFrame(() => {
        updateAesthetics();
        aestheticsRafId = null;
      });
    };

    // Bind map events for real-time 3D updates
    map.on('zoom', throttledUpdateAesthetics);
    map.on('pitch', throttledUpdateAesthetics);
    map.on('rotate', throttledUpdateAesthetics);
    map.on('move', throttledUpdateAesthetics);

    map.on('idle', () => {
      let updated = false;
      Object.keys(markersRef.current).forEach((id) => {
        const markerObj = markersRef.current[id];
        if (
          markerObj &&
          markerObj.event &&
          (!markerObj.pinEl.dataset.surface || markerObj.pinEl.dataset.surface === 'land')
        ) {
          const surface = detectSurfaceType(
            map,
            markerObj.event.longitude,
            markerObj.event.latitude,
          );
          // Only update if it actually changed or is newly detected
          if (markerObj.pinEl.dataset.surface !== surface) {
            markerObj.pinEl.dataset.surface = surface;
            if (markerObj.flatEl) {
              markerObj.flatEl.dataset.surface = surface;
            }
            updated = true;
          }
        }
      });
      if (updated && updateAestheticsRef.current) {
        updateAestheticsRef.current();
      }
    });

    map.on('styleimagemissing', (event) => {
      addMissingStyleImage(map, event.id, mapLayerRef.current);
    });

    map.on('zoomend', () => {
      if (onZoomChangeRef.current) {
        onZoomChangeRef.current(Math.round(map.getZoom()));
      }
    });

    map.on('dragstart', () => {
      isDraggingRef.current = true;
      if (onMapMoveRef.current) {
        onMapMoveRef.current();
      }
    });

    map.on('dragend', () => {
      // Pequeño delay para que el mouseleave no se dispare antes de que el drag haya terminado
      setTimeout(() => {
        isDraggingRef.current = false;
        // After drag ends, close any tooltips whose markers are no longer under the cursor.
        // This handles the case where mouseleave fired during drag and was deferred.
        Object.values(markersRef.current).forEach((markerObj: any) => {
          if (!markerObj || !markerObj.pinEl) return;
          const pinEl = markerObj.pinEl as HTMLDivElement;
          // If not currently under mouse (dataset.hovered stays true but mouse moved away),
          // force-close it now.
          if (pinEl.dataset.hovered === 'true' && !pinEl.matches(':hover')) {
            if (markerObj.closeTimeout) {
              clearTimeout(markerObj.closeTimeout);
              delete markerObj.closeTimeout;
            }
            pinEl.dataset.hovered = 'false';
            if (pinEl.dataset.localSelected === 'true') {
              pinEl.dataset.localSelected = 'false';
              if (selectedEventRef.current?.id === markerObj.event?.id) {
                selectedEventRef.current = null;
                if (syncEventPolygonsRef.current) syncEventPolygonsRef.current();
              }
            }
          }
        });
        if (updateAestheticsRef.current) updateAestheticsRef.current();
      }, 150);
    });

    // Helper to close hover-triggered tooltips (used by movestart, rotatestart, pitchstart)
    const closeHoverTooltips = () => {
      let needsUpdate = false;
      Object.values(markersRef.current).forEach((markerObj: any) => {
        if (!markerObj || !markerObj.pinEl) return;
        const pinEl = markerObj.pinEl as HTMLDivElement;
        // Only close hover-triggered tooltips — leave click-selected ones open
        if (pinEl.dataset.hovered === 'true' && pinEl.dataset.localSelected !== 'true') {
          if (markerObj.closeTimeout) {
            clearTimeout(markerObj.closeTimeout);
            delete markerObj.closeTimeout;
          }
          pinEl.dataset.hovered = 'false';
          needsUpdate = true;
        }
      });
      if (needsUpdate && updateAestheticsRef.current) updateAestheticsRef.current();
    };

    // When the map starts moving (pan, programmatic fly, etc.), force-close any
    // hover-only tooltips that are not click-selected. This prevents tooltips from
    // appearing "glued" to a fixed screen position as the map pans beneath them.
    map.on('movestart', closeHoverTooltips);

    // Close tooltips when user starts rotating map
    map.on('rotatestart', closeHoverTooltips);

    // Close tooltips when user starts changing pitch (3D tilt)
    map.on('pitchstart', closeHoverTooltips);

    map.on('zoomstart', () => {
      if (onMapMoveRef.current) {
        onMapMoveRef.current();
      }
    });

    map.on('style.load', () => {
      if (mapLayerRef.current === 'dark') {
        applyDarkTheme(map);
      }
      if (syncUserLocationRef.current) {
        syncUserLocationRef.current();
      }
      if (syncTrafficRef.current) {
        syncTrafficRef.current();
      }
      if (syncWeatherRef.current) {
        syncWeatherRef.current();
      }
      if (syncZonesRef.current) {
        syncZonesRef.current();
      }
      if (syncCyclewaysRef.current) {
        syncCyclewaysRef.current();
      }

      // Re-add cluster source+layers after style change
      if (!map.getSource('clusters-source')) {
        map.addSource('clusters-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        map.addLayer({
          id: 'cluster-circles',
          type: 'circle',
          source: 'clusters-source',
          paint: {
            'circle-color': '#0B0F19',
            'circle-radius': ['get', 'radius'],
            'circle-stroke-width': 3,
            'circle-stroke-color': ['get', 'color'],
            'circle-pitch-alignment': 'map',
            'circle-opacity': 1,
            'circle-stroke-opacity': 1,
          },
        });
        map.addLayer({
          id: 'cluster-labels',
          type: 'symbol',
          source: 'clusters-source',
          layout: {
            'text-field': ['get', 'count'],
            'text-size': ['get', 'fontSize'],
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-allow-overlap': false,
            'text-ignore-placement': false,
            'text-pitch-alignment': 'map',
            'text-rotation-alignment': 'map',
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': 'rgba(0,0,0,0.6)',
            'text-halo-width': 1,
          },
        });
      }
      // Immediately sync cluster data after style reload
      if (syncClustersRef.current) {
        syncClustersRef.current();
      }
    });

    const syncZones = async () => {
      const map = mapRef.current;
      if (!map || typeof map.isStyleLoaded !== 'function' || !map.isStyleLoaded()) return;

      try {
        let zones = sectorsDataRef.current;
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
          const isDark = mapLayerRef.current === 'dark';
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
              mapRef.current &&
              typeof mapRef.current.hasImage === 'function' &&
              !mapRef.current.hasImage('reserva-pattern')
            ) {
              mapRef.current.addImage('reserva-pattern', imgReserva);
              if (syncZonesRef.current) syncZonesRef.current();
            }
          };
        }

        const currentVisibleIds = visibleSectorIdsRef.current;
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

          const beforeId = getBeforeRoadsOrLabelsLayerId(map);

          // Capa de Relleno (Fill) diferenciada por tipo
          map.addLayer(
            {
              id: 'zones-fill',
              type: 'fill',
              source: 'zones-source',
              layout: {
                visibility: showSectorsRef.current ? 'visible' : 'none',
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
                visibility: showSectorsRef.current ? 'visible' : 'none',
              },
              paint: {
                'fill-pattern': 'reserva-pattern',
                'fill-opacity': 0.8,
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
                visibility: showSectorsRef.current ? 'visible' : 'none',
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
        if (map.getLayer('cluster-circles')) map.moveLayer('cluster-circles');
        if (map.getLayer('cluster-labels')) map.moveLayer('cluster-labels');
      }
    };
    syncZonesRef.current = syncZones;

    // Click on Sector
    map.on('click', 'zones-fill', (e) => {
      if ((e.originalEvent as any)._turismoHandled) return;
      if (!e.features?.length) return;

      // Verificar si hay un evento con minimodal cerca del punto de clic
      const minimodalCategories = [
        'hospital',
        'universidad',
        'bombero',
        'carabinero',
        'camara',
        'fauna',
      ];
      const clickLng = e.lngLat.lng;
      const clickLat = e.lngLat.lat;

      let closestEvent: any = null;
      let closestDist = Infinity;

      for (const ev of eventsRef.current) {
        if (!minimodalCategories.includes(ev.category?.toLowerCase() || '')) continue;
        const dLat = (ev.latitude || 0) - clickLat;
        const dLng = (ev.longitude || 0) - clickLng;
        const dist = dLat * dLat + dLng * dLng;
        // ~150m de radio (0.0015 grados ≈ 150m)
        if (dist < 0.0015 * 0.0015 && dist < closestDist) {
          closestDist = dist;
          closestEvent = ev;
        }
      }

      if (closestEvent) {
        // Marcar como handled para que no se propague
        (e.originalEvent as any)._turismoHandled = true;

        // Simular clic en el pin del evento para abrir su minimodal
        const markerObj = markersRef.current[closestEvent.id];
        if (markerObj && markerObj.pinEl) {
          markerObj.pinEl.click();
        }
        return;
      }

      const feature = e.features[0];
      const props = feature.properties as any;
      // Incluir la geometría del feature para que activeNestedZone tenga geojson
      const zoneData = {
        ...props,
        geojson: feature.geometry,
      };
      if (onSectorPressRef.current) {
        onSectorPressRef.current(zoneData);
      }
    });
    map.on('mouseenter', 'zones-fill', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'zones-fill', () => {
      map.getCanvas().style.cursor = '';
    });

    // Click on Event Polygons (e.g. Parques, Reservas)
    map.on('click', 'event-polygons-fill', (e) => {
      if (!e.features?.length) return;
      (e.originalEvent as any)._turismoHandled = true;
      const featureId = e.features[0].properties?.id;
      if (featureId && onSelectEventRef.current) {
        const event = eventsRef.current.find((ev) => ev.id === featureId);
        if (event) {
          const categoryLower = event.category?.toLowerCase() || '';
          if (
            ['hospital', 'clinica', 'universidad', 'bombero', 'carabinero', 'camara', 'fauna'].includes(
              categoryLower,
            )
          ) {
            const markerObj = markersRef.current[event.id];
            if (markerObj && markerObj.pinEl) {
              const isLocal = markerObj.pinEl.dataset.localSelected === 'true';
              if (!isLocal) {
                markerObj.pinEl.click();
              }
            }
            return;
          }
          onSelectEventRef.current(event);
        }
      }
    });
    map.on('mouseenter', 'event-polygons-fill', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'event-polygons-fill', (e) => {
      map.getCanvas().style.cursor = '';
      // Punto 2: cerrar minimodal del pin si el mouse sale del área
      if (!e.features?.length) return;
      const featureId = e.features[0].properties?.id;
      if (!featureId) return;
      const localCategories = [
        'hospital',
        'universidad',
        'bombero',
        'carabinero',
        'camara',
        'fauna',
      ];
      const event = eventsRef.current.find((ev) => ev.id === featureId);
      if (event && localCategories.includes(event.category?.toLowerCase() || '')) {
        const markerObj = markersRef.current[event.id];
        if (markerObj && markerObj.pinEl) {
          const pinEl = markerObj.pinEl;
          // Sólo cerrar si el pin no está siendo apuntado directamente
          if (pinEl.dataset.hovered !== 'true') {
            if (markerObj.closeTimeout) clearTimeout(markerObj.closeTimeout);
            markerObj.closeTimeout = setTimeout(() => {
              pinEl.dataset.localSelected = 'false';
              if (selectedEventRef.current?.id === event.id) {
                selectedEventRef.current = null;
                if (syncEventPolygonsRef.current) syncEventPolygonsRef.current();
              }
              if (updateAestheticsRef.current) updateAestheticsRef.current();
              delete markerObj.closeTimeout;
            }, 800);
          }
        }
      }
    });

    // Deselect when clicking on empty map (or intercept for magic wand)
    map.on('click', (e) => {
      if ((e.originalEvent as any)._turismoHandled) return;

      if (isMagicWandActiveRef.current && onMagicWandSelectRef.current) {
        // Find building features under the click
        const features = map.queryRenderedFeatures(e.point, {
          layers: map
            .getStyle()
            .layers.filter(
              (l: any) => l.id.includes('building') || l['source-layer']?.includes('building'),
            )
            .map((l: any) => l.id),
        });

        if (features && features.length > 0) {
          onMagicWandSelectRef.current(features[0].geometry);
          return;
        }
      }

      onSelectEventRef.current(null);

      // Punto 1: cerrar todos los minimodales locales al hacer clic en el mapa vacío
      Object.values(markersRef.current).forEach((markerObj: any) => {
        if (markerObj.pinEl && markerObj.pinEl.dataset.localSelected === 'true') {
          markerObj.pinEl.dataset.localSelected = 'false';
          markerObj.pinEl.dataset.hovered = 'false';
          if (markerObj.closeTimeout) {
            clearTimeout(markerObj.closeTimeout);
            delete markerObj.closeTimeout;
          }
        }
      });
      if (selectedEventRef.current) {
        selectedEventRef.current = null;
        if (syncEventPolygonsRef.current) syncEventPolygonsRef.current();
      }
      if (updateAestheticsRef.current) updateAestheticsRef.current();

      if (onMapPinchoRef.current) {
        onMapPinchoRef.current({
          latitude: e.lngLat.lat,
          longitude: e.lngLat.lng,
          x: e.point.x,
          y: e.point.y,
          surface: detectSurfaceType(map, e.lngLat.lng, e.lngLat.lat),
        });
      }
    });

    return () => {
      // Cleanup all markers
      Object.values(markersRef.current).forEach(({ pinMarker, flatMarker }) => {
        pinMarker.remove();
        if (flatMarker) flatMarker.remove();
      });
      markersRef.current = {};

      if (userMarkerRef.current) {
        userMarkerRef.current.marker.remove();
        userMarkerRef.current = null;
      }

      // Disconnect ResizeObserver
      resizeObserver.disconnect();

      if (map) {
        map.off('zoom', throttledUpdateAesthetics);
        map.off('pitch', throttledUpdateAesthetics);
        map.off('rotate', throttledUpdateAesthetics);
        map.off('move', throttledUpdateAesthetics);
        if (aestheticsRafId !== null) cancelAnimationFrame(aestheticsRafId);
        if (boundsTimer) clearTimeout(boundsTimer);
        map.remove();
      }
      mapRef.current = null;
    };
  }, []);

  // Ejecutar sincronización de zonas cuando cambien los datos externos o IDs visibles
  useEffect(() => {
    if (syncZonesRef.current) {
      syncZonesRef.current();
    }
  }, [sectorsData, visibleSectorIds]);

  // Sync Markers and Data
  const clusteredItems = useSuperclusterEvents(events, zoom, currentBounds);

  const syncEventPolygons = () => {
    const map = mapRef.current;
    if (!map || typeof map.isStyleLoaded !== 'function' || !map.isStyleLoaded()) return;

    if (!map.hasImage('humedal-pattern')) {
      const isDark = mapLayerRef.current === 'dark';
      const hWater = isDark ? 'rgba(59,130,246,0.3)' : 'rgba(37,99,235,0.4)';
      const hReed = isDark ? 'rgba(52,211,153,0.4)' : 'rgba(5,150,105,0.5)';
      const svgString = `<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 32 Q 10 29 15 32 T 25 32" stroke="${hWater}" fill="none" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M18 36 Q 23 33 28 36 T 38 36" stroke="${hWater}" fill="none" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M15 32 Q 13 20 8 15" stroke="${hReed}" fill="none" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M15 32 L 15 10" stroke="${hReed}" fill="none" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M15 32 Q 17 20 22 15" stroke="${hReed}" fill="none" stroke-width="1.5" stroke-linecap="round"/>
        <rect x="13.5" y="12" width="3" height="8" rx="1.5" fill="${hReed}" />
      </svg>`;
      const img = new Image(40, 40);
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
      img.onload = () => {
        if (
          mapRef.current &&
          typeof mapRef.current.hasImage === 'function' &&
          !mapRef.current.hasImage('humedal-pattern')
        ) {
          mapRef.current.addImage('humedal-pattern', img);
          syncEventPolygons();
        }
      };
    }

    if (!map.hasImage('parque-pattern')) {
      const isDark = mapLayerRef.current === 'dark';
      const pTree = isDark ? 'rgba(52,211,153,0.3)' : 'rgba(16,185,129,0.4)';
      const pTrunk = isDark ? 'rgba(16,185,129,0.4)' : 'rgba(6,78,59,0.5)';
      const svgStringParque = `<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        <path d="M 10 15 L 15 25 L 5 25 Z" fill="${pTree}"/>
        <rect x="9" y="25" width="2" height="4" fill="${pTrunk}"/>
        <path d="M 30 5 L 34 13 L 26 13 Z" fill="${pTree}"/>
        <rect x="29.5" y="13" width="1" height="3" fill="${pTrunk}"/>
        <path d="M 22 28 L 26 36 L 18 36 Z" fill="${pTree}"/>
        <rect x="21.5" y="36" width="1.5" height="3" fill="${pTrunk}"/>
      </svg>`;
      const imgParque = new Image(40, 40);
      imgParque.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStringParque);
      imgParque.onload = () => {
        if (
          mapRef.current &&
          typeof mapRef.current.hasImage === 'function' &&
          !mapRef.current.hasImage('parque-pattern')
        ) {
          mapRef.current.addImage('parque-pattern', imgParque);
          syncEventPolygons();
        }
      };
    }

    if (!map.hasImage('agua-pattern')) {
      const isDark = mapLayerRef.current === 'dark';
      const aWave = isDark ? 'rgba(96,165,250,0.4)' : 'rgba(37,99,235,0.4)';
      const svgStringAgua = `<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        <path d="M 0 10 Q 10 5, 20 10 T 40 10" stroke="${aWave}" fill="none" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M -10 20 Q 0 15, 10 20 T 30 20 T 50 20" stroke="${aWave}" fill="none" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M 0 30 Q 10 35, 20 30 T 40 30" stroke="${aWave}" fill="none" stroke-width="1.5" stroke-linecap="round"/>
      </svg>`;
      const imgAgua = new Image(40, 40);
      imgAgua.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStringAgua);
      imgAgua.onload = () => {
        if (
          mapRef.current &&
          typeof mapRef.current.hasImage === 'function' &&
          !mapRef.current.hasImage('agua-pattern')
        ) {
          mapRef.current.addImage('agua-pattern', imgAgua);
          syncEventPolygons();
        }
      };
    }

    const polyEvents = events.filter((e) => e.polygon && e.polygon.length > 0);
    const featureCollection = {
      type: 'FeatureCollection',
      features: polyEvents.map((e) => ({
        type: 'Feature',
        properties: {
          id: e.id,
          category: e.category,
          color: getCategoryColor(e.category, e.musicStyle),
        },
        geometry: {
          type: 'Polygon',
          coordinates: [e.polygon!.map((c) => [c.longitude, c.latitude])],
        },
      })),
    };

    if (map.getSource('event-polygons-source')) {
      (map.getSource('event-polygons-source') as maplibregl.GeoJSONSource).setData(
        featureCollection as any,
      );
      if (map.getLayer('event-polygons-fill')) {
        map.setPaintProperty('event-polygons-fill', 'fill-opacity', [
          'match',
          ['get', 'category'],
          ['agua', 'humedal', 'parque', 'naturaleza'],
          0,
          ['case', ['==', ['get', 'id'], selectedEventRef.current?.id ?? ''], 0.35, 0],
        ]);
        map.setPaintProperty('event-polygons-outline', 'line-opacity', [
          'match',
          ['get', 'category'],
          ['agua', 'humedal', 'parque', 'naturaleza'],
          0,
          ['case', ['==', ['get', 'id'], selectedEventRef.current?.id ?? ''], 0.8, 0],
        ]);
      }
    } else {
      map.addSource('event-polygons-source', { type: 'geojson', data: featureCollection as any });

      const beforeId = getBeforeRoadsOrLabelsLayerId(map);

      // Capa base de relleno
      map.addLayer(
        {
          id: 'event-polygons-fill',
          type: 'fill',
          source: 'event-polygons-source',
          paint: {
            'fill-color': ['get', 'color'],
            'fill-opacity': [
              'match',
              ['get', 'category'],
              ['agua', 'humedal', 'parque', 'naturaleza'],
              0,
              ['case', ['==', ['get', 'id'], selectedEventRef.current?.id ?? ''], 0.35, 0.01],
            ],
          },
        },
        beforeId,
      );

      // Capa específica de patrón para humedales
      map.addLayer(
        {
          id: 'event-polygons-humedal-pattern',
          type: 'fill',
          source: 'event-polygons-source',
          filter: ['==', ['get', 'category'], 'humedal'],
          paint: {
            'fill-pattern': 'humedal-pattern',
            'fill-opacity': 0.9,
          },
        },
        beforeId,
      );

      // Capa específica de patrón para parques
      map.addLayer(
        {
          id: 'event-polygons-parque-pattern',
          type: 'fill',
          source: 'event-polygons-source',
          filter: ['in', ['get', 'category'], ['literal', ['parque', 'naturaleza']]],
          paint: {
            'fill-pattern': 'parque-pattern',
            'fill-opacity': 0.8,
          },
        },
        beforeId,
      );

      // Capa específica de patrón para agua
      map.addLayer(
        {
          id: 'event-polygons-agua-pattern',
          type: 'fill',
          source: 'event-polygons-source',
          filter: ['==', ['get', 'category'], 'agua'],
          paint: {
            'fill-pattern': 'agua-pattern',
            'fill-opacity': 0.9,
          },
        },
        beforeId,
      );

      // Borde exterior (solo para eventos seleccionados que no sean agua/humedal)
      map.addLayer(
        {
          id: 'event-polygons-outline',
          type: 'line',
          source: 'event-polygons-source',
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 2,
            'line-opacity': [
              'match',
              ['get', 'category'],
              ['agua', 'humedal'],
              0,
              ['case', ['==', ['get', 'id'], selectedEventRef.current?.id ?? ''], 0.8, 0],
            ],
          },
        },
        beforeId,
      );
    }
  };

  syncEventPolygonsRef.current = syncEventPolygons;

  const syncCameraHeatmap = () => {
    const map = mapRef.current;
    if (!map || typeof map.isStyleLoaded !== 'function' || !map.isStyleLoaded()) return;

    const cameraEvents = events.filter((e) => e.category && e.category.toLowerCase() === 'camara');
    
    const featureCollection = {
      type: 'FeatureCollection',
      features: cameraEvents.map((e) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [e.longitude, e.latitude]
        },
        properties: {
          weight: 1
        }
      }))
    };

    if (map.getSource('camera-heatmap-source')) {
      (map.getSource('camera-heatmap-source') as maplibregl.GeoJSONSource).setData(featureCollection as any);
    } else {
      map.addSource('camera-heatmap-source', {
        type: 'geojson',
        data: featureCollection as any
      });
      
      const beforeId = getBeforeRoadsOrLabelsLayerId(map);
      
      map.addLayer({
        id: 'camera-heatmap-layer',
        type: 'heatmap',
        source: 'camera-heatmap-source',
        maxzoom: 18,
        paint: {
          'heatmap-weight': 1,
          'heatmap-intensity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            11, 1,
            18, 3
          ],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(59, 130, 246, 0)',
            0.2, 'rgba(96, 165, 250, 0.4)',
            0.4, 'rgba(147, 197, 253, 0.6)',
            0.6, 'rgba(167, 139, 250, 0.7)',
            0.8, 'rgba(139, 92, 246, 0.8)',
            1, 'rgba(124, 58, 237, 0.85)' // Purple/Blue neon for surveillance
          ],
          'heatmap-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            11, 20,
            18, 60
          ],
          'heatmap-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            11, 0.7,
            16, 0.7,
            18, 0
          ]
        }
      }, beforeId);
    }
  };


  const sync = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    syncEventPolygons();
    syncCameraHeatmap();

    // Filter out clusters — they are now rendered as native MapLibre layers
    const nonClusterItems = clusteredItems.filter(
      (item) => !('isCluster' in item && item.isCluster),
    );
    const clusterItems = clusteredItems.filter(
      (item) => 'isCluster' in item && item.isCluster,
    ) as Cluster[];

    // ── Update native cluster layers ──
    const clusterFeatures = clusterItems.map((cluster) => {
      const count = cluster.events.length;
      const dominantColor = getClusterDominantColor(cluster.events);
      const badgeRadius = Math.min(22, Math.max(16, 16 + Math.log2(count) * 2));
      const fontSize = badgeRadius < 18 ? 12 : badgeRadius < 20 ? 13 : 14;

      // Compute true centroid for click zoom target
      let cLat = 0,
        cLng = 0;
      for (const ev of cluster.events) {
        cLat += ev.latitude;
        cLng += ev.longitude;
      }
      cLat /= cluster.events.length;
      cLng /= cluster.events.length;

      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [cluster.longitude, cluster.latitude],
        },
        properties: {
          id: cluster.id,
          count: String(count),
          color: dominantColor,
          radius: badgeRadius,
          fontSize,
          centroidLng: cLng,
          centroidLat: cLat,
        },
      };
    });

    if (map.getSource('clusters-source')) {
      (map.getSource('clusters-source') as any).setData({
        type: 'FeatureCollection',
        features: clusterFeatures,
      });
    }

    // Store syncClusters for style.load re-sync
    syncClustersRef.current = () => {
      if (map.getSource('clusters-source')) {
        (map.getSource('clusters-source') as any).setData({
          type: 'FeatureCollection',
          features: clusterFeatures,
        });
      }
    };

    const newMarkerIds = new Set(nonClusterItems.map((e) => e.id));

    // Remove old markers (only non-cluster)
    Object.keys(markersRef.current).forEach((id) => {
      if (!newMarkerIds.has(id)) {
        const markerObj = markersRef.current[id];
        markerObj.pinMarker.remove();
        if (markerObj.flatMarker) markerObj.flatMarker.remove();
        // Clean up registry subscription if any
        if ((markerObj as any).unsubRegistry) (markerObj as any).unsubRegistry();
        delete markersRef.current[id];
      }
    });

    // Add or update markers
    // Add or update non-cluster markers only (clusters are handled via native layers above)
    nonClusterItems.forEach((item) => {
      const event = item as TurismoEvent;
      const isSelected = selectedEvent?.id === event.id;
      const color = getCategoryColor(event.category, event.musicStyle);
      const iconName = getCategoryIcon(event.category, event.musicStyle);
      const isEmergencyState = ['choque', 'incendio', 'accidente', 'calle_cortada'].includes(
        event.category,
      );

      let markerObj = markersRef.current[event.id];

      if (!markerObj) {
        // 1. Create flat DOM element for shadow & waves
        const flatEl = document.createElement('div');
        flatEl.style.pointerEvents = 'none';
        flatEl.style.display = 'flex';
        flatEl.style.alignItems = 'center';
        flatEl.style.justifyContent = 'center';

        const rotationAlignment = event.category === 'embarcacion' ? 'map' : 'viewport';

        const flatMarker = new maplibregl.Marker({
          element: flatEl,
          pitchAlignment: 'map',
          rotationAlignment,
          anchor: 'center',
        })
          .setLngLat([event.longitude, event.latitude])
          .addTo(map);

        // 2. Create interactive vertical DOM element for pin
        const pinEl = document.createElement('div');
        pinEl.id = `maplibre-pin-${event.id}`;
        pinEl.style.cursor = 'pointer';
        pinEl.style.display = 'flex';
        pinEl.style.alignItems = 'center';
        pinEl.style.justifyContent = 'center';

        const catLower = event.category?.toLowerCase() || '';
        if (catLower === 'fauna') {
          pinEl.style.width = '48px';
          pinEl.style.height = '48px';
        } else if (
          ['camara', 'hospital', 'clinica', 'universidad', 'bombero', 'carabinero'].includes(catLower)
        ) {
          pinEl.style.width = '40px';
          pinEl.style.height = '40px';
        } else if (catLower === 'embarcacion') {
          let w = 24;
          if (event.boatSize === 'grande') w = 32;
          else if (event.boatSize === 'mediana') w = 28;
          pinEl.style.width = `${w}px`;
          pinEl.style.height = `${w}px`;
        } else if (['parque', 'reserva', 'reservas', 'naturaleza'].includes(catLower)) {
          pinEl.style.width = '0px';
          pinEl.style.height = '0px';
        } else {
          pinEl.style.width = '28px';
          pinEl.style.height = '28px';
        }

        pinEl.dataset.hovered = 'false';
        pinEl.dataset.category = event.category;

        // A11y: Accesibilidad y teclado
        pinEl.tabIndex = 0;

        const handleOpenMinimodal = () => {
          // Immediately force-close any other hovered/tooltip markers to prevent multiple mini-modals
          Object.values(markersRef.current).forEach((otherObj: any) => {
            if (otherObj.event?.id !== event.id && otherObj.pinEl) {
              if (otherObj.closeTimeout) {
                clearTimeout(otherObj.closeTimeout);
                delete otherObj.closeTimeout;
              }
              // Force hovered off and immediately close their store modal
              if (otherObj.pinEl.dataset.hovered === 'true') {
                otherObj.pinEl.dataset.hovered = 'false';
              }
            }
          });
          // Trigger aesthetics update so previously hovered tooltips are removed from DOM immediately
          if (updateAestheticsRef.current) updateAestheticsRef.current();

          const markerObj = markersRef.current[event.id];
          if (markerObj && markerObj.closeTimeout) {
            clearTimeout(markerObj.closeTimeout);
            delete markerObj.closeTimeout;
          }
          pinEl.dataset.hovered = 'true';

          if (updateAestheticsRef.current) updateAestheticsRef.current();
        };

        const handleCloseMinimodal = () => {
          const markerObj = markersRef.current[event.id];
          if (!markerObj) return;

          if (markerObj.closeTimeout) clearTimeout(markerObj.closeTimeout);

          // During drag, schedule closure to fire after drag ends instead of skipping entirely.
          // Reducimos la tolerancia a 400ms según el área de tolerancia solicitada
          const delayMs = isDraggingRef.current ? 1200 : 400;

          markerObj.closeTimeout = setTimeout(() => {
            // If this timeout fires, the mouse has not re-entered the pin
            // (mouseenter would have cancelled it). Safe to close unconditionally.
            pinEl.dataset.hovered = 'false';

            // Si el pin tenía estado local seleccionado, lo limpiamos al quitar el mouse
            if (pinEl.dataset.localSelected === 'true') {
              pinEl.dataset.localSelected = 'false';
              if (selectedEventRef.current?.id === event.id) {
                selectedEventRef.current = null;
                if (syncEventPolygonsRef.current) syncEventPolygonsRef.current();
              }
            }

            if (updateAestheticsRef.current) updateAestheticsRef.current();
            delete markerObj.closeTimeout;
          }, delayMs);
        };

        pinEl.addEventListener('mouseenter', handleOpenMinimodal);
        pinEl.addEventListener('focus', handleOpenMinimodal); // A11y

        pinEl.addEventListener('mouseleave', handleCloseMinimodal);
        pinEl.addEventListener('blur', handleCloseMinimodal); // A11y

        pinEl.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            const markerObj = markersRef.current[event.id];
            if (markerObj && markerObj.closeTimeout) clearTimeout(markerObj.closeTimeout);
            pinEl.dataset.hovered = 'false';
            if (updateAestheticsRef.current) updateAestheticsRef.current();
            pinEl.blur(); // Remove focus
          } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            pinEl.click();
          }
        });

        pinEl.addEventListener('click', (e) => {
          e.stopPropagation();
          const categoryLower = event.category?.toLowerCase() || '';
          if (categoryLower === 'fauna') {
            const isLocal = pinEl.dataset.localSelected === 'true';
            pinEl.dataset.localSelected = isLocal ? 'false' : 'true';
            if (updateAestheticsRef.current) updateAestheticsRef.current();
            return;
          }
          if (
            ['hospital', 'clinica', 'universidad', 'bombero', 'carabinero', 'camara'].includes(categoryLower)
          ) {
            const isLocal = pinEl.dataset.localSelected === 'true';
            const nextLocal = !isLocal;
            // Clear any other local minimodal that may be locally selected
            if (nextLocal) {
              Object.values(markersRef.current).forEach((m) => {
                if (
                  ['hospital', 'clinica', 'universidad', 'bombero', 'carabinero', 'camara'].includes(
                    m.event?.category?.toLowerCase() || '',
                  ) &&
                  m.pinEl !== pinEl
                ) {
                  m.pinEl.dataset.localSelected = 'false';
                }
              });
            }
            pinEl.dataset.localSelected = nextLocal ? 'true' : 'false';
            // Update selectedEventRef so syncEventPolygons can show/hide the building area
            selectedEventRef.current = nextLocal ? event : null;
            if (updateAestheticsRef.current) updateAestheticsRef.current();
            if (syncEventPolygonsRef.current) syncEventPolygonsRef.current();
            return;
          }
          onSelectEventRef.current(event);
        });

        const isBoat = event.category === 'embarcacion';
        const pinMarker = new maplibregl.Marker({
          element: pinEl,
          pitchAlignment: isBoat ? 'map' : 'viewport',
          rotationAlignment: isBoat ? 'map' : 'viewport',
          anchor: isBoat ? 'center' : 'bottom',
        })
          .setLngLat([event.longitude, event.latitude])
          .addTo(map);

        markersRef.current[event.id] = {
          pinMarker,
          pinEl,
          flatMarker,
          flatEl,
          event,
        };
        markerObj = markersRef.current[event.id];
        updateMarkerDomRefs(markerObj);

        // Subscribe to registry: close this menu if another one opens
        const menuId = `maplibre-pin-${event.id}`;
        const unsubRegistry = radialMenuRegistry.subscribe((openId) => {
          if (openId !== menuId && openId !== null) {
            // Another menu opened — force-close this one
            const obj = markersRef.current[event.id];
            if (obj && obj.closeTimeout) {
              clearTimeout(obj.closeTimeout);
              delete obj.closeTimeout;
            }
            if (pinEl.dataset.hovered === 'true') {
              pinEl.dataset.hovered = 'false';
              if (updateAestheticsRef.current) {
                requestAnimationFrame(() => {
                  if (updateAestheticsRef.current) updateAestheticsRef.current();
                });
              }
            }
          }
        });
        // Store unsub for cleanup (attach to the markerObj for later)
        (markersRef.current[event.id] as any).unsubRegistry = unsubRegistry;

        // Detect and assign surface type
        let initialSurface: 'land' | 'water' = 'land';
        if (event.category === 'embarcacion') {
          initialSurface = 'water';
        } else if (map.isStyleLoaded()) {
          initialSurface = detectSurfaceType(map, event.longitude, event.latitude);
        }
        pinEl.dataset.surface = initialSurface;
        if (flatEl) {
          flatEl.dataset.surface = initialSurface;
        }

        // Render vanilla DOM contents once during creation
        if (event.category === 'embarcacion') {
          renderBoatFlatMarker(flatEl, event);
          renderBoatMarker(pinEl, event, isSelected);
        } else if (event.category?.toLowerCase() === 'fauna') {
          renderLoboMarinoMarker(pinEl, event, isSelected, mapLayer);
        } else if (event.category?.toLowerCase() === 'hospital') {
          renderHospitalMarker(pinEl, event, isSelected, mapLayer);
        } else if (event.category?.toLowerCase() === 'clinica') {
          renderClinicaMarker(pinEl, event, isSelected, mapLayer);
        } else if (event.category?.toLowerCase() === 'universidad') {
          renderUniversityMarker(pinEl, event, isSelected, mapLayer);
        } else if (event.category?.toLowerCase() === 'bombero') {
          renderBomberoMarker(pinEl, event, isSelected, mapLayer);
        } else if (event.category?.toLowerCase() === 'carabinero') {
          renderCarabineroMarker(pinEl, event, isSelected, mapLayer);
        } else if (event.category?.toLowerCase() === 'camara') {
          renderCamaraMarker(pinEl, event, isSelected, mapLayer);
        } else {
          renderFlatMarker(flatEl, event, color, isEmergencyState);
          renderPinMarker(pinEl, event, color, iconName, isEmergencyState, isSelected);
        }
      } else {
        // Update position if it changed
        markerObj.pinMarker.setLngLat([event.longitude, event.latitude]);
        if (markerObj.flatMarker) {
          markerObj.flatMarker.setLngLat([event.longitude, event.latitude]);
        }
        // Force re-render of custom markers to adapt to the map style layer
        let didReRender = false;
        if (event.category?.toLowerCase() === 'fauna') {
          renderLoboMarinoMarker(markerObj.pinEl, event, isSelected, mapLayer);
          didReRender = true;
        } else if (event.category?.toLowerCase() === 'hospital') {
          renderHospitalMarker(markerObj.pinEl, event, isSelected, mapLayer);
          didReRender = true;
        } else if (event.category?.toLowerCase() === 'clinica') {
          renderClinicaMarker(markerObj.pinEl, event, isSelected, mapLayer);
          didReRender = true;
        } else if (event.category?.toLowerCase() === 'universidad') {
          renderUniversityMarker(markerObj.pinEl, event, isSelected, mapLayer);
          didReRender = true;
        } else if (event.category?.toLowerCase() === 'bombero') {
          renderBomberoMarker(markerObj.pinEl, event, isSelected, mapLayer);
          didReRender = true;
        } else if (event.category?.toLowerCase() === 'carabinero') {
          renderCarabineroMarker(markerObj.pinEl, event, isSelected, mapLayer);
          didReRender = true;
        } else if (event.category?.toLowerCase() === 'camara') {
          renderCamaraMarker(markerObj.pinEl, event, isSelected, mapLayer);
          didReRender = true;
        }
        if (didReRender) {
          updateMarkerDomRefs(markerObj);
        }
      }

      // Update Marker z-index to bring selected to front
      if (markerObj.pinEl) {
        const isHovered = markerObj.pinEl.dataset.hovered === 'true';
        const isSel = isSelected || isHovered;
        markerObj.pinEl.style.zIndex = isSel ? '9999' : '10';
        if (isSel && markerObj.pinEl.parentElement) {
          markerObj.pinEl.parentElement.appendChild(markerObj.pinEl);
        }
      }
      if (markerObj.flatEl) {
        markerObj.flatEl.style.zIndex = isSelected ? '999' : '0';
      }
    });

    // Handle Map Pincho (Persistent Tool Pin)
    if (mapPincho) {
      if (!pinMarkerRef.current) {
        const el = document.createElement('div');
        el.className = 'pincho-marker';
        Object.assign(el.style, {
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          backgroundColor: '#10B981',
          border: '2px solid #FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          zIndex: '1500',
        });

        // Add the push-pin icon
        const svg = createSvgIcon('push-pin', 18, '#FFFFFF');
        if (svg) {
          el.appendChild(svg);
        }

        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([mapPincho.longitude, mapPincho.latitude])
          .addTo(map);

        pinMarkerRef.current = { marker, el };
      } else {
        pinMarkerRef.current.marker.setLngLat([mapPincho.longitude, mapPincho.latitude]);
      }
    } else if (pinMarkerRef.current) {
      pinMarkerRef.current.marker.remove();
      pinMarkerRef.current = null;
    }

    if (map.getLayer('cluster-circles')) map.moveLayer('cluster-circles');
    if (map.getLayer('cluster-labels')) map.moveLayer('cluster-labels');

    // Apply immediate 3D and Zoom styling to all markers
    if (updateAestheticsRef.current) {
      updateAestheticsRef.current();
    }
  }, [clusteredItems, selectedEvent, zoom, mapPincho, mapLayer]);

  // Update tactical location pixel coordinates when map moves, so HUD stays glued to the pincho
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapPincho || !tacticalMode) return;

    const updatePosition = () => {
      const point = map.project([mapPincho.longitude, mapPincho.latitude]);
      if (onTacticalLocationChange) {
        onTacticalLocationChange({
          latitude: mapPincho.latitude,
          longitude: mapPincho.longitude,
          x: point.x,
          y: point.y,
          surface: mapPincho.surface,
        });
      }
    };

    map.on('move', updatePosition);
    // Execute once to set initial position
    updatePosition();

    return () => {
      map.off('move', updatePosition);
    };
  }, [mapPincho, tacticalMode, onTacticalLocationChange]);

  // High-Frequency Imperative User Location Marker updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleHighFreqLocation = (e: Event) => {
      const customEvent = e as CustomEvent;
      const loc = customEvent.detail;
      if (!loc) return;

      latestUserLocationRef.current = loc;

      // 1. Accuracy circle layer handling (only if map style is loaded)
      if (map.isStyleLoaded() && loc.accuracy) {
        const accuracyMeters = Math.max(1, loc.accuracy);
        userAccuracyRef.current = { accuracyMeters, latitude: loc.latitude };
        const radius = getAccuracyRadiusAtZoom(accuracyMeters, loc.latitude, map.getZoom());
        const accuracyData: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [loc.longitude, loc.latitude],
              },
              properties: {},
            },
          ],
        };

        if (!map.getSource('user-accuracy')) {
          map.addSource('user-accuracy', {
            type: 'geojson',
            data: accuracyData,
          });
          map.addLayer({
            id: 'user-wave-layer',
            type: 'circle',
            source: 'user-accuracy',
            paint: {
              'circle-radius': WAVE_MIN_RADIUS_PX,
              'circle-color': 'transparent',
              'circle-opacity': 0,
              'circle-stroke-width': WAVE_STROKE_WIDTH,
              'circle-stroke-color': getUserWaveColor(mapLayerRef.current),
              'circle-stroke-opacity': 0,
              'circle-pitch-alignment': 'map',
            },
          });
        } else {
          const source = map.getSource('user-accuracy') as maplibregl.GeoJSONSource;
          if (source.setData) {
            source.setData(accuracyData);
          }
        }
      } else if (!loc.accuracy || !map.isStyleLoaded()) {
        userAccuracyRef.current = null;
        if (map.isStyleLoaded()) {
          if (map.getLayer('user-wave-layer')) map.removeLayer('user-wave-layer');
          if (map.getSource('user-accuracy')) map.removeSource('user-accuracy');
        }
      }

      // 2. DOM marker rendering
      if (!userMarkerRef.current) {
        const el = document.createElement('div');
        el.className = 'user-marker';

        const coneEl = document.createElement('div');
        coneEl.className = 'user-cone';
        el.appendChild(coneEl);

        const styleId = 'user-marker-styles';
        if (!document.getElementById(styleId)) {
          const style = document.createElement('style');
          style.id = styleId;
          style.innerHTML = `
            .user-marker {
              width: 18px;
              height: 18px;
              border-radius: 50%;
              background-color: #3B82F6;
              border: 3px solid #FFFFFF;
              box-shadow: 0 0 10px rgba(0,0,0,0.3);
              position: relative;
              z-index: 2000;
            }
            .user-cone {
              position: absolute;
              top: -24px;
              left: 50%;
              width: 0;
              height: 0;
              border-left: 14px solid transparent;
              border-right: 14px solid transparent;
              border-bottom: 28px solid rgba(59, 130, 246, 0.3);
              transform-origin: bottom center;
              transform: translateX(-50%) scaleX(0.6);
              pointer-events: none;
              display: none;
              z-index: -2;
            }
          `;
          document.head.appendChild(style);
        }

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([loc.longitude, loc.latitude])
          .addTo(map);

        userMarkerRef.current = { marker, el };
      } else {
        userMarkerRef.current.marker.setLngLat([loc.longitude, loc.latitude]);
      }

      // 3. Directional cone rotation
      const userEl = userMarkerRef.current?.el;
      if (userEl) {
        const cone = userEl.querySelector('.user-cone') as HTMLDivElement | null;
        if (cone) {
          if (loc.heading !== null && loc.heading !== undefined) {
            cone.style.display = 'block';
            cone.style.transform = `translateX(-50%) rotate(${loc.heading}deg)`;
          } else {
            cone.style.display = 'none';
          }
        }
      }
    };

    window.addEventListener('high-frequency-user-location', handleHighFreqLocation);

    // Initial marker rendering if location is already loaded
    if (userLocation) {
      handleHighFreqLocation(
        new CustomEvent('high-frequency-user-location', { detail: userLocation }),
      );
    }

    return () => {
      window.removeEventListener('high-frequency-user-location', handleHighFreqLocation);
    };
  }, [userLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const startTs = performance.now();
    let rafId: number;

    const tick = () => {
      if (
        map.isStyleLoaded() &&
        userAccuracyRef.current &&
        map.getLayer('user-wave-layer') &&
        document.visibilityState !== 'hidden'
      ) {
        const t = ((performance.now() - startTs) % WAVE_PERIOD_MS) / WAVE_PERIOD_MS;
        const eased = 1 - Math.pow(1 - t, 3);
        const maxRadius = getAccuracyRadiusAtZoom(
          userAccuracyRef.current.accuracyMeters,
          userAccuracyRef.current.latitude,
          map.getZoom(),
        );
        const radius = WAVE_MIN_RADIUS_PX + Math.max(0, maxRadius - WAVE_MIN_RADIUS_PX) * eased;

        map.setPaintProperty('user-wave-layer', 'circle-radius', radius);
        map.setPaintProperty('user-wave-layer', 'circle-stroke-opacity', (1 - t) * 0.85);
        map.setPaintProperty(
          'user-wave-layer',
          'circle-stroke-color',
          getUserWaveColor(mapLayerRef.current),
        );
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  useEffect(() => {
    syncUserLocationRef.current = sync;
    sync();
  }, [sync]);

  // Sync Traffic Layer
  const syncTraffic = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    if (showTraffic) {
      if (!map.getSource('google-traffic')) {
        map.addSource('google-traffic', {
          type: 'raster',
          tiles: [`${TRAFFIC_PROTOCOL}://{z}/{x}/{y}`],
          tileSize: 256,
        });
      }
      if (!map.getLayer('google-traffic-layer')) {
        map.addLayer({
          id: 'google-traffic-layer',
          type: 'raster',
          source: 'google-traffic',
          paint: {
            'raster-opacity': 0.8,
          },
        });
      }
    } else {
      if (map.getLayer('google-traffic-layer')) {
        map.removeLayer('google-traffic-layer');
      }
      if (map.getSource('google-traffic')) {
        map.removeSource('google-traffic');
      }
    }
  }, [showTraffic]);

  useEffect(() => {
    syncTrafficRef.current = syncTraffic;
    if (mapRef.current?.isStyleLoaded()) {
      syncTraffic();
    }
  }, [syncTraffic]);

  // Sync Weather Layer
  const syncWeather = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const sourceId = 'weather-tile-source';
    const layerId = 'weather-tile-layer';

    if (showWeather) {
      const tileUrl =
        weatherType === 'precipitation'
          ? `https://tilecache.rainviewer.com${radarPath || '/v2/radar/now'}/256/{z}/{x}/{y}/1/1_1.png`
          : `https://tile.openweathermap.org/map/${weatherType}_new/{z}/{x}/{y}.png?appid=YOUR_OWM_API_KEY`;

      if (map.getSource(sourceId)) {
        if (map.getLayer(layerId)) {
          map.removeLayer(layerId);
        }
        map.removeSource(sourceId);
      }

      // If we are waiting for the radar path, don't add the source yet to avoid 400 errors
      if (weatherType === 'precipitation' && !radarPath) return;

      map.addSource(sourceId, {
        type: 'raster',
        tiles: [tileUrl],
        tileSize: 256,
        maxzoom: weatherType === 'precipitation' ? MAX_RAINVIEWER_ZOOM : MAX_WEATHER_ZOOM,
      });

      map.addLayer({
        id: layerId,
        type: 'raster',
        source: sourceId,
        paint: {
          'raster-opacity': 0.6,
        },
      });
    } else {
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    }
  }, [showWeather, weatherType, radarPath]);

  useEffect(() => {
    syncWeatherRef.current = syncWeather;
    if (mapRef.current?.isStyleLoaded()) {
      syncWeather();
    }
  }, [syncWeather]);

  // ─── Sync Ciclovías Layer ───────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const SOURCE_ID = 'cycleways-source';
    const LAYER_BG = 'cycleways-layer-bg';
    const LAYER_LINE = 'cycleways-layer-line';

    const geoJSONData =
      cyclewaysData && cyclewaysData.length > 0
        ? {
            type: 'FeatureCollection',
            features: cyclewaysData.map((c: any) => ({
              type: 'Feature',
              id: c.id,
              properties: {
                IDENTIFICA: c.id,
                EJE_VIA: c.eje,
                INICIO: c.inicio,
                FIN: c.fin,
                KM: c.km,
                TIPO: 'ciclovía',
                COMUNA: 'Valdivia',
              },
              geometry: {
                type: 'LineString',
                coordinates: c.coordinates,
              },
            })),
          }
        : CICLOVIAS_GEOJSON;

    const addLayers = () => {
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: 'geojson',
          data: geoJSONData as any,
        });
      } else {
        (map.getSource(SOURCE_ID) as any).setData(geoJSONData as any);
      }
      if (!map.getLayer(LAYER_BG)) {
        map.addLayer({
          id: LAYER_BG,
          type: 'line',
          source: SOURCE_ID,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#1e3a4a',
            'line-width': 5,
            'line-opacity': 0.8,
          },
        });
      }
      if (!map.getLayer(LAYER_LINE)) {
        map.addLayer({
          id: LAYER_LINE,
          type: 'line',
          source: SOURCE_ID,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#06b6d4',
            'line-width': 3,
            'line-opacity': 1,
            'line-dasharray': [3, 3],
          },
        });
      }
      // Attach click popup once
      if (!(map as any)._cyclewayListenersAttached) {
        map.on('click', LAYER_LINE, (e: any) => {
          if (!e.features?.length) return;
          const props = e.features[0].properties as any;
          new maplibregl.Popup({ closeButton: true, maxWidth: '280px' })
            .setLngLat(e.lngLat)
            .setHTML(
              `
              <div style="font-family:sans-serif;padding:4px 2px;">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
                  <i class="material-icons" style="font-size:20px;color:#00d2ff;">directions_bike</i>
                  <strong style="color:#00d2ff;font-size:13px;">${props.EJE_VIA || 'Ciclovía'}</strong>
                </div>
                <div style="font-size:11px;color:#ccc;line-height:1.8;">
                  <div>Desde: <b style="color:#fff;">${props.INICIO}</b></div>
                  <div>Hasta: <b style="color:#fff;">${props.FIN}</b></div>
                  <div>Largo: <b style="color:#00d2ff;">${props.KM} km</b></div>
                </div>
              </div>
            `,
            )
            .addTo(map);
        });
        map.on('mouseenter', LAYER_LINE, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', LAYER_LINE, () => {
          map.getCanvas().style.cursor = '';
        });
        (map as any)._cyclewayListenersAttached = true;
      }

      if (map.getLayer('cluster-circles')) map.moveLayer('cluster-circles');
      if (map.getLayer('cluster-labels')) map.moveLayer('cluster-labels');
    };

    const removeLayers = () => {
      for (const id of [LAYER_LINE, LAYER_BG]) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      (map as any)._cyclewayListenersAttached = false;
    };

    const sync = () => {
      if (!map.isStyleLoaded()) return;
      if (showCycleways) {
        addLayers();
      } else {
        removeLayers();
      }
    };

    // Register in ref so style.load can call it too
    syncCyclewaysRef.current = sync;

    // Run immediately if map is ready, otherwise wait for next idle
    if (map.isStyleLoaded()) {
      sync();
    } else {
      const onIdle = () => {
        sync();
      };
      map.once('idle', onIdle);
      return () => {
        map.off('idle', onIdle);
      };
    }
  }, [showCycleways, cyclewaysData]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── OSRM Navigation Route Layer ───────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const SOURCE = 'osrm-nav-route';
    const LAYER_BG = 'osrm-nav-route-bg';
    const LAYER_FG = 'osrm-nav-route-fg';

    const data: GeoJSON.Feature = navRouteGeojson
      ? { type: 'Feature', geometry: navRouteGeojson, properties: {} }
      : { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} };

    const applyRoute = () => {
      if (!map.getSource(SOURCE)) {
        map.addSource(SOURCE, { type: 'geojson', data });
        map.addLayer({
          id: LAYER_BG,
          type: 'line',
          source: SOURCE,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#1E3A5F', 'line-width': 10, 'line-opacity': 0.85 },
        });
        map.addLayer({
          id: LAYER_FG,
          type: 'line',
          source: SOURCE,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#3B82F6', 'line-width': 5, 'line-opacity': 1 },
        });
      } else {
        (map.getSource(SOURCE) as maplibregl.GeoJSONSource).setData(data);
        // Asegurar que las capas estén encima tras recargas de estilo
        if (!map.getLayer(LAYER_BG)) {
          map.addLayer({
            id: LAYER_BG, type: 'line', source: SOURCE,
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#1E3A5F', 'line-width': 10, 'line-opacity': 0.85 },
          });
        }
        if (!map.getLayer(LAYER_FG)) {
          map.addLayer({
            id: LAYER_FG, type: 'line', source: SOURCE,
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#3B82F6', 'line-width': 5, 'line-opacity': 1 },
          });
        }
      }

      // Encuadrar la cámara sobre toda la ruta
      const coords = navRouteGeojson?.coordinates;
      if (coords && coords.length > 1) {
        let minLng = coords[0][0], minLat = coords[0][1];
        let maxLng = coords[0][0], maxLat = coords[0][1];
        for (const [lng, lat] of coords) {
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        }
        map.fitBounds(
          [[minLng, minLat], [maxLng, maxLat]],
          { padding: { top: 100, bottom: 260, left: 60, right: 60 }, duration: 800, maxZoom: 16 },
        );
      }
    };

    if (map.isStyleLoaded()) {
      applyRoute();
    } else {
      map.once('idle', applyRoute);
    }
  }, [navRouteGeojson]); // eslint-disable-line react-hooks/exhaustive-deps
  // ───────────────────────────────────────────────────────────────────────────

  // Sync Style (with dynamic maxZoom per layer)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (map.hasImage('wood-pattern')) {
      map.removeImage('wood-pattern');
    }

    // Update maxZoom based on the current layer
    const layerMaxZoom = MAX_ZOOM_PER_LAYER[mapLayer] || 18;
    map.setMaxZoom(layerMaxZoom);

    // Satélite siempre usa el protocolo cacheado para Ultra HD
    const selectedStyle = mapLayer === 'satellite' ? getSatelliteStyle(true) : mapStyles[mapLayer];

    if (selectedStyle) {
      map.setStyle(selectedStyle);
    }
  }, [mapLayer]);

  // Sync Map Camera on Selection change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (selectedEvent) {
      map.flyTo({
        center: [selectedEvent.longitude, selectedEvent.latitude],
        zoom: Math.max(map.getZoom(), 16),
        essential: true,
      });
    }
  }, [selectedEvent]);

  // Sync Zoom Level
  useEffect(() => {
    const map = mapRef.current;
    if (map && zoom !== undefined) {
      if (Math.round(map.getZoom()) !== zoom) {
        map.setZoom(zoom);
      }
    }
  }, [zoom]);

  // Center on User Location
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (centerTrigger && userLocation) {
      map.flyTo({
        center: [userLocation.longitude, userLocation.latitude],
        zoom: 14,
        essential: true,
      });
    }
  }, [centerTrigger, userLocation]);

  // Cursor manager (Tactical Mode & Pincho Tool)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (onMapPincho) {
      const pinchoCursor = `url("data:image/svg+xml;utf8,%3Csvg width='32' height='32' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z' fill='%23EF4444' stroke='%23FFFFFF' stroke-width='1.5'/%3E%3C/svg%3E") 16 32, crosshair`;
      map.getCanvas().style.cursor = pinchoCursor;
    } else if (tacticalMode) {
      const customCursor = `url('data:image/svg+xml;utf8,<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%2310B981" stroke-width="2" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="8"/><line x1="12" y1="0" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="24"/><line x1="0" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="24" y2="12"/><circle cx="12" cy="12" r="1" fill="%2310B981"/></svg>') 12 12, crosshair`;
      map.getCanvas().style.cursor = customCursor;
    } else {
      map.getCanvas().style.cursor = '';
    }
  }, [onMapPincho, tacticalMode]);

  // Dynamic boat movement simulation on water using steering AI
  useEffect(() => {
    // Persistent state for boat simulation to avoid "jittery" or "spinning" behavior
    const simulationState: { [id: string]: { lastHeading: number; turnCooldown: number } } = {};

    const interval = setInterval(() => {
      const map = mapRef.current;
      if (!map || !map.isStyleLoaded()) return;

      Object.values(markersRef.current).forEach((markerObj) => {
        const event = markerObj.event;
        if (!event || event.category !== 'embarcacion') return;

        if (!simulationState[event.id]) {
          simulationState[event.id] = {
            lastHeading: event.boatHeading || 0,
            turnCooldown: 0,
          };
        }
        const state = simulationState[event.id];

        // Step size calculated for a smooth 100ms update step (0.1s)
        const speed = event.boatSpeed || 8;
        const stepSize = 0.0000005 * speed;

        let currentHeading = event.boatHeading || 0;

        // 1. Subtle natural drift (small random changes while in open water)
        if (state.turnCooldown <= 0) {
          // Add a very small random drift (-0.2 to 0.2 degree) to make movement look natural
          currentHeading = (currentHeading + (Math.random() * 0.4 - 0.2) + 360) % 360;
        } else {
          state.turnCooldown--;
        }

        const headingRad = (currentHeading * Math.PI) / 180;
        const candidateLng = event.longitude + Math.sin(headingRad) * stepSize;
        const candidateLat = event.latitude + Math.cos(headingRad) * stepSize;

        // 2. Collision Detection & Avoidance
        if (detectSurfaceTypeForBoat(map, candidateLng, candidateLat) === 'water') {
          // Path is clear: Update position
          event.longitude = candidateLng;
          event.latitude = candidateLat;
          event.boatHeading = currentHeading;

          markerObj.pinMarker.setLngLat([candidateLng, candidateLat]);
          if (markerObj.flatMarker) {
            markerObj.flatMarker.setLngLat([candidateLng, candidateLat]);
          }
        } else {
          // Bank hit! Find best escape angle
          let foundNewDirection = false;
          // Strategy: Try wider turns first to avoid immediate re-collision
          const anglesToTry = [45, -45, 90, -90, 135, -135, 180];

          for (const angleOffset of anglesToTry) {
            const testHeading = (currentHeading + angleOffset + 360) % 360;
            const testHeadingRad = (testHeading * Math.PI) / 180;
            const testLng = event.longitude + Math.sin(testHeadingRad) * stepSize * 15; // Test further ahead (1.5s ahead)
            const testLat = event.latitude + Math.cos(testHeadingRad) * stepSize * 15;

            if (detectSurfaceTypeForBoat(map, testLng, testLat) === 'water') {
              event.boatHeading = testHeading;
              state.turnCooldown = 30; // Prevent jittery turns for 3 seconds (30 cycles of 100ms)
              foundNewDirection = true;
              break;
            }
          }

          if (!foundNewDirection) {
            // Desperate move: complete reversal
            event.boatHeading = (currentHeading + 180) % 360;
            state.turnCooldown = 60;
          }
        }

        // 3. Smooth Visual Rotation Update
        if (!markerObj.domRefs) {
          updateMarkerDomRefs(markerObj);
        }
        const domRefs = markerObj.domRefs!;
        const finalHeading = event.boatHeading;

        const boatBody = domRefs.boatBody;
        if (boatBody) {
          // Slower, more majestic rotation transition
          boatBody.style.transition = 'transform 2.5s ease-in-out';
          boatBody.style.transform = `rotate(${finalHeading}deg)`;
        }
        const wakeContainer = domRefs.wakeContainer;
        if (wakeContainer) {
          // Keep wake in sync with boat rotation
          wakeContainer.style.transition = 'transform 2.5s ease-in-out';
          wakeContainer.style.transform = `translate(-50%, -50%) rotate(${finalHeading}deg)`;
        }
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      <div ref={mapNodeRef} style={{ width: '100%', height: '100%' }}>
        <CloudShadows />
      </div>
      {selectedEvent?.indoorMap && internalFloor !== null && (
        <FloorSelector
          floors={selectedEvent.indoorMap.floors}
          activeFloor={internalFloor}
          onSelectFloor={setInternalFloor}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 400,
  },
  mapElement: {
    height: '100%',
    width: '100%',
  },
});
