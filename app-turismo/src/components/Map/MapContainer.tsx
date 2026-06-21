import React, { useEffect, useRef, useState, useCallback } from 'react';
import { StyleSheet, View, Text, Platform, TouchableOpacity, Animated, Alert } from 'react-native';
import AnimatedReanimated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing as ReanimatedEasing,
  interpolate,
  FadeIn,
  FadeOut,
  ZoomIn,
  ZoomOut,
  LinearTransition,
} from 'react-native-reanimated';
import MapView, {
  Marker,
  Polygon,
  Circle,
  UrlTile,
  PROVIDER_DEFAULT,
  PROVIDER_GOOGLE,
  Polyline,
} from 'react-native-maps';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';

import { MAP_CONFIG } from '../../config/mapConfig';
import { INITIAL_REGION } from '../../constants/location';
import { CategoryIconName, getCategoryColor, getCategoryIcon } from '../../utils/mapUtils';
import { DARK_MAP_STYLE_MOBILE } from '../../config/mapStyles.mobile';
import { OfflineIndicator } from '../MapUI/OfflineIndicator';
import { useSuperclusterEvents, getClusterDominantColor } from '../../utils/clusterUtils';
import { ContextualRadialMenu } from '../ui/ContextualRadialMenu';
import { getLatestRadarPath } from '../../utils/weatherUtils';
import { useUserLocationContext } from '../../context/UserLocationContext';
import { CICLOVIAS_GEOJSON } from '../../data/ciclovias';

import {
  TurismoEvent,
  Cluster,
  MapContainerProps,
  MAX_ZOOM_PER_LAYER,
  MAX_WEATHER_ZOOM,
  MAX_RAINVIEWER_ZOOM,
} from './types';
import { ArtisticMarker, ArtisticMarkerType } from './Markers/ArtisticMarker';
import { StoreMarker } from './Markers/StoreMarker';
import { MiniModal } from './Markers/MiniModal';
import { AuthorityModal } from './Markers/AuthorityModal';
import { furnitureData } from '../../data/mobiliarioData';
import { FurnitureMarker } from './Markers/FurnitureMarker';

// ─── UserMarkerAnimated ──────────────────────────────────────────────────────
const UserMarkerAnimated = React.memo(
  ({
    userLocation,
  }: {
    userLocation: { latitude: number; longitude: number; heading?: number | null };
  }) => {
    const pulseAnim = useSharedValue(0);
    const [trackChanges, setTrackChanges] = useState(true);

    useEffect(() => {
      // Re-enable track changes briefly when location or heading updates
      setTrackChanges(true);
      const timer = setTimeout(() => {
        setTrackChanges(false);
      }, 3000); // Aumentado a 3s para ver un par de pulsos completos
      return () => clearTimeout(timer);
    }, [userLocation.latitude, userLocation.longitude, userLocation.heading]);

    useEffect(() => {
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 2000, easing: ReanimatedEasing.out(ReanimatedEasing.ease) }),
          withTiming(0, { duration: 0 }),
        ),
        -1,
      );
      return () => {
        pulseAnim.value = 0;
      };
    }, [pulseAnim]);

    const pulseStyle = useAnimatedStyle(() => {
      const scale = interpolate(pulseAnim.value, [0, 0.5, 1], [1, 2.8, 1.2]); // Rebote: crece y luego encoge un poco
      const opacity = interpolate(pulseAnim.value, [0, 0.5, 0.8, 1], [0.8, 0.4, 0.2, 0]);

      return {
        transform: [{ scale }],
        opacity,
      };
    });

    return (
      <Marker
        coordinate={{ latitude: userLocation.latitude, longitude: userLocation.longitude }}
        anchor={{ x: 0.5, y: 0.5 }}
        zIndex={20}
        tracksViewChanges={trackChanges}
      >
        <View style={[styles.userMarkerWrapper, { overflow: 'visible' }]}>
          {/* Haz de luz o Cono direccional que apunta según el heading */}
          {userLocation.heading !== null && userLocation.heading !== undefined && (
            <View
              style={[
                styles.coneWrapper,
                {
                  transform: [{ rotate: `${userLocation.heading}deg` }],
                },
              ]}
            >
              <View style={styles.directionalCone} />
            </View>
          )}

          <AnimatedReanimated.View style={[styles.userMarkerPulse, pulseStyle]} />
          <View style={styles.userMarkerCore} />
        </View>
      </Marker>
    );
  },
);
UserMarkerAnimated.displayName = 'UserMarkerAnimated';

// ─── PublicEventMarkerAnimated ───────────────────────────────────────────────
interface EventMarkerProps {
  event: TurismoEvent;
  isSelected: boolean;
  onPress: (event: TurismoEvent) => void;
  pulseScale: number;
  isLightMode?: boolean;
  onSaveLocation?: (locationData: any) => void;
}

const PublicEventMarkerAnimated = React.memo(
  ({ event, isSelected, onPress, pulseScale, isLightMode, onSaveLocation }: EventMarkerProps) => {
    const pulseAnim = useSharedValue(0);
    const [trackChanges, setTrackChanges] = useState(true);

    useEffect(() => {
      if (isSelected) {
        setTrackChanges(true);
      } else {
        // Breve periodo de seguimiento para capturar cambios de estado iniciales
        setTrackChanges(true);
        const timer = setTimeout(() => {
          setTrackChanges(false);
        }, 2000);
        return () => clearTimeout(timer);
      }
    }, [isSelected]);

    useEffect(() => {
      if (!isSelected) {
        pulseAnim.value = 0;
        return;
      }

      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 2500, easing: ReanimatedEasing.out(ReanimatedEasing.ease) }),
          withTiming(0, { duration: 0 }),
        ),
        -1, // infinite loop
      );

      return () => {
        pulseAnim.value = 0;
      };
    }, [pulseAnim, isSelected]);

    const attendeesRatio = Math.min(event.attendeesCount || 0, 1000) / 1000;
    const maxScale = 1.2 + attendeesRatio * 0.8;

    const pulseStyle1 = useAnimatedStyle(() => {
      const scale1 = interpolate(pulseAnim.value, [0, 0.5, 1], [1, maxScale, 1.2]) * pulseScale; // Rebote
      const opacity1 = interpolate(pulseAnim.value, [0, 0.5, 0.8, 1], [0.6, 0.3, 0.1, 0]);

      return {
        transform: [{ scale: scale1 }],
        opacity: opacity1,
      };
    }, [maxScale, pulseScale]);

    const pulseStyle2 = useAnimatedStyle(() => {
      const scale2 =
        interpolate(pulseAnim.value, [0, 0.5, 1], [0.5, maxScale * 0.7, 0.8]) * pulseScale; // Rebote
      const opacity2 = interpolate(pulseAnim.value, [0, 0.5, 1], [0.8, 0.4, 0]);

      return {
        transform: [{ scale: scale2 }],
        opacity: opacity2,
      };
    }, [maxScale, pulseScale]);

    const color = getCategoryColor(event.category, event.musicStyle);
    const iconName = getCategoryIcon(event.category, event.musicStyle);

    const handlePress = useCallback(() => {
      onPress(event);
    }, [onPress, event]);

    const handleSave = useCallback(() => {
      if (onSaveLocation) {
        onSaveLocation({
          locationType: 'event',
          refId: event.id,
          latitude: event.latitude,
          longitude: event.longitude,
          title: event.title,
          notes: event.description,
        });
      }
    }, [onSaveLocation, event]);

    const MarkerContent = (
      <AnimatedReanimated.View
        entering={ZoomIn.duration(400).delay(Math.random() * 200)}
        exiting={ZoomOut.duration(300)}
        layout={LinearTransition.springify().damping(15)}
        style={[styles.markerWrapper, { overflow: 'visible' }]}
      >
        {/* Ondas expansivas, solo animan si isSelected */}
        {isSelected && (
          <>
            <AnimatedReanimated.View
              style={[styles.publicEventPulse, { backgroundColor: color }, pulseStyle1]}
            />
            <AnimatedReanimated.View
              style={[styles.publicEventPulse, { backgroundColor: color }, pulseStyle2]}
            />
          </>
        )}

        {/* Pin central */}
        <View
          style={[
            styles.markerPin,
            {
              backgroundColor: color,
              borderColor: isLightMode ? '#FFFFFF' : '#111827',
              transform: [{ scale: isSelected ? 1.3 : 1 }],
              shadowColor: isLightMode ? 'rgba(0,0,0,0.1)' : '#000',
            },
          ]}
        >
          <MaterialIcons name={iconName} size={16} color="#FFFFFF" />
        </View>
      </AnimatedReanimated.View>
    );

    return (
      <Marker
        key={event.id}
        coordinate={{ latitude: event.latitude, longitude: event.longitude }}
        onPress={handlePress}
        tracksViewChanges={trackChanges}
        anchor={{ x: 0.5, y: 0.5 }}
        zIndex={isSelected ? 10 : 1}
      >
        {isSelected ? (
          <ContextualRadialMenu
            menuId={`native-pin-${event.id}`}
            buttonSize={22}
            offset={6}
            items={[
              {
                id: 'info',
                icon: <MaterialIcons name="info-outline" size={12} color="#002d20" />,
                tooltip: 'Detalles',
                onClick: () => onPress(event),
              },
              {
                id: 'favorite',
                icon: <MaterialIcons name="bookmark-outline" size={12} color="#002d20" />,
                tooltip: 'Guardar',
                onClick: handleSave,
              },
              {
                id: 'share',
                icon: <MaterialIcons name="share" size={12} color="#002d20" />,
                tooltip: 'Compartir',
                onClick: () => onPress(event),
              },
            ]}
            isSelected={isSelected}
            onSelectionChange={(selected) => {
              if (!selected) onPress(null as any);
              else onPress(event);
            }}
          >
            {MarkerContent}
          </ContextualRadialMenu>
        ) : (
          MarkerContent
        )}
      </Marker>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.event.id === nextProps.event.id &&
      prevProps.event.latitude === nextProps.event.latitude &&
      prevProps.event.longitude === nextProps.event.longitude &&
      prevProps.event.attendeesCount === nextProps.event.attendeesCount &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.pulseScale === nextProps.pulseScale &&
      prevProps.isLightMode === nextProps.isLightMode
    );
  },
);
PublicEventMarkerAnimated.displayName = 'PublicEventMarkerAnimated';

// ─── Memoized EventMarker ────────────────────────────────────────────────────
// Cada marcador se renderiza de forma independiente. Solo se re-renderiza si
// cambian sus props (evento seleccionado, datos del evento, etc.)

const EventMarker = React.memo(
  function EventMarker({
    event,
    isSelected,
    onPress,
    pulseScale,
    isLightMode,
    onSaveLocation,
  }: EventMarkerProps) {
    // tracksViewChanges = true por 500ms para dar tiempo a que MaterialIcons
    // cargue sus fuentes y el bitmap del marcador capture el icono correctamente.
    // Luego se desactiva para que el SO no re-capture en cada frame (rendimiento).
    const [trackChanges, setTrackChanges] = useState(true);

    useEffect(() => {
      const timer = setTimeout(() => {
        setTrackChanges(false);
      }, 250);
      return () => clearTimeout(timer);
    }, []);

    // Re-activar brevemente si cambia la selección (para capturar el scale change)
    useEffect(() => {
      Promise.resolve().then(() => setTrackChanges(true));
      const timer = setTimeout(() => {
        setTrackChanges(false);
      }, 150);
      return () => clearTimeout(timer);
    }, [isSelected]);

    const color = getCategoryColor(event.category, event.musicStyle);
    const iconName: CategoryIconName = getCategoryIcon(event.category, event.musicStyle);

    const isMiniModalEvent = ['fauna', 'tienda', 'camara', 'universidad'].includes(event.category?.toLowerCase() || '');
    const isAuthorityEvent = ['hospital', 'bombero', 'carabinero'].includes(event.category?.toLowerCase() || '');
    const isArtistic = ['museo', 'coliseo', 'puerto', 'teatro', 'fauna', 'hospital', 'universidad', 'bombero', 'carabinero', 'camara'].includes(event.category?.toLowerCase() || '');

    const handlePress = useCallback(() => {
      onPress(event);
    }, [onPress, event]);

    const handleSave = useCallback(() => {
      if (onSaveLocation) {
        onSaveLocation({
          locationType: 'event',
          refId: event.id,
          latitude: event.latitude,
          longitude: event.longitude,
          title: event.title,
          notes: event.description,
        });
      }
    }, [onSaveLocation, event]);

    const MarkerContent = (
      <View
        style={{
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: 10,
          zIndex: isSelected ? 9999 : 1,
        }}
      >
        {isSelected && isMiniModalEvent && (
          <MiniModal event={event} isLightMode={isLightMode} isSelected={isSelected} />
        )}
        {isSelected && isAuthorityEvent && (
          <AuthorityModal event={event} isLightMode={isLightMode} />
        )}
        <AnimatedReanimated.View
          entering={ZoomIn.duration(400).delay(Math.random() * 200)}
          exiting={ZoomOut.duration(300)}
          layout={LinearTransition.springify().damping(15)}
        >
          {isArtistic ? (
            <ArtisticMarker
              type={event.category?.toLowerCase() as ArtisticMarkerType}
              isSelected={isSelected}
              size={isSelected ? 72 : 56}
              isLightMode={isLightMode}
              markerSvg={event.markerSvg}
              imageUrl={event.imageUrl}
              title={event.title}
            />
          ) : (
            <View style={styles.markerWrapper}>
              {event.isRealTime && (
                <View
                  style={[
                    styles.pulseCircle,
                    { backgroundColor: color, transform: [{ scale: pulseScale }] },
                  ]}
                />
              )}
              <View
                style={[
                  styles.markerPin,
                  {
                    backgroundColor: color,
                    borderColor: isLightMode ? '#FFFFFF' : '#111827',
                    transform: [{ scale: isSelected ? 1.3 : 1 }],
                    shadowColor: isLightMode ? 'rgba(0,0,0,0.1)' : '#000',
                  },
                ]}
              >
                <MaterialIcons name={iconName} size={16} color="#FFFFFF" />
              </View>
            </View>
          )}
        </AnimatedReanimated.View>
      </View>
    );

    return (
      <Marker
        key={event.id}
        coordinate={{ latitude: event.latitude, longitude: event.longitude }}
        onPress={handlePress}
        tracksViewChanges={trackChanges}
        anchor={{ x: 0.5, y: 0.5 }}
        zIndex={isSelected ? 10 : 1}
      >
        {isSelected && !isMiniModalEvent && !isAuthorityEvent ? (
          <ContextualRadialMenu
            menuId={`native-pub-${event.id}`}
            buttonSize={22}
            offset={6}
            items={[
              {
                id: 'info',
                icon: <MaterialIcons name="info-outline" size={12} color="#002d20" />,
                tooltip: 'Detalles',
                onClick: () => onPress(event),
              },
              {
                id: 'favorite',
                icon: <MaterialIcons name="bookmark-outline" size={12} color="#002d20" />,
                tooltip: 'Guardar',
                onClick: handleSave,
              },
              {
                id: 'share',
                icon: <MaterialIcons name="share" size={12} color="#002d20" />,
                tooltip: 'Compartir',
                onClick: () => onPress(event),
              },
            ]}
            isSelected={isSelected}
            onSelectionChange={(selected) => {
              if (!selected) onPress(null as any);
              else onPress(event);
            }}
          >
            {MarkerContent}
          </ContextualRadialMenu>
        ) : (
          MarkerContent
        )}
      </Marker>
    );
  },
  (prevProps, nextProps) => {
    // Comparación personalizada: solo re-renderizar si cambia lo que importa
    return (
      prevProps.event.id === nextProps.event.id &&
      prevProps.event.latitude === nextProps.event.latitude &&
      prevProps.event.longitude === nextProps.event.longitude &&
      prevProps.event.category === nextProps.event.category &&
      prevProps.event.isRealTime === nextProps.event.isRealTime &&
      prevProps.event.title === nextProps.event.title &&
      prevProps.event.attendeesCount === nextProps.event.attendeesCount &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.onPress === nextProps.onPress &&
      prevProps.pulseScale === nextProps.pulseScale &&
      prevProps.isLightMode === nextProps.isLightMode
    );
  },
);

const ClusterMarker = React.memo(
  ({
    cluster,
    onPress,
    pulseScale,
    isLightMode,
  }: {
    cluster: Cluster;
    onPress: (cluster: Cluster) => void;
    pulseScale: number;
    isLightMode?: boolean;
  }) => {
    const count = cluster.events.length;
    const dominantColor = getClusterDominantColor(cluster.events);

    const [trackChanges, setTrackChanges] = useState(true);
    const prevLightMode = useRef(isLightMode);

    useEffect(() => {
      setTrackChanges(true);
      const timer = setTimeout(() => {
        setTrackChanges(false);
      }, 3000); // 3s para capturar la animación inicial y el pulso
      return () => clearTimeout(timer);
    }, []);

    const trackChangesEffect = isLightMode !== prevLightMode.current;

    useEffect(() => {
      if (trackChangesEffect) {
        setTrackChanges(true);
        const timer = setTimeout(() => {
          setTrackChanges(false);
        }, 300);
        prevLightMode.current = isLightMode;
        return () => clearTimeout(timer);
      }
    }, [isLightMode, trackChangesEffect]);

    const handlePress = useCallback(() => {
      onPress(cluster);
    }, [onPress, cluster]);

    return (
      <Marker
        key={cluster.id}
        coordinate={{ latitude: cluster.latitude, longitude: cluster.longitude }}
        onPress={handlePress}
        tracksViewChanges={trackChanges}
        anchor={{ x: 0.5, y: 0.5 }}
        zIndex={5} // Encima de pines normales, debajo del seleccionado
      >
        <AnimatedReanimated.View
          entering={ZoomIn.duration(500)}
          exiting={ZoomOut.duration(300)}
          layout={LinearTransition.springify().damping(15)}
          style={[styles.clusterWrapper, { overflow: 'visible' }]}
        >
          <View
            style={[
              styles.clusterInner,
              {
                backgroundColor: isLightMode ? '#FFFFFF' : '#0B0F19',
                borderColor: dominantColor,
                shadowColor: isLightMode ? 'rgba(0,0,0,0.1)' : '#000',
              },
            ]}
          >
            <Text style={[styles.clusterText, { color: isLightMode ? '#1F2937' : '#FFFFFF' }]}>
              {count}
            </Text>
          </View>
        </AnimatedReanimated.View>
      </Marker>
    );
  },
  (prev, next) => {
    return (
      prev.cluster.id === next.cluster.id &&
      prev.cluster.latitude === next.cluster.latitude &&
      prev.cluster.longitude === next.cluster.longitude &&
      prev.cluster.events.length === next.cluster.events.length &&
      prev.onPress === next.onPress &&
      prev.pulseScale === next.pulseScale &&
      prev.isLightMode === next.isLightMode
    );
  },
);
ClusterMarker.displayName = 'ClusterMarker';

const zoomToDeltas = (zoomLevel: number) => {
  const delta = 0.015 * Math.pow(2, 13 - zoomLevel);
  return {
    latitudeDelta: delta,
    longitudeDelta: delta,
  };
};

const getPulseScaleForZoom = (zoomLevel: number) => {
  const zoomBoost = 1 + Math.max(0, zoomLevel - 13) * 0.08;
  return Math.min(1.4, zoomBoost);
};

const getRouteCategoryColor = (category: string) => {
  switch (category) {
    case 'cervecera':
      return '#F59E0B';
    case 'reto':
      return '#EF4444';
    case 'turistica':
      return '#3B82F6';
    case 'exploracion':
      return '#10B981';
    default:
      return '#34D399';
  }
};

function MapContainerInner({
  events,
  selectedEvent,
  onSelectEvent,
  mapLayer,
  centerTrigger,
  tacticalMode,
  onTacticalLocationChange,
  onMapPincho,
  mapPincho,
  onMapMove,
  zoom,
  onZoomChange,
  onBoundsChange,
  showTraffic,
  showCycleways = false,
  cyclewaysData = [],
  showSectors = true,
  sectorsData,
  visibleSectorIds,
  onSectorPress,
  activeNestedZone,
  showWeather,
  weatherType = 'precipitation',
  isFrozen = false,
  onSaveLocation,
  isRoutingActive,
  routingType,
  draftRoutePoints = [],
  onMapClickForRouting,
  isRouteFinished,
  savedRoutes = [],
  onRateRoute,
}: Omit<MapContainerProps, 'userLocation'>) {
  const { userLocation } = useUserLocationContext();
  const [showProviderInfo, setShowProviderInfo] = React.useState(false);
  const [localLoboMarinoId, setLocalLoboMarinoId] = React.useState<string | null>(null);
  const [selectedFurnitureId, setSelectedFurnitureId] = React.useState<string | null>(null);
  const [radarPath, setRadarPath] = useState<string | null>(null);
  const skipNextCenter = useRef(false);
  const [currentBounds, setCurrentBounds] = useState<
    | {
        minLat: number;
        maxLat: number;
        minLng: number;
        maxLng: number;
      }
    | undefined
  >(undefined);

  // Effect to fetch the latest RainViewer radar path when weather is enabled
  useEffect(() => {
    if (showWeather && weatherType === 'precipitation' && !radarPath) {
      getLatestRadarPath().then(setRadarPath);
    }
  }, [showWeather, weatherType, radarPath]);

  const currentRegionRef = useRef({
    latitude: INITIAL_REGION.latitude,
    longitude: INITIAL_REGION.longitude,
    latitudeDelta: INITIAL_REGION.latitudeDelta,
    longitudeDelta: INITIAL_REGION.longitudeDelta,
  });

  // --- Nested Zone Camera Animation ---
  useEffect(() => {
    if (activeNestedZone && activeNestedZone.geojson && mapRef.current) {
      const geojson =
        typeof activeNestedZone.geojson === 'string'
          ? JSON.parse(activeNestedZone.geojson)
          : activeNestedZone.geojson;
          
      if (geojson.type === 'Polygon' && geojson.coordinates && geojson.coordinates[0]) {
        const coordinates = geojson.coordinates[0].map((coord: any) => ({
          latitude: coord[1],
          longitude: coord[0],
        }));
        
        mapRef.current.fitToCoordinates(coordinates, {
          edgePadding: { top: 100, right: 100, bottom: 100, left: 100 },
          animated: true,
        });
      }
    }
  }, [activeNestedZone]);

  const currentZoom =
    zoom ?? Math.round(13 - Math.log2(currentRegionRef.current.latitudeDelta / 0.015));
  const pulseScale = getPulseScaleForZoom(currentZoom);

  const isMapLight = mapLayer === 'light' || mapLayer === 'streets';
  const isDark = !isMapLight;

  const handleSelectEvent = useCallback(
    (event: TurismoEvent | null) => {
      setSelectedFurnitureId(null);
      const isLocalSelection = ['fauna', 'hospital', 'bombero', 'carabinero', 'camara', 'universidad'].includes(event?.category?.toLowerCase() || '');
      const isAlreadySelected = (selectedEvent?.id === event?.id) || (localLoboMarinoId === event?.id);
      const nextEvent = isAlreadySelected ? null : event;

      if (nextEvent && isLocalSelection) {
        // Manejamos puramente local para evitar que index.tsx abra su modal/panel
        setLocalLoboMarinoId(nextEvent.id);
        onSelectEvent(null); // Deseleccionamos el evento global si había uno
      } else {
        // Para otros tipos, usamos el flujo estándar
        setLocalLoboMarinoId(null);
        onSelectEvent(nextEvent);
      }
      
      skipNextCenter.current = true;
    },
    [onSelectEvent, selectedEvent, localLoboMarinoId],
  );

  const clusteredItems = useSuperclusterEvents(events, currentZoom, currentBounds);

  const handleClusterPress = useCallback(
    (cluster: Cluster) => {
      const maxPossibleZoom = MAX_ZOOM_PER_LAYER[mapLayer] || 18;
      const nextZoom = Math.min(currentZoom + 2, maxPossibleZoom - 1);
      if (onZoomChange) {
        onZoomChange(nextZoom);
      }
      if (mapRef.current) {
        const deltas = zoomToDeltas(nextZoom);
        mapRef.current.animateToRegion(
          {
            latitude: cluster.latitude,
            longitude: cluster.longitude,
            ...deltas,
          },
          600,
        );
      }
    },
    [currentZoom, onZoomChange, mapLayer],
  );

  // Determinamos el proveedor según la configuración global MAP_CONFIG.
  // Nota: En iOS, para evitar crashes en Expo Go estándar, usamos PROVIDER_DEFAULT de forma predeterminada
  // incluso si la configuración es 'google'. Cambia PROVIDER_DEFAULT por PROVIDER_GOOGLE para iOS
  // solo si has compilado un Development Build nativo con soporte de Google Maps en iOS.
  const mapProvider =
    MAP_CONFIG.provider === 'google'
      ? Platform.OS === 'android'
        ? PROVIDER_GOOGLE
        : PROVIDER_DEFAULT
      : PROVIDER_DEFAULT;

  const mapType =
    mapLayer === 'satellite' ? 'satellite' : mapLayer === 'terrain' ? 'terrain' : 'standard';

  const mapStyle = mapLayer === 'dark' ? DARK_MAP_STYLE_MOBILE : undefined;

  const mapRef = useRef<MapView>(null);

  // Sincronizar zoom del mapa
  useEffect(() => {
    if (zoom !== undefined && mapRef.current) {
      const deltas = zoomToDeltas(zoom);
      mapRef.current.animateToRegion(
        {
          latitude: currentRegionRef.current.latitude,
          longitude: currentRegionRef.current.longitude,
          ...deltas,
        },
        400,
      );
    }
  }, [zoom]);

  // Efecto para centrar y animar el mapa cuando se selecciona un evento desde la interfaz
  useEffect(() => {
    if (selectedEvent && mapRef.current) {
      if (skipNextCenter.current) {
        skipNextCenter.current = false;
        return;
      }

      const nextZoom = Math.max(currentZoom, 16);
      const deltas = zoomToDeltas(nextZoom);

      mapRef.current.animateToRegion(
        {
          latitude: selectedEvent.latitude,
          longitude: selectedEvent.longitude,
          ...deltas,
        },
        800,
      ); // Ligeramente más rápido para sensación de fluidez
    }
  }, [selectedEvent]);

  // Funcionalidad para enfocar la posición del usuario cuando cambia (opcional, por ahora lo haremos desde el index.tsx)
  useEffect(() => {
    if (centerTrigger && userLocation && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        },
        800,
      );
    }
  }, [centerTrigger, userLocation]);
  const toggleProviderInfo = useCallback(() => {
    setShowProviderInfo((current) => !current);
  }, []);

  return (
    <View style={styles.container}>
      <OfflineIndicator />
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={toggleProviderInfo}
        style={[
          styles.providerBadge,
          {
            backgroundColor: isMapLight ? 'rgba(255, 255, 255, 0.9)' : 'rgba(17, 24, 39, 0.9)',
            borderColor: isMapLight ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.14)',
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Mostrar información del proveedor del mapa"
      >
        <View style={styles.providerDot} />
        <Text style={[styles.providerBadgeTitle, { color: isMapLight ? '#1F2937' : '#FFFFFF' }]}>
          Google
        </Text>
        {showProviderInfo && (
          <Text style={[styles.providerBadgeText, { color: isMapLight ? '#4B5563' : '#D1D5DB' }]}>
            Proveedor: Google Maps
          </Text>
        )}
      </TouchableOpacity>
      <MapView
        ref={mapRef}
        provider={mapProvider}
        style={styles.map}
        customMapStyle={mapStyle}
        mapType={mapType}
        maxZoomLevel={MAX_ZOOM_PER_LAYER[mapLayer]} // Respetar el límite de cada capa para evitar "Zoom level not supported"
        initialRegion={INITIAL_REGION}
        // ── Optimizaciones de rendimiento ──
        moveOnMarkerPress={false} // Evita que el mapa se mueva automáticamente al tocar un pin
        loadingEnabled={true} // Muestra indicador de carga mientras se renderizan tiles
        loadingIndicatorColor="#34D399"
        loadingBackgroundColor="#0B0F19"
        rotateEnabled={false} // Desactivar rotación reduce complejidad de render
        pitchEnabled={false} // Desactivar pitch 3D mejora rendimiento en dispositivos bajos
        showsPointsOfInterests={false} // Reducir POIs de Google mejora la velocidad de render de tiles
        showsBuildings={false} // Desactivar edificios 3D libera GPU
        showsTraffic={showTraffic ?? false} // Capa de tráfico opcional
        showsIndoors={false} // Sin mapas interiores
        showsUserLocation={true} // Usa el GPS nativo del dispositivo
        showsMyLocationButton={false} // Ocultar botón nativo porque ya tenemos un FAB
        onPress={(event) => {
          if (event.nativeEvent.action === 'marker-press') {
            return;
          }

          const coordinate = event.nativeEvent.coordinate;

          if (isRoutingActive && onMapClickForRouting) {
            onMapClickForRouting({
              latitude: coordinate.latitude,
              longitude: coordinate.longitude,
            });
            return;
          }

          setLocalLoboMarinoId(null);
          setSelectedFurnitureId(null);
          onSelectEvent(null);
          if (onMapPincho) {
            onMapPincho({
              latitude: coordinate.latitude,
              longitude: coordinate.longitude,
            });
          }
        }}
        onPanDrag={() => {
          if (onMapMove) {
            onMapMove();
          }
        }}
        onRegionChange={(region) => {
          if (tacticalMode && onTacticalLocationChange) {
            onTacticalLocationChange({ latitude: region.latitude, longitude: region.longitude });
          }
        }}
        onRegionChangeComplete={(region, details) => {
          if (details?.isGesture && onMapMove) {
            onMapMove();
          }
          currentRegionRef.current = region;
          if (onZoomChange) {
            const calculatedZoom = Math.round(13 - Math.log2(region.latitudeDelta / 0.015));
            if (calculatedZoom !== zoom) {
              onZoomChange(calculatedZoom);
            }
          }
          const nextBounds = {
            minLat: region.latitude - region.latitudeDelta / 2,
            maxLat: region.latitude + region.latitudeDelta / 2,
            minLng: region.longitude - region.longitudeDelta / 2,
            maxLng: region.longitude + region.longitudeDelta / 2,
          };
          setCurrentBounds(nextBounds);
          if (onBoundsChange) {
            onBoundsChange(nextBounds);
          }
        }}
      >
        {/* Capas de Zonas (Polígonos) */}
        {showSectors &&
          (sectorsData || []).map((zone) => {
            if (visibleSectorIds && !visibleSectorIds.includes(zone.id)) return null;
            
            // Zoom-based visibility rules for specific types
            if (zone.category === 'reserva' && currentZoom < 11.5) return null;
            if (zone.category === 'edificio' && currentZoom < 14) return null;

            const geojson =
              typeof zone.geojson === 'string' ? JSON.parse(zone.geojson) : zone.geojson;
            if (geojson.type === 'Polygon') {
              const coordinates = geojson.coordinates[0].map((coord: any) => ({
                latitude: coord[1],
                longitude: coord[0],
              }));
              let fillAlpha = '26';
              let strokeWidth = 2;
              let lineDashPattern = undefined;
              if (zone.category === 'edificio') {
                fillAlpha = '59'; // 35%
                strokeWidth = 3;
              } else if (zone.category === 'reserva') {
                fillAlpha = '33'; // 20%
                strokeWidth = 2;
                lineDashPattern = [10, 10];
              } else {
                fillAlpha = '14'; // 8%
                strokeWidth = 1.5;
                lineDashPattern = [5, 10];
              }
              const baseColor = (zone.color && zone.color.length === 7) ? zone.color : '#10B981';

              return (
                <Polygon
                  key={`zone-${zone.id}`}
                  coordinates={coordinates}
                  fillColor={`${baseColor}${fillAlpha}`}
                  strokeColor={baseColor}
                  strokeWidth={strokeWidth}
                  lineDashPattern={lineDashPattern}
                  tappable={!!onSectorPress}
                  onPress={() => onSectorPress && onSectorPress(zone)}
                  zIndex={0}
                />
              );
            }
            return null;
          })}

        {/* Marcador de Pincho (Herramienta Activa) */}
        {mapPincho && (
          <Marker
            coordinate={{ latitude: mapPincho.latitude, longitude: mapPincho.longitude }}
            anchor={{ x: 0.5, y: 0.85 }} // Ajuste para que la punta del pincho coincida con el punto
            zIndex={100}
          >
            <View style={styles.markerWrapper}>
              <View
                style={[
                  styles.markerPin,
                  {
                    backgroundColor: '#10B981',
                    borderColor: '#FFFFFF',
                    transform: [{ scale: 1.2 }],
                  },
                ]}
              >
                <MaterialIcons name="push-pin" size={18} color="#FFFFFF" />
              </View>
            </View>
          </Marker>
        )}

        {events
          .filter(e => e.polygon && e.polygon.length > 0 && ['agua', 'humedal'].includes(e.category))
          .map(event => (
            <Polygon
              key={`poly-${event.id}`}
              coordinates={event.polygon!}
              fillColor={`${getCategoryColor(event.category, event.musicStyle)}40`}
              strokeColor={getCategoryColor(event.category, event.musicStyle)}
              strokeWidth={2}
              onPress={() => handleSelectEvent(event)}
            />
          ))}

        {clusteredItems.map((item) => {
          if ('isCluster' in item && item.isCluster) {
            return (
              <ClusterMarker
                key={item.id}
                cluster={item}
                onPress={handleClusterPress}
                pulseScale={pulseScale}
                isLightMode={isMapLight}
              />
            );
          }
          const event = item as TurismoEvent;
          if (event.polygon && event.polygon.length > 0) {
            const isSelected = selectedEvent?.id === event.id || localLoboMarinoId === event.id;

            return (
              <React.Fragment key={event.id}>
                {isSelected && (
                  <Polygon
                    coordinates={event.polygon}
                    fillColor={`${getCategoryColor(event.category, event.musicStyle)}40`}
                    strokeColor={getCategoryColor(event.category, event.musicStyle)}
                    strokeWidth={2}
                    onPress={() => handleSelectEvent(event)}
                  />
                )}
                {event.category === 'publico' ? (
                  <PublicEventMarkerAnimated
                    event={event}
                    isSelected={isSelected}
                    onPress={handleSelectEvent}
                    pulseScale={pulseScale}
                    isLightMode={isMapLight}
                    onSaveLocation={onSaveLocation}
                  />
                ) : event.category === 'tienda' ? (
                  <StoreMarker
                    event={event}
                    isSelected={isSelected}
                    onPress={handleSelectEvent}
                    isLightMode={isMapLight}
                  />
                ) : (
                  <EventMarker
                    event={event}
                    isSelected={isSelected}
                    onPress={handleSelectEvent}
                    pulseScale={pulseScale}
                    isLightMode={isMapLight}
                    onSaveLocation={onSaveLocation}
                  />
                )}
              </React.Fragment>
            );
          }
          if (event.radius && event.radius > 0) {
            return (
              <Circle
                key={event.id}
                center={{ latitude: event.latitude, longitude: event.longitude }}
                radius={event.radius}
                fillColor={`${getCategoryColor(event.category, event.musicStyle)}40`}
                strokeColor={getCategoryColor(event.category, event.musicStyle)}
                strokeWidth={2}
                // @ts-expect-error Circle onPress type is sometimes missing in community typings
                onPress={() => handleSelectEvent(event)}
              />
            );
          }
          if (event.category === 'publico') {
            return (
              <PublicEventMarkerAnimated
                key={event.id}
                event={event}
                isSelected={selectedEvent?.id === event.id}
                onPress={handleSelectEvent}
                pulseScale={pulseScale}
                isLightMode={isMapLight}
                onSaveLocation={onSaveLocation}
              />
            );
          }
          if (event.category === 'tienda') {
            return (
              <StoreMarker
                key={event.id}
                event={event}
                isSelected={selectedEvent?.id === event.id}
                onPress={handleSelectEvent}
                isLightMode={isMapLight}
              />
            );
          }

          return (
            <EventMarker
              key={event.id}
              event={event}
              isSelected={selectedEvent?.id === event.id || localLoboMarinoId === event.id}
              onPress={handleSelectEvent}
              pulseScale={pulseScale}
              isLightMode={isMapLight}
              onSaveLocation={onSaveLocation}
            />
          );
        })}

        {/* Custom Marker for Web (showsUserLocation native feature doesn't work well on web) */}
        {Platform.OS === 'web' && userLocation && (
          <UserMarkerAnimated userLocation={userLocation} />
        )}

        {/* Capa de Clima (OpenWeatherMap / RainViewer) */}
        {showWeather &&
          // If we are waiting for the radar path, we don't render the tile to avoid 400 errors
          (weatherType !== 'precipitation' || radarPath ? (
            <UrlTile
              urlTemplate={
                weatherType === 'precipitation'
                  ? `https://tilecache.rainviewer.com${radarPath || '/v2/radar/now'}/256/{z}/{x}/{y}/1/1_1.png`
                  : `https://tile.openweathermap.org/map/${weatherType}_new/{z}/{x}/{y}.png?appid=YOUR_OWM_API_KEY`
              }
              zIndex={50}
              opacity={0.6}
              maximumZ={weatherType === 'precipitation' ? MAX_RAINVIEWER_ZOOM : MAX_WEATHER_ZOOM}
            />
          ) : null)}

        {showCycleways &&
          (cyclewaysData && cyclewaysData.length > 0
            ? cyclewaysData.map((c) => {
                const coords = c.coordinates.map(([lng, lat]: number[]) => ({
                  latitude: lat,
                  longitude: lng,
                }));
                return (
                  <React.Fragment key={`cycleway-${c.id}`}>
                    <Polyline
                      coordinates={coords}
                      strokeColor="#072030"
                      strokeWidth={6}
                      lineJoin="round"
                      lineCap="round"
                    />
                    <Polyline
                      coordinates={coords}
                      strokeColor="#00d2ff"
                      strokeWidth={3}
                      lineJoin="round"
                      lineCap="round"
                      lineDashPattern={[6, 6]}
                      tappable={true}
                      onPress={() => {
                        let msg = '';
                        if (c.inicio) msg += `Desde: ${c.inicio}\n`;
                        if (c.fin) msg += `Hasta: ${c.fin}\n`;
                        if (c.km) msg += `Largo: ${c.km} km`;
                        Alert.alert(c.eje || 'Ciclovía', msg || 'Tramo de ciclovía');
                      }}
                    />
                  </React.Fragment>
                );
              })
            : CICLOVIAS_GEOJSON.features.map((feature) => {
                const props = (feature.properties || {}) as any;
                const coords = feature.geometry.coordinates.map(([lng, lat]) => ({
                  latitude: lat,
                  longitude: lng,
                }));
                return (
                  <React.Fragment key={`cycleway-${feature.id || props.IDENTIFICA}`}>
                    <Polyline
                      coordinates={coords}
                      strokeColor="#072030"
                      strokeWidth={6}
                      lineJoin="round"
                      lineCap="round"
                    />
                    <Polyline
                      coordinates={coords}
                      strokeColor="#00d2ff"
                      strokeWidth={3}
                      lineJoin="round"
                      lineCap="round"
                      lineDashPattern={[6, 6]}
                      tappable={true}
                      onPress={() => {
                        let msg = '';
                        if (props.INICIO) msg += `Desde: ${props.INICIO}\n`;
                        if (props.FIN) msg += `Hasta: ${props.FIN}\n`;
                        if (props.KM) msg += `Largo: ${props.KM} km`;
                        Alert.alert(props.EJE_VIA || 'Ciclovía', msg || 'Tramo de ciclovía');
                      }}
                    />
                  </React.Fragment>
                );
              }))}

        {/* Capas de Rutas Guardadas (Geo-Router - Público) */}
        {savedRoutes.map((route) => {
          const routeColor = getRouteCategoryColor(route.category);
          return (
            <React.Fragment key={`saved-route-${route.id}`}>
              <Polyline
                coordinates={route.points.map((p) => ({
                  latitude: p.latitude,
                  longitude: p.longitude,
                }))}
                strokeColor={route.isFeatured ? routeColor : `${routeColor}80`}
                strokeWidth={route.isFeatured ? 5 : 3}
                lineJoin="round"
                tappable={true}
                onPress={() => {
                  Alert.alert(
                    route.isFeatured ? 'Ruta Destacada' : 'Ruta Oficial',
                    `Nombre: ${route.name}\nTipo: ${route.category.toUpperCase()}\nCreada por: ${route.businessName || 'Negocio Local'}\nRating: ${route.ratingAvg?.toFixed(1) || '0.0'}`,
                    [
                      { text: 'Cerrar', style: 'cancel' },
                      {
                        text: 'Calificar',
                        onPress: () => {
                          Alert.alert('Calificar Ruta', '¿Qué te pareció este trazado?', [
                            { text: '1', onPress: () => onRateRoute?.(route.id, 1) },
                            { text: '2', onPress: () => onRateRoute?.(route.id, 2) },
                            { text: '3', onPress: () => onRateRoute?.(route.id, 3) },
                            { text: '4', onPress: () => onRateRoute?.(route.id, 4) },
                            { text: '5', onPress: () => onRateRoute?.(route.id, 5) },
                          ]);
                        },
                      },
                    ],
                  );
                }}
              />
              {route.points
                .filter((p) => p.type !== 'waypoint')
                .map((point, pIndex) => (
                  <Marker
                    key={`saved-point-${route.id}-${pIndex}`}
                    coordinate={{ latitude: point.latitude, longitude: point.longitude }}
                    anchor={{ x: 0.5, y: 0.5 }}
                    zIndex={140}
                  >
                    <View style={styles.savedRoutePoint}>
                      <View
                        style={[
                          styles.savedRoutePointDot,
                          { backgroundColor: point.type === 'origin' ? '#FFFFFF' : routeColor },
                        ]}
                      />
                    </View>
                  </Marker>
                ))}
            </React.Fragment>
          );
        })}

        {/* Capa de Trazado de Ruta (Geo-Router) */}
        {isRoutingActive && draftRoutePoints.length > 0 && (
          <>
            {routingType === 'sector' && draftRoutePoints.length >= 3 ? (
              <Polygon
                coordinates={draftRoutePoints.map((p) => ({
                  latitude: p.latitude,
                  longitude: p.longitude,
                }))}
                fillColor="rgba(16, 185, 129, 0.3)"
                strokeColor="#10B981"
                strokeWidth={4}
              />
            ) : (
              <Polyline
                coordinates={draftRoutePoints.map((p) => ({
                  latitude: p.latitude,
                  longitude: p.longitude,
                }))}
                strokeColor="#10B981"
                strokeWidth={4}
                lineDashPattern={routingType === 'single_target' ? [5, 5] : undefined}
              />
            )}
            {draftRoutePoints.map((point, index) => {
              let color = '#10B981';
              let icon: any = 'place';
              let size = 24;

              if (point.type === 'origin') {
                color = '#34D399';
                icon = 'location-on';
                size = 32;
              } else if (point.type === 'destination') {
                color = '#EF4444';
                icon = 'flag';
                size = 32;
              } else if (point.type === 'target') {
                color = '#F59E0B';
                icon = 'ads-click';
              } else if (point.type === 'waypoint') {
                color = '#9CA3AF';
                icon = 'fiber-manual-record';
                size = 12;
              }

              return (
                <Marker
                  key={`draft-point-${index}`}
                  coordinate={{ latitude: point.latitude, longitude: point.longitude }}
                  anchor={{ x: 0.5, y: 0.5 }}
                  zIndex={150}
                >
                  <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialIcons name={icon} size={size} color={color} />
                    {point.name && (
                      <View style={styles.routePointLabel}>
                        <Text style={styles.routePointLabelText}>{point.name}</Text>
                      </View>
                    )}
                  </View>
                </Marker>
              );
            })}
          </>
        )}

        {/* ── Native Mobiliario Layer (Static High-Perf POIs) ── */}
        {currentZoom >= 15 && currentBounds &&
          furnitureData
            .filter(
              (f) =>
                f.latitude >= currentBounds.minLat &&
                f.latitude <= currentBounds.maxLat &&
                f.longitude >= currentBounds.minLng &&
                f.longitude <= currentBounds.maxLng
            )
            .map((f) => (
              <FurnitureMarker
                key={f.id}
                item={f}
                isDark={isDark}
                isSelected={selectedFurnitureId === f.id}
                onPress={() => {
                  setSelectedFurnitureId(f.id === selectedFurnitureId ? null : f.id);
                  onSelectEvent(null);
                  setLocalLoboMarinoId(null);
                }}
              />
            ))}
      </MapView>

      {/* Native Tactical Crosshair Overlay */}
      {tacticalMode && (
        <View style={styles.tacticalCrosshairContainer} pointerEvents="none">
          <Ionicons name="scan-outline" size={32} color="#10B981" />
          <View style={styles.tacticalCrosshairDot} />
        </View>
      )}
    </View>
  );
}

export const MapContainer = React.memo(MapContainerInner, (prev, next) => {
  // Si el mapa estaba congelado y sigue congelado, evitar completamente el renderizado
  if (prev.isFrozen && next.isFrozen) {
    return true;
  }
  // Si cambia el estado de congelación, debemos re-renderizar para reflejar el estado actual
  if (prev.isFrozen !== next.isFrozen) {
    return false;
  }
  // Solo re-renderizar si cambian los datos que afectan al mapa
  return (
    prev.events === next.events &&
    prev.selectedEvent?.id === next.selectedEvent?.id &&
    prev.mapLayer === next.mapLayer &&
    prev.onSelectEvent === next.onSelectEvent &&
    prev.centerTrigger === next.centerTrigger &&
    prev.tacticalMode === next.tacticalMode &&
    prev.showTraffic === next.showTraffic &&
    prev.showCycleways === next.showCycleways &&
    prev.cyclewaysData === next.cyclewaysData &&
    prev.showSectors === next.showSectors &&
    prev.sectorsData === next.sectorsData &&
    prev.visibleSectorIds === next.visibleSectorIds &&
    prev.showWeather === next.showWeather &&
    prev.weatherType === next.weatherType &&
    prev.zoom === next.zoom &&
    prev.onZoomChange === next.onZoomChange &&
    prev.onMapPincho === next.onMapPincho &&
    prev.onMapMove === next.onMapMove &&
    prev.isRoutingActive === next.isRoutingActive &&
    prev.routingType === next.routingType &&
    prev.draftRoutePoints === next.draftRoutePoints &&
    prev.isRouteFinished === next.isRouteFinished &&
    prev.savedRoutes === next.savedRoutes &&
    prev.onRateRoute === next.onRateRoute
  );
});
const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  providerBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(17, 24, 39, 0.9)',
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  providerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4285F4',
  },
  providerBadgeTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  providerBadgeText: {
    color: '#D1D5DB',
    fontSize: 11,
    marginLeft: 4,
  },
  markerWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 140, // Aumentado para evitar recortes en la onda expansiva
    height: 140,
  },
  pulseCircle: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    opacity: 0.35,
    // Eliminamos top/left para que el flex center del wrapper lo ubique al centro
  },
  markerPin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 6,
    overflow: 'visible',
  },
  userMarkerWrapper: {
    width: 120, // Aumentado para el pulso y cono
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coneWrapper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 120,
    height: 120,
    zIndex: -1,
  },
  directionalCone: {
    position: 'absolute',
    top: -10,
    width: 32,
    height: 32,
    borderStyle: 'solid',
    borderLeftWidth: 16,
    borderRightWidth: 16,
    borderBottomWidth: 32,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'rgba(59, 130, 246, 0.25)',
    transform: [{ scaleX: 0.5 }],
  },
  userMarkerPulse: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
  },
  userMarkerCore: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#3B82F6',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  tacticalCrosshairContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  tacticalCrosshairDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#EF4444',
  },
  publicEventPulse: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    bottom: 2,
    left: '50%',
    marginLeft: -16,
  },
  clusterWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 120, // Aumentado
    height: 120,
  },
  clusterInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 8,
  },
  clusterText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  routePointLabel: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  routePointLabelText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  savedRoutePoint: {
    padding: 4,
  },
  savedRoutePointDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
});
