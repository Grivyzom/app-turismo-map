import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  useApiLoadingStatus,
  APILoadingStatus,
  useMap,
} from '@vis.gl/react-google-maps';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { INITIAL_REGION } from '../../constants/location';
import { getCategoryColor, getCategoryIcon } from '../../utils/mapUtils';
import type { CategoryIconName } from '../../utils/mapUtils';
import { useSuperclusterEvents, getClusterDominantColor } from '../../utils/clusterUtils';
import { ContextualRadialMenu } from '../ui/ContextualRadialMenu.web';
import { getLatestRadarPath } from '../../utils/weatherUtils';

import { StoreMarker } from './Markers/StoreMarker';
import { ArtisticMarker, ArtisticMarkerType } from './Markers/ArtisticMarker';
import {
  MapContainerProps,
  Cluster,
  TurismoEvent,
  MAX_ZOOM_PER_LAYER,
  MAX_WEATHER_ZOOM,
  MAX_RAINVIEWER_ZOOM,
} from './types';

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
  onMapPincho,
  onMapMove,
  mapLayer,
  zoom = 13,
  onZoomChange,
  showWeather,
  weatherType = 'precipitation',
  onSaveLocation,
}: MapContainerProps) {
  const status = useApiLoadingStatus();
  const [mapCenter, setMapCenter] = useState({
    lat: INITIAL_REGION.latitude,
    lng: INITIAL_REGION.longitude,
  });
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

  // Effect to fetch the latest RainViewer radar path when weather is enabled
  useEffect(() => {
    if (showWeather && weatherType === 'precipitation' && !radarPath) {
      getLatestRadarPath().then(setRadarPath);
    }
  }, [showWeather, weatherType, radarPath]);

  const clusteredItems = useSuperclusterEvents(events, zoom, currentBounds);

  const handleClusterClick = (cluster: Cluster) => {
    const maxPossibleZoom = MAX_ZOOM_PER_LAYER[mapLayer] || 18;
    const nextZoom = Math.min(zoom + 2, maxPossibleZoom - 1);
    setMapCenter({ lat: cluster.latitude, lng: cluster.longitude });
    if (onZoomChange) {
      onZoomChange(nextZoom);
    }
  };

  // Mapping our mapLayer to Google Maps MapTypeId
  const mapTypeId =
    mapLayer === 'satellite' ? 'satellite' : mapLayer === 'terrain' ? 'terrain' : 'roadmap'; // For 'streets' and 'dark'

  const map = useMap();

  useEffect(() => {
    if (!map) return;
    if (onMapPincho) {
      const pinchoCursor = `url("data:image/svg+xml;utf8,%3Csvg width='32' height='32' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z' fill='%23EF4444' stroke='%23FFFFFF' stroke-width='1.5'/%3E%3C/svg%3E") 16 32, crosshair`;
      map.setOptions({ draggableCursor: pinchoCursor });
    } else {
      map.setOptions({ draggableCursor: null });
    }
  }, [map, onMapPincho]);

  useEffect(() => {
    if (selectedEvent) {
      const timer = setTimeout(() => {
        setMapCenter({ lat: selectedEvent.latitude, lng: selectedEvent.longitude });
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [selectedEvent]);

  useEffect(() => {
    if (!map) return;

    if (showWeather) {
      if (weatherType === 'precipitation' && !radarPath) return;

      const tileUrl =
        weatherType === 'precipitation'
          ? `https://tilecache.rainviewer.com${radarPath || '/v2/radar/now'}/256/{z}/{x}/{y}/1/1_1.png`
          : `https://tile.openweathermap.org/map/${weatherType}_new/{z}/{x}/{y}.png?appid=YOUR_OWM_API_KEY`;

      const googleObj = (window as any).google;
      if (googleObj) {
        const effectiveMaxZoom =
          weatherType === 'precipitation' ? MAX_RAINVIEWER_ZOOM : MAX_WEATHER_ZOOM;
        const weatherLayer = new googleObj.maps.ImageMapType({
          getTileUrl: (coord: { x: number; y: number }, zoom: number) => {
            // Clamp zoom to prevent "Zoom Level Not Supported" error tiles
            const clampedZoom = Math.min(zoom, effectiveMaxZoom);
            return tileUrl
              .replace('{z}', clampedZoom.toString())
              .replace('{x}', coord.x.toString())
              .replace('{y}', coord.y.toString());
          },
          tileSize: new googleObj.maps.Size(256, 256),
          opacity: 0.6,
          name: 'Weather',
          maxZoom: effectiveMaxZoom,
        });

        map.overlayMapTypes.push(weatherLayer);

        return () => {
          map.overlayMapTypes.clear();
        };
      }
    } else {
      map.overlayMapTypes.clear();
    }
  }, [map, showWeather, weatherType, radarPath]);

  const handleMapClick = (event: any) => {
    onSelectEvent(null);

    const rawLatLng = event?.detail?.latLng ?? event?.latLng;
    if (!rawLatLng || !onMapPincho) {
      return;
    }

    const latitude = typeof rawLatLng.lat === 'function' ? rawLatLng.lat() : rawLatLng.lat;
    const longitude = typeof rawLatLng.lng === 'function' ? rawLatLng.lng() : rawLatLng.lng;

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return;
    }

    onMapPincho({
      latitude,
      longitude,
      surface: 'land',
    });
  };

  const handleMapMoveStart = () => {
    if (onMapMove) {
      onMapMove();
    }
  };

  if (status === APILoadingStatus.FAILED) {
    return (
      <View style={styles.errorContainer}>
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
      maxZoom={MAX_ZOOM_PER_LAYER[mapLayer]} // Respetar el límite de cada capa para evitar "Zoom level not supported"
      onCenterChanged={(ev) => setMapCenter(ev.detail.center)}
      onZoomChanged={(ev) => {
        if (onZoomChange) onZoomChange(ev.detail.zoom);
        handleMapMoveStart();
      }}
      onBoundsChanged={(ev) => {
        const b = ev.detail.bounds;
        setCurrentBounds({
          minLat: b.south,
          maxLat: b.north,
          minLng: b.west,
          maxLng: b.east,
        });
      }}
      mapTypeId={mapTypeId}
      disableDefaultUI={true}
      zoomControl={false}
      gestureHandling={'greedy'}
      mapId={'DEMO_MAP_ID'} // AdvancedMarker requires a mapId. Replace with your actual Map ID for vector features.
      colorScheme={mapLayer === 'dark' ? 'DARK' : 'LIGHT'} // Using colorScheme instead of styles for dark mode with mapId
      onClick={handleMapClick}
      onDragStart={handleMapMoveStart}
    >
      {clusteredItems.map((item) => {
        if ('isCluster' in item && item.isCluster) {
          return (
            <AdvancedMarker key={item.id} position={{ lat: item.latitude, lng: item.longitude }}>
              <GoogleClusterMarker cluster={item} onClick={() => handleClusterClick(item)} />
            </AdvancedMarker>
          );
        }
        const event = item as TurismoEvent;
        const isSelected = selectedEvent?.id === event.id;
        const color = getCategoryColor(event.category, event.musicStyle);
        const iconName: CategoryIconName = getCategoryIcon(event.category, event.musicStyle);

        if (event.category === 'tienda') {
          return (
            <AdvancedMarker
              key={event.id}
              position={{ lat: item.latitude, lng: item.longitude }}
              onClick={() => onSelectEvent(event)}
              zIndex={isSelected ? 99999 : 1}
            >
              <StoreMarker
                event={event}
                isSelected={isSelected}
                onPress={onSelectEvent}
                isLightMode={mapLayer === 'light' || mapLayer === 'streets'}
                noWrapper={true}
              />
            </AdvancedMarker>
          );
        }

        const isArtistic = [
          'museo',
          'coliseo',
          'puerto',
          'teatro',
          'fauna',
          'hospital',
          'clinica',
          'universidad',
          'bombero',
          'carabinero',
          'camara',
        ].includes(event.category?.toLowerCase() || '');

        if (isArtistic) {
          const markerContent = (
            <ArtisticMarker
              type={event.category?.toLowerCase() as ArtisticMarkerType}
              isSelected={isSelected}
              size={isSelected ? 72 : 56}
              isLightMode={mapLayer === 'light' || mapLayer === 'streets'}
              markerSvg={event.markerSvg}
              imageUrl={event.imageUrl}
              title={event.title}
            />
          );

          if (event.category === 'camara') {
            return (
              <AdvancedMarker
                key={event.id}
                position={{ lat: event.latitude, lng: event.longitude }}
                zIndex={1}
              >
                <div id={`google-pin-${event.id}`}>{markerContent}</div>
              </AdvancedMarker>
            );
          }

          return (
            <AdvancedMarker
              key={event.id}
              position={{ lat: event.latitude, lng: event.longitude }}
              onClick={() => onSelectEvent(event)}
              zIndex={isSelected ? 99999 : 1}
            >
              <ContextualRadialMenu
                menuId={`google-pin-${event.id}`}
                buttonSize={22}
                offset={6}
                items={[
                  {
                    id: 'info',
                    icon: <MaterialIcons name="info" size={12} color="#002d20" />,
                    tooltip: 'Detalles',
                    onClick: () => onSelectEvent(event),
                  },
                  {
                    id: 'favorite',
                    icon: <MaterialIcons name="bookmark" size={12} color="#002d20" />,
                    tooltip: 'Guardar',
                    onClick: () => {
                      if (onSaveLocation) {
                        onSaveLocation({
                          locationType: 'event',
                          refId: event.id,
                          latitude: event.latitude,
                          longitude: event.longitude,
                          title: event.title,
                          notes: event.description,
                        });
                      } else {
                        alert(`Guardado en Pasaporte: ${event.title}`);
                      }
                    },
                  },
                  {
                    id: 'route',
                    icon: <MaterialIcons name="directions" size={12} color="#002d20" />,
                    tooltip: 'Ruta',
                    onClick: () => alert(`Calculando ruta hacia: ${event.title}`),
                  },
                ]}
                isSelected={isSelected}
                onSelectionChange={(selected) => {
                  if (!selected) onSelectEvent(null);
                  else onSelectEvent(event);
                }}
              >
                {markerContent}
              </ContextualRadialMenu>
            </AdvancedMarker>
          );
        }

        return (
          <AdvancedMarker
            key={event.id}
            position={{ lat: event.latitude, lng: event.longitude }}
            onClick={() => onSelectEvent(event)}
            zIndex={isSelected ? 99999 : 1}
          >
            <ContextualRadialMenu
              menuId={`google-pin-${event.id}`}
              buttonSize={22}
              offset={6}
              items={[
                {
                  id: 'info',
                  icon: <MaterialIcons name="info" size={12} color="#002d20" />,
                  tooltip: 'Detalles',
                  onClick: () => onSelectEvent(event),
                },
                {
                  id: 'favorite',
                  icon: <MaterialIcons name="bookmark" size={12} color="#002d20" />,
                  tooltip: 'Guardar',
                  onClick: () => {
                    if (onSaveLocation) {
                      onSaveLocation({
                        locationType: 'event',
                        refId: event.id,
                        latitude: event.latitude,
                        longitude: event.longitude,
                        title: event.title,
                        notes: event.description,
                      });
                    } else {
                      alert(`Guardado en Pasaporte: ${event.title}`);
                    }
                  },
                },
                {
                  id: 'route',
                  icon: <MaterialIcons name="directions" size={12} color="#002d20" />,
                  tooltip: 'Ruta',
                  onClick: () => alert(`Calculando ruta hacia: ${event.title}`),
                },
              ]}
              isSelected={isSelected}
              onSelectionChange={(selected) => {
                if (!selected) onSelectEvent(null);
                else onSelectEvent(event);
              }}
            >
              <Pin
                background={color}
                borderColor={'#111827'}
                glyphColor={'transparent'}
                scale={isSelected ? 1.3 : 1}
              >
                <MaterialIcons name={iconName} size={15} color="#ffffff" />
              </Pin>
            </ContextualRadialMenu>
          </AdvancedMarker>
        );
      })}
    </Map>
  );
}

function GoogleClusterMarker({ cluster, onClick }: { cluster: Cluster; onClick: () => void }) {
  const count = cluster.events.length;
  const dominantColor = getClusterDominantColor(cluster.events);

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        width: 48,
        height: 48,
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          border: `2px solid rgba(255, 255, 255, 0.85)`,
          backgroundColor: dominantColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontWeight: 'bold',
          fontSize: '14px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = `0 4px 12px ${dominantColor}80`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        {count}
      </div>
    </div>
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
