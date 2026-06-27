import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Animated, Platform, Dimensions } from 'react-native';
import { router } from 'expo-router';

import {
  TurismoEvent,
  MapLayer,
  MAX_ZOOM_PER_LAYER,
  MapCoordinate,
  RouteType,
  RoutePoint,
  RoutePointType,
  Zone,
} from '../../src/components/Map/types';
import { CheckInRecord } from '../../src/utils/checkInStorage';
import { ParsedSearch } from '../../src/utils/aiSearchParser';
import { TabType, MapDisplayMode } from '../../src/components/MapUI';
import {
  DEFAULT_MAP_LAYER,
  loadPersistedMapLayer,
  savePersistedMapLayer,
} from '../../src/utils/mapPreferences';
import { loadUserProfile, saveUserProfile } from '../../src/utils/userProfileStorage';
import { useUserLocationContext } from '../../src/context/UserLocationContext';
import {
  buildGoogleMapsSearchUrl,
  buildGoogleStreetViewUrl,
  formatPinchoCoordinates,
  reverseGeocode,
} from '../../src/utils/mapPincho';
import { INITIAL_EVENTS, WS_SIMULATION_POOL, CategoryFilter } from '../../src/data/mockEvents';

// Categorías visibles por modo de mapa. 'mapa' = infraestructura/seguridad de la ciudad,
// 'turismo' = atractivos y naturaleza, 'comercial' = comercio y gastronomía.
const MODE_CATEGORIES: Record<MapDisplayMode, CategoryFilter[]> = {
  mapa: ['hospital', 'universidad', 'bombero', 'carabinero', 'camara', 'emergencia', 'publico'],
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
    'embarcacion',
    'parque',
    'agua',
    'humedal',
  ],
  comercial: ['tienda', 'gastronomia'],
};

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
  const [userProfile, setUserProfile] = useState<any>(null);
  const [events, setEvents] = useState<TurismoEvent[]>(INITIAL_EVENTS);
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('todos');
  const [selectedEvent, setSelectedEvent] = useState<TurismoEvent | null>(null);
  const [viewMode, setViewMode] = useState<'local' | 'tourist'>('local');
  const [mapDisplayMode, setMapDisplayMode] = useState<MapDisplayMode>('mapa');

  // ── Nested Zones State ─────────────────────────────────────────────────
  const [activeNestedZone, setActiveNestedZone] = useState<any>(null);
  const [selectedSector, setSelectedSector] = useState<Zone | null>(null);

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

  useEffect(() => {
    const fetchCycleways = async () => {
      try {
        const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8080';
        const response = await fetch(`${baseUrl}/api/v1/cycleways`);
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
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8080';
      let url = `${baseUrl}/api/v1/zones`;
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
          const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8080';
          const response = await fetch(`${baseUrl}/api/v1/cycleways`);
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
  const [routingType, setRoutingType] = useState<RouteType>('direct');
  const [routeCategory, setRouteCategory] = useState('turistica');
  const [draftRoutePoints, setDraftRoutePoints] = useState<RoutePoint[]>([]);
  const [draftRouteName, setDraftRouteName] = useState('');
  const [isRouteFinished, setIsRouteFinished] = useState(false);
  const [savedRoutes, setSavedRoutes] = useState<any[]>([]);
  const [showSavedRoutes, setShowSavedRoutes] = useState(true);

  const fetchSavedRoutes = useCallback(async () => {
    try {
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8080';
      const response = await fetch(`${baseUrl}/api/v1/routes`);
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
        const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8080';
        await fetch(`${baseUrl}/api/v1/profile/view-mode`, {
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
        router.push('/ingresar');
        return;
      }
      setRawActiveTab(tab);
    },
    [token, showNotification],
  );
  const [panelSlide] = useState(() => new Animated.Value(0));
  const [showRightSheet, setShowRightSheet] = useState(false);
  const [rightSheetSlide] = useState(() => new Animated.Value(0));
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
          ? `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/v1/places/search?q=${encodeURIComponent(search)}&viewMode=${viewMode}`
          : `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/v1/places/search?viewMode=${viewMode}`;

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
            const newPlaces = data.results.filter((rp: any) => !existingIds.has(rp.id));
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
        const { getLocalizedWeather } = await import('../../src/utils/weatherUtils');
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
      showNotification(`Búsqueda: "${result.originalText}"`);
    },
    [showNotification],
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
      duration: 220,
      useNativeDriver: false,
    }).start(() => {
      setShowRightSheet(false);
    });
  }, [rightSheetSlide]);

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

  const filteredEvents = useMemo(
    () =>
      events.filter((event) => {
        const isEmergencyEvent = ['choque', 'incendio', 'accidente', 'calle_cortada'].includes(
          event.category,
        );
        const matchesCategory =
          selectedCategory === 'todos'
            ? isEmergencyEvent || MODE_CATEGORIES[mapDisplayMode].includes(event.category as CategoryFilter)
            : (selectedCategory === 'emergencia' && isEmergencyEvent) ||
              event.category === selectedCategory;
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          (event.title?.toLowerCase() || '').includes(query) ||
          (event.description?.toLowerCase() || '').includes(query) ||
          (event.organizer?.toLowerCase() || '').includes(query);
        return matchesCategory && matchesSearch;
      }),
    [events, selectedCategory, searchQuery, mapDisplayMode],
  );

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

  useEffect(() => {
    if (
      isRoutingActive &&
      (routingType === 'single_target' || routingType === 'ciclovia' || routingType === 'sector') &&
      draftRoutePoints.length === 0 &&
      userLocation
    ) {
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
  }, [isRoutingActive, routingType, draftRoutePoints.length, userLocation, showNotification]);

  const handleMapClickForRouting = useCallback(
    (location: MapCoordinate) => {
      if (!isRoutingActive || isRouteFinished) return;

      const newPoint: RoutePoint = {
        latitude: location.latitude,
        longitude: location.longitude,
        type: 'waypoint',
        orderIndex: draftRoutePoints.length,
      };

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
    if (
      (routingType !== 'single_target' && routingType !== 'ciclovia' && routingType !== 'sector') ||
      draftRoutePoints.length < (routingType === 'sector' ? 3 : 2)
    )
      return;
    setDraftRoutePoints((prev) => {
      const last = prev[prev.length - 1];
      const newPoints = [...prev];
      newPoints[newPoints.length - 1] = { ...last, type: 'destination' };
      return newPoints;
    });
    setIsRouteFinished(true);
    showNotification(
      routingType === 'ciclovia'
        ? 'Ciclovía trazada exitosamente'
        : routingType === 'sector'
          ? 'Polígono cerrado exitosamente'
          : 'Ruta de objetivo único finalizada',
      'success',
    );
  }, [routingType, draftRoutePoints, showNotification]);

  const saveRoute = useCallback(async () => {
    if (!draftRouteName) {
      showNotification(
        routingType === 'sector'
          ? 'Debes asignar un nombre al sector'
          : 'Debes asignar un nombre a la ruta',
        'warning',
      );
      return;
    }

    try {
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8080';
      const endpoint =
        routingType === 'sector' ? `${baseUrl}/api/v1/zones` : `${baseUrl}/api/v1/routes`;
      const bodyPayload =
        routingType === 'sector'
          ? {
              name: draftRouteName,
              description: 'Sector creado desde el mapa',
              category: routeCategory || 'edificio',
              color:
                routeCategory === 'edificio'
                  ? '#6366F1'
                  : routeCategory === 'reserva'
                    ? '#22C55E'
                    : routeCategory === 'subzona'
                      ? '#A855F7'
                      : '#EAB308',
              points: draftRoutePoints.map((p, i) => ({
                latitude: p.latitude,
                longitude: p.longitude,
                orderIndex: i,
                pointType: p.type,
              })),
            }
          : {
              name: draftRouteName,
              type: routingType,
              category: routeCategory,
              targetAudience: 'all',
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
        showNotification(
          routingType === 'sector' ? 'Sector guardado exitosamente' : 'Ruta guardada exitosamente',
          'success',
        );
        setIsRoutingActive(false);
        setDraftRoutePoints([]);
        setDraftRouteName('');
        setIsRouteFinished(false);
        if (routingType === 'sector') {
          fetchSectors();
        } else {
          fetchSavedRoutes();
        }
      } else {
        showNotification(
          routingType === 'sector' ? 'Error al guardar el sector' : 'Error al guardar la ruta',
          'error',
        );
      }
    } catch (error) {
      console.error('Error saving:', error);
      showNotification('Error de conexión al guardar', 'error');
    }
  }, [draftRouteName, routingType, draftRoutePoints, token, routeCategory, showNotification]);

  const cancelRouting = useCallback(() => {
    setIsRoutingActive(false);
    setDraftRoutePoints([]);
    setDraftRouteName('');
    setIsRouteFinished(false);
    showNotification('Trazado de ruta cancelado');
  }, [showNotification]);

  const rateRoute = useCallback(
    async (routeId: string, rating: number, comment?: string) => {
      if (!token) {
        showNotification('Inicia sesión para calificar rutas', 'warning');
        router.push('/ingresar');
        return;
      }

      try {
        const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8080';
        const response = await fetch(`${baseUrl}/api/v1/routes/${routeId}/rate`, {
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
    [token, showNotification, fetchSavedRoutes],
  );

  const handleSelectEvent = useCallback(
    (event: TurismoEvent | null) => {
      // If routing is active, clicking an event adds it as a waypoint/target
      if (isRoutingActive) {
        if (event && !isRouteFinished) {
          handleMapClickForRouting({ latitude: event.latitude, longitude: event.longitude });
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
    selectedCategory,
    setSelectedCategory,
    selectedEvent,
    setSelectedEvent,
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
    closeRightSheet,
    filteredEvents,
    handleSelectEvent,
    closeEventPanel,

    // Tourist/Local view mode
    viewMode,
    handleToggleViewMode,

    // Map content mode (Mapa/Turismo/Comercial)
    mapDisplayMode,
    setMapDisplayMode,

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

    // On-screen Toast notifications
    activeToast,
    setActiveToast,
  };
}
