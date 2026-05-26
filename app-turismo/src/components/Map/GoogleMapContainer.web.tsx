import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  useApiLoadingStatus,
  APILoadingStatus,
} from '@vis.gl/react-google-maps';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { INITIAL_REGION } from '../../constants/location';
import { CategoryIconName, getCategoryColor, getCategoryIcon } from '../../utils/mapUtils';

import { MapContainerProps } from './types';

// The maps API key should be stored in environment variables.
const GOOGLE_MAPS_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 'YOUR_GOOGLE_MAPS_API_KEY';

export function GoogleMapContainer(props: MapContainerProps) {
  return (
    <View style={styles.container}>
      {/* APIProvider must wrap the map components to load the SDK */}
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
        <InnerGoogleMap {...props} />
      </APIProvider>
    </View>
  );
}

function InnerGoogleMap({
  events,
  selectedEvent,
  onSelectEvent,
  mapLayer,
  zoom = 13,
  onZoomChange,
}: MapContainerProps) {
  const status = useApiLoadingStatus();
  const [mapCenter, setMapCenter] = useState({
    lat: INITIAL_REGION.latitude,
    lng: INITIAL_REGION.longitude,
  });

  // Mapping our mapLayer to Google Maps MapTypeId
  const mapTypeId =
    mapLayer === 'satellite' ? 'satellite' : mapLayer === 'terrain' ? 'terrain' : 'roadmap'; // For 'streets' and 'dark'

  useEffect(() => {
    if (selectedEvent) {
      const timer = setTimeout(() => {
        setMapCenter({ lat: selectedEvent.latitude, lng: selectedEvent.longitude });
        if (onZoomChange) onZoomChange(15);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [selectedEvent, onZoomChange]);

  if (status === APILoadingStatus.FAILED) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorEmoji}>⚠️</Text>
        <Text style={styles.errorTitle}>ApiNotActivatedMapError</Text>
        <Text style={styles.errorSubtitle}>Error al cargar Google Maps</Text>
        <Text style={styles.errorText}>
          La API "Maps JavaScript API" no está activada en tu consola de Google Cloud para este API
          Key.
        </Text>
        <Text style={styles.errorInstructions}>
          Para solucionarlo:{'\n'}
          1. Ve a la consola de Google Cloud.{'\n'}
          2. Selecciona tu proyecto y ve a "APIs y servicios".{'\n'}
          3. Busca "Maps JavaScript API" y haz clic en "Habilitar".
        </Text>
      </View>
    );
  }

  if (status === APILoadingStatus.LOADING) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingSpinner}>🔄</Text>
        <Text style={styles.loadingText}>Cargando mapa de Google...</Text>
      </View>
    );
  }

  return (
    <Map
      style={{ width: '100%', height: '100%' }}
      defaultCenter={{ lat: INITIAL_REGION.latitude, lng: INITIAL_REGION.longitude }}
      center={mapCenter}
      zoom={zoom}
      maxZoom={18} // Limitar el zoom máximo para consistencia
      onCenterChanged={(ev) => setMapCenter(ev.detail.center)}
      onZoomChanged={(ev) => onZoomChange && onZoomChange(ev.detail.zoom)}
      mapTypeId={mapTypeId}
      disableDefaultUI={true}
      zoomControl={false}
      gestureHandling={'greedy'}
      mapId={'DEMO_MAP_ID'} // AdvancedMarker requires a mapId. Replace with your actual Map ID for vector features.
      colorScheme={mapLayer === 'dark' ? 'DARK' : 'LIGHT'} // Using colorScheme instead of styles for dark mode with mapId
    >
      {events.map((event) => {
        const isSelected = selectedEvent?.id === event.id;
        const color = getCategoryColor(event.category);
        const iconName: CategoryIconName = getCategoryIcon(event.category);
        return (
          <AdvancedMarker
            key={event.id}
            position={{ lat: event.latitude, lng: event.longitude }}
            onClick={() => onSelectEvent(event)}
          >
            <Pin
              background={color}
              borderColor={'#111827'}
              glyphColor={'transparent'}
              scale={isSelected ? 1.3 : 1}
            >
              <MaterialIcons name={iconName} size={15} color="#ffffff" />
            </Pin>
          </AdvancedMarker>
        );
      })}
    </Map>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 400,
    position: 'relative',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#0B0F19',
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 400,
    width: '100%',
    height: '100%',
  },
  errorEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  errorTitle: {
    color: '#FCA5A5',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtitle: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorText: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 320,
    marginBottom: 16,
  },
  errorInstructions: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'left',
    maxWidth: 340,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    padding: 14,
    borderRadius: 8,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0B0F19',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 400,
    width: '100%',
    height: '100%',
  },
  loadingSpinner: {
    fontSize: 28,
    marginBottom: 12,
  },
  loadingText: {
    color: '#34D399',
    fontSize: 14,
    fontWeight: '600',
  },
});
