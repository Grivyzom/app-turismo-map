import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Animated, Platform, Dimensions, DeviceEventEmitter } from 'react-native';
import { router } from 'expo-router';

import {
  TurismoEvent,
  MapLayer,
  MAX_ZOOM_PER_LAYER,
  MapCoordinate,
  RouteType,
  RoutePoint,
  RoutePointType,
  RouteVisibility,
  Route,
  Zone,
} from '../components/Map/types';
import {
  fetchOsrmMultiRoute,
  fetchOptimizedTrip,
  formatDistance,
  TransportMode,
  OsrmRoute,
} from '../utils/osrmService';
import { CheckInRecord } from '../utils/checkInStorage';
import { ParsedSearch } from '../utils/aiSearchParser';
import { TabType, MapDisplayMode } from '../components/MapUI';
import {
  DEFAULT_MAP_LAYER,
  loadPersistedMapLayer,
  savePersistedMapLayer,
  loadPersistedCameraAnimations,
  savePersistedCameraAnimations,
  DEFAULT_CAMERA_ANIMATIONS,
  loadPersistedShowSecurityCameras,
  savePersistedShowSecurityCameras,
  DEFAULT_SHOW_SECURITY_CAMERAS,
} from '../utils/mapPreferences';
import { loadUserProfile, saveUserProfile } from '../utils/userProfileStorage';
import { useUserLocationContext } from '../context/UserLocationContext';
import { useAuth } from '../context/AuthContext';
import {
  buildGoogleMapsSearchUrl,
  buildGoogleStreetViewUrl,
  formatPinchoCoordinates,
  reverseGeocode,
} from '../utils/mapPincho';
import { INITIAL_EVENTS, WS_SIMULATION_POOL, CategoryFilter } from '../data/mockEvents';
import { API_URL } from '../config/api';
import { isUtilityCategory } from '../components/Map/design/pinDesignSystem';

// Categorías visibles por modo de mapa. 'mapa' = infraestructura/seguridad de la ciudad,
// 'turismo' = atractivos, naturaleza y amenidades de parques, 'comercial' = comercio y gastronomía.
const MODE_CATEGORIES: Record<MapDisplayMode, CategoryFilter[]> = {
  mapa: [
    'hospital',
    'clinica',
    'universidad',
    'bombero',
    'carabinero',
    'camara',
    'emergencia',
    'publico',
    'municipalidad',
  ],
  turismo: [
    'cultura',
    'naturaleza',
    'museo',
    'teatro',
    'fauna',
    'coliseo',
    'puerto',
    'musica',
    'deportes',
    'maquina_ejercicio',
    'embarcacion',
    'parque',
    'agua',
    'humedal',
    'escultura',
    'torreon',
    'estatua',
    'arte',
    'bosque',
    'sendero',
    'banca',
    'silla',
    'bebedero',
    'bano',
    'basurero',
    'papelera',
  ],
  comercial: ['tienda', 'gastronomia'],
};

const CATEGORY_ALIASES: Record<string, string[]> = {
  gastronomia: ['gastronomia'],
  cultura: ['cultura', 'museo', 'teatro', 'escultura', 'estatua', 'torreon', 'arte', 'coliseo'],
  naturaleza: ['naturaleza', 'parque', 'bosque', 'humedal', 'fauna', 'agua'],
  musica: ['musica'],
  deportes: ['deportes', 'coliseo', 'maquina_ejercicio', 'ejercicio'],
  publico: [
    'publico',
    'municipalidad',
    'universidad',
    'hospital',
    'clinica',
    'banca',
    'silla',
    'bebedero',
    'bano',
    'basurero',
    'papelera',
    'mobiliario',
  ],
  emergencia: [
    'emergencia',
    'choque',
    'incendio',
    'accidente',
    'calle_cortada',
    'bombero',
    'carabinero',
    'camara',
  ],
  embarcacion: ['embarcacion', 'puerto'],
  tienda: ['tienda', 'mercado', 'supermercado'],
};

// ── Filtros contextuales de Pines para Modo Geo-Router ─────────────────────────
const ROUTER_CATEGORY_PIN_FILTERS: Record<string, (event: TurismoEvent) => boolean> = {
  // Modo Ciudad: Pines comerciales, gastronomía, tiendas, mercados, ferias
  ciudad: (e) => {
    const cat = (e.category || '').toLowerCase();
    const isCommercialCat = [
      'tienda',
      'gastronomia',
      'mercado',
      'comercial',
      'supermercado',
    ].includes(cat);
    const isCommercialId =
      e.id.startsWith('comercial-') ||
      e.id.includes('mercado') ||
      e.id.includes('feria') ||
      e.id.includes('mall');
    return isCommercialCat || isCommercialId;
  },

  // Modo Bosque / Naturaleza: Senderos, spots, máquinas de ejercicio, parques
  bosque: (e) => {
    const cat = (e.category || '').toLowerCase();
    const isNatureCat = [
      'bosque',
      'sendero',
      'new_spot',
      'maquina_ejercicio',
      'ejercicio',
      'parque',
      'naturaleza',
      'humedal',
      'fauna',
      'banca',
      'bebedero',
    ].includes(cat);
    const isNatureId =
      e.id.startsWith('fitness-') ||
      e.id.startsWith('spot-') ||
      e.id.startsWith('parque-');
    return isNatureCat || isNatureId;
  },

  // Alias para reserva natural
  reserva: (e) => {
    const cat = (e.category || '').toLowerCase();
    return (
      [
        'bosque',
        'sendero',
        'new_spot',
        'maquina_ejercicio',
        'ejercicio',
        'parque',
        'naturaleza',
        'humedal',
        'fauna',
        'banca',
        'bebedero',
      ].includes(cat) ||
      e.id.startsWith('fitness-') ||
      e.id.startsWith('spot-') ||
      e.id.startsWith('parque-')
    );
  },

  // Modo Turística: Sitios patrimoniales, museos, monumentos, esculturas, comercio tradicional
  turistica: (e) => {
    const cat = (e.category || '').toLowerCase();
    return (
      [
        'cultura',
        'museo',
        'teatro',
        'escultura',
        'torreon',
        'estatua',
        'arte',
        'gastronomia',
        'mercado',
        'fauna',
        'embarcacion',
        'new_spot',
        'sendero',
        'parque',
      ].includes(cat) ||
      e.id.startsWith('comercial-') ||
      e.id.startsWith('spot-')
    );
  },

  // Modo Ruta Cervecera: Bares, pubs, cervecerías y gastronomía
  cervecera: (e) => {
    const cat = (e.category || '').toLowerCase();
    const text = `${e.title || ''} ${e.description || ''}`.toLowerCase();
    return (
      cat === 'gastronomia' ||
      cat === 'tienda' ||
      text.includes('cerve') ||
      text.includes('bar') ||
      text.includes('pub') ||
      text.includes('schop') ||
      e.id.includes('kunstmann')
    );
  },

  // Modo Reto Deportivo: Estaciones de calistenia, máquinas, complejos deportivos
  reto: (e) => {
    const cat = (e.category || '').toLowerCase();
    return (
      [
        'deportes',
        'maquina_ejercicio',
        'ejercicio',
        'coliseo',
        'invitation_sports',
      ].includes(cat) || e.id.startsWith('fitness-')
    );
  },

  // Modo Exploración: Spots, miradores, senderos, hitos históricos
  exploracion: (e) => {
    const cat = (e.category || '').toLowerCase();
    return (
      [
        'new_spot',
        'sendero',
        'new_item',
        'bosque',
        'naturaleza',
        'humedal',
        'torreon',
        'escultura',
        'embarcacion',
        'fauna',
      ].includes(cat) || e.id.startsWith('spot-')
    );
  },

  // Modo Edificio: Malls, arquitectura y servicios
  edificio: (e) => {
    const cat = (e.category || '').toLowerCase();
    return [
      'edificio',
      'municipalidad',
      'universidad',
      'hospital',
      'clinica',
      'coliseo',
      'teatro',
      'museo',
    ].includes(cat);
  },

  // Modo Subzona: Zonas cívicas, barrios y parques vecinales
  subzona: (e) => {
    const cat = (e.category || '').toLowerCase();
    return ['publico', 'municipalidad', 'universidad', 'parque'].includes(cat);
  },
};

/**
 * Visibilidad de una categoría según filtros y modo, sin datos propios del evento.
 * Lo usa la capa OSM (visibleOsmCategories); filteredEvents aplica además las
 * reglas por evento (parkId de utilidades, búsqueda).
 */
function isCategoryVisible(
  category: string,
  selectedCategories: CategoryFilter[],
  mapDisplayMode: MapDisplayMode,
  showSecurityCameras: boolean,
): boolean {
  if (selectedCategories.includes('ninguno')) return false;
  if (category === 'camara' && !showSecurityCameras) return false;
  if (isUtilityCategory(category) && mapDisplayMode !== 'turismo') return false;
  const isEmergencyCategory = ['choque', 'incendio', 'accidente', 'calle_cortada'].includes(
    category,
  );
  if (selectedCategories.includes('todos') || selectedCategories.length === 0) {
    return (
      isEmergencyCategory || MODE_CATEGORIES[mapDisplayMode].includes(category as CategoryFilter)
    );
  }
  return (
    (selectedCategories.includes('emergencia') && isEmergencyCategory) ||
    selectedCategories.includes(category as CategoryFilter) ||
    selectedCategories.some((cat) => CATEGORY_ALIASES[cat]?.includes(category))
  );
}

const ALL_OSM_CATEGORIES: CategoryFilter[] = [
  'parque', 'agua', 'humedal', 'universidad', 'hospital', 'clinica',
  'bombero', 'carabinero', 'camara', 'escultura', 'torreon', 'estatua',
  'arte',
  // 'edificio' queda a proposito FUERA de todos los MODE_CATEGORIES: los buildings
  // se pintan como capa de poligonos/extrusion 3D en un plan posterior, no como pin
  // puntual, asi que nunca deben aparecer en visibleOsmCategories. No es un bug.
  'edificio',
  'banca', 'basurero', 'bebedero', 'bano',
];

type MapPinchoState = {
  latitude: number;
  longitude: number;
  surface?: 'land' | 'water';
  address: string;
  imageUrl: string;
  googleMapsUrl: string;
  isResolving: boolean;
};

export interface AppNotification {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: Date;
  isRead: boolean;
}

export function useHomeScreenState(token: string | null) {
  const { openAuthModal } = useAuth();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [events, setEvents] = useState<TurismoEvent[]>(INITIAL_EVENTS);
  const [selectedCategories, setSelectedCategories] = useState<CategoryFilter[]>(['todos']);
  const selectedCategory = selectedCategories[0] || 'todos';
  const setSelectedCategory = useCallback((cat: CategoryFilter | CategoryFilter[]) => {
    if (Array.isArray(cat)) {
      setSelectedCategories(cat.length === 0 ? ['todos'] : cat);
    } else {
      setSelectedCategories([cat]);
    }
  }, []);
  const [selectedEvent, setSelectedEvent] = useState<TurismoEvent | null>(null);
  const [selectedSpot, setSelectedSpot] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'local' | 'tourist'>('local');
  const [mapDisplayMode, setMapDisplayMode] = useState<MapDisplayMode>('mapa');

  const handleMapDisplayModeChange = useCallback((mode: MapDisplayMode) => {
    setMapDisplayMode(mode);
    if (mode !== 'turismo') {
      setSelectedEvent((prev) => {
        if (!prev) return null;
        const cat = prev.category?.toLowerCase() || '';
        if (
          cat === 'parque' ||
          cat === 'reserva' ||
          cat === 'reservas' ||
          cat === 'naturaleza' ||
          isUtilityCategory(cat) ||
          prev.parkId
        ) {
          return null;
        }
        return prev;
      });
    }
  }, []);

  // ── Nested Zones State ─────────────────────────────────────────────────
  const [activeNestedZone, setActiveNestedZone] = useState<any>(null);
  const [selectedSector, setSelectedSector] = useState<Zone | null>(null);
  const [activeBuildingId, setActiveBuildingId] = useState<number | null>(null);

  // ── Magic Wand (Zone Creation) State ───────────────────────────────────
  const [isMagicWandActive, setIsMagicWandActive] = useState<boolean>(false);
  const [extractedGeometry, setExtractedGeometry] = useState<any>(null);
  const [activeFloor, setActiveFloor] = useState<number | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [simulationIndex, setSimulationIndex] = useState(0);
  const [mapLayer, setMapLayer] = useState<MapLayer>(DEFAULT_MAP_LAYER);
  const [mapLayerReady, setMapLayerReady] = useState(false);
  const [showTraffic, setShowTraffic] = useState(false);
  const [showCycleways, setShowCycleways] = useState(false);
  const [cycleways, setCycleways] = useState<any[]>([]);
  const [showSectors, setShowSectors] = useState(true);
  const [sectors, setSectors] = useState<any[]>([]);
  const [visibleSectorIds, setVisibleSectorIds] = useState<number[]>([]);
  const [showWeather, setShowWeather] = useState(false);
  const [cameraAnimationsEnabled, setCameraAnimationsEnabled] =
    useState<boolean>(DEFAULT_CAMERA_ANIMATIONS);

  useEffect(() => {
    let isMounted = true;
    loadPersistedCameraAnimations().then((enabled) => {
      if (isMounted) setCameraAnimationsEnabled(enabled);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const toggleCameraAnimations = useCallback(() => {
    setCameraAnimationsEnabled((prev) => {
      const next = !prev;
      savePersistedCameraAnimations(next);
      return next;
    });
  }, []);

  // Capa opcional de cámaras de seguridad (opt-in, persistida)
  const [showSecurityCameras, setShowSecurityCameras] = useState<boolean>(
    DEFAULT_SHOW_SECURITY_CAMERAS,
  );

  useEffect(() => {
    let isMounted = true;
    loadPersistedShowSecurityCameras().then((enabled) => {
      if (isMounted) setShowSecurityCameras(enabled);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const toggleSecurityCameras = useCallback(() => {
    setShowSecurityCameras((prev) => {
      const next = !prev;
      savePersistedShowSecurityCameras(next);
      return next;
    });
    // Al apagar la capa no debe quedar una cámara seleccionada huérfana
    setSelectedEvent((prev) => (prev?.category === 'camara' ? null : prev));
  }, []);

  useEffect(() => {
    if (!selectedEvent) setSelectedSpot(null);
  }, [selectedEvent]);

  useEffect(() => {
    const fetchCycleways = async () => {
      try {
        const response = await fetch(`${API_URL}/api/v1/cycleways`);
        if (response.ok) {
          const data = await response.json();
          setCycleways(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error('Error fetching cycleways:', error);
      }
    };
    fetchCycleways();
  }, []);

  const fetchSectors = useCallback(async () => {
    try {
      let url = `${API_URL}/api/v1/zones`;
      if (activeNestedZone) {
        url += `?zoneId=${activeNestedZone.id}`;
      }
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const safeData = Array.isArray(data) ? data : [];
        setSectors((prev) => {
          // If this is the first time we're setting sectors, initialize visibility
          if (prev.length === 0 && safeData.length > 0) {
            setVisibleSectorIds(safeData.map((s: any) => s.id));
          } else {
            // Check for new sectors added since last poll and make them visible by default
            const existingIds = new Set(prev.map((s: any) => s.id));
            const newIds = safeData
              .filter((s: any) => !existingIds.has(s.id))
              .map((s: any) => s.id);
            if (newIds.length > 0) {
              setVisibleSectorIds((currentIds) => [...currentIds, ...newIds]);
            }
          }
          return safeData;
        });
      }
    } catch (error) {
      console.error('Error fetching sectors:', error);
    }
  }, [activeNestedZone]);

  useEffect(() => {
    // Initial fetch
    fetchSectors();

    // Auto-refresh every 15 seconds
    const interval = setInterval(() => {
      fetchSectors();

      const fetchCycleways = async () => {
        try {
          const response = await fetch(`${API_URL}/api/v1/cycleways`);
          if (response.ok) {
            const data = await response.json();
            setCycleways(Array.isArray(data) ? data : []);
          }
        } catch (error) {
          // ignore background polling errors
        }
      };
      fetchCycleways();
    }, 15000);

    return () => clearInterval(interval);
  }, [fetchSectors]);
  const [weatherType, setWeatherType] = useState<
    'clouds' | 'precipitation' | 'pressure' | 'wind' | 'temp'
  >('precipitation');
  const [activeTab, setRawActiveTab] = useState<TabType>('map');
  const [showFilters, setShowFilters] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [showSectorsConfig, setShowSectorsConfig] = useState(false);
  const [isTacticalModeActive, setIsTacticalModeActive] = useState(false);
  const [showZoomSlider, setShowZoomSlider] = useState(false);
  const [isTelemetryExpanded, setIsTelemetryExpanded] = useState(true);

  // ── Routing Mode State (Geo-Router) ─────────────────────────────────────
  const [isRoutingActive, setIsRoutingActive] = useState(false);
  const [routingType, setRoutingType] = useState<RouteType>('multi_target');
  const [routeCategory, setRouteCategory] = useState('ciudad');
  const [draftRoutePoints, setDraftRoutePoints] = useState<RoutePoint[]>([]);
  const [draftRouteName, setDraftRouteName] = useState('');
  const [isRouteFinished, setIsRouteFinished] = useState(false);
  const [savedRoutes, setSavedRoutes] = useState<any[]>([]);
  const [showSavedRoutes, setShowSavedRoutes] = useState(true);

  // Social Geo-Router Additions
  const [transportMode, setTransportMode] = useState<TransportMode>('foot');
  const [routeVisibility, setRouteVisibility] = useState<RouteVisibility>('public');
  const [draftRouteGeojson, setDraftRouteGeojson] = useState<GeoJSON.LineString | null>(null);
  const [osrmDistance, setOsrmDistance] = useState<number>(0);
  const [osrmDuration, setOsrmDuration] = useState<number>(0);
  const [isCalculatingOsrm, setIsCalculatingOsrm] = useState<boolean>(false);
  const [latestShareToken, setLatestShareToken] = useState<string | null>(null);
  const [routeAlternatives, setRouteAlternatives] = useState<OsrmRoute[]>([]);
  const [selectedAlternativeIndex, setSelectedAlternativeIndex] = useState<number>(0);
  const [isOptimizingTrip, setIsOptimizingTrip] = useState<boolean>(false);
  const primaryRouteRef = useRef<OsrmRoute | null>(null);

  const fetchSavedRoutes = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/v1/routes`);
      if (response.ok) {
        const data = await response.json();
        setSavedRoutes(data);
      }
    } catch (error) {
      console.error('Error fetching saved routes:', error);
    }
  }, []);

  useEffect(() => {
    fetchSavedRoutes();
  }, [fetchSavedRoutes]);

  const [tacticalLocation, setTacticalLocation] = useState<{
    latitude: number;
    longitude: number;
    x?: number;
    y?: number;
    surface?: 'land' | 'water';
  } | null>(null);

  const [mapPincho, setMapPincho] = useState<MapPinchoState | null>(null);

  // Load user profile for pre-filtering
  useEffect(() => {
    loadUserProfile().then((profile) => {
      setUserProfile(profile);
      setSelectedCategory('todos');

      let initialViewMode: 'local' | 'tourist' = 'local';
      if (profile) {
        const castProfile = profile as any;
        if (castProfile.currentViewMode === 'local' || castProfile.currentViewMode === 'tourist') {
          initialViewMode = castProfile.currentViewMode;
        } else if ((profile.userType as string) === 'tourist') {
          initialViewMode = 'tourist';
        }
      }
      setViewMode(initialViewMode);

      if (profile?.userType === 'citizen' || profile?.userType === 'guest') {
        setMapLayer('streets'); // Assuming streets layer for tourists
      }
    });
  }, []);

  useEffect(() => {
    setEvents(INITIAL_EVENTS);
  }, [viewMode]);

  const handleToggleViewMode = useCallback(async () => {
    const newMode = viewMode === 'local' ? 'tourist' : 'local';
    setViewMode(newMode);

    if (token) {
      try {
        await fetch(`${API_URL}/api/v1/profile/view-mode`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ viewMode: newMode }),
        });
      } catch (error) {
        console.error('Error saving view mode to backend:', error);
      }
    }

    if (userProfile) {
      const updatedProfile = { ...userProfile, currentViewMode: newMode };
      setUserProfile(updatedProfile);
      saveUserProfile(updatedProfile);
    }
  }, [viewMode, token, userProfile]);

  const [resolvedAddress, setResolvedAddress] = useState<string>('');
  const [isResolvingAddress, setIsResolvingAddress] = useState<boolean>(false);
  const [showCreateEventModal, setShowCreateEventModal] = useState<boolean>(false);
  const [showNearbyEvents, setShowNearbyEvents] = useState(false);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotificationTray, setShowNotificationTray] = useState(false);
  // activeToast: used only on native. On web, sileo handles display via DOM portal.
  const [activeToast, setActiveToast] = useState<{
    message: string;
    type: AppNotification['type'];
  } | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showNotification = useCallback(
    (message: string, type: AppNotification['type'] = 'info') => {
      const newNotification: AppNotification = {
        id: `notif-${Date.now()}`,
        message,
        type,
        timestamp: new Date(),
        isRead: false,
      };
      setNotifications((prev) => [newNotification, ...prev]);

      if (Platform.OS === 'web') {
        // On web: call sileo directly. It uses a DOM portal so overflow:hidden can't clip it.
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { sileo } = require('sileo');
          const sileoMethod = sileo[type] ?? sileo.info;
          sileoMethod({ title: message });
        } catch (e) {
          // sileo not available – fall through to activeToast
          setActiveToast({ message, type });
          if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
          toastTimeoutRef.current = setTimeout(() => setActiveToast(null), 4000);
        }
      } else {
        // On native: use the custom in-tree toast component
        setActiveToast({ message, type });
        if (toastTimeoutRef.current) {
          clearTimeout(toastTimeoutRef.current);
        }
        toastTimeoutRef.current = setTimeout(() => {
          setActiveToast(null);
        }, 4000);
      }
    },
    [],
  );

  const handleSetTab = useCallback(
    (tab: TabType) => {
      if (!token && ['profile', 'feed', 'saved', 'forum', 'historial'].includes(tab)) {
        showNotification('Inicia sesión para usar esta sección', 'warning');
        openAuthModal('login');
        return;
      }
      setRawActiveTab(tab);
    },
    [token, showNotification, openAuthModal],
  );

  // Al cerrar sesión, regresar pacíficamente al mapa si la pestaña requería autenticación
  useEffect(() => {
    if (!token && ['profile', 'feed', 'saved', 'forum', 'historial'].includes(activeTab)) {
      setRawActiveTab('map');
    }
  }, [token, activeTab]);
  const [panelSlide] = useState(() => new Animated.Value(0));
  const [showRightSheet, setShowRightSheet] = useState(false);
  const [rightSheetSlide] = useState(() => new Animated.Value(0));

  const [showDetailsIsland, setShowDetailsIsland] = useState(false);
  const [detailsIslandSlide] = useState(() => new Animated.Value(0));

  const [pinchoSlide] = useState(() => new Animated.Value(0));

  // ── Check-in modal state ──────────────────────────────────────────────────
  const [checkInModalRecord, setCheckInModalRecord] = useState<CheckInRecord | null>(null);
  const [showCheckInModal, setShowCheckInModal] = useState(false);

  const [centerTrigger, setCenterTrigger] = useState(0);
  const [zoom, setZoom] = useState(13);

  const [mapBounds, setMapBounds] = useState<{
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  } | null>(null);

  const fetchRealPlaces = useCallback(
    async (
      search?: string,
      bounds?: { minLat: number; maxLat: number; minLng: number; maxLng: number },
    ) => {
      try {
        let url = search
          ? `${API_URL}/api/v1/places/search?q=${encodeURIComponent(search)}&viewMode=${viewMode}`
          : `${API_URL}/api/v1/places/search?viewMode=${viewMode}`;

        if (bounds) {
          const joinChar = url.includes('?') ? '&' : '?';
          url += `${joinChar}minLat=${bounds.minLat}&maxLat=${bounds.maxLat}&minLng=${bounds.minLng}&maxLng=${bounds.maxLng}`;
        }

        if (activeNestedZone) {
          const joinChar = url.includes('?') ? '&' : '?';
          url += `${joinChar}zoneId=${activeNestedZone.id}`;
        }

        const res = await fetch(url, {
          headers: {
            Authorization: token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json',
          },
        });

        if (res.status === 401) {
          console.warn('Sesión expirada o no autorizada');
          return;
        }

        const data = await res.json();
        if (data.results) {
          setEvents((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            // Las filas OSM (organizer === 'OpenStreetMap') NUNCA entran a `events`:
            // ese array alimenta el pipeline pesado de pines interactivos
            // (renderPinMarker en web, EventMarker/ArtisticMarker en mobile).
            // Los pines OSM se pintan en una capa liviana aparte (Plan 2/3).
            const newPlaces = data.results.filter(
              (rp: any) => !existingIds.has(rp.id) && rp.organizer !== 'OpenStreetMap',
            );
            return [...prev, ...newPlaces];
          });
        }
      } catch (err) {
        console.error('Error fetching real places:', err);
      }
    },
    [token, activeNestedZone, viewMode],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRealPlaces(searchQuery, mapBounds ?? undefined);
    }, 500); // Debounce de 500ms
    return () => clearTimeout(timer);
  }, [searchQuery, mapBounds, fetchRealPlaces, activeNestedZone]);

  // ── Smart Recommendations Effect ──────────────────────────────────────────
  const fetchSmartRecommendations = useCallback(
    async (options?: { forceRefresh?: boolean }) => {
      if (!token) return;
      try {
        const response = await fetch(`${API_URL}/api/v1/recommendations`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (response.ok) {
          const data = await response.json();
          if (data.results && data.results.length > 0) {
            setEvents((prev) => {
              if (options?.forceRefresh) {
                // Conservar eventos base del sistema y reemplazar recomendaciones previas
                const initialEventIds = new Set(INITIAL_EVENTS.map((e) => e.id));
                const baseEvents = prev.filter((p) => initialEventIds.has(p.id));
                return [...baseEvents, ...data.results];
              }
              const existingIds = new Set(prev.map((p) => p.id));
              const newPlaces = data.results.filter((rp: any) => !existingIds.has(rp.id));
              return [...prev, ...newPlaces];
            });
          }
        }
      } catch (err) {
        console.warn('Error fetching smart recommendations:', err);
      }
    },
    [token],
  );

  useEffect(() => {
    fetchSmartRecommendations();
  }, [fetchSmartRecommendations]);

  // ── Reactividad Inmediata ante Cambios de Preferencias / Vibe ─────────────
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('MAP_PREFERENCES_UPDATED', () => {
      fetchSmartRecommendations({ forceRefresh: true });
    });
    return () => sub.remove();
  }, [fetchSmartRecommendations]);

  // ── Reverse Geocoding Effect ──────────────────────────────────────────────
  useEffect(() => {
    if (!tacticalLocation) {
      setResolvedAddress('');
      return;
    }

    const { latitude, longitude } = tacticalLocation;
    let isCancelled = false;

    const performReverseGeocoding = async () => {
      setIsResolvingAddress(true);
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'AppTurismoMap/1.0 (antigravity)',
          },
        });
        const data = await response.json();

        if (isCancelled) return;

        if (data && data.address) {
          const addr = data.address;
          const road = addr.road || addr.pedestrian || addr.suburb || '';
          const houseNumber = addr.house_number || '';
          const city = addr.city || addr.town || addr.village || 'Valdivia';

          let cleanAddr = '';
          if (road) {
            cleanAddr = houseNumber ? `${road} ${houseNumber}` : road;
          } else {
            cleanAddr = data.display_name?.split(',')[0] || 'Dirección no identificada';
          }

          if (city && !cleanAddr.includes(city)) {
            cleanAddr += `, ${city}`;
          }

          setResolvedAddress(cleanAddr);
        } else {
          setResolvedAddress(`Sector Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`);
        }
      } catch (err) {
        console.warn('Error fetching reverse geocoding:', err);
        if (!isCancelled) {
          setResolvedAddress(
            `Valdivia, Chile (Sector Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)})`,
          );
        }
      } finally {
        if (!isCancelled) {
          setIsResolvingAddress(false);
        }
      }
    };

    const timer = setTimeout(() => {
      void performReverseGeocoding();
    }, 800); // Debounce de 800ms para evitar múltiples requests

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [tacticalLocation]);

  useEffect(() => {
    if (!mapPincho || !mapPincho.isResolving) {
      return;
    }

    const { latitude, longitude } = mapPincho;
    let isCancelled = false;

    const performReverseGeocoding = async () => {
      try {
        const address = await reverseGeocode(latitude, longitude);

        if (isCancelled) return;

        setMapPincho((current) =>
          current
            ? {
                ...current,
                address: address || formatPinchoCoordinates(latitude, longitude),
                isResolving: false,
              }
            : current,
        );
      } catch (err) {
        console.warn('Error fetching pincho reverse geocoding:', err);
        if (!isCancelled) {
          setMapPincho((current) =>
            current
              ? {
                  ...current,
                  address: formatPinchoCoordinates(latitude, longitude),
                  isResolving: false,
                }
              : current,
          );
        }
      }
    };

    const timer = setTimeout(() => {
      void performReverseGeocoding();
    }, 400);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [mapPincho]);

  // Synchronize Tactical Mode with dropping a pin (Pincho)
  useEffect(() => {
    if (!isTacticalModeActive) {
      setMapPincho(null);
      setTacticalLocation(null);
    }
  }, [isTacticalModeActive]);

  // Mutual exclusivity to prevent submenus from overlapping
  useEffect(() => {
    if (showFilters) {
      setShowToolsMenu(false);
      setShowSectorsConfig(false);
      setShowZoomSlider(false);
      setShowNotificationTray(false);
      setShowNearbyEvents(false);
    }
  }, [showFilters]);

  useEffect(() => {
    if (showToolsMenu) {
      setShowFilters(false);
      setShowSectorsConfig(false);
      setShowZoomSlider(false);
      setShowNotificationTray(false);
    }
  }, [showToolsMenu]);

  useEffect(() => {
    if (showSectorsConfig) {
      setShowFilters(false);
      setShowToolsMenu(false);
      setShowZoomSlider(false);
      setShowNotificationTray(false);
    }
  }, [showSectorsConfig]);

  useEffect(() => {
    if (showZoomSlider) {
      setShowFilters(false);
      setShowToolsMenu(false);
      setShowSectorsConfig(false);
      setShowNotificationTray(false);
    }
  }, [showZoomSlider]);

  useEffect(() => {
    if (showNotificationTray) {
      setShowFilters(false);
      setShowToolsMenu(false);
      setShowSectorsConfig(false);
      setShowZoomSlider(false);
    }
  }, [showNotificationTray]);

  useEffect(() => {
    if (showNearbyEvents) {
      setShowFilters(false);
    }
  }, [showNearbyEvents]);

  useEffect(() => {
    if (selectedEvent) {
      setShowFilters(false);
    }
  }, [selectedEvent]);

  useEffect(() => {
    if (selectedSpot) {
      setShowFilters(false);
    }
  }, [selectedSpot]);

  const handleCreateNewEvent = useCallback(
    (
      title: string,
      description: string,
      category: any,
      organizer: string,
      time: string,
      address: string,
      imageUrl?: string,
    ) => {
      if (!tacticalLocation) return;

      const newEvent: TurismoEvent = {
        id: `custom-${Date.now()}`,
        title,
        description,
        latitude: tacticalLocation.latitude,
        longitude: tacticalLocation.longitude,
        category,
        organizer,
        time,
        address,
        attendeesCount: Math.floor(Math.random() * 30),
        imageUrl:
          imageUrl ||
          'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&q=80&w=800',
        isRealTime: true,
        status: 'agendado',
      };

      setEvents((prev) => [newEvent, ...prev]);
      setSelectedEvent(newEvent);
      setIsTacticalModeActive(false);
      setShowCreateEventModal(false);
      setTacticalLocation(null);
      showNotification(`📍 Evento "${title}" pinado en ${address}`);
    },
    [tacticalLocation, showNotification],
  );

  useEffect(() => {
    if (!showWeather) return;

    const checkRain = async () => {
      try {
        const { getLocalizedWeather } = await import('../utils/weatherUtils');
        const data = await getLocalizedWeather();
        const valdivia = data.find((d) => d.name === 'Valdivia');
        if (valdivia) {
          const willRain = valdivia.forecast.some(
            (f) =>
              f.condition.toLowerCase().includes('lluvia') ||
              f.condition.toLowerCase().includes('chubascos'),
          );
          if (willRain) {
            showNotification('Se pronostica lluvia en Valdivia en las próximas horas.', 'warning');
          }
        }
      } catch (err) {
        console.warn('Error checking rain alert:', err);
      }
    };

    void checkRain();
  }, [showWeather, showNotification]);

  const currentMaxZoom = MAX_ZOOM_PER_LAYER[mapLayer] || 18;

  const handleVoiceSearch = useCallback(
    (result: ParsedSearch) => {
      setSelectedCategory(result.category as CategoryFilter);
      setSearchQuery(result.query);

      if (result.query === '') {
        setSelectedEvent(null);
      } else {
        if (result.eventId) {
          const ev = events.find((e) => String(e.id) === String(result.eventId));
          if (ev) {
            setSelectedEvent(ev);
          }
        }
      }
    },
    [events],
  );

  const handleVoicePartialSearch = useCallback((text: string) => {
    setSearchQuery(text);
  }, []);

  const injectSimulationEvent = useCallback((type: 'embarcacion' | 'accidente' | 'incendio') => {
    let title = 'Evento simulado';
    if (type === 'embarcacion') title = 'Lancha Turística ' + Math.floor(Math.random() * 100);
    if (type === 'accidente') title = 'Accidente Menor';
    if (type === 'incendio') title = 'Foco de Incendio';

    const center = { latitude: -39.8142, longitude: -73.2459 };

    const newEvent: TurismoEvent = {
      id: `sim-${type}-${Date.now()}`,
      title,
      description: 'Entidad simulada dinámicamente',
      latitude: center.latitude + (Math.random() - 0.5) * 0.01,
      longitude: center.longitude + (Math.random() - 0.5) * 0.01,
      category: type,
      organizer: 'Simulator',
      time: 'Ahora',
      isRealTime: true,
      boatHeading: type === 'embarcacion' ? 0 : undefined,
    };

    setEvents((prev) => [...prev, newEvent]);
    showNotificationRef.current(`${title} inyectado`, 'success');
  }, []);

  const moveSimulationEvent = useCallback((id: string, deltaLat: number, deltaLng: number) => {
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === id) {
          let newHeading = e.boatHeading;
          if (e.category === 'embarcacion') {
            const angle = Math.atan2(deltaLng, deltaLat) * (180 / Math.PI);
            newHeading = angle;
          }
          return {
            ...e,
            latitude: e.latitude + deltaLat,
            longitude: e.longitude + deltaLng,
            boatHeading: newHeading,
          };
        }
        return e;
      }),
    );
  }, []);

  const triggerWebSocketEvent = useCallback(() => {
    if (simulationIndex >= WS_SIMULATION_POOL.length) {
      showNotification('ℹ️ Todos los eventos de simulación ya están en el mapa.');
      return;
    }

    const baseEvent = WS_SIMULATION_POOL[simulationIndex];
    const newEvent: TurismoEvent = {
      ...baseEvent,
      id: `ws-${Date.now()}`,
      isRealTime: true,
      attendeesCount: (baseEvent.attendeesCount ?? 0) + Math.floor(Math.random() * 20),
    };

    setEvents((prev) => [newEvent, ...prev]);
    setSelectedEvent(newEvent);
    setSimulationIndex((prev) => prev + 1);

    const isEmergencyEvent = ['choque', 'incendio', 'accidente', 'calle_cortada'].includes(
      newEvent.category,
    );
    if (isEmergencyEvent) {
      showNotificationRef.current(`🚨 ALERTA: ¡Emergencia! "${newEvent.title}"`, 'warning');
    } else {
      showNotificationRef.current(`Nuevo evento en Valdivia! "${newEvent.title}"`, 'success');
    }
  }, [simulationIndex]);

  useEffect(() => {
    if (activeTab !== 'map') return;
    const timer = setTimeout(() => {
      if (simulationIndex < WS_SIMULATION_POOL.length) {
        triggerWebSocketEvent();
      }
    }, 15000);
    return () => clearTimeout(timer);
  }, [simulationIndex, triggerWebSocketEvent, activeTab]);

  useEffect(() => {
    let isMounted = true;

    void loadPersistedMapLayer().then((storedMapLayer) => {
      if (!isMounted) {
        return;
      }

      if (storedMapLayer) {
        setMapLayer(storedMapLayer);
      }

      setMapLayerReady(true);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!mapLayerReady) {
      return;
    }

    void savePersistedMapLayer(mapLayer);
  }, [mapLayer, mapLayerReady]);

  const screenWidth = Dimensions.get('window').width;
  const isDesktop = Platform.OS === 'web' && screenWidth > 768;
  const panelWidth = isDesktop ? 380 : screenWidth;

  const openRightSheet = useCallback(() => {
    setShowRightSheet(true);
    Animated.spring(rightSheetSlide, {
      toValue: 1,
      tension: 40,
      friction: 8,
      useNativeDriver: false,
    }).start();
  }, [rightSheetSlide]);

  const closeRightSheet = useCallback(() => {
    Animated.timing(rightSheetSlide, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setShowRightSheet(false));
  }, [rightSheetSlide]);

  const openDetailsIsland = useCallback(() => {
    setShowDetailsIsland(true);
    Animated.spring(detailsIslandSlide, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();
  }, [detailsIslandSlide]);

  const closeDetailsIsland = useCallback(() => {
    Animated.timing(detailsIslandSlide, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setShowDetailsIsland(false));
  }, [detailsIslandSlide]);

  useEffect(() => {
    if (selectedEvent) {
      Animated.spring(panelSlide, {
        toValue: 1,
        tension: 50,
        friction: 10,
        useNativeDriver: false,
      }).start();
    } else {
      closeRightSheet();
      Animated.timing(panelSlide, {
        toValue: 0,
        duration: 250,
        useNativeDriver: false,
      }).start();
    }
  }, [selectedEvent, panelSlide, closeRightSheet]);

  useEffect(() => {
    if (mapPincho) {
      Animated.spring(pinchoSlide, {
        toValue: 1,
        tension: 50,
        friction: 10,
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(pinchoSlide, {
        toValue: 0,
        duration: 250,
        useNativeDriver: false,
      }).start();
    }
  }, [mapPincho, pinchoSlide]);

  const filteredEvents = useMemo(() => {
    // Si el Geo-Router está activo, filtrar pines contextuales según el filtro seleccionado
    // (ej. 'ciudad' -> comercios, 'bosque' -> senderos, spots y máquinas)
    if (isRoutingActive) {
      const activeFilterKey = (routeCategory || 'ciudad').toLowerCase();
      const filterFn =
        ROUTER_CATEGORY_PIN_FILTERS[activeFilterKey] || ROUTER_CATEGORY_PIN_FILTERS.ciudad;
      const query = searchQuery.toLowerCase();
      return events.filter((event) => {
        if (!filterFn(event)) return false;
        if (!query) return true;
        return (
          (event.title?.toLowerCase() || '').includes(query) ||
          (event.description?.toLowerCase() || '').includes(query) ||
          (event.organizer?.toLowerCase() || '').includes(query)
        );
      });
    }

    return events.filter((event) => {
      const isEmergencyEvent = ['choque', 'incendio', 'accidente', 'calle_cortada'].includes(
        event.category,
      );
      if (selectedCategories.includes('ninguno')) {
        return false;
      }

      // Cámaras: capa opt-in. Se corta aquí (y no en MODE_CATEGORIES) para que
      // ningún filtro ni alias (ej. 'emergencia' → 'camara') las cuele de vuelta.
      if (event.category === 'camara' && !showSecurityCameras) {
        return false;
      }

      // Los pines de utilidad (bancas, basureros, bebederos, ejercicio) NUNCA se muestran en modo 'mapa' ni 'comercial'.
      // En modo 'turismo', solo son elegibles aquellos que pertenecen al polígono regular de un parque o reserva.
      if (isUtilityCategory(event.category)) {
        if (mapDisplayMode !== 'turismo') {
          return false;
        }
        if (!event.parkId) {
          return false;
        }
      }

      const matchesCategory =
        selectedCategories.includes('todos') || selectedCategories.length === 0
          ? isEmergencyEvent ||
            MODE_CATEGORIES[mapDisplayMode].includes(event.category as CategoryFilter)
          : (selectedCategories.includes('emergencia') && isEmergencyEvent) ||
            selectedCategories.includes(event.category as CategoryFilter) ||
            selectedCategories.some((cat) => CATEGORY_ALIASES[cat]?.includes(event.category));
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        (event.title?.toLowerCase() || '').includes(query) ||
        (event.description?.toLowerCase() || '').includes(query) ||
        (event.organizer?.toLowerCase() || '').includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [
    events,
    isRoutingActive,
    routeCategory,
    selectedCategories,
    searchQuery,
    mapDisplayMode,
    showSecurityCameras,
  ]);

  const visibleOsmCategories = useMemo(() => {
    // Con Geo-Router activo, la capa OSM sigue el mismo filtro contextual que los pines.
    if (isRoutingActive) {
      const filterFn =
        ROUTER_CATEGORY_PIN_FILTERS[(routeCategory || 'ciudad').toLowerCase()] ||
        ROUTER_CATEGORY_PIN_FILTERS.ciudad;
      return ALL_OSM_CATEGORIES.filter((category) =>
        filterFn({ id: '', category } as TurismoEvent),
      );
    }
    return ALL_OSM_CATEGORIES.filter((cat) =>
      isCategoryVisible(cat, selectedCategories, mapDisplayMode, showSecurityCameras),
    );
  }, [isRoutingActive, routeCategory, selectedCategories, mapDisplayMode, showSecurityCameras]);

  const isTacticalModeActiveRef = useRef(isTacticalModeActive);
  useEffect(() => {
    isTacticalModeActiveRef.current = isTacticalModeActive;
  }, [isTacticalModeActive]);

  const showNotificationRef = useRef(showNotification);
  useEffect(() => {
    showNotificationRef.current = showNotification;
  }, [showNotification]);

  const handleMapPincho = useCallback((location: MapCoordinate) => {
    if (!isTacticalModeActiveRef.current) {
      return;
    }

    setSelectedEvent(null);
    setMapPincho({
      latitude: location.latitude,
      longitude: location.longitude,
      surface: location.surface,
      address: 'Resolviendo dirección...',
      imageUrl: buildGoogleStreetViewUrl(location.latitude, location.longitude),
      googleMapsUrl: buildGoogleMapsSearchUrl(location.latitude, location.longitude),
      isResolving: true,
    });

    // Set tactical location to show TacticalHUD over the clicked location
    setTacticalLocation({
      latitude: location.latitude,
      longitude: location.longitude,
      x: location.x,
      y: location.y,
      surface: location.surface,
    });

    showNotificationRef.current('Pincho colocado en el mapa', 'success');
  }, []);

  const clearMapPincho = useCallback(() => {
    setMapPincho(null);
    setTacticalLocation(null);
  }, []);

  const closeEventPanel = useCallback(() => {
    closeRightSheet();
    setSelectedEvent(null);
  }, [closeRightSheet]);

  // ── Routing Logic (Geo-Router) ──────────────────────────────────────────

  const { userLocation } = useUserLocationContext();

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // metres
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in metres
  };

  const hasAutoInjectedOriginRef = useRef(false);

  useEffect(() => {
    if (!isRoutingActive) {
      hasAutoInjectedOriginRef.current = false;
      return;
    }

    if (
      !hasAutoInjectedOriginRef.current &&
      (routingType === 'single_target' || routingType === 'ciclovia' || routingType === 'sector') &&
      draftRoutePoints.length === 0 &&
      userLocation
    ) {
      hasAutoInjectedOriginRef.current = true;
      setDraftRoutePoints([
        {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          type: 'origin',
          orderIndex: 0,
        },
      ]);
      showNotification('Origen fijado en tu ubicación GPS', 'info');
    }
  }, [isRoutingActive, routingType, userLocation, showNotification]);

  // Previsualización automática del trazado en calles reales con OSRM Multi-Stop
  useEffect(() => {
    if (
      !isRoutingActive ||
      routingType === 'sector' ||
      routingType === 'measure' ||
      draftRoutePoints.length < 2
    ) {
      if (draftRoutePoints.length < 2) {
        setDraftRouteGeojson(null);
        setOsrmDistance(0);
        setOsrmDuration(0);
        setRouteAlternatives([]);
        setSelectedAlternativeIndex(0);
        primaryRouteRef.current = null;
      }
      return;
    }

    let isCancelled = false;
    const timer = setTimeout(async () => {
      setIsCalculatingOsrm(true);
      try {
        const route = await fetchOsrmMultiRoute(
          draftRoutePoints.map((p) => ({ latitude: p.latitude, longitude: p.longitude, name: p.name })),
          transportMode,
          { includeAlternatives: true },
        );
        if (!isCancelled) {
          primaryRouteRef.current = route;
          setDraftRouteGeojson(route.geojson);
          setOsrmDistance(route.distance);
          setOsrmDuration(route.duration);
          setRouteAlternatives(route.alternatives ?? []);
          setSelectedAlternativeIndex(0);
        }
      } catch (err) {
        console.warn('[Social Geo-Router] Error calculando OSRM:', err);
      } finally {
        if (!isCancelled) {
          setIsCalculatingOsrm(false);
        }
      }
    }, 350);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [isRoutingActive, routingType, draftRoutePoints, transportMode]);

  const selectRouteAlternative = useCallback(
    (index: number) => {
      if (index === 0 && primaryRouteRef.current) {
        setSelectedAlternativeIndex(0);
        setDraftRouteGeojson(primaryRouteRef.current.geojson);
        setOsrmDistance(primaryRouteRef.current.distance);
        setOsrmDuration(primaryRouteRef.current.duration);
        return;
      }
      const alt = routeAlternatives[index - 1];
      if (alt) {
        setSelectedAlternativeIndex(index);
        setDraftRouteGeojson(alt.geojson);
        setOsrmDistance(alt.distance);
        setOsrmDuration(alt.duration);
      }
    },
    [routeAlternatives],
  );

  const optimizeDraftRouteOrder = useCallback(async () => {
    if (draftRoutePoints.length < 3) {
      showNotification('Se necesitan al menos 3 paradas para optimizar el recorrido', 'info');
      return;
    }
    setIsOptimizingTrip(true);
    try {
      const res = await fetchOptimizedTrip(
        draftRoutePoints.map((p) => ({ latitude: p.latitude, longitude: p.longitude, name: p.name })),
        transportMode,
      );

      const reordered: RoutePoint[] = res.orderedIndices.map((origIdx, newIdx) => {
        const p = draftRoutePoints[origIdx];
        let pType: RoutePointType = 'waypoint';
        if (newIdx === 0) pType = 'origin';
        else if (newIdx === res.orderedIndices.length - 1 && isRouteFinished) pType = 'destination';
        return {
          ...p,
          type: pType,
          orderIndex: newIdx,
        };
      });

      setDraftRoutePoints(reordered);
      primaryRouteRef.current = res.route;
      setDraftRouteGeojson(res.route.geojson);
      setOsrmDistance(res.route.distance);
      setOsrmDuration(res.route.duration);
      setRouteAlternatives(res.route.alternatives ?? []);
      setSelectedAlternativeIndex(0);

      const savedMsg =
        res.distanceSavedMeters > 30
          ? `¡Ruta optimizada! Se redujo ${formatDistance(res.distanceSavedMeters)} de recorrido`
          : '¡Ruta optimizada con el itinerario de paradas más eficiente!';
      showNotification(savedMsg, 'success');
    } catch (err: any) {
      console.error('[Social Geo-Router] Error optimizando itinerario:', err);
      showNotification('No se pudo optimizar el orden en este momento', 'warning');
    } finally {
      setIsOptimizingTrip(false);
    }
  }, [draftRoutePoints, transportMode, isRouteFinished, showNotification]);

  const undoLastRoutePoint = useCallback(() => {
    setDraftRoutePoints((prev) => {
      if (prev.length <= 1) {
        setDraftRouteGeojson(null);
        setOsrmDistance(0);
        setOsrmDuration(0);
        setRouteAlternatives([]);
        setSelectedAlternativeIndex(0);
        primaryRouteRef.current = null;
        return [];
      }
      return prev.slice(0, -1);
    });
    setIsRouteFinished(false);
  }, []);

  const recalculateDraftRoute = useCallback(async () => {
    if (
      !isRoutingActive ||
      routingType === 'sector' ||
      routingType === 'measure' ||
      draftRoutePoints.length < 2
    ) {
      if (draftRoutePoints.length < 2) {
        showNotification('Añade al menos 2 puntos para calcular una ruta', 'info');
      }
      return;
    }

    setIsCalculatingOsrm(true);
    showNotification('Recalculando la mejor ruta...', 'info');
    try {
      const route = await fetchOsrmMultiRoute(
        draftRoutePoints.map((p) => ({ latitude: p.latitude, longitude: p.longitude, name: p.name })),
        transportMode,
        { includeAlternatives: true },
      );
      primaryRouteRef.current = route;
      setDraftRouteGeojson(route.geojson);
      setOsrmDistance(route.distance);
      setOsrmDuration(route.duration);
      setRouteAlternatives(route.alternatives ?? []);
      setSelectedAlternativeIndex(0);
      showNotification('¡Ruta recalculada con éxito!', 'success');
    } catch (err) {
      console.warn('[Social Geo-Router] Error recalculando ruta:', err);
      showNotification('No se pudo recalcular la ruta en este momento', 'warning');
    } finally {
      setIsCalculatingOsrm(false);
    }
  }, [isRoutingActive, routingType, draftRoutePoints, transportMode, showNotification]);

  const handleMapClickForRouting = useCallback(
    (location: MapCoordinate & {
      name?: string;
      businessId?: number;
      eventId?: string;
      category?: string;
    }) => {
      if (!isRoutingActive || isRouteFinished) return;

      const newPoint: RoutePoint = {
        latitude: location.latitude,
        longitude: location.longitude,
        name: location.name,
        type: 'waypoint',
        orderIndex: draftRoutePoints.length,
        businessId: location.businessId,
        eventId: location.eventId,
        category: location.category,
      };

      if (location.name) {
        showNotification(`📍 Negocio añadido: ${location.name}`, 'success');
      }

      if (routingType === 'direct') {
        if (draftRoutePoints.length === 0) {
          newPoint.type = 'origin';
          setDraftRoutePoints([newPoint]);
        } else if (draftRoutePoints.length === 1) {
          newPoint.type = 'destination';
          setDraftRoutePoints((prev) => [...prev, newPoint]);
          setIsRouteFinished(true);
          showNotification('Ruta directa completada', 'success');
        }
      } else if (
        routingType === 'single_target' ||
        routingType === 'ciclovia' ||
        routingType === 'sector' ||
        routingType === 'measure'
      ) {
        // En Objetivo Único, el origen es dinámico (podríamos pedirlo o usar GPS)
        // Por simplicidad del brief, el primer clic si no hay nada es el destino?
        // No, el brief dice "Origen Dinámico: El sistema toma la ubicación GPS actual".
        // Pero si no hay GPS, permitamos el primer clic como origen.
        if (draftRoutePoints.length === 0) {
          newPoint.type = 'origin';
          setDraftRoutePoints([newPoint]);
        } else {
          // Clics intermedios son waypoints (giros).
          // El usuario debe "Finalizar" manualmente o el último clic es destino?
          // El brief dice "El último clic define el punto final".
          // Así que seguimos agregando waypoints hasta que el usuario decida que el último es destino.
          setDraftRoutePoints((prev) => [...prev, newPoint]);
        }
      } else if (routingType === 'multi_target') {
        if (draftRoutePoints.length === 0) {
          newPoint.type = 'origin';
          setDraftRoutePoints([newPoint]);
        } else {
          // Snapping logic
          const origin = draftRoutePoints[0];
          const dist = calculateDistance(
            location.latitude,
            location.longitude,
            origin.latitude,
            origin.longitude,
          );

          if (dist < 25) {
            // Umbral de 25 metros para snapping
            newPoint.latitude = origin.latitude;
            newPoint.longitude = origin.longitude;
            newPoint.type = 'destination'; // Cierra el circuito
            setDraftRoutePoints((prev) => [...prev, newPoint]);
            setIsRouteFinished(true);
            showNotification('Circuito cerrado detectado', 'info');
          } else {
            newPoint.type = 'target';
            // Aquí se debería abrir un prompt para el nombre, pero lo haremos en el HUD
            setDraftRoutePoints((prev) => [...prev, newPoint]);
          }
        }
      }
    },
    [isRoutingActive, isRouteFinished, routingType, draftRoutePoints, showNotification],
  );

  const finishSingleTargetRoute = useCallback(() => {
    if (routingType === 'measure') {
      setDraftRoutePoints([]);
      return;
    }
    const minPoints = routingType === 'sector' ? 3 : 2;
    if (draftRoutePoints.length < minPoints) return;

    setDraftRoutePoints((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      const newPoints = [...prev];
      newPoints[newPoints.length - 1] = { ...last, type: 'destination' };
      return newPoints;
    });
    setIsRouteFinished(true);
    showNotification(
      routingType === 'sector'
        ? 'Polígono cerrado exitosamente'
        : 'Ruta trazada exitosamente. Asigna un nombre para guardarla.',
      'success',
    );
  }, [routingType, draftRoutePoints, showNotification]);

  const saveRoute = useCallback(async () => {
    if (!draftRouteName.trim()) {
      showNotification(
        routingType === 'sector'
          ? 'Debes asignar un nombre al sector'
          : 'Debes asignar un nombre a la ruta',
        'warning',
      );
      return;
    }

    try {
      const isSector = routingType === 'sector';
      const endpoint = isSector
        ? `${API_URL}/api/v1/zones`
        : `${API_URL}/api/v1/user/routes`;

      const bodyPayload = isSector
        ? {
            name: draftRouteName.trim(),
            description: 'Sector creado desde el mapa',
            category: routeCategory || 'edificio',
            color:
                routeCategory === 'edificio'
                ? '#6366F1'
                : routeCategory === 'reserva' || routeCategory === 'bosque'
                  ? '#10B981'
                  : routeCategory === 'subzona'
                    ? '#A855F7'
                    : '#F59E0B',
            points: draftRoutePoints.map((p, i) => ({
              latitude: p.latitude,
              longitude: p.longitude,
              orderIndex: i,
              pointType: p.type,
            })),
          }
        : {
            name: draftRouteName.trim(),
            type: routingType,
            category: routeCategory,
            targetAudience: 'all',
            visibility: routeVisibility,
            transportMode: transportMode,
            geomGeojson: draftRouteGeojson ? JSON.stringify(draftRouteGeojson) : '',
            points: draftRoutePoints.map((p, i) => ({
              latitude: p.latitude,
              longitude: p.longitude,
              orderIndex: i,
              pointType: p.type,
              name: p.name || '',
            })),
          };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyPayload),
      });

      if (response.ok) {
        const resData = await response.json();
        if (resData.shareToken) {
          setLatestShareToken(resData.shareToken);
        }

        showNotification(
          isSector
            ? 'Sector guardado exitosamente'
            : routeVisibility === 'unlisted'
              ? 'Ruta creada con enlace para compartir'
              : 'Ruta guardada exitosamente',
          'success',
        );

        hasAutoInjectedOriginRef.current = false;
        setIsRoutingActive(false);
        setDraftRoutePoints([]);
        setDraftRouteName('');
        setDraftRouteGeojson(null);
        setOsrmDistance(0);
        setOsrmDuration(0);
        setRouteAlternatives([]);
        setSelectedAlternativeIndex(0);
        primaryRouteRef.current = null;
        setIsRouteFinished(false);

        if (isSector) {
          fetchSectors();
        } else {
          fetchSavedRoutes();
        }
      } else {
        showNotification(
          isSector ? 'Error al guardar el sector' : 'Error al guardar la ruta',
          'error',
        );
      }
    } catch (error) {
      console.error('Error saving:', error);
      showNotification('Error de conexión al guardar', 'error');
    }
  }, [
    draftRouteName,
    routingType,
    draftRoutePoints,
    token,
    routeCategory,
    routeVisibility,
    transportMode,
    draftRouteGeojson,
    showNotification,
    fetchSectors,
    fetchSavedRoutes,
  ]);

  const cancelRouting = useCallback(() => {
    hasAutoInjectedOriginRef.current = false;
    setIsRoutingActive(false);
    setDraftRoutePoints([]);
    setDraftRouteName('');
    setDraftRouteGeojson(null);
    setOsrmDistance(0);
    setOsrmDuration(0);
    setRouteAlternatives([]);
    setSelectedAlternativeIndex(0);
    primaryRouteRef.current = null;
    setIsRouteFinished(false);
    showNotification('Trazado de ruta cancelado');
  }, [showNotification]);

  const rateRoute = useCallback(
    async (routeId: string, rating: number, comment?: string) => {
      if (!token) {
        showNotification('Inicia sesión para calificar rutas', 'warning');
        openAuthModal('login');
        return;
      }

      try {
        const response = await fetch(`${API_URL}/api/v1/routes/${routeId}/rate`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ rating, comment }),
        });

        if (response.ok) {
          showNotification('¡Gracias por calificar la ruta!', 'success');
          fetchSavedRoutes(); // Refrescar promedio en el mapa
        } else {
          showNotification('Error al enviar calificación', 'error');
        }
      } catch (error) {
        console.error('Error rating route:', error);
        showNotification('Error de conexión', 'error');
      }
    },
    [token, showNotification, fetchSavedRoutes, openAuthModal],
  );

  const completeRoute = useCallback(
    async (routeId: string) => {
      if (!token) {
        showNotification('Inicia sesión para registrar tus rutas completadas', 'warning');
        openAuthModal('login');
        return;
      }

      try {
        const response = await fetch(`${API_URL}/api/v1/routes/${routeId}/save`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: 'completed' }),
        });

        if (response.ok) {
          showNotification('🎉 ¡Ruta completada! Puedes calificarla y compartir tu experiencia', 'success');
          fetchSavedRoutes();
        } else {
          showNotification('Error al registrar ruta completada', 'error');
        }
      } catch (error) {
        console.error('Error completing route:', error);
        showNotification('Error de conexión', 'error');
      }
    },
    [token, showNotification, fetchSavedRoutes, openAuthModal],
  );

  const handleSelectEvent = useCallback(
    (event: TurismoEvent | null) => {
      // If routing is active, clicking an event adds it as a waypoint/target
      if (isRoutingActive) {
        if (event && !isRouteFinished) {
          handleMapClickForRouting({
            latitude: event.latitude,
            longitude: event.longitude,
            name: event.title,
            businessId: (event as any).businessId,
            eventId: event.id,
            category: event.category,
          });
        }
        return;
      }
      if (event) {
        setMapPincho(null);
      }
      setSelectedEvent(event);
    },
    [isRoutingActive, isRouteFinished, handleMapClickForRouting],
  );

  return {
    events,
    setEvents,
    closeRightSheet,
    showDetailsIsland,
    detailsIslandSlide,
    openDetailsIsland,
    closeDetailsIsland,
    selectedCategories,
    setSelectedCategories,
    selectedCategory,
    setSelectedCategory,
    selectedEvent,
    setSelectedEvent,
    selectedSpot,
    setSelectedSpot,
    searchQuery,
    setSearchQuery,
    simulationIndex,
    setSimulationIndex,
    mapLayer,
    setMapLayer,
    mapLayerReady,
    setMapLayerReady,
    showTraffic,
    setShowTraffic,
    showCycleways,
    setShowCycleways,
    cycleways,
    showSectors,
    setShowSectors,
    sectors,
    visibleSectorIds,
    setVisibleSectorIds,
    showWeather,
    setShowWeather,
    weatherType,
    setWeatherType,
    activeTab,
    setActiveTab: handleSetTab,
    showFilters,
    setShowFilters,
    showToolsMenu,
    setShowToolsMenu,
    showSectorsConfig,
    setShowSectorsConfig,
    isTacticalModeActive,
    setIsTacticalModeActive,
    showZoomSlider,
    setShowZoomSlider,
    activeNestedZone,
    setActiveNestedZone,
    selectedSector,
    setSelectedSector,
    activeBuildingId,
    setActiveBuildingId,
    isMagicWandActive,
    setIsMagicWandActive,
    extractedGeometry,
    setExtractedGeometry,
    activeFloor,
    setActiveFloor,
    isTelemetryExpanded,
    setIsTelemetryExpanded,
    tacticalLocation,
    setTacticalLocation,
    mapPincho,
    setMapPincho,
    handleMapPincho,
    clearMapPincho,
    resolvedAddress,
    setResolvedAddress,
    isResolvingAddress,
    showCreateEventModal,
    setShowCreateEventModal,
    showNearbyEvents,
    setShowNearbyEvents,
    handleCreateNewEvent,
    notifications,
    setNotifications,
    showNotificationTray,
    setShowNotificationTray,
    userProfile,
    panelSlide,
    pinchoSlide,
    showRightSheet,
    rightSheetSlide,
    checkInModalRecord,
    setCheckInModalRecord,
    showCheckInModal,
    setShowCheckInModal,
    centerTrigger,
    setCenterTrigger,
    zoom,
    setZoom,
    mapBounds,
    setMapBounds,
    currentMaxZoom,
    showNotification,
    handleVoiceSearch,
    handleVoicePartialSearch,
    triggerWebSocketEvent,
    injectSimulationEvent,
    moveSimulationEvent,
    isDesktop,
    screenWidth,
    panelWidth,
    openRightSheet,
    filteredEvents,
    visibleOsmCategories,
    handleSelectEvent,
    closeEventPanel,

    // Tourist/Local view mode
    viewMode,
    handleToggleViewMode,

    // Map content mode (Mapa/Turismo/Comercial)
    mapDisplayMode,
    setMapDisplayMode: handleMapDisplayModeChange,

    // Routing Mode (Geo-Router)
    isRoutingActive,
    setIsRoutingActive,
    routingType,
    setRoutingType,
    routeCategory,
    setRouteCategory,
    draftRoutePoints,
    setDraftRoutePoints,
    draftRouteName,
    setDraftRouteName,
    isRouteFinished,
    setIsRouteFinished,
    savedRoutes,
    showSavedRoutes,
    setShowSavedRoutes,
    handleMapClickForRouting,
    finishSingleTargetRoute,
    saveRoute,
    cancelRouting,
    rateRoute,
    completeRoute,
    transportMode,
    setTransportMode,
    routeVisibility,
    setRouteVisibility,
    draftRouteGeojson,
    osrmDistance,
    osrmDuration,
    isCalculatingOsrm,
    undoLastRoutePoint,
    latestShareToken,
    routeAlternatives,
    selectedAlternativeIndex,
    selectRouteAlternative,
    optimizeDraftRouteOrder,
    isOptimizingTrip,
    recalculateDraftRoute,

    // On-screen Toast notifications
    activeToast,
    setActiveToast,

    // Motor de Cámara y Efectos GTA V
    cameraAnimationsEnabled,
    setCameraAnimationsEnabled,
    toggleCameraAnimations,

    // Capa opcional de cámaras de seguridad
    showSecurityCameras,
    toggleSecurityCameras,
  };
}
