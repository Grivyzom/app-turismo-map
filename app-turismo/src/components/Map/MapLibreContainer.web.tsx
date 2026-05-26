import React, { useEffect, useRef, useCallback } from 'react';
import maplibregl, { Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { StyleSheet, View } from 'react-native';
import { createRoot, Root } from 'react-dom/client';
import { MaterialIcons } from '@expo/vector-icons';

import { VALDIVIA_LAT, VALDIVIA_LNG } from '../../constants/location';
import { getCategoryColor, getCategoryIcon } from '../../utils/mapUtils';
import { addMissingStyleImage, applyDarkTheme } from '../../utils/mapWebUtils';
import { getActiveMapStyles, getSatelliteStyle } from '../../config/mapStyles.web';
import { SatelliteTileCache } from '../../utils/satelliteTileCache';
import { TrafficTileCache, TRAFFIC_PROTOCOL } from '../../utils/trafficTileCache';

import { MapContainerProps, MAX_ZOOM_PER_LAYER } from './types';

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
  zoom = 13,
  onZoomChange,
  showTraffic = false,
}: MapContainerProps) {
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  // Track our DOM markers
  const markersRef = useRef<{
    [id: string]: { marker: maplibregl.Marker; root: Root; el: HTMLDivElement };
  }>({});
  const userMarkerRef = useRef<{ marker: maplibregl.Marker; el: HTMLDivElement } | null>(null);

  // Refs to avoid stale closures in map event listeners
  const eventsRef = useRef(events);
  const onSelectEventRef = useRef(onSelectEvent);
  const selectedEventRef = useRef(selectedEvent);
  const mapLayerRef = useRef(mapLayer);
  const onZoomChangeRef = useRef(onZoomChange);
  const updateAestheticsRef = useRef<() => void>(() => {});
  const tileCacheRef = useRef<SatelliteTileCache | null>(null);
  const trafficCacheRef = useRef<TrafficTileCache | null>(null);
  const syncUserLocationRef = useRef<() => void>(() => {});
  const syncTrafficRef = useRef<() => void>(() => {});

  useEffect(() => {
    eventsRef.current = events;
    onSelectEventRef.current = onSelectEvent;
    selectedEventRef.current = selectedEvent;
    mapLayerRef.current = mapLayer;
    onZoomChangeRef.current = onZoomChange;

    if (updateAestheticsRef.current) {
      updateAestheticsRef.current();
    }
  }, [events, onSelectEvent, selectedEvent, mapLayer, onZoomChange]);

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
      `;
      document.head.appendChild(style);
    }

    // Agregar atribución compacta de forma segura en la esquina inferior izquierda
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

    const updateAesthetics = () => {
      const z = map.getZoom();
      const pitch = map.getPitch();

      Object.keys(markersRef.current).forEach((id) => {
        const markerObj = markersRef.current[id];
        if (!markerObj) return;

        const isSelected = selectedEventRef.current?.id === id;
        const el = markerObj.el;

        const inner = el.querySelector('.marker-3d-container') as HTMLDivElement | null;
        const shadow = el.querySelector('.marker-3d-shadow') as HTMLDivElement | null;
        const stem = el.querySelector('.marker-3d-stem') as HTMLDivElement | null;
        const pin = el.querySelector('.marker-3d-pin') as HTMLDivElement | null;
        const icon = el.querySelector('.marker-3d-icon') as HTMLDivElement | null;

        if (!inner || !pin) return;

        // 1. Zoom Adaptation (disappear or turn into dot)
        let zoomScale = 1;
        let zoomOpacity = 1;
        let showIcon = true;
        let isVisible = true;

        if (z >= 13) {
          zoomScale = 1.0;
          zoomOpacity = 1.0;
          showIcon = true;
        } else if (z >= 11) {
          const ratio = (z - 11) / (13 - 11); // 0 to 1
          zoomScale = 0.4 + ratio * 0.6; // 0.4 to 1.0
          zoomOpacity = 0.3 + ratio * 0.7; // 0.3 to 1.0
          showIcon = z >= 12; // hide icon at zoom < 12 (small dot)
        } else {
          zoomScale = 0;
          zoomOpacity = 0;
          isVisible = false;
        }

        // Apply visibility and pointer-events
        el.style.visibility = isVisible ? 'visible' : 'hidden';
        el.style.pointerEvents = isVisible ? 'auto' : 'none';

        // 2. Pitch 3D Effect
        const isHovered = el.dataset.hovered === 'true';
        const maxElevation = isSelected ? 36 : isHovered ? 32 : 28;
        const elevation = isVisible
          ? Math.sin((pitch * Math.PI) / 180) * maxElevation * zoomScale
          : 0;

        const baseScale = isSelected ? 1.25 : isHovered ? 1.15 : 1.0;
        const finalScale = baseScale * zoomScale;

        pin.style.transform = `translateY(-${elevation}px) scale(${finalScale})`;
        pin.style.opacity = `${zoomOpacity}`;

        if (icon) {
          icon.style.opacity = showIcon ? '1' : '0';
        }

        if (stem) {
          if (pitch > 0 && isVisible) {
            stem.style.height = `${elevation}px`;
            stem.style.bottom = `${12 * zoomScale}px`;
            stem.style.opacity = `${(pitch / 60) * 0.9}`;
          } else {
            stem.style.height = '0px';
            stem.style.opacity = '0';
          }
        }

        if (shadow) {
          if (isVisible) {
            const shadowScaleX = 1 + (pitch / 60) * 0.4;
            const shadowScaleY = Math.max(0.3, 1 - (pitch / 60) * 0.6);
            const skewX = -pitch * 0.4;
            const shadowShiftX = (pitch / 60) * 4;

            shadow.style.transform = `translateX(${shadowShiftX}px) scaleX(${shadowScaleX}) scaleY(${shadowScaleY}) skewX(${skewX}deg)`;
            shadow.style.opacity = `${(0.3 + (pitch / 60) * 0.5) * zoomOpacity}`;
            shadow.style.width = `${20 * zoomScale}px`;
            shadow.style.height = `${6 * zoomScale}px`;
          } else {
            shadow.style.opacity = '0';
          }
        }
      });
    };

    updateAestheticsRef.current = updateAesthetics;

    // Bind map events for real-time 3D updates
    map.on('zoom', updateAesthetics);
    map.on('pitch', updateAesthetics);
    map.on('rotate', updateAesthetics);
    map.on('move', updateAesthetics);

    map.on('styleimagemissing', (event) => {
      addMissingStyleImage(map, event.id, mapLayerRef.current);
    });

    map.on('zoomend', () => {
      if (onZoomChangeRef.current) {
        onZoomChangeRef.current(Math.round(map.getZoom()));
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
    });

    // Deselect when clicking on empty map
    map.on('click', (e) => {
      // Small timeout to allow marker clicks to process first and call stopPropagation
      setTimeout(() => {
        onSelectEventRef.current(null);
      }, 10);
    });

    return () => {
      // Cleanup all markers
      Object.values(markersRef.current).forEach(({ marker, root }) => {
        marker.remove();
        setTimeout(() => {
          if (root) root.unmount();
        }, 0);
      });
      markersRef.current = {};

      if (userMarkerRef.current) {
        userMarkerRef.current.marker.remove();
        userMarkerRef.current = null;
      }

      if (map) {
        map.off('zoom', updateAesthetics);
        map.off('pitch', updateAesthetics);
        map.off('rotate', updateAesthetics);
        map.off('move', updateAesthetics);
        map.remove();
      }
      mapRef.current = null;
    };
  }, []);

  // Sync Markers and Data
  const sync = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const newMarkerIds = new Set(events.map((e) => e.id));

    // Remove old markers
    Object.keys(markersRef.current).forEach((id) => {
      if (!newMarkerIds.has(id)) {
        const markerObj = markersRef.current[id];
        markerObj.marker.remove();
        setTimeout(() => markerObj.root.unmount(), 0);
        delete markersRef.current[id];
      }
    });

    // Add or update markers
    events.forEach((event) => {
      const isSelected = selectedEvent?.id === event.id;
      const color = getCategoryColor(event.category);
      const iconName = getCategoryIcon(event.category);

      let markerObj = markersRef.current[event.id];

      if (!markerObj) {
        // Create new DOM element for marker
        const el = document.createElement('div');
        el.style.cursor = 'pointer';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.dataset.hovered = 'false';

        el.addEventListener('mouseenter', () => {
          el.dataset.hovered = 'true';
          if (updateAestheticsRef.current) updateAestheticsRef.current();
        });

        el.addEventListener('mouseleave', () => {
          el.dataset.hovered = 'false';
          if (updateAestheticsRef.current) updateAestheticsRef.current();
        });

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelectEventRef.current(event);
        });

        // Use 'bottom' anchor for 3D standing pins
        const marker = new maplibregl.Marker({
          element: el,
          anchor: 'bottom',
        })
          .setLngLat([event.longitude, event.latitude])
          .addTo(map);

        const root = createRoot(el);
        markersRef.current[event.id] = { marker, root, el };
        markerObj = markersRef.current[event.id];
      } else {
        // Update position if it changed
        markerObj.marker.setLngLat([event.longitude, event.latitude]);
      }

      // Update Marker z-index to bring selected to front
      if (markerObj.el) {
        markerObj.el.style.zIndex = isSelected ? '1000' : '1';
      }

      // Render the marker UI with React
      markerObj.root.render(
        <div
          className="marker-3d-container"
          style={{
            position: 'relative',
            width: 28,
            height: 28,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-end', // Align contents to bottom
          }}
        >
          {/* 1. Flat Shadow underneath */}
          <div
            className="marker-3d-shadow"
            style={{
              position: 'absolute',
              bottom: 0,
              width: 20,
              height: 6,
              borderRadius: '50%',
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              filter: 'blur(1px)',
              transform: 'scale(1)',
              opacity: 0.3,
              transition: 'transform 0.15s ease, opacity 0.15s ease',
              zIndex: 0,
              pointerEvents: 'none',
            }}
          />

          {/* 2. Standing Stem */}
          <div
            className="marker-3d-stem"
            style={{
              position: 'absolute',
              bottom: 12,
              width: 2.5,
              height: 0,
              backgroundColor: '#9CA3AF',
              backgroundImage: `linear-gradient(to top, #4B5563, ${color})`,
              opacity: 0,
              transformOrigin: 'bottom center',
              transition: 'height 0.15s ease, opacity 0.15s ease',
              zIndex: 1,
              pointerEvents: 'none',
              borderRadius: 1,
            }}
          />

          {/* 3. The Interactive Pin */}
          <div
            className="marker-3d-pin"
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              backgroundColor: color,
              border: '2px solid #111827',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0px 2px 4px rgba(0,0,0,0.5)',
              transform: isSelected ? 'scale(1.25)' : 'scale(1)',
              transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.15s ease',
              zIndex: 2,
              position: 'relative',
            }}
          >
            <div
              className="marker-3d-icon"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'opacity 0.15s ease',
              }}
            >
              <MaterialIcons name={iconName} size={15} color="#FFFFFF" />
            </div>
          </div>
        </div>,
      );
    });

    // Handle User Location Marker
    if (userLocation) {
      // Manejo de la precisión de la ubicación (accuracy) - SOLO si el estilo está cargado
      if (map.isStyleLoaded()) {
        if (userLocation.accuracy) {
          const accuracyData: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                geometry: {
                  type: 'Point',
                  coordinates: [userLocation.longitude, userLocation.latitude],
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
              id: 'user-accuracy-layer',
              type: 'circle',
              source: 'user-accuracy',
              paint: {
                'circle-radius': [
                  'interpolate',
                  ['exponential', 2],
                  ['zoom'],
                  10,
                  Math.max(1, userLocation.accuracy / 10),
                  20,
                  Math.max(10, userLocation.accuracy * 2),
                ],
                'circle-color': '#3B82F6',
                'circle-opacity': 0.15,
                'circle-stroke-width': 1,
                'circle-stroke-color': '#3B82F6',
              },
            });
          } else {
            const source = map.getSource('user-accuracy') as maplibregl.GeoJSONSource;
            if (source.setData) {
              source.setData(accuracyData);
            }
          }
        } else {
          // Remover si ya no hay accuracy
          if (map.getLayer('user-accuracy-layer')) map.removeLayer('user-accuracy-layer');
          if (map.getSource('user-accuracy')) map.removeSource('user-accuracy');
        }
      }

      // Marcador DOM del usuario (se puede crear inmediatamente, no depende del canvas style!)
      if (!userMarkerRef.current) {
        // Create user marker element
        const el = document.createElement('div');
        el.className = 'user-marker';

        // Elemento para el haz de luz / cono direccional
        const coneEl = document.createElement('div');
        coneEl.className = 'user-cone';
        el.appendChild(coneEl);

        // Inline styles for pulse animation and cone
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
            .user-marker::after {
              content: '';
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              width: 48px;
              height: 48px;
              background-color: rgba(59, 130, 246, 0.3);
              border-radius: 50%;
              z-index: -1;
              animation: userPulse 2s infinite;
            }
            .user-cone {
              position: absolute;
              top: -24px; /* proyecta al frente */
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
            @keyframes userPulse {
              0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0.8; }
              100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
            }
          `;
          document.head.appendChild(style);
        }

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([userLocation.longitude, userLocation.latitude])
          .addTo(map);

        userMarkerRef.current = { marker, el };
      } else {
        userMarkerRef.current.marker.setLngLat([userLocation.longitude, userLocation.latitude]);
      }

      // Actualizar la rotación en tiempo real del cono direccional
      const userEl = userMarkerRef.current?.el;
      if (userEl) {
        const cone = userEl.querySelector('.user-cone') as HTMLDivElement | null;
        if (cone) {
          if (userLocation.heading !== null && userLocation.heading !== undefined) {
            cone.style.display = 'block';
            cone.style.transform = `translateX(-50%) rotate(${userLocation.heading}deg)`;
          } else {
            cone.style.display = 'none';
          }
        }
      }
    } else if (userMarkerRef.current) {
      // Remove user marker if userLocation is null
      userMarkerRef.current.marker.remove();
      userMarkerRef.current = null;

      if (map.isStyleLoaded()) {
        if (map.getLayer('user-accuracy-layer')) map.removeLayer('user-accuracy-layer');
        if (map.getSource('user-accuracy')) map.removeSource('user-accuracy');
      }
    }

    // Apply immediate 3D and Zoom styling to all markers
    if (updateAestheticsRef.current) {
      updateAestheticsRef.current();
    }
  }, [events, selectedEvent, userLocation]);

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
          tiles: [
            `${TRAFFIC_PROTOCOL}://{z}/{x}/{y}`
          ],
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
        zoom: 14,
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

  // Tactical Mode
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (tacticalMode) {
      const customCursor = `url('data:image/svg+xml;utf8,<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%2310B981" stroke-width="2" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="8"/><line x1="12" y1="0" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="24"/><line x1="0" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="24" y2="12"/><circle cx="12" cy="12" r="1" fill="%2310B981"/></svg>') 12 12, crosshair`;
      map.getCanvas().style.cursor = customCursor;

      const handleMouseMove = (e: maplibregl.MapMouseEvent) => {
        if (onTacticalLocationChange) {
          onTacticalLocationChange({
            latitude: e.lngLat.lat,
            longitude: e.lngLat.lng,
            x: e.originalEvent.clientX,
            y: e.originalEvent.clientY,
          });
        }
      };

      map.on('mousemove', handleMouseMove);

      return () => {
        map.off('mousemove', handleMouseMove);
        map.getCanvas().style.cursor = ''; // Reset cursor
      };
    } else {
      map.getCanvas().style.cursor = ''; // Ensure cursor is reset when deactivated
      if (onTacticalLocationChange) onTacticalLocationChange(null);
    }
  }, [tacticalMode, onTacticalLocationChange]);

  return (
    <View style={styles.container}>
      <div ref={mapNodeRef} style={styles.mapElement} />
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
