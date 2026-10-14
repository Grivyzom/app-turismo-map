import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import maplibregl, { Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { StyleSheet, View } from 'react-native';

import { VALDIVIA_LAT, VALDIVIA_LNG } from '../../constants/location';
import { getCategoryColor, getCategoryIcon } from '../../utils/mapUtils';
import {
  addMissingStyleImage,
  applyDarkTheme,
  applyRiverStyling,
  hideBaseMapPOIs,
} from '../../utils/mapWebUtils';
import { getSatelliteStyle, CARTO_API_KEY } from '../../config/mapStyles.web';
import { SatelliteTileCache } from '../../utils/satelliteTileCache';
import { TrafficTileCache, TRAFFIC_PROTOCOL } from '../../utils/trafficTileCache';
import {
  useSuperclusterEvents,
  CAMERA_PIN_MIN_ZOOM,
  CAMERA_GROUP_MAX_ZOOM,
} from '../../utils/clusterUtils';
import { MICRODOT_PAINT, microdotFeatures } from '../../utils/semanticZoom';
import { pickTopPriority, pinHitBox, WALK_LINE_DASHARRAY } from '../../utils/contextualRanking';
import { radialMenuRegistry } from '../../utils/radialMenuRegistry';
import { getLatestRadarPath } from '../../utils/weatherUtils';
import { useRainEffect } from '../../utils/useRainEffect';
import { CICLOVIAS_GEOJSON } from '../../data/ciclovias';
import { MOBILIARIO_GEOJSON } from '../../data/mobiliarioData';
import { FloorSelector } from '../MapUI/FloorSelector';
import { isPointInPolygon } from '../../utils/locationUtils';

import {
  MapContainerProps,
  MAX_ZOOM_PER_LAYER,
  MAX_WEATHER_ZOOM,
  MAX_RAINVIEWER_ZOOM,
  TurismoEvent,
  Cluster,
  RoutePoint,
  RouteType,
} from './types';

// ─── Extracted utility modules ────────────────────────────────────────────────
import {
  getAccuracyRadiusAtZoom,
  WAVE_PERIOD_MS,
  WAVE_MIN_RADIUS_PX,
  WAVE_STROKE_WIDTH,
  getUserWaveColor,
} from './utils/markerHelpers';
import { detectSurfaceType, detectSurfaceTypeForBoat } from './utils/surfaceDetection';
import { createSvgIcon } from './utils/svgIcons';
import { applyHillshade } from './utils/hillshade';
import { attachPerformanceWatchdog } from './utils/performanceWatchdog';
import { CAMERA_CONSTRAINTS, applyCameraGate, resetNorthPitch } from './utils/cameraConstraints';
import {
  getBeforeBridgesOrBuildingLayerId,
  getBeforeRoadsOrLabelsLayerId,
  getBeforeRoadsLayerId,
  updateMarkerDomRefs,
} from './utils/mapHelpers';
import {
  NATURE_AREAS_GEOJSON,
  NATURE_AREA_CATEGORIES,
  isNatureAreaCategory,
} from '../../data/natureAreas';
import {
  getNatureAreaPalette,
  NATURE_AREA_MIN_ZOOM,
  NATURE_AREA_FADE_ZOOM,
  NATURE_AREA_FADE_FACTOR,
  NATURE_AREA_OUTLINE_WIDTH,
} from './design/natureAreaStyle';
import { renderBoatFlatMarker, renderBoatMarker } from './markers/render/renderBoatMarkers';
import { renderFlatMarker } from './markers/render/renderFlatMarker';
import { renderLoboMarinoMarker } from './markers/render/renderLoboMarinoMarker';
import { renderHospitalMarker, renderClinicaMarker } from './markers/render/renderHospitalMarker';
import { renderBomberoMarker } from './markers/render/renderBomberoMarker';
import { renderCarabineroMarker } from './markers/render/renderCarabineroMarker';
import { renderCamaraMarker } from './markers/render/renderCamaraMarker';
import { renderUniversityMarker } from './markers/render/renderUniversityMarker';
import {
  renderBenchMarker,
  renderFitnessMarker,
  renderTrashMarker,
  renderWaterMarker,
} from './markers/render/renderFlatGroundMarkers';
import { renderPinMarker } from './markers/render/renderPinMarker';
import { injectMarkerStyles } from './design/markerStyles';
import {
  executeMapLibreGtaVSpawn,
  executeMapLibreGtaVLogout,
  executeSmoothPinFocus,
  hasCameraSpawnedInSession,
  markCameraSpawnedInSession,
  resetCameraSpawnInSession,
} from './camera/cameraAnimationEngine';
import {
  CUSTOM_RENDERER_CATEGORIES,
  getPinDesign,
  isEmergencyCategory,
  isPinlessCategory,
  isToggleClickCategory,
  isUtilityCategory,
  isNoModalCategory,
} from './design/pinDesignSystem';
import { CloudShadows } from './CloudShadows';
import {
  CARTO_VECTOR_STYLE_URL,
  mapStyles,
} from './utils/mapLibreConfig';
import { ROUTE_CHEVRON_ID, ensureRouteChevronImage, ensureDraftRouteMarkerStyles } from './utils/routeDraftHelpers';
import { isClickInsideModalOrInput } from './utils/mapClickGuards';
import { createBuildingLOD } from './utils/buildingLOD';
import { createZonesSync } from './utils/zonesLayer';
import { registerZoneInteractions } from './utils/zoneInteractions';
import { createAestheticsUpdater } from './utils/aesthetics';


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
  showMobiliario = false,
  showWeather = false,
  weatherType = 'precipitation',
  onSaveLocation,
  onSectorPress,
  activeNestedZone,
  activeFloor,
  isMagicWandActive = false,
  onMagicWandSelect,
  navRouteGeojson,
  walkPreviewGeojson,
  isAuthenticated,
  cameraAnimationsEnabled = true,
  isRoutingActive = false,
  routingType,
  draftRoutePoints = [],
  onMapClickForRouting,
  isRouteFinished = false,
  mapDisplayMode = 'turismo',
  controlsTopOffset = 80,
}: MapContainerProps) {
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const pinMarkerRef = useRef<{ marker: maplibregl.Marker; el: HTMLDivElement } | null>(null);
  const prevAuthRef = useRef<boolean | undefined>(undefined);
  const hasSpawnedRef = useRef<boolean>(false);
  const lastCenterTriggerRef = useRef<number>(0);
  const mapReadyRef = useRef<boolean>(false);
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
  const [is3DActive, setIs3DActive] = useState<boolean>(false);
  const [lightweightMode, setLightweightMode] = useState<boolean>(false);
  const [compassVisible, setCompassVisible] = useState<boolean>(false);
  const compassNeedleRef = useRef<HTMLDivElement | null>(null);

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
        body: HTMLDivElement | null;
        stem: HTMLDivElement | null;
        lensContainer: HTMLDivElement | null;
        icon: HTMLDivElement | null;
        flatContainer: HTMLDivElement | null;
        shadowPin: HTMLDivElement | null;
        shadowStem: HTMLDivElement | null;
        puncture: HTMLDivElement | null;
        pedestal: HTMLDivElement | null;
        ripples: NodeListOf<HTMLDivElement> | null;
        storeModal: HTMLDivElement | null;
        notesContainer: HTMLDivElement | null;
        badgeEl: HTMLDivElement | null;
        loboSVG: SVGElement | null;
        boatBody: HTMLDivElement | null;
        wakeContainer: HTMLDivElement | null;
        flatGroundEl?: HTMLElement | null;
        flatMarkerIcon?: HTMLElement | null;
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
  const mapDisplayModeRef = useRef(mapDisplayMode);
  const mapLayerRef = useRef(mapLayer);
  const onZoomChangeRef = useRef(onZoomChange);
  const onMapPinchoRef = useRef(onMapPincho);
  const onMapMoveRef = useRef(onMapMove);
  const isDraggingRef = useRef(false);
  const updateAestheticsRef = useRef<() => void>(() => {});
  const cameraHeatmapKeyRef = useRef<string | null>(null);
  const tileCacheRef = useRef<SatelliteTileCache | null>(null);
  const trafficCacheRef = useRef<TrafficTileCache | null>(null);
  const syncUserLocationRef = useRef<() => void>(() => {});
  const syncTrafficRef = useRef<() => void>(() => {});
  const syncWeatherRef = useRef<() => void>(() => {});
  const syncZonesRef = useRef<() => void>(() => {});
  const syncCyclewaysRef = useRef<() => void>(() => {});
  const syncClustersRef = useRef<() => void>(() => {});
  const syncEventPolygonsRef = useRef<() => void>(() => {});
  // Último array `events` subido a 'event-polygons-source': evita re-subir
  // el GeoJSON en cada pan/zoom/selección cuando los datos no cambiaron.
  const polygonEventsUploadedRef = useRef<TurismoEvent[] | null>(null);
  // Firma (tema + resaltado + categorías) aplicada a la capa natural.
  const natureAreasKeyRef = useRef<string>('');
  const sync3DBuildingsRef = useRef<() => void>(() => {});
  const lastZonePatternPitchTRef = useRef<number>(-1);
  const activeParkIdRef = useRef<string | null>(null);
  // Refs de gestos de cámara: permiten adaptar el grace period de eliminación
  // de marcadores y omitir el queryRenderedFeatures de oclusión cuando el
  // gesto en curso lo hace innecesariamente costoso.
  const isPitchingRef = useRef<boolean>(false);
  const isZoomingRef = useRef<boolean>(false);   // Durante scroll/zoom: sin grace period (LOD intencionado)
  const isRotatingRef = useRef<boolean>(false);  // Durante rotación: grace corto (150ms)
  const isMovingRef = useRef<boolean>(false);    // Durante arrastre/paneo: preserva visibilidad sin parpadeos

  const sectorsDataRef = useRef(sectorsData);
  const visibleSectorIdsRef = useRef(visibleSectorIds);
  const showSectorsRef = useRef(showSectors);

  // Social Geo-Router Refs
  const isRoutingActiveRef = useRef(isRoutingActive);
  const onMapClickForRoutingRef = useRef(onMapClickForRouting);
  const draftRoutePointsRef = useRef(draftRoutePoints);
  const routingTypeRef = useRef(routingType);
  const isRouteFinishedRef = useRef(isRouteFinished);
  const cameraAnimationsEnabledRef = useRef(cameraAnimationsEnabled);
  const isGtaVRunningRef = useRef(false);
  interface DraftRouteMarkerItem {
    marker: maplibregl.Marker;
    el: HTMLDivElement;
    bodyEl: HTMLDivElement;
    pillEl: HTMLDivElement;
    pulseEl: HTMLDivElement;
    role: 'origin' | 'destination' | 'waypoint';
  }
  const draftRouteMarkersRef = useRef<DraftRouteMarkerItem[]>([]);
  const syncDraftRouteRef = useRef<() => void>(() => {});

  useEffect(() => {
    isRoutingActiveRef.current = isRoutingActive;
    onMapClickForRoutingRef.current = onMapClickForRouting;
    draftRoutePointsRef.current = draftRoutePoints;
    routingTypeRef.current = routingType;
    isRouteFinishedRef.current = isRouteFinished;
  }, [isRoutingActive, onMapClickForRouting, draftRoutePoints, routingType, isRouteFinished]);

  // Cambiar cursor a cruz (crosshair) cuando el trazador de ruta está activo
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    try {
      const canvas = map.getCanvas();
      if (canvas) {
        canvas.style.cursor = isRoutingActive ? 'crosshair' : '';
      }
    } catch {}
  }, [isRoutingActive]);

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
    mapDisplayModeRef.current = mapDisplayMode;
    mapLayerRef.current = mapLayer;
    onZoomChangeRef.current = onZoomChange;
    onMapPinchoRef.current = onMapPincho;
    onMapMoveRef.current = onMapMove;
    latestUserLocationRef.current = userLocation;
    onSectorPressRef.current = onSectorPress;
    activeNestedZoneRef.current = activeNestedZone;
    cameraAnimationsEnabledRef.current = cameraAnimationsEnabled;

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
    cameraAnimationsEnabled,
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
          applyCameraGate(m);
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
      applyCameraGate(map);
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
    if (map.getLayer('zones-reserva-pattern')) {
      map.setLayoutProperty('zones-reserva-pattern', 'visibility', visibility);
    }
    if (map.getLayer('zones-reserva-flat-fallback')) {
      map.setLayoutProperty('zones-reserva-flat-fallback', 'visibility', visibility);
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
    const initialPitch = initialLayer === '3d' ? CAMERA_CONSTRAINTS.pitch3D : 0;
    const initialBearing = initialLayer === '3d' ? CAMERA_CONSTRAINTS.bearing3D : 0;
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
      pitch: initialPitch,
      bearing: initialBearing,
      maxZoom: initialMaxZoom,
      maxPitch: CAMERA_CONSTRAINTS.maxPitch,
      attributionControl: false,
      transformRequest: (url: string) => {
        const cartoKey =
          CARTO_API_KEY ||
          process.env.EXPO_PUBLIC_CARTO_API_KEY ||
          process.env.CARTO_API_KEY ||
          '';

        if (cartoKey && (url.includes('basemaps.cartocdn.com') || url.includes('carto.com'))) {
          if (!url.includes('api_key=') && !url.includes('key=')) {
            const separator = url.includes('?') ? '&' : '?';
            return {
              url: `${url}${separator}api_key=${cartoKey}`,
            };
          }
        }
        return { url };
      },
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

    const buildingLOD = createBuildingLOD({
      map,
      getMap: () => mapRef.current,
      getLayerMode: () => mapLayerRef.current,
    });
    sync3DBuildingsRef.current = buildingLOD.sync3DBuildings;

    map.on('load', () => {
      mapReadyRef.current = true;
      const center = map.getCenter();
      lastStableCenter = { lat: center.lat, lng: center.lng };
      lastStableZoom = map.getZoom();
      setCurrentBounds(getStableBounds());

      // Comprobar spawn inicial si el usuario ya está autenticado con ubicación
      if (isAuthenticated) {
        const targetLoc = latestUserLocationRef.current || userLocation;
        if (targetLoc && !hasSpawnedRef.current) {
          hasSpawnedRef.current = true;
          prevAuthRef.current = true;
          const alreadySpawned = hasCameraSpawnedInSession();
          executeMapLibreGtaVSpawn(map, targetLoc, !alreadySpawned && cameraAnimationsEnabled);
          markCameraSpawnedInSession();
        }
      } else {
        prevAuthRef.current = false;
      }

      // Silenciar POIs estáticos del mapa base (OpenFreeMap / OpenMapTiles)
      hideBaseMapPOIs(map);

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

      // Edificios 3D ('building-3d') deben dibujarse DESPUÉS (encima) de estos
      // marcadores nativos para que la extrusión los oculte de verdad — un
      // circle/symbol layer de MapLibre no hace depth-test contra fill-extrusion,
      // solo respeta orden de pintado. Insertarlos antes de 'building-3d' logra
      // la oclusión sin tocar el estilo base.
      const buildingBeforeId = map.getLayer('building-3d') ? 'building-3d' : undefined;

      if (!map.getSource('mobiliario-source')) {
        map.addSource('mobiliario-source', {
          type: 'geojson',
          data: MOBILIARIO_GEOJSON as any,
        });
        map.addLayer(
          {
            id: 'mobiliario-layer',
            type: 'symbol',
            source: 'mobiliario-source',
            minzoom: 15,
            layout: {
              'icon-image': ['get', 'amenity'],
              'icon-size': 0.8,
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
              visibility: showMobiliario ? 'visible' : 'none',
            },
            paint: {
              'icon-opacity': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.5, 1],
            },
          },
          buildingBeforeId,
        );
      }

      // ── Native Cluster Layers (rendered on WebGL canvas, not DOM) ──
      if (!map.getSource('clusters-source')) {
        map.addSource('clusters-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });

        // Circle background layer - pitch-aligned to map surface
        // Micro-dots semánticos (sin clusters numéricos): un punto por evento en su coordenada real.
        map.addLayer(
          {
            id: 'cluster-circles',
            type: 'circle',
            source: 'clusters-source',
            paint: MICRODOT_PAINT as any,
          },
          buildingBeforeId,
        );
      }

      // Micro-dots tocables: caja de 52x52px (hit target expandido) y gana el de mayor priority_rank.
      map.on('click', (e) => {
        if ((e.originalEvent as any)._turismoHandled) return;
        if (!map.getLayer('cluster-circles')) return;
        const hit = pickTopPriority(
          map.queryRenderedFeatures(pinHitBox(e.point.x, e.point.y), { layers: ['cluster-circles'] }),
        );
        const hitId = hit?.properties?.id;
        if (!hitId || isClickInsideModalOrInput(e)) return;
        if (isRoutingActiveRef.current && onMapClickForRoutingRef.current) return;
        const event = eventsRef.current.find((ev) => ev.id === hitId);
        if (event && onSelectEventRef.current) {
          (e.originalEvent as any)._turismoHandled = true;
          onSelectEventRef.current(event);
        }
      });
      map.on('mousemove', (e) => {
        if (!map.getLayer('cluster-circles')) return;
        const over = map.queryRenderedFeatures(pinHitBox(e.point.x, e.point.y), {
          layers: ['cluster-circles'],
        }).length;
        map.getCanvas().style.cursor = over ? 'pointer' : '';
      });

      if (sync3DBuildingsRef.current) {
        sync3DBuildingsRef.current();
      }
    });
    let moveSettleTimer: ReturnType<typeof setTimeout> | null = null;
    map.on('moveend', () => {
      debouncedUpdateBounds();
      if (moveSettleTimer) clearTimeout(moveSettleTimer);
      moveSettleTimer = setTimeout(() => {
        isMovingRef.current = false;
        isDraggingRef.current = false;
        // Solo cuando la cámara se detuvo completamente, corremos la estética
        // para resolver la oclusión 3D real de edificios en reposo.
        if (updateAestheticsRef.current) updateAestheticsRef.current();
      }, 140);
    });
    map.on('zoomend', debouncedUpdateBounds);
    map.on('pitch', () => {
      const next3D = map.getPitch() > 25;
      // Solo disparar re-render si el estado 3D realmente cambió
      setIs3DActive((prev) => (prev !== next3D ? next3D : prev));
      isPitchingRef.current = true;
    });

    // Restablecer flag de pitch cuando el gesto termina; pequeño delay de asentamiento
    // para evitar que un último queryRenderedFeatures dispare antes de que los tiles terminen.
    let pitchSettleTimer: ReturnType<typeof setTimeout> | null = null;
    map.on('pitchend', () => {
      if (pitchSettleTimer) clearTimeout(pitchSettleTimer);
      pitchSettleTimer = setTimeout(() => {
        isPitchingRef.current = false;
        // Forzar un re-chequeo de oclusión ahora que la cámara está quieta
        if (updateAestheticsRef.current) updateAestheticsRef.current();
      }, 120);
    });

    // Estilos y animaciones de marcadores: design/markerStyles.ts
    injectMarkerStyles();

    // Agregar atribución compacta de forma segura en la esquina inferior izquierda
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

    const updateAesthetics = createAestheticsUpdater(map, {
      activeParkIdRef,
      isDraggingRef,
      isMovingRef,
      isPitchingRef,
      isRotatingRef,
      isZoomingRef,
      lastZonePatternPitchTRef,
      markersRef,
      mapLayerRef,
      onSaveLocationRef,
      onSelectEventRef,
      selectedEventRef,
      userAccuracyRef,
      updateAestheticsRef,
    });
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
    map.on('movestart', () => {
      closeHoverTooltips();
      isMovingRef.current = true;
    });

    // Close tooltips when user starts rotating map
    map.on('rotatestart', () => {
      closeHoverTooltips();
      isRotatingRef.current = true;
    });
    let rotateSettleTimer: ReturnType<typeof setTimeout> | null = null;
    map.on('rotateend', () => {
      if (rotateSettleTimer) clearTimeout(rotateSettleTimer);
      rotateSettleTimer = setTimeout(() => {
        isRotatingRef.current = false;
        if (updateAestheticsRef.current) updateAestheticsRef.current();
      }, 120);
    });

    // Close tooltips when user starts changing pitch (3D tilt)
    map.on('pitchstart', closeHoverTooltips);

    // Watchdog: degrada a 2D liviano si el dispositivo no sostiene el framerate
    const detachWatchdog = attachPerformanceWatchdog(map, (reason) => {
      console.info('[perf] modo liviano 2D activado:', reason);
      setIs3DActive(false);
      setLightweightMode(true);
    });

    // Gate de cámara: 2D norte-arriba bajo minZoomForPitchAndRotate
    applyCameraGate(map);
    let lastGateZoom = map.getZoom();
    map.on('zoomend', () => {
      applyCameraGate(map);
      const z = map.getZoom();
      const crossedDown =
        lastGateZoom >= CAMERA_CONSTRAINTS.resetBelowZoom && z < CAMERA_CONSTRAINTS.resetBelowZoom;
      lastGateZoom = z;
      if (crossedDown && (map.getPitch() !== 0 || map.getBearing() !== 0)) {
        resetNorthPitch(map, CAMERA_CONSTRAINTS.resetDurationMs);
      }
    });

    // Brújula reactiva: visible sólo con bearing/pitch no triviales
    const syncCompass = () => {
      const bearing = map.getBearing();
      const visible =
        Math.abs(bearing) > CAMERA_CONSTRAINTS.compassBearingThresholdDeg ||
        map.getPitch() > CAMERA_CONSTRAINTS.compassPitchThresholdDeg;
      if (compassNeedleRef.current) {
        compassNeedleRef.current.style.transform = `rotate(${-bearing}deg)`;
      }
      setCompassVisible((prev) => (prev !== visible ? visible : prev));
    };
    map.on('rotate', syncCompass);
    map.on('pitch', syncCompass);
    syncCompass();

    map.on('zoomstart', () => {
      isZoomingRef.current = true;
      if (onMapMoveRef.current) {
        onMapMoveRef.current();
      }
    });
    map.on('zoomend', () => {
      // Pequeño delay para asentamiento del zoom antes de reanudar el grace period
      setTimeout(() => { isZoomingRef.current = false; }, 60);
    });

    map.on('style.load', () => {
      // Silenciar POIs estáticos del mapa base tras cambio de estilo
      hideBaseMapPOIs(map);
      if (mapLayerRef.current === 'dark') {
        applyDarkTheme(map);
      }
      applyRiverStyling(map, mapLayerRef.current === 'dark');
      applyHillshade(map, mapLayerRef.current, mapLayerRef.current === 'dark');
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
      if (syncEventPolygonsRef.current) {
        syncEventPolygonsRef.current();
      }
      if (syncCyclewaysRef.current) {
        syncCyclewaysRef.current();
      }
      if (syncDraftRouteRef.current) {
        syncDraftRouteRef.current();
      }

      // Re-add cluster source+layers after style change
      if (!map.getSource('clusters-source')) {
        map.addSource('clusters-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        const reloadBuildingBeforeId = map.getLayer('building-3d') ? 'building-3d' : undefined;
        // Micro-dots semánticos (sin clusters numéricos): un punto por evento en su coordenada real.
        map.addLayer(
          {
            id: 'cluster-circles',
            type: 'circle',
            source: 'clusters-source',
            paint: MICRODOT_PAINT as any,
          },
          reloadBuildingBeforeId,
        );
      }
      // Immediately sync cluster data after style reload
      if (syncClustersRef.current) {
        syncClustersRef.current();
      }
      if (sync3DBuildingsRef.current) {
        sync3DBuildingsRef.current();
      }
    });

    const syncZones = createZonesSync({
      getMap: () => mapRef.current,
      getSectors: () => sectorsDataRef.current,
      getVisibleSectorIds: () => visibleSectorIdsRef.current,
      getLayerMode: () => mapLayerRef.current,
      getShowSectors: () => showSectorsRef.current,
    });
    syncZonesRef.current = syncZones;

    registerZoneInteractions(map, {
      activeParkIdRef,
      eventsRef,
      isRoutingActiveRef,
      markersRef,
      onMapClickForRoutingRef,
      onSectorPressRef,
      onSelectEventRef,
      selectedEventRef,
      syncEventPolygonsRef,
      updateAestheticsRef,
    });

    // Deselect when clicking on empty map (or intercept for magic wand / routing)
    map.on('click', (e) => {
      if ((e.originalEvent as any)._turismoHandled) return;
      if (isClickInsideModalOrInput(e)) return;

      if (isRoutingActiveRef.current && onMapClickForRoutingRef.current) {
        // Comprobar si el clic cayó sobre o muy cerca (<= 28px de pantalla) de un negocio/evento
        let hitEvent: any = null;
        let minPixelDist = 28;

        const clickPoint = e.point;
        if (eventsRef.current && eventsRef.current.length > 0) {
          for (const ev of eventsRef.current) {
            const evScreenPoint = map.project([ev.longitude, ev.latitude]);
            const dx = clickPoint.x - evScreenPoint.x;
            const dy = clickPoint.y - evScreenPoint.y;
            const distPx = Math.sqrt(dx * dx + dy * dy);
            if (distPx < minPixelDist) {
              minPixelDist = distPx;
              hitEvent = ev;
            }
          }
        }

        onMapClickForRoutingRef.current({
          latitude: hitEvent ? hitEvent.latitude : e.lngLat.lat,
          longitude: hitEvent ? hitEvent.longitude : e.lngLat.lng,
          name: hitEvent?.title,
          businessId: hitEvent?.businessId,
          eventId: hitEvent?.id,
          category: hitEvent?.category,
        });
        return;
      }

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

      // ── Comprobar si el clic cayó sobre un parque o zona de reserva ─────────────
      const polyLayers = ['event-polygons-fill', 'nature-areas-fill'].filter((l) =>
        map.getLayer(l),
      );

      let hitPolygonEvent: TurismoEvent | null = null;
      if (polyLayers.length > 0) {
        const polyHits = map.queryRenderedFeatures(e.point, { layers: polyLayers });
        // Agua/humedales sin nombre son sólo contexto visual: no abren nada.
        const hit = polyHits?.find((f) => f.properties?.interactive !== false);
        if (hit) {
          const fid = hit.properties?.id;
          hitPolygonEvent = eventsRef.current.find((ev) => ev.id === fid) ?? null;
        }
      }

      // Comprobación matemática exacta (punto-en-polígono) como respaldo
      if (!hitPolygonEvent) {
        hitPolygonEvent =
          eventsRef.current.find((ev) => {
            if (!ev.polygon || ev.polygon.length < 3) return false;
            const cat = ev.category?.toLowerCase() || '';
            if (
              cat !== 'parque' &&
              cat !== 'reserva' &&
              cat !== 'reservas' &&
              cat !== 'naturaleza'
            ) {
              return false;
            }
            return isPointInPolygon(
              { latitude: e.lngLat.lat, longitude: e.lngLat.lng },
              ev.polygon,
            );
          }) ?? null;
      }

      if (hitPolygonEvent) {
        (e.originalEvent as any)._turismoHandled = true;
        activeParkIdRef.current = hitPolygonEvent.id;
        if (onSelectEventRef.current) {
          onSelectEventRef.current(hitPolygonEvent);
        }
        return;
      }

      // Si el clic fue en terreno completamente vacío (fuera de parques y pines), deseleccionar
      activeParkIdRef.current = null;
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
      detachWatchdog();
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
        buildingLOD.dispose();
        if (aestheticsRafId !== null) cancelAnimationFrame(aestheticsRafId);
        if (boundsTimer) clearTimeout(boundsTimer);
        map.remove();
      }
      mapReadyRef.current = false;
      mapRef.current = null;
    };
  }, []);

  // Ejecutar sincronización de zonas cuando cambien los datos externos o IDs visibles
  useEffect(() => {
    if (syncZonesRef.current) {
      syncZonesRef.current();
    }
  }, [sectorsData, visibleSectorIds]);

  // Parque o zona de reserva activa seleccionada
  const activeParkId = useMemo(() => {
    if (mapDisplayMode !== 'turismo') return null;
    if (!selectedEvent) return null;
    const cat = selectedEvent.category?.toLowerCase() || '';
    if (cat === 'parque' || cat === 'reserva' || cat === 'reservas' || cat === 'naturaleza') {
      return selectedEvent.id;
    }
    if (selectedEvent.parkId) {
      return selectedEvent.parkId;
    }
    return null;
  }, [selectedEvent, mapDisplayMode]);

  activeParkIdRef.current = activeParkId;

  // Sync Markers and Data
  const clusteredItems = useSuperclusterEvents(
    events,
    zoom,
    currentBounds,
    selectedEvent?.id,
    activeParkId,
  );

  // Categorías naturales activas según los filtros (agua/humedal/parque).
  // Sólo cambia cuando cambian los filtros, no al hacer pan/zoom.
  const visibleNatureCategories = useMemo(() => {
    const present = new Set<string>();
    for (const e of events) {
      if (isNatureAreaCategory(e.category)) present.add(e.category);
    }
    return NATURE_AREA_CATEGORIES.filter((c) => present.has(c));
  }, [events]);

  // Capa de contexto natural: fuente estática (se sube una sola vez por
  // estilo) + 2 capas planas. Selección, tema y filtros se resuelven con
  // setPaintProperty/setFilter, que no re-tilean nada.
  const syncNatureAreas = (map: MapLibreMap) => {
    const palette = getNatureAreaPalette(mapLayerRef.current);
    const highlightId = activeParkIdRef.current ?? selectedEventRef.current?.id ?? '';
    const isHighlighted = ['==', ['get', 'id'], highlightId];
    const restOpacity = [
      'match',
      ['get', 'category'],
      'agua',
      palette.restOpacity.agua,
      'humedal',
      palette.restOpacity.humedal,
      palette.restOpacity.parque,
    ];
    const fillColor = [
      'match',
      ['get', 'category'],
      'agua',
      palette.color.agua,
      'humedal',
      palette.color.humedal,
      palette.color.parque,
    ];
    // Fade-in a escala de barrio y atenuación a escala de calle; el área
    // resaltada se mantiene visible a cualquier zoom.
    const fillOpacity = [
      'interpolate',
      ['linear'],
      ['zoom'],
      NATURE_AREA_MIN_ZOOM - 0.5,
      ['case', isHighlighted, palette.selectedOpacity, 0],
      NATURE_AREA_MIN_ZOOM + 0.5,
      ['case', isHighlighted, palette.selectedOpacity, restOpacity],
      NATURE_AREA_FADE_ZOOM - 1,
      ['case', isHighlighted, palette.selectedOpacity, restOpacity],
      NATURE_AREA_FADE_ZOOM + 1,
      ['case', isHighlighted, palette.selectedOpacity, ['*', restOpacity, NATURE_AREA_FADE_FACTOR]],
    ];
    const categoryFilter = ['in', ['get', 'category'], ['literal', visibleNatureCategories]];
    const outlineFilter = ['==', ['get', 'id'], highlightId];

    if (!map.getSource('nature-areas-source')) {
      map.addSource('nature-areas-source', {
        type: 'geojson',
        data: NATURE_AREAS_GEOJSON as any,
        // Simplificación por tile algo más agresiva que el default (0.375):
        // son tintes de fondo, no necesitan precisión sub-píxel.
        tolerance: 0.75,
      });
      const beforeId = getBeforeRoadsLayerId(map);
      map.addLayer(
        {
          id: 'nature-areas-fill',
          type: 'fill',
          source: 'nature-areas-source',
          filter: categoryFilter as any,
          paint: {
            'fill-color': fillColor as any,
            'fill-opacity': fillOpacity as any,
            'fill-antialias': false,
          },
        },
        beforeId,
      );
      map.addLayer(
        {
          id: 'nature-areas-outline',
          type: 'line',
          source: 'nature-areas-source',
          filter: outlineFilter as any,
          layout: { 'line-join': 'round' },
          paint: {
            'line-color': fillColor as any,
            'line-width': NATURE_AREA_OUTLINE_WIDTH,
            'line-opacity': 0.9,
          },
        },
        beforeId,
      );

      // Cursor de mano sólo sobre áreas que abren información al tocarlas.
      if (!(map as any)._nature_bound) {
        (map as any)._nature_bound = true;
        map.on('mousemove', 'nature-areas-fill', (e) => {
          const interactive = e.features?.some((f) => f.properties?.interactive === true);
          map.getCanvas().style.cursor = interactive ? 'pointer' : '';
        });
        map.on('mouseleave', 'nature-areas-fill', () => {
          map.getCanvas().style.cursor = '';
        });
      }
      natureAreasKeyRef.current = '';
    }

    const key = `${mapLayerRef.current}|${highlightId}|${visibleNatureCategories.join(',')}`;
    if (key === natureAreasKeyRef.current) return;
    natureAreasKeyRef.current = key;

    map.setFilter('nature-areas-fill', categoryFilter as any);
    map.setFilter('nature-areas-outline', outlineFilter as any);
    map.setPaintProperty('nature-areas-fill', 'fill-color', fillColor);
    map.setPaintProperty('nature-areas-fill', 'fill-opacity', fillOpacity);
    map.setPaintProperty('nature-areas-outline', 'line-color', fillColor);
  };

  const syncEventPolygons = () => {
    const map = mapRef.current;
    if (!map || typeof map.isStyleLoaded !== 'function' || !map.isStyleLoaded()) return;

    syncNatureAreas(map);

    const highlightId = activeParkIdRef.current ?? selectedEventRef.current?.id ?? '';
    const selectedId = selectedEventRef.current?.id ?? '';

    // Polígonos de eventos (edificios, universidades, …). Las áreas
    // naturales viven en su propia capa estática (syncNatureAreas).
    const buildPolygonEventsCollection = () => ({
      type: 'FeatureCollection',
      features: events
        .filter((e) => e.polygon && e.polygon.length > 0 && !isNatureAreaCategory(e.category))
        .map((e) => ({
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
    });

    const fillOpacity = ['case', ['==', ['get', 'id'], selectedId], 0.35, 0.01];
    const outlineOpacity = ['case', ['==', ['get', 'id'], highlightId], 0.85, 0];
    const outlineWidth = ['case', ['==', ['get', 'id'], highlightId], 2.5, 1];

    const source = map.getSource('event-polygons-source') as maplibregl.GeoJSONSource | undefined;
    if (source) {
      if (polygonEventsUploadedRef.current !== events) {
        polygonEventsUploadedRef.current = events;
        source.setData(buildPolygonEventsCollection() as any);
      }
      if (map.getLayer('event-polygons-fill')) {
        map.setPaintProperty('event-polygons-fill', 'fill-opacity', fillOpacity);
        map.setPaintProperty('event-polygons-outline', 'line-opacity', outlineOpacity);
        map.setPaintProperty('event-polygons-outline', 'line-width', outlineWidth);
      }
      return;
    }

    polygonEventsUploadedRef.current = events;
    map.addSource('event-polygons-source', {
      type: 'geojson',
      data: buildPolygonEventsCollection() as any,
    });

    // Bajo puentes y bajo 'building-3d': MapLibre pinta por orden de capas
    // (painter's algorithm), no por profundidad real, así que un fill 2D
    // insertado por encima de un puente o de la extrusión de un edificio
    // siempre se ve, sin importar la geometría real de esas estructuras.
    const beforeId = getBeforeBridgesOrBuildingLayerId(map);

    map.addLayer(
      {
        id: 'event-polygons-fill',
        type: 'fill',
        source: 'event-polygons-source',
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': fillOpacity as any,
        },
      },
      beforeId,
    );

    // Borde exterior (sólo para el evento seleccionado)
    map.addLayer(
      {
        id: 'event-polygons-outline',
        type: 'line',
        source: 'event-polygons-source',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': outlineWidth as any,
          'line-opacity': outlineOpacity as any,
        },
      },
      beforeId,
    );
  };

  syncEventPolygonsRef.current = syncEventPolygons;

  const syncCameraHeatmap = () => {
    const map = mapRef.current;
    if (!map || typeof map.isStyleLoaded !== 'function' || !map.isStyleLoaded()) return;

    const cameraEvents = events.filter((e) => e.category && e.category.toLowerCase() === 'camara');

    // sync() corre en cada tick de zoom; re-subir el GeoJSON sólo si cambió el
    // set de cámaras (p. ej. al activar/desactivar la capa) o si un cambio de
    // estilo se llevó la fuente.
    const heatmapKey = cameraEvents.map((e) => e.id).join(',');
    if (map.getSource('camera-heatmap-source') && cameraHeatmapKeyRef.current === heatmapKey) {
      return;
    }
    cameraHeatmapKeyRef.current = heatmapKey;

    const featureCollection = {
      type: 'FeatureCollection',
      features: cameraEvents.map((e) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [e.longitude, e.latitude],
        },
        properties: {
          weight: 1,
        },
      })),
    };

    if (map.getSource('camera-heatmap-source')) {
      (map.getSource('camera-heatmap-source') as maplibregl.GeoJSONSource).setData(
        featureCollection as any,
      );
    } else {
      map.addSource('camera-heatmap-source', {
        type: 'geojson',
        data: featureCollection as any,
      });

      // Bajo 'building-3d' para que un edificio en cámara tape el resplandor,
      // en vez de dibujarse siempre encima de la extrusión.
      const beforeId = map.getLayer('building-3d')
        ? 'building-3d'
        : getBeforeRoadsOrLabelsLayerId(map);

      map.addLayer(
        {
          id: 'camera-heatmap-layer',
          type: 'heatmap',
          source: 'camera-heatmap-source',
          // Vista de conjunto ("zonas vigiladas") hasta que aparecen los pines;
          // a escala ciudad no aporta y sólo ensucia el mapa.
          minzoom: 12,
          maxzoom: CAMERA_PIN_MIN_ZOOM + 0.5,
          paint: {
            'heatmap-weight': 1,
            'heatmap-intensity': [
              'interpolate',
              ['linear'],
              ['zoom'],
              12,
              1,
              CAMERA_PIN_MIN_ZOOM,
              2.5,
            ],
            'heatmap-color': [
              'interpolate',
              ['linear'],
              ['heatmap-density'],
              0,
              'rgba(59, 130, 246, 0)',
              0.2,
              'rgba(96, 165, 250, 0.4)',
              0.4,
              'rgba(147, 197, 253, 0.6)',
              0.6,
              'rgba(167, 139, 250, 0.7)',
              0.8,
              'rgba(139, 92, 246, 0.8)',
              1,
              'rgba(124, 58, 237, 0.85)', // Purple/Blue neon for surveillance
            ],
            'heatmap-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              12,
              18,
              CAMERA_PIN_MIN_ZOOM,
              50,
            ],
            // Se desvanece justo cuando entran los pines: antes seguía visible
            // hasta z18 y se dibujaba por debajo de los pines ya renderizados.
            'heatmap-opacity': [
              'interpolate',
              ['linear'],
              ['zoom'],
              12,
              0,
              13,
              0.6,
              CAMERA_PIN_MIN_ZOOM - 0.7,
              0.6,
              CAMERA_PIN_MIN_ZOOM,
              0,
            ],
          },
        },
        beforeId,
      );
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
    const clusterFeatures = microdotFeatures(
      clusterItems.flatMap((c) => c.events),
      (ev) => getCategoryColor(ev.category, ev.musicStyle),
    );

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

    // ── Eliminación diferida adaptativa ─────────────────────────────────────
    // El grace period varía según el gesto de cámara activo:
    //   • Zoom (rueda scroll) → eliminación inmediata.
    //     Los cambios de LOD son intencionados; no tiene sentido diferir.
    //   • Rotación            → 150ms + animación de salida.
    //     Pequeño bounce de bounds al terminar la rotación.
    //   • Pitch / Pan         → 350ms + animación de salida.
    //     El bounds puede oscilar mientras se asienta la cámara inclinada.
    //
    // En todos los casos con grace > 0, se aplica 'pin-dismiss' (CSS) al
    // pinEl ANTES de ocultarlo para que el usuario vea una transición suave
    // en vez de una desaparición instantánea.
    const graceMs = isZoomingRef.current ? 0
                  : isRotatingRef.current ? 150
                  : isDraggingRef.current || isMovingRef.current ? 500
                  : 350;

    const dismissMarker = (markerObj: typeof markersRef.current[string]) => {
      // Animación de salida visible antes de ocultar
      markerObj.pinEl.classList.remove('pin-enter');
      markerObj.pinEl.classList.add('pin-dismiss');
      // Quitar interactividad de inmediato
      markerObj.pinEl.style.pointerEvents = 'none';
      if (markerObj.flatEl) markerObj.flatEl.style.pointerEvents = 'none';
    };

    const removeMarkerNow = (id: string) => {
      const obj = markersRef.current[id];
      if (!obj) return;
      obj.pinMarker.remove();
      if (obj.flatMarker) obj.flatMarker.remove();
      if ((obj as any).unsubRegistry) (obj as any).unsubRegistry();
      delete markersRef.current[id];
    };

    Object.keys(markersRef.current).forEach((id) => {
      if (!newMarkerIds.has(id)) {
        const markerObj = markersRef.current[id];
        // Si ya hay un timer de remoción pendiente, no resetear
        if ((markerObj as any)._removalTimer) return;

        if (graceMs === 0) {
          // Zoom: eliminar del DOM directamente (sin animación, sin delay)
          markerObj.pinEl.style.visibility = 'hidden';
          removeMarkerNow(id);
        } else {
          // Pitch / Rotate / Pan: animación de salida + eliminación diferida
          dismissMarker(markerObj);

          (markerObj as any)._removalTimer = setTimeout(() => {
            if (!markersRef.current[id]) return;
            // Asegurar que la animación terminó y ocultamos antes de destruir
            markersRef.current[id].pinEl.style.visibility = 'hidden';
            removeMarkerNow(id);
          }, graceMs);
        }
      }
    });

    /**
     * Pinta el contenido de un marcador según su categoría.
     * Único punto de despacho: creación y re-render comparten camino.
     */
    const renderMarkerContent = (
      pinEl: HTMLDivElement,
      flatEl: HTMLDivElement | undefined,
      event: TurismoEvent,
      isSelected: boolean,
      color: string,
      iconName: string,
      isEmergencyState: boolean,
      isNew: boolean,
    ) => {
      const cat = event.category?.toLowerCase() || '';
      switch (cat) {
        case 'embarcacion':
          if (flatEl) renderBoatFlatMarker(flatEl, event);
          renderBoatMarker(pinEl, event, isSelected);
          break;
        case 'fauna':
          renderLoboMarinoMarker(pinEl, event, isSelected, mapLayer);
          break;
        case 'hospital':
          renderHospitalMarker(pinEl, event, isSelected, mapLayer);
          break;
        case 'clinica':
          renderClinicaMarker(pinEl, event, isSelected, mapLayer);
          break;
        case 'universidad':
          renderUniversityMarker(pinEl, event, isSelected, mapLayer);
          break;
        case 'bombero':
          renderBomberoMarker(pinEl, event, isSelected, mapLayer);
          break;
        case 'carabinero':
          renderCarabineroMarker(pinEl, event, isSelected, mapLayer);
          break;
        case 'camara':
          renderCamaraMarker(pinEl, event, isSelected, mapLayer);
          break;
        case 'banca':
        case 'silla':
          renderBenchMarker(pinEl, event, isSelected, mapLayer);
          break;
        case 'basurero':
        case 'papelera':
          renderTrashMarker(pinEl, event, isSelected, mapLayer);
          break;
        case 'bebedero':
        case 'fuente':
        case 'fuente_agua':
        case 'drinking_water':
          renderWaterMarker(pinEl, event, isSelected, mapLayer);
          break;
        case 'maquina_ejercicio':
        case 'ejercicio':
          renderFitnessMarker(pinEl, event, isSelected, mapLayer);
          break;
        default:
          if (flatEl) renderFlatMarker(flatEl, event, color, isEmergencyState, mapLayer);
          renderPinMarker(
            pinEl,
            event,
            color,
            iconName,
            isEmergencyState,
            isSelected,
            mapLayer,
            isNew,
          );
          break;
      }
    };

    // Add or update markers
    // Add or update non-cluster markers only (clusters are handled via native layers above)
    nonClusterItems.forEach((item) => {
      const event = item as TurismoEvent;
      const isSelected = selectedEvent?.id === event.id;
      const color = getCategoryColor(event.category, event.musicStyle);
      const iconName = getCategoryIcon(event.category, event.musicStyle);
      const isEmergencyState = isEmergencyCategory(event.category);
      // Firma del render: si no cambia, no vale la pena reconstruir el DOM
      // (además reiniciaría las animaciones ambientales en cada zoom).
      // Sólo los markers con renderer propio dependen de `isSelected` en su
      // DOM; en los genéricos la selección la resuelve updateAesthetics.
      const selectionAffectsDom = CUSTOM_RENDERER_CATEGORIES.includes(
        event.category?.toLowerCase() || '',
      );
      const renderKey = [
        event.category,
        mapLayer,
        selectionAffectsDom && isSelected ? 'sel' : '',
        event.vineta?.type || '',
        event.vineta?.label || '',
      ].join('|');

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
          opacityWhenCovered: 0, // Se oculta detrás de edificios 3D
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
        if (catLower === 'embarcacion') {
          let w = 24;
          if (event.boatSize === 'grande') w = 32;
          else if (event.boatSize === 'mediana') w = 28;
          pinEl.style.width = `${w}px`;
          pinEl.style.height = `${w}px`;
        } else if (isUtilityCategory(catLower)) {
          pinEl.style.width = '28px';
          pinEl.style.height = '28px';
        } else if (isPinlessCategory(catLower)) {
          pinEl.style.width = '0px';
          pinEl.style.height = '0px';
        } else {
          // El tamaño lo dicta el design system, no una lista paralela
          const boxSize = getPinDesign(event, mapLayer).size;
          pinEl.style.width = `${boxSize}px`;
          pinEl.style.height = `${boxSize}px`;
        }

        pinEl.dataset.hovered = 'false';
        pinEl.dataset.category = event.category;

        // Animación de despliegue desde el punto de anclaje al mapa.
        // Solo se aplica fuera de zoom (en zoom se crean muchos pines a la vez
        // y la animación escalonada quedaría caótica).
        if (!isZoomingRef.current && !isPinlessCategory(catLower)) {
          pinEl.classList.add('pin-enter');
          // Auto-remover la clase tras la duración de la animación para no
          // interferir con transforms posteriores de updateAesthetics.
          setTimeout(() => { pinEl.classList.remove('pin-enter'); }, 600);
        }

        // A11y: Accesibilidad y teclado
        pinEl.tabIndex = 0;

        const handleOpenMinimodal = () => {
          // Los pines de utilidad no tienen efecto hover ni abren minimodals al pasar el cursor
          if (isUtilityCategory(event.category)) return;

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
          if (isUtilityCategory(event.category)) {
            pinEl.dataset.hovered = 'false';
            return;
          }

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

          // Grupo de cámaras: no es un destino, sólo un atajo para separarlas.
          if (event.cameraGroup) {
            pinEl.dataset.hovered = 'false';
            map.fitBounds(event.cameraGroup.bounds, {
              padding: 80,
              maxZoom: CAMERA_GROUP_MAX_ZOOM,
              duration: cameraAnimationsEnabledRef.current === false ? 0 : 650,
            });
            return;
          }

          if (isRoutingActiveRef.current && onMapClickForRoutingRef.current) {
            onMapClickForRoutingRef.current({
              latitude: event.latitude,
              longitude: event.longitude,
              name: event.title,
              businessId: (event as any)?.businessId,
              eventId: event.id,
              category: event.category,
            });
            return;
          }

          // Pines de utilidad que NO abren modal (banco, fuente de agua, basurero):
          // 1. Quitar cualquier hover residual y foco
          // 2. Vuelo suave y cinemático hacia el pin (sin saltos bruscos)
          // 3. Resaltar localmente el pin sin abrir modal ni ocultar la interfaz
          if (isNoModalCategory(event.category)) {
            pinEl.dataset.hovered = 'false';
            pinEl.blur();

            isGtaVRunningRef.current = true;
            executeSmoothPinFocus(
              map,
              {
                latitude: event.latitude,
                longitude: event.longitude,
                heading: 0,
              },
              cameraAnimationsEnabledRef.current ?? true,
              () => {
                isGtaVRunningRef.current = false;
              },
            );

            // Resaltar visualmente el pin sin abrir ningún modal ni alterar la interfaz
            const isLocal = pinEl.dataset.localSelected === 'true';
            const nextLocal = !isLocal;
            Object.values(markersRef.current).forEach((m) => {
              if (m.pinEl !== pinEl && m.pinEl.dataset.localSelected === 'true') {
                m.pinEl.dataset.localSelected = 'false';
              }
            });
            pinEl.dataset.localSelected = nextLocal ? 'true' : 'false';
            selectedEventRef.current = nextLocal ? event : null;
            if (updateAestheticsRef.current) updateAestheticsRef.current();
            return;
          }

          // Otras utilidades que sí abren modal (ej. estaciones de calistenia / ejercicio):
          if (isUtilityCategory(event.category)) {
            pinEl.dataset.hovered = 'false';
            pinEl.blur();

            isGtaVRunningRef.current = true;
            executeSmoothPinFocus(
              map,
              {
                latitude: event.latitude,
                longitude: event.longitude,
                heading: 0,
              },
              cameraAnimationsEnabledRef.current ?? true,
              () => {
                isGtaVRunningRef.current = false;
              },
            );

            onSelectEventRef.current(event);
            return;
          }

          // `toggle` = el pin fija/suelta su mini-modal in-situ.
          // `full`   = el pin abre la ficha extensa.
          if (isToggleClickCategory(event.category)) {
            const isLocal = pinEl.dataset.localSelected === 'true';
            const nextLocal = !isLocal;
            // Sólo un mini-modal fijado a la vez
            if (nextLocal) {
              Object.values(markersRef.current).forEach((m) => {
                if (isToggleClickCategory(m.event?.category) && m.pinEl !== pinEl) {
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
        const isFlatMarker =
          isBoat ||
          event.isFlat === true ||
          isUtilityCategory(event.category);
        const pinMarker = new maplibregl.Marker({
          element: pinEl,
          pitchAlignment: isFlatMarker ? 'map' : 'viewport',
          rotationAlignment: isFlatMarker ? 'map' : 'viewport',
          anchor: isFlatMarker ? 'center' : 'bottom',
          opacityWhenCovered: isFlatMarker ? 1 : 0, // Los marcadores planos se proyectan al suelo y no deben ser ocultados por WebGL
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

        // Contenido DOM del marcador. Ojo con el orden: los refs se cachean
        // DESPUÉS de pintar, si no quedan todos en null y el sistema 3D
        // (aguja, sombra, viñeta, pedestal) nunca llega a activarse.
        renderMarkerContent(
          pinEl,
          flatEl,
          event,
          isSelected,
          color,
          iconName,
          isEmergencyState,
          true,
        );
        pinEl.dataset.renderKey = renderKey;
        updateMarkerDomRefs(markerObj);
      } else {
        // ── Re-adopción (cancelar remoción diferida si el pin volvió) ────────
        if ((markerObj as any)._removalTimer) {
          clearTimeout((markerObj as any)._removalTimer);
          delete (markerObj as any)._removalTimer;
          // Cancelar animación de salida y restaurar estado visible
          markerObj.pinEl.classList.remove('pin-dismiss');
          markerObj.pinEl.style.visibility = 'visible';
          markerObj.pinEl.style.pointerEvents = 'auto';
          if (markerObj.flatEl) {
            markerObj.flatEl.style.visibility = 'visible';
            markerObj.flatEl.style.pointerEvents = 'none';
          }
        }

        // Update position if it changed
        markerObj.pinMarker.setLngLat([event.longitude, event.latitude]);
        if (markerObj.flatMarker) {
          markerObj.flatMarker.setLngLat([event.longitude, event.latitude]);
        }
        // Reconstruir el DOM sólo si cambió algo que lo afecta (categoría,
        // capa del mapa, selección, viñeta). Antes se repintaba en cada
        // cambio de zoom, lo que reiniciaba todas las animaciones.
        if (markerObj.pinEl.dataset.renderKey !== renderKey) {
          renderMarkerContent(
            markerObj.pinEl,
            markerObj.flatEl,
            event,
            isSelected,
            color,
            iconName,
            isEmergencyState,
            false,
          );
          markerObj.pinEl.dataset.renderKey = renderKey;
          updateMarkerDomRefs(markerObj);
        }
      }

      // Update Marker z-index to bring selected to front
      if (markerObj.pinEl) {
        const isHovered = markerObj.pinEl.dataset.hovered === 'true';
        const isSel = isSelected || isHovered;
        markerObj.pinEl.style.zIndex = isSel ? '9999' : '10';
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
          boxSizing: 'border-box',
        });

        // Add the push-pin icon
        const svg = createSvgIcon('push-pin', 18, '#FFFFFF');
        if (svg) {
          el.appendChild(svg);
        }

        const marker = new maplibregl.Marker({ element: el, anchor: 'center', opacityWhenCovered: 0 })
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

    if (map.getLayer('cluster-circles')) {
      map.moveLayer('cluster-circles', map.getLayer('building-3d') ? 'building-3d' : undefined);
    }
    if (map.getLayer('cluster-labels')) {
      map.moveLayer('cluster-labels', map.getLayer('building-3d') ? 'building-3d' : undefined);
    }

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

      // 1. Precisión del GPS: la onda es un elemento CSS dentro del marker
      // (compositor, 0 repintados de WebGL); acá sólo se guarda el dato.
      userAccuracyRef.current = loc.accuracy
        ? { accuracyMeters: Math.max(1, loc.accuracy), latitude: loc.latitude }
        : null;

      // 2. DOM marker rendering
      if (!userMarkerRef.current) {
        const el = document.createElement('div');
        el.className = 'user-marker';

        const coneEl = document.createElement('div');
        coneEl.className = 'user-cone';
        el.appendChild(coneEl);

        const waveEl = document.createElement('div');
        waveEl.className = 'user-wave';
        waveEl.innerHTML =
          '<svg viewBox="-50 -50 100 100" width="100" height="100"><circle r="49" fill="none" stroke="currentColor" stroke-width="' +
          WAVE_STROKE_WIDTH +
          '" vector-effect="non-scaling-stroke"/></svg>';
        el.appendChild(waveEl);

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
            .user-wave {
              position: absolute;
              top: 50%;
              left: 50%;
              width: 100px;
              height: 100px;
              margin: -50px 0 0 -50px;
              color: var(--wave-color, #60A5FA);
              pointer-events: none;
              z-index: -1;
              opacity: 0;
              display: none;
              animation: user-wave-pulse var(--wave-period, 1700ms) linear infinite;
              will-change: transform, opacity;
            }
            .user-wave svg { display: block; }
            @keyframes user-wave-pulse {
              0%   { transform: scale(var(--wave-s0, 0.12)); opacity: 0.85;
                     animation-timing-function: cubic-bezier(0.215, 0.61, 0.355, 1); }
              100% { transform: scale(var(--wave-s1, 1)); opacity: 0; }
            }
            @media (prefers-reduced-motion: reduce) {
              .user-wave { animation: none; opacity: 0.35; transform: scale(var(--wave-s1, 1)); }
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

        const marker = new maplibregl.Marker({ element: el, opacityWhenCovered: 0 })
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

    // Escala de la onda según precisión (metros) y zoom actual.
    const syncUserWave = () => {
      const userEl = userMarkerRef.current?.el;
      const wave = userEl?.querySelector('.user-wave') as HTMLDivElement | null;
      if (!userEl || !wave) return;
      const acc = userAccuracyRef.current;
      if (!acc) {
        wave.style.display = 'none';
        return;
      }
      const maxR = getAccuracyRadiusAtZoom(acc.accuracyMeters, acc.latitude, map.getZoom());
      userEl.style.setProperty('--wave-s0', String(WAVE_MIN_RADIUS_PX / 50));
      userEl.style.setProperty('--wave-s1', String(Math.max(maxR, WAVE_MIN_RADIUS_PX * 2) / 50));
      userEl.style.setProperty('--wave-period', `${WAVE_PERIOD_MS}ms`);
      userEl.style.setProperty('--wave-color', getUserWaveColor(mapLayerRef.current));
      wave.style.display = 'block';
    };
    const originalHandler = handleHighFreqLocation;
    const handler = (e: Event) => {
      originalHandler(e);
      syncUserWave();
    };
    map.on('zoom', syncUserWave);

    window.addEventListener('high-frequency-user-location', handler);

    // Initial marker rendering if location is already loaded
    if (userLocation) {
      handler(new CustomEvent('high-frequency-user-location', { detail: userLocation }));
    }

    return () => {
      map.off('zoom', syncUserWave);
      window.removeEventListener('high-frequency-user-location', handler);
    };
  }, [userLocation]);

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
          if (isClickInsideModalOrInput(e)) return;
          if (!e.features?.length) return;
          if (isRoutingActiveRef.current && onMapClickForRoutingRef.current) {
            (e.originalEvent as any)._turismoHandled = true;
            onMapClickForRoutingRef.current({
              latitude: e.lngLat.lat,
              longitude: e.lngLat.lng,
            });
            return;
          }
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

      if (map.getLayer('cluster-circles')) {
        map.moveLayer('cluster-circles', map.getLayer('building-3d') ? 'building-3d' : undefined);
      }
      if (map.getLayer('cluster-labels')) {
        map.moveLayer('cluster-labels', map.getLayer('building-3d') ? 'building-3d' : undefined);
      }
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

  // ── Mobiliario Layer Visibility ───────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !map.getLayer('mobiliario-layer')) return;
    try {
      map.setLayoutProperty('mobiliario-layer', 'visibility', showMobiliario ? 'visible' : 'none');
    } catch {}
  }, [showMobiliario]);


  // ── Walk preview: línea punteada usuario → pin (sin fitBounds) ────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const SOURCE = 'walk-preview';
    const LAYER = 'walk-preview-line';
    const data: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: walkPreviewGeojson
        ? [{ type: 'Feature', geometry: walkPreviewGeojson, properties: {} }]
        : [],
    };
    const apply = () => {
      if (!map.getSource(SOURCE)) {
        map.addSource(SOURCE, { type: 'geojson', data });
      } else {
        (map.getSource(SOURCE) as maplibregl.GeoJSONSource).setData(data);
      }
      if (!map.getLayer(LAYER)) {
        map.addLayer({
          id: LAYER,
          type: 'line',
          source: SOURCE,
          layout: { 'line-cap': 'butt', 'line-join': 'round' },
          paint: { 'line-color': '#1D4ED8', 'line-width': 3.5, 'line-dasharray': WALK_LINE_DASHARRAY },
        });
      }
    };
    if (map.isStyleLoaded()) apply();
    else map.once('idle', apply);
  }, [walkPreviewGeojson]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── OSRM Navigation Route Layer ───────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const SOURCE = 'osrm-nav-route';
    const LAYER_BG = 'osrm-nav-route-bg';
    const LAYER_FG = 'osrm-nav-route-fg';

    const data: GeoJSON.FeatureCollection =
      navRouteGeojson && !isRoutingActive
        ? {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                geometry: navRouteGeojson,
                properties: {},
              },
            ],
          }
        : {
            type: 'FeatureCollection',
            features: [],
          };

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
            id: LAYER_BG,
            type: 'line',
            source: SOURCE,
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#1E3A5F', 'line-width': 10, 'line-opacity': 0.85 },
          });
        }
        if (!map.getLayer(LAYER_FG)) {
          map.addLayer({
            id: LAYER_FG,
            type: 'line',
            source: SOURCE,
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#3B82F6', 'line-width': 5, 'line-opacity': 1 },
          });
        }
      }

      // Encuadrar la cámara sobre toda la ruta (solo en navegación turn-by-turn, no al trazar en Geo-Router)
      const coords = navRouteGeojson?.coordinates;
      if (!isRoutingActive && coords && coords.length > 1) {
        let minLng = coords[0][0],
          minLat = coords[0][1];
        let maxLng = coords[0][0],
          maxLat = coords[0][1];
        for (const [lng, lat] of coords) {
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        }
        map.fitBounds(
          [
            [minLng, minLat],
            [maxLng, maxLat],
          ],
          { padding: { top: 100, bottom: 260, left: 60, right: 60 }, duration: 800, maxZoom: 16 },
        );
      }
    };

    if (map.isStyleLoaded()) {
      applyRoute();
    } else {
      map.once('idle', applyRoute);
    }
  }, [navRouteGeojson, isRoutingActive]); // eslint-disable-line react-hooks/exhaustive-deps
  // ───────────────────────────────────────────────────────────────────────────

  // ── Social Geo-Router 2D Surface Procedural Line & Direction Chevrons ───────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const DRAFT_ROUTE_SOURCE = 'draft-route-surface-source';
    const DRAFT_ROUTE_CASING = 'draft-route-surface-casing';
    const DRAFT_ROUTE_CORE = 'draft-route-surface-core';
    const DRAFT_ROUTE_DASH = 'draft-route-surface-dash';
    const DRAFT_ROUTE_ARROWS = 'draft-route-surface-arrows';

    const DRAFT_SECTOR_SOURCE = 'draft-route-sector-source';
    const DRAFT_SECTOR_FILL = 'draft-route-sector-fill';
    const DRAFT_SECTOR_STROKE = 'draft-route-sector-stroke';

    // 1. Sincronizar pines HTML en el mapa para cada punto colocado (con reconciliación para evitar parpadeos)
    if (!isRoutingActive || draftRoutePoints.length === 0) {
      draftRouteMarkersRef.current.forEach((item) => item.marker.remove());
      draftRouteMarkersRef.current = [];
    } else {
      ensureDraftRouteMarkerStyles();

      // Descartar pines sobrantes si se eliminaron puntos (ej. Deshacer)
      while (draftRouteMarkersRef.current.length > draftRoutePoints.length) {
        const removed = draftRouteMarkersRef.current.pop();
        removed?.marker.remove();
      }

      draftRoutePoints.forEach((point, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === draftRoutePoints.length - 1 && draftRoutePoints.length > 1;
        const role: 'origin' | 'destination' | 'waypoint' = isFirst
          ? 'origin'
          : isLast
            ? 'destination'
            : 'waypoint';

        const bodyText = isFirst ? 'A' : isLast ? 'B' : `${idx}`;
        const labelText =
          point.name || (isFirst ? 'Inicio' : isLast ? 'Destino' : `Parada ${idx}`);

        const existing = draftRouteMarkersRef.current[idx];

        if (existing) {
          // Reutilizar marcador existente sin reconstruir el DOM ni disparar animaciones
          existing.marker.setLngLat([point.longitude, point.latitude]);
          existing.marker.setOpacity('1', '1');
          existing.marker.setPitchAlignment('viewport');
          existing.marker.setRotationAlignment('viewport');
          try {
            existing.el.style.zIndex = '3000';
            existing.el.style.opacity = '1';
            existing.el.style.visibility = 'visible';
          } catch {}
          if (existing.role !== role) {
            existing.el.classList.remove(
              'draft-pin-origin',
              'draft-pin-destination',
              'draft-pin-waypoint',
            );
            existing.el.classList.add(`draft-pin-${role}`);
            existing.role = role;
          }
          if (existing.bodyEl.textContent !== bodyText) {
            existing.bodyEl.textContent = bodyText;
          }
          if (existing.pillEl.textContent !== labelText) {
            existing.pillEl.textContent = labelText;
          }
        } else {
          // Nuevo marcador: solo este nuevo pin anima su entrada
          const el = document.createElement('div');
          el.className = `draft-route-pin-wrapper draft-pin-${role}`;
          el.style.zIndex = '3000';
          el.style.opacity = '1';
          el.style.visibility = 'visible';

          // Anillo de pulso para origen y destino
          const pulse = document.createElement('div');
          pulse.className = 'draft-route-pulse';
          el.appendChild(pulse);

          // Cuerpo del pin con letra o número (la animación pop-in se aísla en el cuerpo)
          const body = document.createElement('div');
          body.className = 'draft-route-pin-body draft-pin-enter';
          body.textContent = bodyText;
          body.addEventListener(
            'animationend',
            () => {
              body.classList.remove('draft-pin-enter');
            },
            { once: true },
          );
          el.appendChild(body);

          // Etiqueta flotante con nombre o rol
          const pill = document.createElement('div');
          pill.className = 'draft-route-label-pill';
          pill.textContent = labelText;
          el.appendChild(pill);

          // pitchAlignment y rotationAlignment en 'viewport' para mantenerse siempre visibles en 3D
          // Opacidad forzada a 1 y opacityWhenCovered a 1 para que NUNCA se oculte bajo el terreno
          // Anclaje al 'center' para que el pin quede milimétricamente centrado con el centro del clic y la línea 2D
          const marker = new maplibregl.Marker({
            element: el,
            anchor: 'center',
            pitchAlignment: 'viewport',
            rotationAlignment: 'viewport',
            opacity: '1',
            opacityWhenCovered: '1',
          })
            .setLngLat([point.longitude, point.latitude])
            .addTo(map);

          marker.setOpacity('1', '1');
          marker.setPitchAlignment('viewport');
          marker.setRotationAlignment('viewport');

          try {
            marker.getElement().style.zIndex = '3000';
            marker.getElement().style.opacity = '1';
            marker.getElement().style.visibility = 'visible';
          } catch {}

          draftRouteMarkersRef.current.push({
            marker,
            el,
            bodyEl: body,
            pillEl: pill,
            pulseEl: pulse,
            role,
          });
        }
      });
    }

    // 2. Coordenadas de la línea 2D procedural sobre el suelo
    let lineCoords: [number, number][] = [];
    if (isRoutingActive && draftRoutePoints.length >= 2) {
      if (
        navRouteGeojson &&
        navRouteGeojson.coordinates &&
        navRouteGeojson.coordinates.length >= 2
      ) {
        lineCoords = navRouteGeojson.coordinates as [number, number][];
      } else {
        // Trazado procedural instantáneo entre pines antes de respuesta OSRM
        lineCoords = draftRoutePoints.map((p) => [p.longitude, p.latitude]);
      }
    }

    const lineFeatures: GeoJSON.Feature<GeoJSON.LineString>[] =
      lineCoords.length >= 2
        ? [
            {
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: lineCoords,
              },
              properties: {},
            },
          ]
        : [];

    const lineData: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
      type: 'FeatureCollection',
      features: lineFeatures,
    };

    // 3. Polígono de sector si aplica
    const isSector = isRoutingActive && routingType === 'sector' && draftRoutePoints.length >= 3;
    const sectorCoords = isSector
      ? [
          [
            ...draftRoutePoints.map((p) => [p.longitude, p.latitude]),
            [draftRoutePoints[0].longitude, draftRoutePoints[0].latitude],
          ],
        ]
      : [];

    const sectorFeatures: GeoJSON.Feature<GeoJSON.Polygon>[] =
      sectorCoords.length >= 1
        ? [
            {
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: sectorCoords,
              },
              properties: {},
            },
          ]
        : [];

    const sectorData: GeoJSON.FeatureCollection<GeoJSON.Polygon> = {
      type: 'FeatureCollection',
      features: sectorFeatures,
    };

    const syncDraftLayers = () => {
      // Línea principal
      const routeSrc = map.getSource(DRAFT_ROUTE_SOURCE) as maplibregl.GeoJSONSource | undefined;
      if (!routeSrc) {
        map.addSource(DRAFT_ROUTE_SOURCE, {
          type: 'geojson',
          data: lineData,
        });
      } else {
        routeSrc.setData(lineData);
      }

      // Casing 2D plano sobre la superficie
      if (!map.getLayer(DRAFT_ROUTE_CASING)) {
        map.addLayer({
          id: DRAFT_ROUTE_CASING,
          type: 'line',
          source: DRAFT_ROUTE_SOURCE,
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
          },
          paint: {
            'line-color': '#022c22',
            'line-width': [
              'interpolate',
              ['linear'],
              ['zoom'],
              10, 8,
              14, 12,
              18, 16,
            ],
            'line-opacity': 0.9,
          },
        });
      }

      // Línea core esmeralda neón 2D de alta visibilidad sobre la superficie
      if (!map.getLayer(DRAFT_ROUTE_CORE)) {
        map.addLayer({
          id: DRAFT_ROUTE_CORE,
          type: 'line',
          source: DRAFT_ROUTE_SOURCE,
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
          },
          paint: {
            'line-color': '#00E676',
            'line-width': [
              'interpolate',
              ['linear'],
              ['zoom'],
              10, 4.5,
              14, 7,
              18, 10,
            ],
            'line-opacity': 1.0,
          },
        });
      }

      // Línea de pulso dash blanca para indicar flujo
      if (!map.getLayer(DRAFT_ROUTE_DASH)) {
        map.addLayer({
          id: DRAFT_ROUTE_DASH,
          type: 'line',
          source: DRAFT_ROUTE_SOURCE,
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
          },
          paint: {
            'line-color': '#FFFFFF',
            'line-width': [
              'interpolate',
              ['linear'],
              ['zoom'],
              10, 2,
              14, 3.5,
              18, 5,
            ],
            'line-opacity': 0.9,
            'line-dasharray': [0.5, 3],
          },
        });
      }

      // Flechas direccionales que indican hacia dónde va el camino
      const addArrowsLayer = () => {
        if (!mapRef.current || mapRef.current.getLayer(DRAFT_ROUTE_ARROWS)) return;
        try {
          mapRef.current.addLayer({
            id: DRAFT_ROUTE_ARROWS,
            type: 'symbol',
            source: DRAFT_ROUTE_SOURCE,
            layout: {
              'symbol-placement': 'line',
              'symbol-spacing': 28,
              'icon-image': ROUTE_CHEVRON_ID,
              'icon-size': [
                'interpolate',
                ['linear'],
                ['zoom'],
                10, 0.5,
                14, 0.7,
                18, 0.95,
              ],
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
              'icon-keep-upright': false,
              'icon-pitch-alignment': 'map',
              'icon-rotation-alignment': 'map',
            },
          });
        } catch (err) {
          console.warn('[MapLibre] Could not add arrows layer:', err);
        }
      };

      if (map.hasImage(ROUTE_CHEVRON_ID)) {
        addArrowsLayer();
      } else {
        ensureRouteChevronImage(map, addArrowsLayer);
      }

      // Capas de sector poligonal
      const sectorSrc = map.getSource(DRAFT_SECTOR_SOURCE) as maplibregl.GeoJSONSource | undefined;
      if (!sectorSrc) {
        map.addSource(DRAFT_SECTOR_SOURCE, {
          type: 'geojson',
          data: sectorData,
        });
      } else {
        sectorSrc.setData(sectorData);
      }

      if (!map.getLayer(DRAFT_SECTOR_FILL)) {
        map.addLayer({
          id: DRAFT_SECTOR_FILL,
          type: 'fill',
          source: DRAFT_SECTOR_SOURCE,
          paint: {
            'fill-color': '#10B981',
            'fill-opacity': 0.2,
          },
        });
      }

      if (!map.getLayer(DRAFT_SECTOR_STROKE)) {
        map.addLayer({
          id: DRAFT_SECTOR_STROKE,
          type: 'line',
          source: DRAFT_SECTOR_SOURCE,
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
          },
          paint: {
            'line-color': '#059669',
            'line-width': 2.5,
            'line-dasharray': [2, 2],
          },
        });
      }

      // Re-elevar capas de trazado por encima de cualquier otra capa del mapa
      try {
        if (map.getLayer(DRAFT_SECTOR_FILL)) map.moveLayer(DRAFT_SECTOR_FILL);
        if (map.getLayer(DRAFT_SECTOR_STROKE)) map.moveLayer(DRAFT_SECTOR_STROKE);
        if (map.getLayer(DRAFT_ROUTE_CASING)) map.moveLayer(DRAFT_ROUTE_CASING);
        if (map.getLayer(DRAFT_ROUTE_CORE)) map.moveLayer(DRAFT_ROUTE_CORE);
        if (map.getLayer(DRAFT_ROUTE_DASH)) map.moveLayer(DRAFT_ROUTE_DASH);
        if (map.getLayer(DRAFT_ROUTE_ARROWS)) map.moveLayer(DRAFT_ROUTE_ARROWS);
      } catch {}
    };

    syncDraftRouteRef.current = syncDraftLayers;

    const hasStyle = Boolean(map.getStyle() && map.getStyle().layers);
    if (hasStyle) {
      syncDraftLayers();
    } else {
      map.once('load', syncDraftLayers);
    }
  }, [isRoutingActive, routingType, draftRoutePoints, navRouteGeojson]); // eslint-disable-line react-hooks/exhaustive-deps

  // Limpieza al desmontar
  useEffect(() => {
    return () => {
      draftRouteMarkersRef.current.forEach((m) => m.marker.remove());
      draftRouteMarkersRef.current = [];
    };
  }, []);
  // ───────────────────────────────────────────────────────────────────────────
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
      // diff:false fuerza reconstrucción completa del estilo en vez del
      // parche incremental por defecto (diff:true). Con diff:true, si
      // Style.setState() logra aplicar el diff sin lanzar excepción,
      // maplibre NUNCA emite 'style.load' — solo remueve/agrega capas
      // en silencio, así que nuestras capas custom (event-polygons-*,
      // zones-*, waterway) quedan borradas sin que el handler de
      // 'style.load' llegue a restaurarlas. Eso pasaba de forma
      // asimétrica según la dirección del cambio (p.ej. satélite → día/
      // noche perdía los polígonos, día/noche → satélite no, porque ahí
      // el diff sí lanzaba y caía al fallback de reconstrucción). Forzar
      // reconstrucción completa siempre garantiza que 'style.load' se
      // dispare y nuestro handler reponga todo, sin depender de si el
      // diff interno de maplibre tira o no una excepción para ESTE par
      // de estilos en particular.
      map.setStyle(selectedStyle, { diff: false });
    }

    // Si la capa seleccionada es '3d', animar automáticamente cámara a perspectiva 3D
    if (mapLayer === '3d') {
      map.easeTo({ pitch: CAMERA_CONSTRAINTS.pitch3D, bearing: CAMERA_CONSTRAINTS.bearing3D, duration: 1000 });
      setIs3DActive(true);
    }

    // Re-sincronizar edificios 3D cuando el estilo esté listo
    const onStyleReady = () => {
      if (sync3DBuildingsRef.current) {
        sync3DBuildingsRef.current();
      }
    };
    if (map.isStyleLoaded()) {
      onStyleReady();
    } else {
      map.once('styledata', onStyleReady);
    }
  }, [mapLayer]);

  // Sync Map Camera on Selection change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (selectedEvent) {
      if (isUtilityCategory(selectedEvent.category)) {
        if (!isGtaVRunningRef.current) {
          isGtaVRunningRef.current = true;
          executeSmoothPinFocus(
            map,
            { latitude: selectedEvent.latitude, longitude: selectedEvent.longitude, heading: 0 },
            cameraAnimationsEnabled,
            () => {
              isGtaVRunningRef.current = false;
            },
          );
        }
        return;
      }

      const currentZ = typeof map.getZoom === 'function' ? map.getZoom() : 16;
      const targetZ = Math.min(19.5, Math.max(currentZ, 16.5));
      map.easeTo({
        center: [selectedEvent.longitude, selectedEvent.latitude],
        zoom: targetZ,
        pitch: map.getPitch(),
        duration: 800,
        easing: (t: number) => 1 - Math.pow(1 - t, 3),
        essential: true,
      });
    }
  }, [selectedEvent, cameraAnimationsEnabled]);

  // Sync Zoom Level (protegido contra interrupciones de animaciones cinemáticas activas)
  useEffect(() => {
    const map = mapRef.current;
    if (map && zoom !== undefined) {
      if (!map.isMoving() && Math.round(map.getZoom()) !== zoom) {
        map.setZoom(zoom);
      }
    }
  }, [zoom]);

  // Center on User Location con soporte cinematográfico GTA V.
  // `centerTrigger` es un contador que solo sube (nunca vuelve a 0) — sin
  // este guard, como `userLocation` también está en el dep array, CUALQUIER
  // actualización de geolocalización (watchPosition, incluido jitter de GPS
  // sin que el usuario se mueva) volvía a disparar el flythrough completo,
  // no solo el tap real en "centrar en mí".
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (centerTrigger !== lastCenterTriggerRef.current && centerTrigger && userLocation) {
      lastCenterTriggerRef.current = centerTrigger;
      if (cameraAnimationsEnabled) {
        executeMapLibreGtaVSpawn(map, userLocation, true);
      } else {
        map.flyTo({
          center: [userLocation.longitude, userLocation.latitude],
          zoom: 15.5,
          pitch: 0,
          essential: true,
        });
      }
    }
  }, [centerTrigger, userLocation, cameraAnimationsEnabled]);

  // ── Motor de Animaciones y Efectos de Cámara GTA V ────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;

    if (isAuthenticated) {
      // Caso 1: Usuario autenticado al ingresar al mapa o tras iniciar sesión
      if (!hasSpawnedRef.current && userLocation) {
        hasSpawnedRef.current = true;
        prevAuthRef.current = true;
        const alreadySpawned = hasCameraSpawnedInSession();
        executeMapLibreGtaVSpawn(map, userLocation, !alreadySpawned && cameraAnimationsEnabled);
        markCameraSpawnedInSession();
      }
    } else {
      // Caso 2: Logout (cambió de true a false)
      if (prevAuthRef.current === true) {
        hasSpawnedRef.current = false;
        prevAuthRef.current = false;
        resetCameraSpawnInSession();
        executeMapLibreGtaVLogout(map, cameraAnimationsEnabled);
      } else if (prevAuthRef.current === undefined) {
        // Caso 3: Usuario no logueado por default (normal city center)
        prevAuthRef.current = false;
      }
    }
  }, [isAuthenticated, userLocation, cameraAnimationsEnabled]);

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

      {/* Botón flotante para alternar entre vista 2D y perspectiva 3D inclinada */}
      <div
        style={{
          position: 'absolute',
          top: controlsTopOffset,
          right: 14,
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {!lightweightMode && <button
          onClick={() => {
            const map = mapRef.current;
            if (!map) return;
            const currentPitch = map.getPitch();
            if (currentPitch > 20) {
              map.easeTo({ pitch: 0, duration: 800 });
              setIs3DActive(false);
            } else {
              map.easeTo({ pitch: CAMERA_CONSTRAINTS.pitch3D, bearing: CAMERA_CONSTRAINTS.bearing3D, duration: 1000 });
              setIs3DActive(true);
            }
          }}
          title={is3DActive ? 'Cambiar a vista 2D' : 'Ver edificios en 3D'}
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: is3DActive ? 'rgba(52, 211, 153, 0.95)' : 'rgba(15, 23, 42, 0.85)',
            color: is3DActive ? '#0F172A' : '#34D399',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            fontWeight: 'bold',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(8px)',
            transition: 'all 0.2s ease',
          }}
        >
          {is3DActive ? '2D' : '3D'}
        </button>}
        {compassVisible && (
          <button
            onClick={() => resetNorthPitch(mapRef.current)}
            title="Restablecer norte"
            aria-label="Restablecer norte"
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(8px)',
              marginLeft: '-3px',
            }}
          >
            <div ref={compassNeedleRef} style={{
                width: '22px',
                height: '22px',
                transform: `rotate(${-(mapRef.current?.getBearing() ?? 0)}deg)`,
              }}>
              <svg viewBox="0 0 24 24" width="22" height="22">
                <polygon points="12,2 16,12 8,12" fill="#F87171" />
                <polygon points="12,22 16,12 8,12" fill="#E2E8F0" />
              </svg>
            </div>
          </button>
        )}
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
