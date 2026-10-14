import React, { useState, useCallback, useMemo, Component, ErrorInfo, ReactNode } from 'react';
import DeckGL from '@deck.gl/react';
import { Tile3DLayer, TileLayer } from '@deck.gl/geo-layers';
import { Tiles3DLoader } from '@loaders.gl/3d-tiles';
import { GeoJsonLayer, ScatterplotLayer, BitmapLayer } from '@deck.gl/layers';
import { TerrainController, AmbientLight, DirectionalLight, LightingEffect } from '@deck.gl/core';
import { _TerrainExtension as TerrainExtension } from '@deck.gl/extensions';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';

import valdiviaBuildings from '../../data/valdivia_buildings.json';
import { VALDIVIA_LAT, VALDIVIA_LNG } from '../../constants/location';
import { getCategoryColor } from '../../utils/mapUtils';
import { MapContainerProps, TurismoEvent } from './types';

const GOOGLE_MAPS_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 'YOUR_GOOGLE_MAPS_API_KEY';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class DeckGLErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('[DeckGL 3D] ErrorBoundary capturó excepción de renderizado:', error, errorInfo);
    if (this.props.onError) {
      this.props.onError(error);
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      return this.props.fallback(this.state.error, this.reset);
    }
    return this.props.children;
  }
}

export function DeckGL3DContainer({
  events = [],
  selectedEvent,
  onSelectEvent,
  onSelectLayer,
  zoom = 16,
  onZoomChange,
}: MapContainerProps) {
  const [attributions, setAttributions] = useState<string>('');
  const [apiError, setApiError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState<number>(0);

  // Estados de capas para carga ultrarrápida y modo Nocturno
  const [showBuildings, setShowBuildings] = useState<boolean>(true);
  const [showRealTerrain, setShowRealTerrain] = useState<boolean>(false); // False por defecto: carga instantánea en CARTO Nocturno
  const [baseStyle, setBaseStyle] = useState<'dark' | 'satellite'>('dark');

  const [viewState, setViewState] = useState({
    longitude: selectedEvent?.longitude ?? VALDIVIA_LNG,
    latitude: selectedEvent?.latitude ?? VALDIVIA_LAT,
    zoom: Math.max(zoom, 15.5),
    pitch: 58,
    bearing: 28,
    maxPitch: 75,
    minZoom: 10,
    maxZoom: 21,
  });

  // Iluminación nocturna con reflejos arquitectónicos
  const ambientLight = useMemo(
    () =>
      new AmbientLight({
        color: [255, 255, 255],
        intensity: baseStyle === 'dark' ? 1.4 : 1.1,
      }),
    [baseStyle]
  );

  const dirLight = useMemo(
    () =>
      new DirectionalLight({
        color: baseStyle === 'dark' ? [200, 225, 255] : [255, 250, 240], // Tono azulado lunar en nocturno
        intensity: 2.2,
        direction: [-1, -3, -2],
      }),
    [baseStyle]
  );

  const lightingEffect = useMemo(
    () => new LightingEffect({ ambientLight, dirLight }),
    [ambientLight, dirLight]
  );

  const handleViewStateChange = useCallback(
    ({ viewState: newViewState }: any) => {
      setViewState(newViewState);
      if (onZoomChange && newViewState.zoom !== viewState.zoom) {
        onZoomChange(newViewState.zoom);
      }
    },
    [onZoomChange, viewState.zoom]
  );

  // ── Capa 1A: Base Vectorial Rápida CARTO Dark Matter (Modo Nocturno Instantáneo) ──
  const cartoDarkBaseLayer = useMemo(() => {
    if (showRealTerrain) return null; // Si el terreno real de Google está activo, Google es la base

    const cartoKey =
      process.env.EXPO_PUBLIC_CARTO_API_KEY ||
      process.env.CARTO_API_KEY ||
      '';

    const tileUrl =
      baseStyle === 'dark'
        ? cartoKey
          ? `https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png?api_key=${cartoKey}`
          : 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
        : 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

    const tileSize = baseStyle === 'dark' && cartoKey ? 512 : 256;

    return new TileLayer({
      id: `base-map-tiles-${baseStyle}`,
      data: tileUrl,
      minZoom: 0,
      maxZoom: 19,
      tileSize,
      getTileData: async ({ url, signal }: any) => {
        try {
          if (!url) return null;
          const response = await fetch(url, { signal });
          if (!response.ok) return null;
          const blob = await response.blob();
          // Descartar tesela de error de ESRI "Map data not yet available" (exactamente 2521 bytes)
          if (blob.size === 2521) return null;
          return await createImageBitmap(blob);
        } catch {
          return null;
        }
      },
      renderSubLayers: (props: any) => {
        const {
          bbox: { west, south, east, north },
        } = props.tile;

        if (!props.data) return null;

        return new BitmapLayer(props, {
          data: null as any,
          image: props.data,
          bounds: [west, south, east, north],
        });
      },
    });
  }, [showRealTerrain, baseStyle]);

  // ── Capa 1B: Google Photorealistic 3D Tiles (Malla Topográfica Real de Google) ──
  const google3DTiles = useMemo(() => {
    if (!showRealTerrain) return null;

    const tilesetUrl = `https://tile.googleapis.com/v1/3dtiles/root.json?key=${GOOGLE_MAPS_API_KEY}`;

    return new Tile3DLayer({
      id: `google-3d-tiles-${retryKey}`,
      data: tilesetUrl,
      loader: Tiles3DLoader,
      loadOptions: {
        fetch: {
          headers: {
            'X-GOOG-API-KEY': GOOGLE_MAPS_API_KEY,
          },
        },
      },
      operation: 'terrain+draw',
      maximumScreenSpaceError: 24,
      onTraversalComplete: (selectedTiles: any[]) => {
        const credits = new Set<string>();
        selectedTiles.forEach((tile) => {
          const copyright = tile.header?.asset?.copyright || tile.header?.copyright;
          if (copyright) credits.add(copyright);
        });
        if (credits.size > 0) {
          setAttributions(Array.from(credits).join(' | '));
        }
        return selectedTiles;
      },
      onTileError: (error: any) => {
        console.warn('[Google 3D Tiles] Error en tile:', error);
        const msg = error?.message || String(error);
        if (msg.includes('403') || msg.includes('blocked') || msg.includes('PERMISSION_DENIED')) {
          setApiError(
            'Error 403 (API_KEY_SERVICE_BLOCKED): La clave de API tiene restricciones que bloquean la Map Tiles API.'
          );
        } else {
          setApiError(`Error al cargar tiles 3D: ${msg}`);
        }
      },
    });
  }, [showRealTerrain, retryKey]);

  // ── Capa 2: Edificios 3D de Valdivia (Estilizados para Modo Nocturno) ──
  const buildings3DLayer = useMemo(() => {
    if (!showBuildings) return null;

    const isDark = baseStyle === 'dark';

    return new GeoJsonLayer({
      id: `valdivia-buildings-3d-${showRealTerrain ? 'terrain' : 'flat'}-${baseStyle}`,
      data: valdiviaBuildings as any,
      extruded: true,
      wireframe: false,
      filled: true,
      getElevation: (f: any) => {
        const h = f.properties?.height;
        return typeof h === 'number' && h > 0 ? h : 10;
      },
      getFillColor: (f: any) => {
        const h = f.properties?.height || 8;
        if (isDark) {
          // Paleta Nocturna vibrante sobre CARTO Dark Matter
          if (h >= 45) return [245, 158, 11, 255]; // Torres altas: Ámbar dorado
          if (h >= 28) return [52, 211, 153, 255]; // Edificios destacados: Esmeralda
          if (h >= 18) return [56, 189, 248, 250]; // Medianos: Celeste neón
          if (h >= 10) return [59, 130, 246, 245]; // Bloques: Azul arquitectónico
          return [42, 72, 110, 235]; // Casas y locales: Slate azul acero visible
        } else {
          // Paleta Satélite
          if (h >= 24) return [245, 248, 252, 240];
          if (h >= 14) return [220, 228, 238, 235];
          return [195, 205, 218, 230];
        }
      },
      getLineColor: isDark ? [147, 197, 253, 160] : [140, 155, 175, 180], // Contornos luminosos definidos
      lineWidthMinPixels: 1,
      pickable: true,
      autoHighlight: true,
      highlightColor: [52, 211, 153, 220], // Resaltado esmeralda vivo
      extensions: showRealTerrain ? [new TerrainExtension()] : [],
      terrainDrawMode: showRealTerrain ? 'offset' : undefined,
      material: {
        ambient: isDark ? 0.5 : 0.4,
        diffuse: 0.65,
        shininess: 40,
        specularColor: isDark ? [80, 120, 160] : [80, 85, 95],
      },
    });
  }, [showBuildings, showRealTerrain, baseStyle]);

  // ── Capa 3: POIs y Eventos Turísticos ──
  const poisLayer = useMemo(() => {
    const formattedEvents = events.map((ev) => {
      const hexColor = getCategoryColor(ev.category, ev.musicStyle);
      const r = parseInt(hexColor.slice(1, 3), 16) || 230;
      const g = parseInt(hexColor.slice(3, 5), 16) || 80;
      const b = parseInt(hexColor.slice(5, 7), 16) || 50;
      const isSelected = selectedEvent?.id === ev.id;

      return {
        ...ev,
        position: [ev.longitude, ev.latitude],
        color: isSelected ? [255, 215, 0, 255] : [r, g, b, 230],
        radius: isSelected ? 14 : 9,
      };
    });

    return new ScatterplotLayer({
      id: `turismo-pois-3d-${showRealTerrain ? 'terrain' : 'flat'}`,
      data: formattedEvents,
      pickable: true,
      opacity: 0.95,
      stroked: true,
      filled: true,
      radiusScale: 1,
      radiusMinPixels: 8,
      radiusMaxPixels: 24,
      lineWidthMinPixels: 2,
      getPosition: (d: any) => d.position,
      getRadius: (d: any) => d.radius,
      getFillColor: (d: any) => d.color,
      getLineColor: [255, 255, 255, 255],
      extensions: showRealTerrain ? [new TerrainExtension()] : [],
      terrainDrawMode: showRealTerrain ? 'offset' : undefined,
      onClick: (info: any) => {
        if (info.object && onSelectEvent) {
          onSelectEvent(info.object as TurismoEvent);
        }
      },
    });
  }, [events, selectedEvent, onSelectEvent, showRealTerrain]);

  // Tooltip interactivo
  const getTooltip = useCallback(({ object }: any) => {
    if (!object) return null;
    if (object.title) {
      return {
        html: `<div style="background: #0F172A; padding: 6px 12px; border-radius: 8px; color: #FFFFFF; font-size: 12px; border: 1px solid #34D399; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
          <strong>${object.title}</strong>
          <div style="color: #94A3B8; font-size: 11px; margin-top: 2px;">${object.category || 'Punto turístico'}</div>
        </div>`,
      };
    }
    if (object.properties?.name && object.properties.name !== 'yes') {
      return {
        html: `<div style="background: #0F172A; padding: 6px 12px; border-radius: 8px; color: #FFFFFF; font-size: 12px; border: 1px solid rgba(255,255,255,0.2); box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
          <strong>${object.properties.name}</strong>
          <div style="color: #34D399; font-size: 11px; margin-top: 2px;">Altura: ~${object.properties.height || 10}m (${object.properties.levels || 2} pisos)</div>
        </div>`,
      };
    }
    return null;
  }, []);

  // Controles de cámara
  const resetCamera = () => {
    setViewState((prev) => ({
      ...prev,
      bearing: 0,
      pitch: 55,
      zoom: 16.5,
    }));
  };

  const togglePitch = () => {
    setViewState((prev) => ({
      ...prev,
      pitch: prev.pitch > 20 ? 0 : 58,
    }));
  };

  const zoomIn = () => {
    setViewState((prev) => ({
      ...prev,
      zoom: Math.min(prev.zoom + 1, 21),
    }));
  };

  const zoomOut = () => {
    setViewState((prev) => ({
      ...prev,
      zoom: Math.max(prev.zoom - 1, 10),
    }));
  };

  const handleRetry = (resetErrorBoundary?: () => void) => {
    setApiError(null);
    setRetryKey((k) => k + 1);
    if (resetErrorBoundary) {
      resetErrorBoundary();
    }
  };

  const handleFallbackToStandard = () => {
    if (onSelectLayer) {
      onSelectLayer('dark');
    }
  };

  const activeLayers = useMemo(
    () => [cartoDarkBaseLayer, google3DTiles, buildings3DLayer, poisLayer].filter(Boolean),
    [cartoDarkBaseLayer, google3DTiles, buildings3DLayer, poisLayer]
  );

  return (
    <View style={styles.container}>
      <DeckGLErrorBoundary
        onError={(err) => setApiError(err.message)}
        fallback={(err, reset) => (
          <View style={styles.errorOverlay}>
            <View style={styles.errorCard}>
              <MaterialIcons name="warning-amber" size={28} color="#F59E0B" />
              <Text style={styles.errorTitle}>Error al cargar capa</Text>
              <Text style={styles.errorMessage}>{err.message}</Text>
              <TouchableOpacity
                style={styles.fallbackBtn}
                onPress={handleFallbackToStandard}
                activeOpacity={0.8}
              >
                <Text style={styles.actionBtnText}>Volver al mapa</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      >
        <DeckGL
          viewState={viewState}
          onViewStateChange={handleViewStateChange}
          controller={{ type: TerrainController }}
          layers={activeLayers}
          effects={[lightingEffect]}
          getTooltip={getTooltip}
          getCursor={({ isHovering }) => (isHovering ? 'pointer' : 'grab')}
          onError={(err: any) => {
            console.warn('[DeckGL onError]:', err);
            setApiError(err?.message || 'Error al conectar');
          }}
        />
      </DeckGLErrorBoundary>

      {/* Controles Flotantes 3D */}
      <View style={styles.floatingControls}>
        <TouchableOpacity style={styles.controlBtn} onPress={zoomIn} activeOpacity={0.7}>
          <MaterialIcons name="add" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlBtn} onPress={zoomOut} activeOpacity={0.7}>
          <MaterialIcons name="remove" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlBtn} onPress={togglePitch} activeOpacity={0.7}>
          <Text style={styles.controlText}>{viewState.pitch > 20 ? '2D' : '3D'}</Text>
        </TouchableOpacity>

        {/* Toggle para encender/apagar edificios 3D */}
        <TouchableOpacity
          style={[styles.controlBtn, showBuildings && styles.activeControlBtn]}
          onPress={() => setShowBuildings((prev) => !prev)}
          activeOpacity={0.7}
        >
          <MaterialIcons
            name="apartment"
            size={20}
            color={showBuildings ? '#0F172A' : '#94A3B8'}
          />
        </TouchableOpacity>

        {/* Toggle para Terreno Real de Google (Separado, opcional y pesado) */}
        <TouchableOpacity
          style={[styles.controlBtn, showRealTerrain && styles.activeTerrainBtn]}
          onPress={() => {
            setShowRealTerrain((prev) => !prev);
            setApiError(null);
          }}
          activeOpacity={0.7}
        >
          <MaterialIcons
            name="terrain"
            size={20}
            color={showRealTerrain ? '#FFFFFF' : '#94A3B8'}
          />
        </TouchableOpacity>

        {/* Toggle entre estilo Nocturno y Satélite */}
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={() => setBaseStyle((prev) => (prev === 'dark' ? 'satellite' : 'dark'))}
          activeOpacity={0.7}
        >
          <Ionicons
            name={baseStyle === 'dark' ? 'moon' : 'globe-outline'}
            size={18}
            color={baseStyle === 'dark' ? '#38BDF8' : '#34D399'}
          />
        </TouchableOpacity>

        {/* Brújula de orientación */}
        <TouchableOpacity style={styles.controlBtn} onPress={resetCamera} activeOpacity={0.7}>
          <Ionicons
            name="compass"
            size={22}
            color="#34D399"
            style={{ transform: [{ rotate: `${-viewState.bearing}deg` }] }}
          />
        </TouchableOpacity>
      </View>

      {/* Indicador de Modo en la esquina superior izquierda */}
      <View style={styles.modeBadge} pointerEvents="none">
        <Text style={styles.modeBadgeText}>
          {showRealTerrain ? '⛰️ Terreno Real Google' : '⚡ 3D Nocturno (CARTO)'}
        </Text>
      </View>

      {/* Franja de Atribución */}
      <View style={styles.attributionBar} pointerEvents="none">
        <Text style={styles.attributionText}>
          {showRealTerrain
            ? `Google 3D Tiles | OSM Buildings | ${attributions || 'Data Imagery © Google'}`
            : 'CARTO Dark Matter | OpenStreetMap 3D Buildings'}
        </Text>
      </View>

      {/* Notificación si hay error en Google Tiles */}
      {apiError && showRealTerrain && (
        <View style={styles.errorNotification}>
          <Text style={styles.errorNotificationText}>
            Relieve de Google tardando o bloqueado. Cambiando a CARTO Nocturno...
          </Text>
          <TouchableOpacity
            onPress={() => {
              setShowRealTerrain(false);
              setApiError(null);
            }}
            style={styles.dismissErrorBtn}
          >
            <Text style={styles.dismissErrorText}>Usar CARTO Rápido</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: '#0B0F19',
    overflow: 'hidden',
  },
  floatingControls: {
    position: 'absolute',
    top: 70,
    right: 14,
    flexDirection: 'column',
    gap: 8,
    zIndex: 9999,
  },
  controlBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  activeControlBtn: {
    backgroundColor: '#34D399',
    borderColor: '#34D399',
  },
  activeTerrainBtn: {
    backgroundColor: '#6366F1',
    borderColor: '#818CF8',
  },
  controlText: {
    color: '#34D399',
    fontWeight: '700',
    fontSize: 13,
  },
  modeBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
    zIndex: 9999,
  },
  modeBadgeText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '700',
  },
  attributionBar: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    zIndex: 9999,
  },
  attributionText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '500',
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(11, 15, 25, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 10000,
  },
  errorCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    maxWidth: 420,
    width: '100%',
    borderWidth: 1,
    borderColor: '#F59E0B',
    alignItems: 'center',
  },
  errorTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
    marginTop: 8,
    marginBottom: 6,
  },
  errorMessage: {
    color: '#CBD5E1',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 14,
  },
  fallbackBtn: {
    backgroundColor: '#34D399',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  actionBtnText: {
    color: '#0F172A',
    fontWeight: '600',
    fontSize: 13,
  },
  errorNotification: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: '#1E293B',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F59E0B',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10000,
  },
  errorNotificationText: {
    color: '#FCD34D',
    fontSize: 12,
    flex: 1,
    marginRight: 8,
  },
  dismissErrorBtn: {
    backgroundColor: '#34D399',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  dismissErrorText: {
    color: '#0F172A',
    fontSize: 11,
    fontWeight: '700',
  },
});
