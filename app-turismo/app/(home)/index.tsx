import React, { Suspense, useState, useCallback, useEffect, useMemo } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
  Animated,
  Pressable,
  Image,
  ActivityIndicator,
  TextInput,
  Linking,
  Share,
  Clipboard,
  StyleSheet,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StatusBar } from 'expo-status-bar';

import { TelemetryWidget } from '../../src/components/MapUI/TelemetryWidget';
import {
  TopAppBar,
  WeatherForecastWidget,
  NotificationTray,
  RouterHUD,
  TacticalHUD,
} from '../../src/components/MapUI';
import { TelemetryHUD } from '../../src/components/MapUI/TelemetryHUD';
import { BuildingGallery } from '../../src/components/MapUI/BuildingGallery';
import { ParkImageSlider } from '../../src/components/MapUI/ParkImageSlider';
import { MyLocationButton } from '../../src/components/MapUI/MyLocationButton';
import {
  EventCheckInSection,
  LocationErrorNotifier,
  SectorConfigPanel,
} from '../../src/components/MapUI';
import { MapContainer } from '../../src/components/Map/MapContainer';
import { getCategoryColor, getCategoryIcon } from '../../src/utils/mapUtils';
import { CHECKIN_EXCLUDED_CATEGORIES } from '../../src/utils/checkInStorage';
import { getZoneCentroid } from '../../src/utils/locationUtils';
import FloatingIsland from '../../src/components/ui/FloatingIsland';
import { ContextualRadialMenu, SearchableSelect } from '../../src/components/ui';
import { SaveToCollectionModal } from '../../src/components/ui/SaveToCollectionModal';
import { NearbyEventsPanel } from '../../src/components/MapUI/NearbyEventsPanel';
import { LoadingFallback } from '../../src/components/ui/LoadingFallback';
import { CheckInModal } from '../../src/components/ui/CheckInModal';
import { CollectionsFloatingIsland } from '../../src/components/ui/CollectionsFloatingIsland';
import { CreatePointModal } from '../../src/components/MapUI/CreatePointModal';
import { CreateSectorModal } from '../../src/components/MapUI/CreateSectorModal';
import { CoordsEditorHUD } from '../../src/components/MapUI/CoordsEditorHUD';
import { CategoryFilter, CATEGORY_ICONS, MAP_LAYER_OPTIONS } from '../../src/data/mockEvents';
import { ContextualSurveyWidget } from '../../src/components/ui/ContextualSurveyWidget';
import { useAuth } from '../../src/context/AuthContext';
import { lazyWithRetry } from '../../src/utils/lazyWithRetry';
import { PlacesShelfTrigger, PlacesShelfPanel, PlaceItem } from '../../src/components/ui/BottomPlaceCarousel';

import { useHomeScreenState } from './useHomeScreenState';
import { styles, NAVBAR_CLEARANCE } from './styles';

// --- Lazy-loaded screens ---
const UserProfileScreen = lazyWithRetry(() => import('../../src/screens/UserProfileScreen'));
const FeedScreen = lazyWithRetry(() => import('../../src/screens/FeedScreen'));
const PassportScreen = lazyWithRetry(() => import('../../src/screens/PassportScreen'));
const ForumScreen = lazyWithRetry(() => import('../../src/screens/ForumScreen'));
const EventsScreen = lazyWithRetry(() => import('../../src/screens/EventsScreen'));

// Prefetch helpers
const prefetchFeed = () => import('../../src/screens/FeedScreen');
const prefetchSaved = () => import('../../src/screens/PassportScreen');
const prefetchForum = () => import('../../src/screens/ForumScreen');
const prefetchProfile = () => import('../../src/screens/UserProfileScreen');
const prefetchEventos = () => import('../../src/screens/EventsScreen');
const prefetchHistorial = () => import('../../src/screens/PassportScreen');

// @ts-ignore - Safety fallback for legacy build references
const isEmergency = false;

// ── ControlTooltip ─────────────────────────────────────────────────────────
// Web: hover. Mobile: long-press (1.5s auto-hide).
// buttonSize prop → posicionamiento numérico exacto (sin percentages frágiles).

const TOOLTIP_H = 28; // approx: paddingVertical*2 + fontSize*lineHeight

interface ControlTooltipProps {
  label: string;
  children: React.ReactNode;
  buttonSize: number;
}

const ControlTooltip: React.FC<ControlTooltipProps> = ({ label, children, buttonSize }) => {
  const [visible, setVisible] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = React.useCallback(() => setVisible(true), []);
  const hide = React.useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  }, []);
  const showMobile = React.useCallback(() => {
    setVisible(true);
    timerRef.current = setTimeout(() => setVisible(false), 1500);
  }, []);

  React.useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  // Web event handlers — objeto estable via useMemo
  const webProps = React.useMemo(
    () => Platform.OS === 'web' ? { onMouseEnter: show, onMouseLeave: hide } : null,
    [show, hide],
  );

  // Inyecta onLongPress en el child sin sobreescribir el existente
  const child = children as React.ReactElement;
  const childWithPress = Platform.OS !== 'web'
    ? React.cloneElement(child as React.ReactElement<any>, {
        onLongPress: () => {
          (child.props as any)?.onLongPress?.();
          showMobile();
        },
      })
    : child;

  // Posicionamiento numérico exacto: tooltip a la izquierda del botón
  const tooltipRight = buttonSize + 10; // gap de 10px
  const tooltipTop   = Math.round((buttonSize - TOOLTIP_H) / 2);

  return (
    <View style={tooltipWrap} {...(webProps as any)}>
      {childWithPress}
      {visible && (
        <View
          style={[tooltipStyles.bubble, { right: tooltipRight, top: tooltipTop }]}
          pointerEvents="none"
        >
          <Text style={tooltipStyles.text} numberOfLines={1}>{label}</Text>
          <View style={tooltipStyles.arrow} />
        </View>
      )}
    </View>
  );
};

const tooltipWrap = { position: 'relative' } as const;

const tooltipStyles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    backgroundColor: 'rgba(10, 17, 32, 0.95)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    zIndex: 9999,
    ...Platform.select({ web: { backdropFilter: 'blur(12px)', whiteSpace: 'nowrap' } as any }),
  },
  text: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  arrow: {
    position: 'absolute',
    right: -5,
    top: 9,
    width: 8,
    height: 8,
    backgroundColor: 'rgba(10, 17, 32, 0.95)',
    borderRightWidth: 1,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    transform: [{ rotate: '45deg' }],
  },
});

// ───────────────────────────────────────────────────────────────────────────

interface MapLayerMenuProps {
  currentLayer: any;
  onSelectLayer: (layer: any) => void;
  isReady: boolean;
}

const MapLayerMenu: React.FC<MapLayerMenuProps> = ({ currentLayer, onSelectLayer, isReady }) => {
  return (
    <View style={{ marginTop: 16, paddingHorizontal: 16 }}>
      <Text
        style={[
          styles.filterSectionTitle,
          { paddingHorizontal: 0, marginBottom: 8, color: '#94A3B8' },
        ]}
      >
        Capa del Mapa
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {MAP_LAYER_OPTIONS.map((layer) => {
          const IconComponent = layer.iconFamily === 'Ionicons' ? Ionicons : MaterialIcons;
          const isActive = currentLayer === layer.key;
          return (
            <TouchableOpacity
              key={layer.key}
              style={[
                styles.layerChip,
                isActive && styles.activeLayerChip,
                { flex: 1, minWidth: 80 },
              ]}
              onPress={() => onSelectLayer(layer.key)}
              disabled={!isReady}
            >
              <IconComponent
                name={layer.iconName}
                size={14}
                color={isActive ? '#34D399' : '#CBD5E0'}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.layerChipText, isActive && styles.activeLayerChipText]}>
                {layer.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

export default function HomeScreen() {
  const { token } = useAuth();
  console.log('[DEBUG] Rendering HomeScreen v2.2');
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();

  const [collectionModalVisible, setCollectionModalVisible] = useState(false);
  const [locationToSave, setLocationToSave] = useState<any>(null);
  const [showCoordsEditor, setShowCoordsEditor] = useState(false);
  const [showCollectionsIsland, setShowCollectionsIsland] = useState(false);
  const [shelfOpen, setShelfOpen] = useState(false);
  const unifiedControlsAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    Animated.spring(unifiedControlsAnim, {
      toValue: shelfOpen ? 0 : 1,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();
  }, [shelfOpen, unifiedControlsAnim]);

  const {
    events,
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
    showTraffic,
    setShowTraffic,
    showSectors,
    setShowSectors,
    activeNestedZone,
    setActiveNestedZone,
    selectedSector,
    setSelectedSector,
    activeFloor,
    setActiveFloor,
    activeTab,
    setActiveTab,
    showFilters,
    setShowFilters,
    showToolsMenu,
    setShowToolsMenu,
    showSectorsConfig,
    setShowSectorsConfig,
    sectors,
    visibleSectorIds,
    setVisibleSectorIds,
    isTacticalModeActive,
    setIsTacticalModeActive,
    showZoomSlider,
    setShowZoomSlider,
    isTelemetryExpanded,
    setIsTelemetryExpanded,
    tacticalLocation,
    setTacticalLocation,
    mapPincho,
    handleMapPincho,
    clearMapPincho,
    resolvedAddress,
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
    setMapBounds,
    currentMaxZoom,
    showNotification,
    handleVoiceSearch,
    handleVoicePartialSearch,
    triggerWebSocketEvent,
    isDesktop,
    screenWidth,
    panelWidth,
    openRightSheet,
    closeRightSheet,
    filteredEvents,
    handleSelectEvent,
    closeEventPanel,
    showWeather,
    setShowWeather,
    weatherType,
    setWeatherType,
    showCycleways,
    setShowCycleways,
    cycleways,

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
    savedRoutes,
    showSavedRoutes,
    setShowSavedRoutes,
    handleMapClickForRouting,
    finishSingleTargetRoute,
    saveRoute,
    cancelRouting,
    rateRoute,
    viewMode,
    handleToggleViewMode,
    mapDisplayMode,
    setMapDisplayMode,
    activeToast,
  } = useHomeScreenState(token);

  // Filtrado inmersivo para el BottomPlaceCarousel.
  // El modo (Mapa | Turismo | Comercial) viene del navbar (mapDisplayMode).
  const lugaresCarrusel = useMemo(() => {
    if (mapDisplayMode === 'mapa') return [];

    // Configura qué categorías pertenecen a qué modo
    const turismoCats = ['cultura', 'naturaleza', 'museo', 'parque', 'teatro', 'monumento'];
    const comercialCats = ['gastronomia', 'tienda'];

    return filteredEvents
      .filter((e) => {
        if (mapDisplayMode === 'turismo') return turismoCats.includes(e.category);
        if (mapDisplayMode === 'comercial') return comercialCats.includes(e.category);
        return false;
      })
      .map((e) => ({
        id: e.id,
        name: e.title,
        category: e.category,
        imageUrl: e.imageUrl || 'https://via.placeholder.com/400x300',
        distance: e.distancia,
      }));
  }, [mapDisplayMode, filteredEvents]);

  useEffect(() => {
    if (params.action === 'create_sector') {
      setIsRoutingActive(true);
      setRoutingType('sector');
      setRouteCategory('edificio');
    } else if (params.action === 'create_route') {
      setIsRoutingActive(true);
      setRoutingType('single_target');
    } else if (params.action === 'create_point') {
      setShowCreateEventModal(true);
    }
  }, [params.action]);

  const isEmergencyEvent = selectedEvent
    ? ['choque', 'incendio', 'accidente', 'calle_cortada'].includes(selectedEvent.category)
    : false;

  const isInformative = selectedEvent?.category?.toLowerCase() === 'fauna';

  const handleSectorPress = useCallback(
    (zone: any) => {
      // Verificar si hay un evento con minimodal en esta misma ubicación (ej: Carabinero)
      const minimodalCategories = [
        'hospital',
        'universidad',
        'bombero',
        'carabinero',
        'camara',
        'fauna',
      ];
      const matchingEvent = filteredEvents.find((ev) => {
        if (!minimodalCategories.includes(ev.category?.toLowerCase() || '')) return false;

        const zoneLat =
          zone.latitude ||
          (zone.geojson && zone.geojson.coordinates ? zone.geojson.coordinates[0][0][1] : 0);
        const zoneLng =
          zone.longitude ||
          (zone.geojson && zone.geojson.coordinates ? zone.geojson.coordinates[0][0][0] : 0);

        const latDiff = Math.abs((ev.latitude || 0) - zoneLat);
        const lngDiff = Math.abs((ev.longitude || 0) - zoneLng);

        // Si están a menos de ~100 metros de distancia, asumimos que es el mismo edificio
        return latDiff < 0.001 && lngDiff < 0.001;
      });

      if (matchingEvent) {
        handleSelectEvent(matchingEvent);
        return;
      }

      if (zone.category === 'edificio' || zone.category === 'reserva') {
        setSelectedSector(zone);
      }
    },
    [setSelectedSector, filteredEvents, handleSelectEvent],
  );

  const handleExploreSector = useCallback(() => {
    if (selectedSector) {
      setActiveNestedZone(selectedSector);
      setSelectedSector(null);
    }
  }, [selectedSector, setActiveNestedZone]);

  const closeSectorPanel = useCallback(() => {
    setSelectedSector(null);
  }, []);

  const handleSaveLocation = useCallback(
    (data: any) => {
      if (!token) {
        showNotification('Inicia sesión para guardar ubicaciones', 'warning');
        router.push('/ingresar');
        return;
      }
      setLocationToSave(data);
      setCollectionModalVisible(true);
    },
    [token, showNotification],
  );

  const handleSaveSector = useCallback(() => {
    if (!selectedSector) return;
    const center = getZoneCentroid(selectedSector.geojson);
    if (!center) return;
    handleSaveLocation({
      locationType: 'custom_pin',
      refId: String(selectedSector.id),
      latitude: center.latitude,
      longitude: center.longitude,
      title: selectedSector.name,
    });
  }, [selectedSector, handleSaveLocation]);

  const handleSectorDirections = useCallback(() => {
    if (!selectedSector) return;
    const center = getZoneCentroid(selectedSector.geojson);
    if (!center) return;
    const url = Platform.select({
      ios: `maps:0,0?q=${center.latitude},${center.longitude}`,
      android: `geo:0,0?q=${center.latitude},${center.longitude}`,
      web: `https://www.google.com/maps/search/?api=1&query=${center.latitude},${center.longitude}`,
    });
    if (url) Linking.openURL(url);
  }, [selectedSector]);

  const handleToggleSector = useCallback(
    (sectorId: number) => {
      setVisibleSectorIds((prev) =>
        prev.includes(sectorId) ? prev.filter((id) => id !== sectorId) : [...prev, sectorId],
      );
    },
    [setVisibleSectorIds],
  );

  const showMainUI = activeTab === 'map';

  const handleToggleViewModeWithNotification = useCallback(() => {
    handleToggleViewMode();
    showNotification(
      viewMode === 'local'
        ? 'Modo Explorador (Turismo) activado.'
        : 'Modo Ciudadano (Local) activado.',
      'info',
    );
  }, [handleToggleViewMode, viewMode, showNotification]);

  const [formAddress, setFormAddress] = React.useState('');

  // Posición medida de los botones "Herramientas" y "Notificaciones" del navbar,
  // para anclar sus paneles justo debajo (en vez de una posición fija).
  const FILTERS_PANEL_WIDTH = 300;
  const NOTIFICATIONS_PANEL_WIDTH = 320;
  const [filtersAnchor, setFiltersAnchor] = React.useState({
    top: NAVBAR_CLEARANCE,
    left: Math.max(16, screenWidth - FILTERS_PANEL_WIDTH - 16),
  });
  const [notificationsAnchor, setNotificationsAnchor] = React.useState({
    top: NAVBAR_CLEARANCE,
    left: Math.max(16, screenWidth - NOTIFICATIONS_PANEL_WIDTH - 16),
  });
  const handleFiltersAnchorChange = useCallback(
    (pos: { top: number; left: number }) =>
      setFiltersAnchor({
        top: pos.top,
        left: Math.min(pos.left, screenWidth - FILTERS_PANEL_WIDTH - 16),
      }),
    [screenWidth],
  );
  const handleNotificationsAnchorChange = useCallback(
    (pos: { top: number; left: number }) =>
      setNotificationsAnchor({
        top: pos.top,
        left: Math.min(pos.left, screenWidth - NOTIFICATIONS_PANEL_WIDTH - 16),
      }),
    [screenWidth],
  );

  const copyToClipboard = React.useCallback(
    async (text: string) => {
      try {
        if (Platform.OS === 'web') {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            showNotification('Coordenadas copiadas al portapapeles');
            return;
          }
        }
        Clipboard.setString(text);
        showNotification('Coordenadas copiadas al portapapeles');
      } catch (err) {
        console.error('Failed to copy to clipboard:', err);
        try {
          Clipboard.setString(text);
          showNotification('Coordenadas copiadas al portapapeles');
        } catch (fallbackErr) {
          console.error('Fallback copy failed:', fallbackErr);
          showNotification('Error al copiar al portapapeles');
        }
      }
    },
    [showNotification],
  );

  const handleSectorShare = React.useCallback(async () => {
    if (!selectedSector) return;
    const center = getZoneCentroid(selectedSector.geojson);
    const mapsUrl = center
      ? `https://www.google.com/maps/search/?api=1&query=${center.latitude},${center.longitude}`
      : undefined;
    const message = `${selectedSector.name} - Descúbrelo en el mapa turístico de Valdivia${mapsUrl ? `\n${mapsUrl}` : ''}`;

    try {
      await Share.share({
        message,
        url: mapsUrl,
        title: selectedSector.name,
      });
    } catch (error) {
      console.warn('No se pudo compartir el sector:', error);
    }
  }, [selectedSector]);

  const handleSharePincho = React.useCallback(async () => {
    if (!mapPincho) return;

    const message = `Pincho en ${mapPincho.address}\n${mapPincho.latitude.toFixed(
      5,
    )}, ${mapPincho.longitude.toFixed(5)}\n${mapPincho.googleMapsUrl}`;

    try {
      await Share.share({
        message,
        url: mapPincho.googleMapsUrl,
        title: 'Pincho de ubicación',
      });
    } catch (error) {
      console.warn('No se pudo compartir el pincho:', error);
    }
  }, [mapPincho]);

  React.useEffect(() => {
    if (showCreateEventModal && resolvedAddress) {
      setFormAddress(resolvedAddress);
    }
  }, [showCreateEventModal, resolvedAddress]);

  if (!isDesktop && activeTab === 'profile') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />

        <View style={styles.topBarWrapper}>
          <TopAppBar
            currentTab={activeTab}
            onTabChange={setActiveTab}
            onTabHover={prefetchProfile}
            mapDisplayMode={mapDisplayMode}
            onMapDisplayModeChange={setMapDisplayMode}
            viewMode={viewMode}
            onToggleViewMode={handleToggleViewModeWithNotification}
            showFilters={showFilters}
            onFiltersClick={() => setShowFilters(!showFilters)}
            onFiltersAnchorChange={handleFiltersAnchorChange}
          />
        </View>

        <View style={styles.profileContainer}>
          <Suspense fallback={<LoadingFallback />}>
            <UserProfileScreen />
          </Suspense>
        </View>
      </SafeAreaView>
    );
  }

  if (!isDesktop && activeTab === 'feed') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />

        <View style={styles.topBarWrapper}>
          <TopAppBar
            currentTab={activeTab}
            onTabChange={setActiveTab}
            onVoiceSearch={handleVoiceSearch}
            onVoicePartialSearch={handleVoicePartialSearch}
            notificationsCount={notifications.filter((n) => !n.isRead).length}
            onNotificationClick={() => setShowNotificationTray(!showNotificationTray)}
            onNotificationsAnchorChange={handleNotificationsAnchorChange}
            onTabHover={prefetchFeed}
            mapDisplayMode={mapDisplayMode}
            onMapDisplayModeChange={setMapDisplayMode}
            viewMode={viewMode}
            onToggleViewMode={handleToggleViewModeWithNotification}
            showFilters={showFilters}
            onFiltersClick={() => setShowFilters(!showFilters)}
            onFiltersAnchorChange={handleFiltersAnchorChange}
          />
        </View>

        <View style={styles.profileContainer}>
          <Suspense fallback={<LoadingFallback />}>
            <FeedScreen />
          </Suspense>
        </View>
      </SafeAreaView>
    );
  }

  if (!isDesktop && activeTab === 'eventos') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />

        <View style={styles.topBarWrapper}>
          <TopAppBar
            currentTab={activeTab}
            onTabChange={setActiveTab}
            onVoiceSearch={handleVoiceSearch}
            onVoicePartialSearch={handleVoicePartialSearch}
            notificationsCount={notifications.filter((n) => !n.isRead).length}
            onNotificationClick={() => setShowNotificationTray(!showNotificationTray)}
            onNotificationsAnchorChange={handleNotificationsAnchorChange}
            onTabHover={prefetchEventos}
            mapDisplayMode={mapDisplayMode}
            onMapDisplayModeChange={setMapDisplayMode}
            viewMode={viewMode}
            onToggleViewMode={handleToggleViewModeWithNotification}
            showFilters={showFilters}
            onFiltersClick={() => setShowFilters(!showFilters)}
            onFiltersAnchorChange={handleFiltersAnchorChange}
          />
        </View>

        <View style={styles.profileContainer}>
          <Suspense fallback={<LoadingFallback />}>
            <EventsScreen />
          </Suspense>
        </View>
      </SafeAreaView>
    );
  }

  if (!isDesktop && activeTab === 'historial') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />

        <View style={styles.topBarWrapper}>
          <TopAppBar
            currentTab={activeTab}
            onTabChange={setActiveTab}
            onVoiceSearch={handleVoiceSearch}
            onVoicePartialSearch={handleVoicePartialSearch}
            notificationsCount={notifications.filter((n) => !n.isRead).length}
            onNotificationClick={() => setShowNotificationTray(!showNotificationTray)}
            onNotificationsAnchorChange={handleNotificationsAnchorChange}
            onTabHover={prefetchHistorial}
            mapDisplayMode={mapDisplayMode}
            onMapDisplayModeChange={setMapDisplayMode}
            viewMode={viewMode}
            onToggleViewMode={handleToggleViewModeWithNotification}
            showFilters={showFilters}
            onFiltersClick={() => setShowFilters(!showFilters)}
            onFiltersAnchorChange={handleFiltersAnchorChange}
          />
        </View>

        <View style={styles.profileContainer}>
          <Suspense fallback={<LoadingFallback />}>
            <PassportScreen />
          </Suspense>
        </View>
      </SafeAreaView>
    );
  }

  if (!isDesktop && activeTab === 'saved') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />

        <View style={styles.topBarWrapper}>
          <TopAppBar
            currentTab={activeTab}
            onTabChange={setActiveTab}
            onVoiceSearch={handleVoiceSearch}
            onVoicePartialSearch={handleVoicePartialSearch}
            notificationsCount={notifications.filter((n) => !n.isRead).length}
            onNotificationClick={() => setShowNotificationTray(!showNotificationTray)}
            onNotificationsAnchorChange={handleNotificationsAnchorChange}
            onTabHover={prefetchSaved}
            mapDisplayMode={mapDisplayMode}
            onMapDisplayModeChange={setMapDisplayMode}
            viewMode={viewMode}
            onToggleViewMode={handleToggleViewModeWithNotification}
            showFilters={showFilters}
            onFiltersClick={() => setShowFilters(!showFilters)}
            onFiltersAnchorChange={handleFiltersAnchorChange}
          />
        </View>

        <View style={styles.profileContainer}>
          <Suspense fallback={<LoadingFallback />}>
            <PassportScreen />
          </Suspense>
        </View>
      </SafeAreaView>
    );
  }

  if (!isDesktop && activeTab === 'forum') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />

        <View style={styles.topBarWrapper}>
          <TopAppBar
            currentTab={activeTab}
            onTabChange={setActiveTab}
            onVoiceSearch={handleVoiceSearch}
            onVoicePartialSearch={handleVoicePartialSearch}
            notificationsCount={notifications.filter((n) => !n.isRead).length}
            onNotificationClick={() => setShowNotificationTray(!showNotificationTray)}
            onNotificationsAnchorChange={handleNotificationsAnchorChange}
            onTabHover={prefetchForum}
            mapDisplayMode={mapDisplayMode}
            onMapDisplayModeChange={setMapDisplayMode}
            viewMode={viewMode}
            onToggleViewMode={handleToggleViewModeWithNotification}
            showFilters={showFilters}
            onFiltersClick={() => setShowFilters(!showFilters)}
            onFiltersAnchorChange={handleFiltersAnchorChange}
          />
        </View>

        <View style={styles.profileContainer}>
          <Suspense fallback={<LoadingFallback />}>
            <ForumScreen />
          </Suspense>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <LocationErrorNotifier showNotification={showNotification} />

      <View
        pointerEvents={activeTab === 'map' ? 'auto' : 'none'}
        style={[
          styles.mapContainer,
          activeTab !== 'map' && {
            ...Platform.select({
              web: {
                filter: 'blur(12px) brightness(0.65)',
                transform: 'scale(1.025)',
              } as any,
              default: {
                opacity: 0.8,
              },
            }),
          },
        ]}
      >
        <MapContainer
          events={filteredEvents}
          selectedEvent={selectedEvent}
          onSelectEvent={handleSelectEvent}
          mapLayer={mapLayer}
          centerTrigger={centerTrigger}
          tacticalMode={isTacticalModeActive}
          onTacticalLocationChange={setTacticalLocation}
          onMapPincho={handleMapPincho}
          mapPincho={mapPincho}
          zoom={zoom}
          onZoomChange={setZoom}
          onBoundsChange={setMapBounds}
          activeFloor={activeFloor}
          showTraffic={showTraffic}
          showCycleways={showCycleways}
          cyclewaysData={cycleways}
          showSectors={showSectors}
          sectorsData={sectors}
          visibleSectorIds={visibleSectorIds}
          onSectorPress={handleSectorPress}
          showWeather={showWeather}
          weatherType={weatherType}
          isFrozen={activeTab !== 'map'}
          onSaveLocation={handleSaveLocation}
          isRoutingActive={isRoutingActive}
          routingType={routingType}
          draftRoutePoints={draftRoutePoints}
          onMapClickForRouting={handleMapClickForRouting}
          isRouteFinished={isRouteFinished}
          savedRoutes={showSavedRoutes ? savedRoutes : []}
          onRateRoute={rateRoute}
          activeNestedZone={activeNestedZone}
        />
      </View>

      {/* Panel de lugares recomendados (absoluto, flota a la izquierda de la barra de controles) */}
      {activeTab === 'map' && (
        <PlacesShelfPanel
          visible={mapDisplayMode !== 'mapa'}
          isOpen={shelfOpen}
          onClose={() => setShelfOpen(false)}
          data={lugaresCarrusel}
          bottomOffset={Math.max(insets.bottom, 20)}
          onPlacePress={(lugar) => {
            setSelectedEvent(filteredEvents.find((e) => e.id === lugar.id) || null);
          }}
        />
      )}

      {showMainUI && mapPincho && !isDesktop && (
        <View pointerEvents="box-none" style={styles.sidePanelOverlay}>
          <Animated.View
            // Prevent map interactions when interacting with the modal
            onStartShouldSetResponder={() => true}
            onTouchStart={(e) => e.stopPropagation()}
            // @ts-ignore - Web specific
            onWheel={(e: any) => e.stopPropagation()}
            // @ts-ignore - Web specific
            onPointerDown={(e: any) => e.stopPropagation()}
            style={[
              styles.sidePanel,
              {
                width: isDesktop ? 520 : '100%',
                maxWidth: isDesktop ? 520 : '100%',
                height: isDesktop ? 'auto' : 'auto', // Adjust height strategy if needed
                bottom: isDesktop ? 20 : 0,
                // On desktop, keep it floating in the center but respect vertical spacing
                left: 'auto',
                right: 'auto',
                alignSelf: 'center',
                top: isDesktop ? (Platform.OS === 'ios' ? 56 : 16) : 'auto',
                borderTopLeftRadius: 22,
                borderTopRightRadius: 22,
                borderBottomLeftRadius: isDesktop ? 22 : 0,
                borderBottomRightRadius: isDesktop ? 22 : 0,
                paddingBottom: Math.max(insets.bottom, 20),
                paddingTop: 14,
                paddingHorizontal: 14,
                opacity: pinchoSlide,
                transform: [
                  {
                    translateY: pinchoSlide.interpolate({
                      inputRange: [0, 1],
                      outputRange: [300, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.pinchoCard}>
              <View style={styles.pinchoImageColumn}>
                <View style={styles.pinchoImageFrame}>
                  <Image
                    source={{ uri: mapPincho.imageUrl }}
                    style={styles.pinchoImage}
                    resizeMode="cover"
                  />
                  <View style={styles.pinchoImageOverlay} />
                  <View style={styles.pinchoStreetViewBadge}>
                    <Ionicons name="globe-outline" size={12} color="#FFFFFF" />
                    <Text style={styles.pinchoStreetViewText}>Street View</Text>
                  </View>
                  <View style={styles.pinchoSourceBadge}>
                    <Text style={styles.pinchoSourceBadgeText}>
                      {mapPincho.isResolving ? 'RESOLVIENDO' : 'LISTO'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.pinchoBody}>
                <View style={styles.pinchoHeaderRow}>
                  <View style={styles.pinchoHeaderTextBlock}>
                    <Text style={styles.pinchoTitle} numberOfLines={1}>
                      {mapPincho.address}
                    </Text>
                    <Text style={styles.pinchoSubtitle} numberOfLines={1}>
                      {mapPincho.surface === 'water'
                        ? 'Zona sobre agua · navegable / costanera'
                        : 'Zona sobre tierra · dirección aproximada'}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={clearMapPincho}
                    style={styles.pinchoCloseButton}
                    activeOpacity={0.7}
                    accessibilityLabel="Cerrar pincho"
                  >
                    <Ionicons name="close" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>

                <View style={styles.pinchoMetaRow}>
                  <View style={styles.pinchoMetaChipPrimary}>
                    <Text style={styles.pinchoMetaChipTextPrimary}>
                      {mapPincho.latitude.toFixed(5)}, {mapPincho.longitude.toFixed(5)}
                    </Text>
                  </View>
                  <View style={styles.pinchoMetaChipSecondary}>
                    <Text style={styles.pinchoMetaChipTextSecondary}>
                      {mapPincho.surface === 'water' ? 'Agua' : 'Tierra'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.pinchoActionsColumn}>
                <TouchableOpacity
                  activeOpacity={0.86}
                  onPress={() => {
                    handleSaveLocation({
                      locationType: 'custom_pin',
                      latitude: mapPincho.latitude,
                      longitude: mapPincho.longitude,
                      title: mapPincho.address || 'Ubicación seleccionada',
                      notes: `Coordenadas: ${mapPincho.latitude.toFixed(5)}, ${mapPincho.longitude.toFixed(5)}`,
                    });
                  }}
                  style={styles.pinchoActionButtonSecondary}
                  accessibilityLabel="Guardar en colecciones"
                >
                  <MaterialIcons name="bookmark-outline" size={18} color="#34D399" />
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.86}
                  onPress={() => void handleSharePincho()}
                  style={styles.pinchoActionButtonSecondary}
                  accessibilityLabel="Compartir pincho"
                >
                  <Ionicons name="share-social" size={18} color="#34D399" />
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.86}
                  onPress={() => void Linking.openURL(mapPincho.googleMapsUrl)}
                  style={styles.pinchoActionButtonPrimary}
                  accessibilityLabel="Abrir en Google Maps"
                >
                  <Ionicons name="navigate" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </View>
      )}

      {isDesktop && activeTab !== 'map' && (
        <View
          style={{
            position: 'absolute',
            top: NAVBAR_CLEARANCE,
            bottom: 20,
            left: 16,
            right: 16,
            zIndex: 4000,
          }}
        >
          <FloatingIsland
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onClose={() => setActiveTab('map')}
            showSidebar={false}
          />
        </View>
      )}

      {/* ━━━ NAVBAR SUPERIOR ━━━ */}
      <View style={[styles.topBarWrapper, { zIndex: 6000 }]} pointerEvents="box-none">
        <TopAppBar
          currentTab={activeTab}
          onTabChange={setActiveTab}
          onVoiceSearch={handleVoiceSearch}
          onVoicePartialSearch={handleVoicePartialSearch}
          notificationsCount={notifications.filter((n) => !n.isRead).length}
          onNotificationClick={() => setShowNotificationTray(!showNotificationTray)}
          onNotificationsAnchorChange={handleNotificationsAnchorChange}
          mapDisplayMode={mapDisplayMode}
          onMapDisplayModeChange={setMapDisplayMode}
          viewMode={viewMode}
          onToggleViewMode={handleToggleViewModeWithNotification}
          showFilters={showFilters}
          onFiltersClick={() => setShowFilters(!showFilters)}
          onFiltersAnchorChange={handleFiltersAnchorChange}
          onSearchFocus={() => {
            if (selectedEvent) handleSelectEvent(null);
            if (mapPincho) clearMapPincho();
          }}
          onCollectionsClick={() => setShowCollectionsIsland(true)}
        />
      </View>
      {showMainUI && (
        <Animated.View
          pointerEvents={shelfOpen ? 'none' : 'auto'}
          style={[
            styles.unifiedControlsContainer,
            { 
              bottom: isDesktop ? 20 : Math.max(insets.bottom, 20),
              opacity: unifiedControlsAnim,
              transform: [
                {
                  translateY: unifiedControlsAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0], // slide down when hiding
                  }),
                },
                {
                  scale: unifiedControlsAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.95, 1], // slight shrink when hiding
                  }),
                }
              ]
            },
          ]}
        >
          {/* Zoom */}
          <ControlTooltip label="Zoom" buttonSize={isDesktop ? 36 : 44}>
            <TouchableOpacity
              style={[styles.controlButton, showZoomSlider && styles.controlButtonActive]}
              onPress={() => setShowZoomSlider(!showZoomSlider)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Zoom"
            >
              <MaterialIcons
                name="zoom-in"
                size={isDesktop ? 20 : 24}
                color={showZoomSlider ? '#34D399' : '#9CA3AF'}
              />
            </TouchableOpacity>
          </ControlTooltip>

          <View style={styles.controlDivider} />

          {/* Mi ubicación */}
          <ControlTooltip label="Mi ubicación" buttonSize={isDesktop ? 36 : 44}>
            <MyLocationButton
              isDesktop={isDesktop}
              onCenterPress={() => setCenterTrigger((prev) => prev + 1)}
            />
          </ControlTooltip>

          <View style={styles.controlDivider} />

          {/* Modo Táctico */}
          <ControlTooltip label="Modo Táctico" buttonSize={isDesktop ? 36 : 44}>
            <TouchableOpacity
              style={[
                styles.controlButton,
                isTacticalModeActive && { backgroundColor: 'rgba(52, 211, 153, 0.12)' },
              ]}
              onPress={() => {
                const nextState = !isTacticalModeActive;
                setIsTacticalModeActive(nextState);
              }}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Modo Táctico"
            >
              <MaterialIcons
                name="center-focus-strong"
                size={isDesktop ? 18 : 22}
                color={isTacticalModeActive ? '#34D399' : '#9CA3AF'}
              />
            </TouchableOpacity>
          </ControlTooltip>

          {/* Recomendados — solo en modo turismo/comercial */}
          {mapDisplayMode !== 'mapa' && lugaresCarrusel.length > 0 && (
            <>
              <View style={styles.controlDivider} />
              <ControlTooltip label="Recomendados" buttonSize={isDesktop ? 36 : 44}>
                <PlacesShelfTrigger
                  isOpen={shelfOpen}
                  onPress={() => setShelfOpen((p) => !p)}
                  count={lugaresCarrusel.length}
                  isDesktop={isDesktop}
                />
              </ControlTooltip>
            </>
          )}
        </Animated.View>
      )}

      {/* Zoom Slider Flotante */}
      {showMainUI && showZoomSlider && (
        <View
          style={[
            styles.zoomSliderContainer,
            { bottom: isDesktop ? 20 : Math.max(insets.bottom, 20) },
          ]}
        >
          <View style={styles.zoomSliderGlass}>
            <TouchableOpacity
              style={styles.zoomControlBtn}
              onPress={() => setZoom((z) => Math.min(z + 1, currentMaxZoom))}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Acercar mapa"
            >
              <MaterialIcons name="add" size={16} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.zoomTrackWrapper}>
              <View style={styles.zoomTrackLine}>
                <View
                  style={[
                    styles.zoomTrackFill,
                    { height: `${((zoom - 1) / (currentMaxZoom - 1)) * 100}%` },
                  ]}
                />
              </View>

              {Array.from({ length: 5 }).map((_, idx) => {
                const level = Math.round(1 + (idx * (currentMaxZoom - 1)) / 4);
                const isSelected = zoom === level;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.zoomTickDot,
                      { bottom: `${(idx / 4) * 100}%` },
                      isSelected && styles.zoomTickDotActive,
                    ]}
                    onPress={() => setZoom(level)}
                    activeOpacity={0.7}
                  />
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.zoomControlBtn}
              onPress={() => setZoom((z) => Math.max(z - 1, 1))}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Alejar mapa"
            >
              <MaterialIcons name="remove" size={16} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.zoomBadge}>
              <Text style={styles.zoomBadgeText}>{zoom}x</Text>
            </View>
          </View>
        </View>
      )}

      {/* Menú de Herramientas Flotante (State-based) */}
      {showMainUI && !activeNestedZone && <WeatherForecastWidget isDark={mapLayer === 'dark'} />}

      {/* HUD for Nested Zone Exit with Vertical Floor Selector */}
      {activeNestedZone && (
        <View
          style={{
            position: 'absolute',
            top: NAVBAR_CLEARANCE,
            left: 20,
            right: 20,
            zIndex: 999,
          }}
        >
          <View
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.85)', // Glassmorphism base
              borderRadius: 16,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.1)', // Subtle border matching sidebar
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.4,
              shadowRadius: 20,
              elevation: 10,
              ...Platform.select({ web: { backdropFilter: 'blur(12px)' } as any }), // Glassmorphism blur
            }}
          >
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 4,
                  height: 30,
                  backgroundColor: '#38BDF8',
                  borderRadius: 2,
                }}
              />
              <View>
                <Text
                  style={{
                    color: '#9CA3AF',
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: 1.5,
                    fontWeight: '600',
                    marginBottom: 2,
                  }}
                >
                  Estás viendo
                </Text>
                <Text
                  style={{ color: '#F8FAFC', fontSize: 18, fontWeight: '800', letterSpacing: 0.5 }}
                >
                  {activeNestedZone.name}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => {
                setActiveNestedZone(null);
                setActiveFloor(null);
              }}
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: 'rgba(239, 68, 68, 0.5)',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Text style={{ color: '#EF4444', fontWeight: '700', letterSpacing: 0.5 }}>
                Salir del Edificio
              </Text>
            </TouchableOpacity>
          </View>

          {/* Selector Vertical de Pisos */}
          <View
            style={{
              position: 'absolute',
              top: 80, // Below the HUD
              right: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.1)',
              paddingVertical: 8,
              alignItems: 'center',
              ...Platform.select({ web: { backdropFilter: 'blur(10px)' } as any }),
            }}
          >
            <Text
              style={{
                color: '#9CA3AF',
                fontSize: 9,
                fontWeight: 'bold',
                marginBottom: 4,
                textTransform: 'uppercase',
              }}
            >
              Pisos
            </Text>
            {[4, 3, 2, 1, 0].map((floor) => {
              const isActive = activeFloor === floor;
              return (
                <TouchableOpacity
                  key={floor}
                  onPress={() => setActiveFloor(isActive ? null : floor)}
                  style={{
                    paddingVertical: 10,
                    backgroundColor: isActive ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                    borderLeftWidth: 3,
                    borderLeftColor: isActive ? '#38BDF8' : 'transparent',
                    width: 50,
                    alignItems: 'center',
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={{
                      color: isActive ? '#38BDF8' : '#D1D5DB',
                      fontWeight: isActive ? 'bold' : '600',
                      fontSize: 13,
                    }}
                  >
                    {floor === 0 ? 'PB' : `P${floor}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Galería multimedia del edificio */}
          <BuildingGallery
            zoneId={activeNestedZone.id}
            activeFloor={activeFloor}
            isDesktop={isDesktop}
            visible={!!activeNestedZone}
          />
        </View>
      )}

      {/* --- Tactical Mode Overlay --- */}
      {showMainUI && isTacticalModeActive && tacticalLocation && isDesktop && (
        <TacticalHUD
          tacticalLocation={tacticalLocation}
          isResolvingAddress={isResolvingAddress}
          resolvedAddress={resolvedAddress}
          screenWidth={screenWidth}
          isLightMode={mapLayer === 'light' || mapLayer === 'streets'}
        />
      )}

      {/* HUD de Rutas (Geo-Router) */}
      {showMainUI && isRoutingActive && (
        <>
          <RouterHUD
            isRoutingActive={isRoutingActive}
            routingType={routingType}
            setRoutingType={setRoutingType}
            routeCategory={routeCategory}
            setRouteCategory={setRouteCategory}
            draftRoutePoints={draftRoutePoints}
            setDraftRoutePoints={setDraftRoutePoints}
            draftRouteName={draftRouteName}
            setDraftRouteName={setDraftRouteName}
            isRouteFinished={isRouteFinished}
            onFinishSingleTarget={finishSingleTargetRoute}
            onSave={saveRoute}
            onCancel={cancelRouting}
            hideSaveBlock={routingType === 'sector'}
          />

          {isRouteFinished && routingType === 'sector' && (
            <CreateSectorModal
              visible={true}
              onClose={() => cancelRouting()}
              draftRoutePoints={draftRoutePoints}
              showNotification={showNotification}
              onSuccess={() => {
                cancelRouting();
              }}
            />
          )}
        </>
      )}

      {/* Dashboard de Telemetría (Live Telemetry HUD) */}
      <TelemetryHUD isDesktop={isDesktop} />

      {showMainUI && showNearbyEvents && (
        <View style={styles.sidePanelOverlay} pointerEvents="box-none">
          <Pressable style={styles.sidePanelBackdrop} onPress={() => setShowNearbyEvents(false)} />
          <NearbyEventsPanel
            events={events}
            onSelectEvent={handleSelectEvent}
            onClose={() => setShowNearbyEvents(false)}
            isDesktop={isDesktop}
            containerStyle={[
              styles.filterOverlay,
              isDesktop
                ? { right: 72, bottom: 20, width: 320, paddingVertical: 0 }
                : {
                    left: 0,
                    right: 0,
                    bottom: 0,
                    width: '100%',
                    borderBottomLeftRadius: 0,
                    borderBottomRightRadius: 0,
                    paddingBottom: Math.max(insets.bottom, 20),
                  },
            ]}
          />
        </View>
      )}

      {showMainUI && showFilters && (
        <View style={styles.sidePanelOverlay} pointerEvents="box-none">
          <Pressable style={styles.sidePanelBackdrop} onPress={() => setShowFilters(false)} />
          <View
            style={[
              styles.filterOverlay,
              isDesktop
                ? {
                    top: filtersAnchor.top,
                    left: filtersAnchor.left,
                    bottom: 'auto',
                    right: 'auto',
                    width: 300,
                  }
                : {
                    left: 0,
                    right: 0,
                    bottom: 0,
                    width: '100%',
                    borderBottomLeftRadius: 0,
                    borderBottomRightRadius: 0,
                    paddingBottom: Math.max(insets.bottom, 20),
                  },
            ]}
          >
            {!isDesktop && <View style={styles.sheetHandle} />}
            <View style={styles.filterHeader}>
              <Text style={styles.filterSectionTitle}>Explorar</Text>
              {!isDesktop && (
                <TouchableOpacity
                  onPress={() => setShowFilters(false)}
                  style={styles.closeButtonCompact}
                >
                  <Ionicons name="close" size={20} color="#A0AEC0" />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView
              style={{ flexShrink: 1, maxHeight: isDesktop ? 600 : '70%' }}
              contentContainerStyle={{ paddingBottom: 20 }}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <Text style={[styles.filterSectionTitle, { marginTop: 0 }]}>Categorías</Text>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  paddingHorizontal: 16,
                  marginBottom: 8,
                }}
              >
                {(
                  [
                    'todos',
                    'ninguno',
                    'gastronomia',
                    'cultura',
                    'naturaleza',
                    'musica',
                    'deportes',
                    'publico',
                    'emergencia',
                    'embarcacion',
                    'tienda',
                  ] as CategoryFilter[]
                ).map((cat) => {
                  const iconData = CATEGORY_ICONS[cat];
                  const IconComponent = iconData.family === 'Ionicons' ? Ionicons : MaterialIcons;
                  const isActive = selectedCategory === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.categoryChip, isActive && styles.activeCategoryChip]}
                      onPress={() => setSelectedCategory(cat)}
                    >
                      <IconComponent
                        name={iconData.name}
                        size={14}
                        color={isActive ? '#FFFFFF' : '#CBD5E0'}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={[styles.categoryText, isActive && styles.activeCategoryText]}>
                        {cat === 'ninguno'
                          ? 'Ocultar Pines'
                          : cat === 'embarcacion'
                            ? 'Embarcaciones'
                            : cat === 'emergencia'
                              ? 'Emergencias'
                              : cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.filterSectionTitle}>Herramientas</Text>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  paddingHorizontal: 16,
                  marginBottom: 8,
                }}
              >
                <TouchableOpacity
                  style={[
                    styles.toolChip,
                    showNearbyEvents && styles.activeToolChip,
                    { paddingHorizontal: 12 },
                  ]}
                  onPress={() => {
                    setShowNearbyEvents(!showNearbyEvents);
                    showNotification(
                      !showNearbyEvents ? 'Calendario activado' : 'Calendario desactivado',
                    );
                  }}
                >
                  <MaterialIcons
                    name="calendar-today"
                    size={16}
                    color={showNearbyEvents ? '#34D399' : '#9CA3AF'}
                  />
                  <Text
                    style={[styles.toolChipText, showNearbyEvents && styles.activeToolChipText]}
                  >
                    Eventos
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.toolChip,
                    showTraffic && styles.activeToolChip,
                    { paddingHorizontal: 12 },
                  ]}
                  onPress={() => {
                    setShowTraffic(!showTraffic);
                    showNotification(
                      !showTraffic ? 'Tráfico en vivo activado' : 'Tráfico desactivado',
                    );
                  }}
                >
                  <MaterialIcons
                    name="traffic"
                    size={16}
                    color={showTraffic ? '#34D399' : '#9CA3AF'}
                  />
                  <Text style={[styles.toolChipText, showTraffic && styles.activeToolChipText]}>
                    Tráfico
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.toolChip,
                    showCycleways && styles.activeToolChip,
                    { paddingHorizontal: 12 },
                  ]}
                  onPress={() => {
                    setShowCycleways(!showCycleways);
                    showNotification(
                      !showCycleways ? '🚲 Ciclovías activadas' : 'Ciclovías desactivadas',
                    );
                  }}
                >
                  <MaterialIcons
                    name="directions-bike"
                    size={16}
                    color={showCycleways ? '#34D399' : '#9CA3AF'}
                  />
                  <Text style={[styles.toolChipText, showCycleways && styles.activeToolChipText]}>
                    Ciclovías
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.toolChip,
                    showSectors && styles.activeToolChip,
                    { paddingHorizontal: 12 },
                  ]}
                  onPress={() => {
                    setShowSectors(true);
                    setShowSectorsConfig(true);
                    setShowFilters(false);
                  }}
                >
                  <MaterialIcons
                    name="layers"
                    size={16}
                    color={showSectors ? '#34D399' : '#9CA3AF'}
                  />
                  <Text style={[styles.toolChipText, showSectors && styles.activeToolChipText]}>
                    Sectores
                  </Text>
                </TouchableOpacity>

                {userProfile?.userType &&
                  ['partner_owner', 'partner_worker'].includes(userProfile.userType) && (
                    <TouchableOpacity
                      style={[
                        styles.toolChip,
                        isRoutingActive && styles.activeToolChip,
                        { paddingHorizontal: 12 },
                      ]}
                      onPress={() => {
                        setIsRoutingActive(!isRoutingActive);
                        setShowFilters(false);
                        if (!isRoutingActive) showNotification('Modo Geo-Router activado.');
                      }}
                    >
                      <MaterialIcons
                        name="route"
                        size={16}
                        color={isRoutingActive ? '#34D399' : '#9CA3AF'}
                      />
                      <Text
                        style={[styles.toolChipText, isRoutingActive && styles.activeToolChipText]}
                      >
                        Geo-Router
                      </Text>
                    </TouchableOpacity>
                  )}
              </View>

              <MapLayerMenu
                currentLayer={mapLayer}
                onSelectLayer={setMapLayer}
                isReady={mapLayerReady}
              />
            </ScrollView>
          </View>
        </View>
      )}

      {showMainUI && selectedEvent && !isInformative && (
        <View style={styles.sidePanelOverlay} pointerEvents="box-none">
          {/* Tap-to-dismiss backdrop */}
          <Pressable style={styles.sidePanelBackdrop} onPress={closeEventPanel} />

          <Animated.View
            // Prevent map interactions when interacting with the modal
            onStartShouldSetResponder={() => true}
            onTouchStart={(e) => e.stopPropagation()}
            // @ts-ignore - Web specific
            onWheel={(e: any) => e.stopPropagation()}
            // @ts-ignore - Web specific
            onPointerDown={(e: any) => e.stopPropagation()}
            style={[
              styles.sidePanel,
              {
                width: isDesktop ? panelWidth : '100%',
                maxWidth: isDesktop ? panelWidth : '100%',
                height: isDesktop ? 'auto' : '82%',
                // Use the same bottom anchor as topBarWrapper
                bottom: isDesktop ? 20 : 0,
                left: isDesktop ? 16 : 0,
                right: isDesktop ? 'auto' : 0,
                top: isDesktop ? NAVBAR_CLEARANCE : 'auto',
                borderTopLeftRadius: 32,
                borderTopRightRadius: 32,
                borderBottomLeftRadius: isDesktop ? 32 : 0,
                borderBottomRightRadius: isDesktop ? 32 : 0,
                paddingBottom: 0,
                transform: [
                  {
                    translateX: isDesktop
                      ? panelSlide.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-panelWidth - 32, 0],
                        })
                      : 0,
                  },
                  {
                    translateY: !isDesktop
                      ? panelSlide.interpolate({
                          inputRange: [0, 1],
                          outputRange: [800, 0],
                        })
                      : 0,
                  },
                ],
                opacity: panelSlide,
              },
            ]}
          >
            {!isDesktop && (
              <View style={styles.premiumHandleContainer}>
                <View style={styles.premiumHandle} />
              </View>
            )}
            <ScrollView
              style={styles.panelScroll}
              contentContainerStyle={[
                selectedEvent.imageUrl
                  ? styles.panelScrollContentWithBanner
                  : styles.panelScrollContent,
                { paddingBottom: isDesktop ? 32 : Math.max(insets.bottom + 40, 60) },
              ]}
              showsVerticalScrollIndicator={false}
              bounces={true}
            >
              {selectedEvent.imageUrl ? (
                <View style={styles.bannerContainer}>
                  <Image source={{ uri: selectedEvent.imageUrl }} style={styles.bannerImage} />
                  <View style={styles.bannerOverlay} />
                  <View style={styles.bannerFadeBottom} />

                  <View style={styles.bannerHeader}>
                    <View
                      style={[
                        styles.cardBadgePremium,
                        {
                          borderColor: 'rgba(255, 255, 255, 0.15)',
                          backgroundColor: 'rgba(18, 22, 30, 0.75)',
                        },
                      ]}
                    >
                      <MaterialIcons
                        name={getCategoryIcon(selectedEvent.category, selectedEvent.musicStyle)}
                        size={12}
                        color={getCategoryColor(selectedEvent.category, selectedEvent.musicStyle)}
                        style={{ marginRight: 5 }}
                      />
                      <Text style={styles.cardBadgeTextPremium}>
                        {isEmergencyEvent
                          ? selectedEvent.category.toUpperCase().replace('_', ' ')
                          : isInformative
                            ? 'INFORMACIÓN'
                            : selectedEvent.category.toUpperCase()}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={closeEventPanel}
                      style={styles.closeButtonPremium}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="close" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.cardHeaderPremium}>
                  <View
                    style={[
                      styles.cardBadgePremium,
                      {
                        borderColor: 'rgba(255, 255, 255, 0.08)',
                        backgroundColor: 'rgba(255, 255, 255, 0.04)',
                      },
                    ]}
                  >
                    <MaterialIcons
                      name={getCategoryIcon(selectedEvent.category, selectedEvent.musicStyle)}
                      size={12}
                      color={getCategoryColor(selectedEvent.category, selectedEvent.musicStyle)}
                      style={{ marginRight: 5 }}
                    />
                    <Text style={styles.cardBadgeTextPremium}>
                      {isEmergencyEvent
                        ? selectedEvent.category.toUpperCase().replace('_', ' ')
                        : isInformative
                          ? 'INFORMACIÓN'
                          : selectedEvent.category.toUpperCase()}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={closeEventPanel}
                    style={styles.closeButtonPremium}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close" size={20} color="#A0AEC0" />
                  </TouchableOpacity>
                </View>
              )}

              <View
                style={
                  selectedEvent.imageUrl
                    ? styles.panelContentWrapperWithPadding
                    : styles.panelContentWrapper
                }
              >
                <View style={styles.titleRowPremium}>
                  {selectedEvent.isRealTime && (
                    <View style={styles.liveIndicatorPremium}>
                      <View style={styles.liveDot} />
                      <Text style={styles.liveText}>VIVO</Text>
                    </View>
                  )}
                  <Text style={styles.cardTitlePremium} numberOfLines={2}>
                    {selectedEvent.title}
                  </Text>
                </View>

                {/* Subcabecera de Organizador Compacta */}
                <View style={styles.subHeaderRowPremium}>
                  <Text style={styles.subHeaderTextPremium}>
                    {isEmergencyEvent
                      ? '⚠️ Reportado por'
                      : isInformative
                        ? '📍 Punto de Interés'
                        : '👤 Organizado por'}
                    <Text
                      style={[
                        styles.subHeaderOrganizerPremium,
                        {
                          color: getCategoryColor(selectedEvent.category, selectedEvent.musicStyle),
                        },
                      ]}
                    >
                      {' '}
                      {selectedEvent.organizer}
                    </Text>
                  </Text>
                </View>

                <Text style={styles.cardDescPremium}>{selectedEvent.description}</Text>

                {/* Micro-Timeline de Progreso (Sleek LED Tracker) - Hidden for informative */}
                {!isInformative && (
                  <View style={styles.microTimelineContainer}>
                    {['agendado', 'en_proceso', 'finalizado'].map((status, index) => {
                      const eventStatus =
                        selectedEvent.status ||
                        (selectedEvent.isRealTime ? 'en_proceso' : 'agendado');
                      const isActive = eventStatus === status;
                      const isPast =
                        ['agendado', 'en_proceso', 'finalizado'].indexOf(eventStatus) > index;
                      const isCompleted = isActive || isPast;

                      const getLabel = (s: string) => {
                        if (s === 'agendado') return 'Agendado';
                        if (s === 'en_proceso') return 'En proceso';
                        return 'Finalizado';
                      };

                      const activeColor = getCategoryColor(
                        selectedEvent.category,
                        selectedEvent.musicStyle,
                      );

                      return (
                        <React.Fragment key={status}>
                          <View style={styles.microNodeWrapper}>
                            {isActive ? (
                              <View style={styles.microNodeActiveContainer}>
                                <View
                                  style={[
                                    styles.microNodeActiveShadow,
                                    { backgroundColor: activeColor },
                                  ]}
                                />
                                <View
                                  style={[
                                    styles.microNodeActiveCore,
                                    { backgroundColor: activeColor },
                                  ]}
                                />
                              </View>
                            ) : (
                              <View
                                style={[
                                  styles.microNode,
                                  isPast && {
                                    backgroundColor: activeColor,
                                    borderColor: activeColor,
                                  },
                                ]}
                              />
                            )}
                            <Text
                              style={[
                                styles.microLabel,
                                isCompleted && styles.microLabelCompleted,
                                isActive && { color: activeColor },
                              ]}
                            >
                              {getLabel(status)}
                            </Text>
                          </View>
                          {index < 2 && (
                            <View
                              style={[styles.microLine, isPast && { backgroundColor: activeColor }]}
                            />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </View>
                )}

                {/* Rejilla Horizontal de Metadatos (Info Hub) */}
                <View style={styles.metaInfoGrid}>
                  {!isInformative && (
                    <View style={styles.metaGridItem}>
                      <Ionicons name="time-outline" size={14} color="#A0AEC0" />
                      <Text style={styles.metaGridText} numberOfLines={1}>
                        {selectedEvent.time}
                      </Text>
                    </View>
                  )}

                  {!isInformative && <View style={styles.metaGridDivider} />}

                  <View style={styles.metaGridItem}>
                    <MaterialIcons
                      name={getCategoryIcon(selectedEvent.category, selectedEvent.musicStyle)}
                      size={14}
                      color={getCategoryColor(selectedEvent.category, selectedEvent.musicStyle)}
                    />
                    <Text style={styles.metaGridText} numberOfLines={1}>
                      {isEmergencyEvent
                        ? 'ALERTA'
                        : isInformative
                          ? 'PATRIMONIO'
                          : selectedEvent.category.toUpperCase()}
                    </Text>
                  </View>

                  {!isInformative && <View style={styles.metaGridDivider} />}

                  {!isInformative && (
                    <View style={styles.metaGridItem}>
                      <Ionicons name="people-outline" size={14} color="#A0AEC0" />
                      <Text style={styles.metaGridText} numberOfLines={1}>
                        {selectedEvent.attendeesCount || 24} asistirán
                      </Text>
                    </View>
                  )}

                  {isInformative && (
                    <>
                      <View style={styles.metaGridDivider} />
                      <View style={styles.metaGridItem}>
                        <Ionicons name="calendar-outline" size={14} color="#A0AEC0" />
                        <Text style={styles.metaGridText} numberOfLines={1}>
                          {selectedEvent.time}
                        </Text>
                      </View>
                    </>
                  )}
                </View>

                {/* Dirección Física */}
                {selectedEvent.address && (
                  <View style={styles.addressRowContainer}>
                    <Ionicons
                      name="location-sharp"
                      size={16}
                      color={getCategoryColor(selectedEvent.category, selectedEvent.musicStyle)}
                    />
                    <Text style={styles.addressText} numberOfLines={2}>
                      {selectedEvent.address}
                    </Text>
                  </View>
                )}

                {/* Botonera de Acciones con Check-in Inteligente */}
                <EventCheckInSection
                  selectedEvent={selectedEvent}
                  setCheckInModalRecord={setCheckInModalRecord}
                  setShowCheckInModal={setShowCheckInModal}
                />

                {isDesktop && !isInformative && (
                  <View style={styles.desktopToolsContainerPremium}>
                    <Text style={styles.desktopToolsTitlePremium}>COMPLEMENTOS EN VIVO</Text>
                    <TouchableOpacity
                      onPress={openRightSheet}
                      style={styles.desktopToolsBtnPremium}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="chatbubbles-outline"
                        size={16}
                        color="#A78BFA"
                        style={{ marginRight: 8 }}
                      />
                      <Text style={styles.desktopToolsBtnTextPremium}>
                        Foro y Comentarios en Vivo
                      </Text>
                      <Ionicons
                        name="chevron-forward-outline"
                        size={14}
                        color="#A78BFA"
                        style={{ marginLeft: 'auto' }}
                      />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Minimalist absolute bottom coordinates footer */}
            <View
              style={[
                styles.coordinatesBadgeFooter,
                { paddingBottom: isDesktop ? 12 : Math.max(insets.bottom, 12) },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.coordinatesBadgeFooterText} selectable={true}>
                  GPS: {selectedEvent.latitude.toFixed(6)}, {selectedEvent.longitude.toFixed(6)}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    copyToClipboard(
                      `${selectedEvent.latitude.toFixed(6)}, ${selectedEvent.longitude.toFixed(6)}`,
                    );
                  }}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 6,
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="content-copy" size={10} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </View>
      )}

      {/* --- MiniModal for Informative Landmarks --- */}
      {showMainUI && selectedEvent && isInformative && (
        <Animated.View
          style={[
            styles.miniModalContainer,
            {
              width: isDesktop ? 380 : '90%',
              left: isDesktop ? 20 : '5%',
              bottom: isDesktop ? 32 : 40,
              transform: [
                {
                  translateY: panelSlide.interpolate({
                    inputRange: [0, 1],
                    outputRange: [600, 0],
                  }),
                },
              ],
              opacity: panelSlide,
            },
          ]}
        >
          {/* Header/Banner Section */}
          <View style={styles.miniBannerContainer}>
            {selectedEvent.imageUrl && (
              <Image source={{ uri: selectedEvent.imageUrl }} style={styles.miniBannerImage} />
            )}
            <View style={styles.miniBannerOverlay} />
            <TouchableOpacity
              onPress={closeEventPanel}
              style={styles.miniCloseButton}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={18} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.miniBadgeContainer}>
              <View style={[styles.miniBadge, { backgroundColor: 'rgba(18, 22, 30, 0.8)' }]}>
                <MaterialIcons name="pets" size={12} color="#A0AEC0" />
                <Text style={styles.miniBadgeText}>LANDMARK PATRIMONIAL</Text>
              </View>
            </View>
          </View>

          {/* Info Section */}
          <View style={styles.miniContent}>
            <Text style={styles.miniTitle}>{selectedEvent.title}</Text>
            <Text style={styles.miniOrganizer}>📍 {selectedEvent.organizer}</Text>

            <Text style={styles.miniDescription} numberOfLines={4}>
              {selectedEvent.description}
            </Text>

            {/* Meta Grid Section */}
            <View style={styles.miniMetaGrid}>
              <View style={styles.miniMetaItem}>
                <Ionicons name="calendar-outline" size={14} color="#A0AEC0" />
                <Text style={styles.miniMetaText}>{selectedEvent.time}</Text>
              </View>
              <View style={styles.miniMetaDivider} />
              <View style={styles.miniMetaItem}>
                <Ionicons name="location-outline" size={14} color="#A0AEC0" />
                <Text style={styles.miniMetaText} numberOfLines={1}>
                  Feria Fluvial
                </Text>
              </View>
            </View>

            {/* Action Buttons Section */}
            <View style={styles.miniActionRow}>
              <TouchableOpacity
                style={[
                  styles.miniPrimaryBtn,
                  { backgroundColor: getCategoryColor(selectedEvent.category) },
                ]}
                activeOpacity={0.8}
                onPress={() => {
                  const url = `https://www.google.com/maps/dir/?api=1&destination=${selectedEvent.latitude},${selectedEvent.longitude}`;
                  Linking.openURL(url);
                }}
              >
                <Ionicons name="navigate" size={16} color="#FFFFFF" />
                <Text style={styles.miniPrimaryBtnText}>Cómo llegar</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.miniIconBtn} activeOpacity={0.7}>
                <Ionicons name="share-social-outline" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      )}

      {/* --- Sector Info Card (Before Exploring) --- */}
      {showMainUI &&
        selectedSector &&
        !activeNestedZone &&
        (() => {
          const isParkSector = selectedSector.category === 'reserva';
          const heroImage =
            selectedSector.images && selectedSector.images.length > 0
              ? selectedSector.images[0]
              : undefined;
          const hasRatingOrBadges =
            isParkSector &&
            (selectedSector.rating != null ||
              !!selectedSector.openingHours ||
              !!selectedSector.parkType);

          return (
            <Animated.View
              style={[
                styles.miniModalContainer,
                {
                  width: isDesktop ? 380 : '90%',
                  left: isDesktop ? 20 : '5%',
                  bottom: isDesktop ? 32 : 40,
                },
              ]}
            >
              {/* Header/Banner Section */}
              <View
                style={[styles.miniBannerContainer, { height: 100, backgroundColor: '#1E293B' }]}
              >
                {heroImage && <Image source={{ uri: heroImage }} style={styles.miniBannerImage} />}
                <View style={styles.miniBannerOverlay} />
                <TouchableOpacity
                  onPress={closeSectorPanel}
                  style={styles.miniCloseButton}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={18} color="#FFFFFF" />
                </TouchableOpacity>

                <View style={styles.miniBadgeContainer}>
                  <View style={[styles.miniBadge, { backgroundColor: 'rgba(56, 189, 248, 0.2)' }]}>
                    <Ionicons name="business" size={12} color="#38BDF8" />
                    <Text style={[styles.miniBadgeText, { color: '#38BDF8' }]}>
                      {(selectedSector.category ?? '').toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>

              <ScrollView
                style={
                  isParkSector
                    ? [styles.sectorScroll, { maxHeight: isDesktop ? 380 : 320 }]
                    : styles.sectorScroll
                }
                showsVerticalScrollIndicator={false}
              >
                {/* Info Section */}
                <View style={styles.miniContent}>
                  {hasRatingOrBadges && (
                    <View style={styles.sectorRatingBadgeRow}>
                      {selectedSector.rating != null && (
                        <View style={styles.sectorRatingPill}>
                          <Ionicons name="star" size={12} color="#FBBF24" />
                          <Text style={styles.sectorRatingText}>
                            {selectedSector.rating.toFixed(1)}
                          </Text>
                        </View>
                      )}
                      {selectedSector.openingHours && (
                        <View style={styles.sectorBadgePill}>
                          <Ionicons name="time-outline" size={12} color="#A0AEC0" />
                          <Text style={styles.sectorBadgePillText} numberOfLines={1}>
                            {selectedSector.openingHours}
                          </Text>
                        </View>
                      )}
                      {selectedSector.parkType && (
                        <View style={styles.sectorBadgePill}>
                          <Ionicons name="leaf-outline" size={12} color="#34D399" />
                          <Text style={styles.sectorBadgePillText} numberOfLines={1}>
                            {selectedSector.parkType}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  <Text style={styles.miniTitle}>{selectedSector.name}</Text>

                  <Text style={styles.miniDescription} numberOfLines={isParkSector ? undefined : 3}>
                    {selectedSector.description ||
                      'Sector delimitado de la ciudad. Haz clic en explorar para ver su interior.'}
                  </Text>

                  {isParkSector && selectedSector.images && selectedSector.images.length > 0 && (
                    <ParkImageSlider images={selectedSector.images} />
                  )}

                  {isParkSector && (
                    <>
                      <View style={styles.sectorPlaceholderSection}>
                        <Text style={styles.sectorPlaceholderTitle}>Actividades recientes</Text>
                        <View style={styles.sectorPlaceholderBox}>
                          <Ionicons name="time-outline" size={16} color="#64748B" />
                          <Text style={styles.sectorPlaceholderText}>
                            Sin actividades recientes
                          </Text>
                        </View>
                      </View>

                      <View style={styles.sectorPlaceholderSection}>
                        <Text style={styles.sectorPlaceholderTitle}>Próximamente</Text>
                        <View style={styles.sectorPlaceholderBox}>
                          <Ionicons name="sparkles-outline" size={16} color="#64748B" />
                          <Text style={styles.sectorPlaceholderText}>Próximamente disponible</Text>
                        </View>
                      </View>
                    </>
                  )}

                  {/* Action Buttons Section */}
                  <View style={[styles.miniActionRow, { marginTop: isParkSector ? 14 : 0 }]}>
                    <TouchableOpacity
                      style={[
                        styles.miniPrimaryBtn,
                        { backgroundColor: '#38BDF8', flex: 1, marginRight: 0 },
                      ]}
                      activeOpacity={0.8}
                      onPress={handleExploreSector}
                    >
                      <Ionicons name="enter-outline" size={18} color="#0F172A" />
                      <Text
                        style={[
                          styles.miniPrimaryBtnText,
                          { color: '#0F172A', fontWeight: 'bold', fontSize: 14 },
                        ]}
                      >
                        Explorar Interior
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>

              {isParkSector && (
                <View style={styles.sectorFooterRow}>
                  <TouchableOpacity
                    style={styles.sectorFooterBtn}
                    activeOpacity={0.8}
                    onPress={handleSaveSector}
                  >
                    <Ionicons name="bookmark-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.sectorFooterBtnText}>Guardar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sectorFooterBtn, { backgroundColor: '#38BDF8' }]}
                    activeOpacity={0.8}
                    onPress={handleSectorDirections}
                  >
                    <Ionicons name="navigate-outline" size={16} color="#0F172A" />
                    <Text style={[styles.sectorFooterBtnText, { color: '#0F172A' }]}>
                      Como llegar
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.sectorFooterIconBtn}
                    activeOpacity={0.8}
                    onPress={handleSectorShare}
                  >
                    <Ionicons name="share-social-outline" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              )}
            </Animated.View>
          );
        })()}

      {/* Modal de Check-in Exitoso */}
      {showCheckInModal && (
        <CheckInModal
          record={checkInModalRecord}
          onClose={() => {
            setShowCheckInModal(false);
            setCheckInModalRecord(null);
          }}
        />
      )}

      {/* Modal de Creación de Evento Pinado */}
      <CreatePointModal
        visible={showCreateEventModal}
        onClose={() => setShowCreateEventModal(false)}
        tacticalLocation={tacticalLocation}
        formAddress={formAddress}
        setFormAddress={setFormAddress}
        handleCreateNewEvent={handleCreateNewEvent}
        showNotification={showNotification}
      />

      {isDesktop && showRightSheet && (
        <Animated.View
          style={[
            styles.sidePanel,
            {
              position: 'absolute',
              width: panelWidth,
              maxWidth: panelWidth,
              top: 16,
              bottom: 16,
              right: 16,
              left: 'auto',
              borderRadius: 32,
              zIndex: 3005,
              transform: [
                {
                  translateX: rightSheetSlide.interpolate({
                    inputRange: [0, 1],
                    outputRange: [panelWidth + 32, 0],
                  }),
                },
              ],
              opacity: rightSheetSlide,
            },
          ]}
        >
          <View style={styles.rightSheetHeader}>
            <Ionicons name="chatbubbles" size={20} color="#A78BFA" style={{ marginRight: 8 }} />
            <Text style={styles.rightSheetTitle}>Foro en Vivo</Text>
            <TouchableOpacity
              onPress={closeRightSheet}
              style={styles.rightSheetCloseButton}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color="#A0AEC0" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.panelScroll}
            contentContainerStyle={{ padding: 24, gap: 16 }}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.rightSheetSubTitle}>
              Comunidad activa en "{selectedEvent ? selectedEvent.title : ''}"
            </Text>

            <View style={styles.commentBox}>
              <View style={styles.commentHeader}>
                <Text style={styles.commentAuthor}>Carlos Espinoza</Text>
                <Text style={styles.commentTime}>Hace 5 min</Text>
              </View>
              <Text style={styles.commentText}>
                ¡El ambiente está increíble! La música se escucha espectacular y hay mucha gente
                disfrutando del evento. ¡Muy recomendado!
              </Text>
            </View>

            <View style={styles.commentBox}>
              <View style={styles.commentHeader}>
                <Text style={styles.commentAuthor}>María José Valenzuela</Text>
                <Text style={styles.commentTime}>Hace 12 min</Text>
              </View>
              <Text style={styles.commentText}>
                ¿Alguien sabe si todavía quedan entradas en puerta o si el acceso es completamente
                liberado?
              </Text>
            </View>

            <View style={styles.commentBox}>
              <View style={styles.commentHeader}>
                <Text style={styles.commentAuthor}>Tomás Schmidt</Text>
                <Text style={styles.commentTime}>Hace 20 min</Text>
              </View>
              <Text style={styles.commentText}>
                Acabo de llegar, el estacionamiento cerca del sector está un poco lleno pero hay
                guardias orientando. ¡Vengan con tiempo!
              </Text>
            </View>

            {/* Form to leave a message */}
            <View style={styles.commentInputContainer}>
              <Text style={styles.commentInputLabel}>Deja un comentario en el foro</Text>
              <View style={styles.commentInputWrapper}>
                <Text style={styles.commentInputPlaceholder}>Escribe algo...</Text>
                <TouchableOpacity style={styles.sendCommentBtn}>
                  <Ionicons name="send" size={14} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </Animated.View>
      )}

      {showNotificationTray && (
        <NotificationTray
          notifications={notifications}
          onClose={() => setShowNotificationTray(false)}
          onClearAll={() => setNotifications([])}
          onMarkAsRead={(id) => {
            setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
          }}
          anchor={notificationsAnchor}
        />
      )}

      {/* Modal para Guardar Ubicaciones en Colecciones */}
      <SaveToCollectionModal
        visible={collectionModalVisible}
        onClose={() => setCollectionModalVisible(false)}
        locationData={locationToSave}
      />

      {showSectorsConfig && (
        <SectorConfigPanel
          sectors={sectors}
          visibleSectorIds={visibleSectorIds}
          onToggleSector={handleToggleSector}
          showSectors={showSectors}
          onToggleAll={setShowSectors}
          onClose={() => setShowSectorsConfig(false)}
        />
      )}

      {/* Floating On-Screen Toast Notifier */}
      {activeToast && (
        <View style={styles.toastContainer}>
          <View
            style={[
              styles.toastCard,
              styles[`toastCard_${activeToast.type}` as keyof typeof styles],
            ]}
          >
            <MaterialIcons
              name={
                activeToast.type === 'success'
                  ? 'check-circle'
                  : activeToast.type === 'error'
                    ? 'error'
                    : activeToast.type === 'warning'
                      ? 'warning'
                      : 'info'
              }
              size={20}
              color={
                activeToast.type === 'success'
                  ? '#34D399'
                  : activeToast.type === 'error'
                    ? '#EF4444'
                    : activeToast.type === 'warning'
                      ? '#F59E0B'
                      : '#60A5FA'
              }
            />
            <Text style={styles.toastMessage}>{activeToast.message}</Text>
          </View>
        </View>
      )}

      {/* Collections Floating Island */}
      <CollectionsFloatingIsland
        visible={showCollectionsIsland}
        onClose={() => setShowCollectionsIsland(false)}
      />
    </SafeAreaView>
  );
}
