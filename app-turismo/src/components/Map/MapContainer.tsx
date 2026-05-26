import React, { useEffect, useRef, useState, useCallback } from 'react';
import { StyleSheet, View, Text, Platform, TouchableOpacity, Animated, Easing } from 'react-native';
import MapView, { Marker, Callout, Polygon, Circle, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';

import { MAP_CONFIG } from '../../config/mapConfig';
import { INITIAL_REGION } from '../../constants/location';
import { CategoryIconName, getCategoryColor, getCategoryIcon } from '../../utils/mapUtils';
import { DARK_MAP_STYLE_MOBILE } from '../../config/mapStyles.mobile';
import { OfflineIndicator } from '../MapUI/OfflineIndicator';

import { TurismoEvent } from './types';
import { MapContainerProps } from './types';

// ─── UserMarkerAnimated ──────────────────────────────────────────────────────
const UserMarkerAnimated = React.memo(
  ({
    userLocation,
  }: {
    userLocation: { latitude: number; longitude: number; heading?: number | null };
  }) => {
    const [pulseAnim] = useState(() => new Animated.Value(0));

    useEffect(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }, [pulseAnim]);

    const scale = pulseAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 3],
    });

    const opacity = pulseAnim.interpolate({
      inputRange: [0, 0.7, 1],
      outputRange: [0.8, 0.4, 0],
    });

    return (
      <Marker
        coordinate={{ latitude: userLocation.latitude, longitude: userLocation.longitude }}
        anchor={{ x: 0.5, y: 0.5 }}
        zIndex={2}
      >
        <View style={styles.userMarkerWrapper}>
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

          <Animated.View style={[styles.userMarkerPulse, { transform: [{ scale }], opacity }]} />
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
}

const PublicEventMarkerAnimated = React.memo(
  ({ event, isSelected, onPress }: EventMarkerProps) => {
    const [pulseAnim] = useState(() => new Animated.Value(0));

    useEffect(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 2500,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }, [pulseAnim]);

    const attendeesRatio = Math.min(event.attendeesCount || 0, 1000) / 1000;
    // maxScale goes from 1.5 (0 attendees) up to 4.0 (1000+ attendees)
    const maxScale = 1.5 + (attendeesRatio * 2.5);

    const scale1 = pulseAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, maxScale],
    });

    const opacity1 = pulseAnim.interpolate({
      inputRange: [0, 0.7, 1],
      outputRange: [0.6, 0.2, 0],
    });
    
    const scale2 = pulseAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.5, maxScale * 0.7],
    });
    
    const opacity2 = pulseAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.8, 0],
    });

    const color = getCategoryColor(event.category);
    const iconName = getCategoryIcon(event.category);

    const handlePress = useCallback(() => {
      onPress(event);
    }, [onPress, event]);

    return (
      <Marker
        key={event.id}
        coordinate={{ latitude: event.latitude, longitude: event.longitude }}
        onPress={handlePress}
        anchor={{ x: 0.5, y: 0.5 }}
      >
        <View style={styles.markerWrapper}>
          {/* Ondas expansivas */}
          <Animated.View style={[styles.publicEventPulse, { backgroundColor: color, transform: [{ scale: scale1 }], opacity: opacity1 }]} />
          <Animated.View style={[styles.publicEventPulse, { backgroundColor: color, transform: [{ scale: scale2 }], opacity: opacity2 }]} />
          
          {/* Pin central */}
          <View
            style={[
              styles.markerPin,
              {
                backgroundColor: color,
                borderColor: '#111827',
                transform: [{ scale: isSelected ? 1.3 : 1 }],
              },
            ]}
          >
            <MaterialIcons name={iconName} size={16} color="#FFFFFF" />
          </View>
        </View>
      </Marker>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.event.id === nextProps.event.id &&
      prevProps.event.latitude === nextProps.event.latitude &&
      prevProps.event.longitude === nextProps.event.longitude &&
      prevProps.event.attendeesCount === nextProps.event.attendeesCount &&
      prevProps.isSelected === nextProps.isSelected
    );
  },
);
PublicEventMarkerAnimated.displayName = 'PublicEventMarkerAnimated';

// ─── Memoized EventMarker ────────────────────────────────────────────────────
// Cada marcador se renderiza de forma independiente. Solo se re-renderiza si
// cambian sus props (evento seleccionado, datos del evento, etc.)


const EventMarker = React.memo(
  function EventMarker({ event, isSelected, onPress }: EventMarkerProps) {
    // tracksViewChanges = true por 500ms para dar tiempo a que MaterialIcons
    // cargue sus fuentes y el bitmap del marcador capture el icono correctamente.
    // Luego se desactiva para que el SO no re-capture en cada frame (rendimiento).
    const [trackChanges, setTrackChanges] = useState(true);

    useEffect(() => {
      const timer = setTimeout(() => {
        setTrackChanges(false);
      }, 600);
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

    const color = getCategoryColor(event.category);
    const iconName: CategoryIconName = getCategoryIcon(event.category);

    const handlePress = useCallback(() => {
      onPress(event);
    }, [onPress, event]);

    return (
      <Marker
        key={event.id}
        coordinate={{ latitude: event.latitude, longitude: event.longitude }}
        onPress={handlePress}
        tracksViewChanges={trackChanges}
        anchor={{ x: 0.5, y: 0.5 }}
      >
        {/* Marcador personalizado nativo */}
        <View style={styles.markerWrapper}>
          {event.isRealTime && <View style={[styles.pulseCircle, { backgroundColor: color }]} />}
          <View
            style={[
              styles.markerPin,
              {
                backgroundColor: color,
                borderColor: '#111827',
                transform: [{ scale: isSelected ? 1.3 : 1 }],
              },
            ]}
          >
            <MaterialIcons name={iconName} size={16} color="#FFFFFF" />
          </View>
        </View>
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
      prevProps.onPress === nextProps.onPress
    );
  },
);

const zoomToDeltas = (zoomLevel: number) => {
  const delta = 0.015 * Math.pow(2, 13 - zoomLevel);
  return {
    latitudeDelta: delta,
    longitudeDelta: delta,
  };
};

function MapContainerInner({
  events,
  selectedEvent,
  onSelectEvent,
  mapLayer,
  userLocation,
  centerTrigger,
  tacticalMode,
  onTacticalLocationChange,
  zoom,
  onZoomChange,
  showTraffic,
  isFrozen = false,
}: MapContainerProps) {
  const [showProviderInfo, setShowProviderInfo] = React.useState(false);

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

  const currentRegionRef = useRef({
    latitude: INITIAL_REGION.latitude,
    longitude: INITIAL_REGION.longitude,
    latitudeDelta: INITIAL_REGION.latitudeDelta,
    longitudeDelta: INITIAL_REGION.longitudeDelta,
  });

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
      mapRef.current.animateToRegion(
        {
          latitude: selectedEvent.latitude,
          longitude: selectedEvent.longitude,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
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
        style={styles.providerBadge}
        accessibilityRole="button"
        accessibilityLabel="Mostrar información del proveedor del mapa"
      >
        <View style={styles.providerDot} />
        <Text style={styles.providerBadgeTitle}>Google</Text>
        {showProviderInfo && <Text style={styles.providerBadgeText}>Proveedor: Google Maps</Text>}
      </TouchableOpacity>
      <MapView
        ref={mapRef}
        provider={mapProvider}
        style={styles.map}
        customMapStyle={mapStyle}
        mapType={mapType}
        maxZoomLevel={18} // Limitar el zoom máximo para consistencia
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
        onRegionChange={(region) => {
          if (tacticalMode && onTacticalLocationChange) {
            onTacticalLocationChange({ latitude: region.latitude, longitude: region.longitude });
          }
        }}
        onRegionChangeComplete={(region) => {
          currentRegionRef.current = region;
        }}
      >
        {events.map((event) => {
          if (event.polygon && event.polygon.length > 0) {
            return (
              <Polygon
                key={event.id}
                coordinates={event.polygon}
                fillColor={`${getCategoryColor(event.category)}40`}
                strokeColor={getCategoryColor(event.category)}
                strokeWidth={2}
                tappable={true}
                onPress={() => onSelectEvent(event)}
              />
            );
          }
          if (event.radius && event.radius > 0) {
            return (
              <Circle
                key={event.id}
                center={{ latitude: event.latitude, longitude: event.longitude }}
                radius={event.radius}
                fillColor={`${getCategoryColor(event.category)}40`}
                strokeColor={getCategoryColor(event.category)}
                strokeWidth={2}
                tappable={true}
                onPress={() => onSelectEvent(event)}
              />
            );
          }
          if (event.category === 'publico') {
            return (
              <PublicEventMarkerAnimated
                key={event.id}
                event={event}
                isSelected={selectedEvent?.id === event.id}
                onPress={onSelectEvent}
              />
            );
          }

          return (
            <EventMarker
              key={event.id}
              event={event}
              isSelected={selectedEvent?.id === event.id}
              onPress={onSelectEvent}
            />
          );
        })}

        {/* Custom Marker for Web (showsUserLocation native feature doesn't work well on web) */}
        {Platform.OS === 'web' && userLocation && (
          <UserMarkerAnimated userLocation={userLocation} />
        )}
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
    prev.userLocation?.latitude === next.userLocation?.latitude &&
    prev.userLocation?.longitude === next.userLocation?.longitude &&
    prev.centerTrigger === next.centerTrigger &&
    prev.tacticalMode === next.tacticalMode &&
    prev.showTraffic === next.showTraffic
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
    width: 56,
    height: 56,
  },
  pulseCircle: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    opacity: 0.35,
    // Nota: El pulso dinámico en móvil se emula en layout, se puede enriquecer con Reanimated si fuera necesario.
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
    // Asegurar que el contenido (icono) no sea recortado
    overflow: 'visible',
  },
  userMarkerWrapper: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coneWrapper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
    height: 80,
    zIndex: -1,
  },
  directionalCone: {
    position: 'absolute',
    top: -6, // Proyecto de haz hacia el frente de la posición
    width: 32,
    height: 32,
    borderStyle: 'solid',
    borderLeftWidth: 16,
    borderRightWidth: 16,
    borderBottomWidth: 32,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'rgba(59, 130, 246, 0.25)', // Luz azul suave de barrido
    transform: [{ scaleX: 0.5 }], // Esbelto para simular linterna de orientación
  },
  userMarkerPulse: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(59, 130, 246, 0.3)', // bg-blue-500/30
  },
  userMarkerCore: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#3B82F6', // bg-blue-500
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
    width: 40,
    height: 40,
    borderRadius: 20,
  },
});
