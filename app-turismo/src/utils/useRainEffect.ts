import { useEffect, useRef } from 'react';

import { RainEffect } from './rainEffect';
import { Rain3DLayer } from './rain3dLayer';
import { getLocalizedWeather } from './weatherUtils';

export interface RainEffectOptions {
  minZoom?: number;
  fullZoom?: number;
  mode?: 'canvas2d' | 'webgl3d';
  dropCount?: number;
}

/**
 * Hook para controlar efecto de lluvia basado en datos climáticos
 * Sincroniza con eventos del mapa (zoom, pan, rotate, pitch)
 * Soporta dos motores:
 * 1. 'webgl3d': CustomLayer nativa MapLibre GL 5.x con shaders GPU y matriz RTC.
 * 2. 'canvas2d': Canvas superpuesto tradicional con anclaje de perspectiva.
 * Controla visibilidad según Zoom LOD (lluvia de cerca, macro de lejos)
 */
export function useRainEffect(
  mapContainer: HTMLElement | null,
  mapRef?: any,
  enabled = true,
  options?: RainEffectOptions
) {
  const mode = options?.mode || 'canvas2d';
  const rainEffectRef = useRef<RainEffect | null>(null);
  const rain3dLayerRef = useRef<Rain3DLayer | null>(null);
  const weatherCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRainingRef = useRef(false);

  const isRainingCode = (code: number): boolean => {
    return (code >= 51 && code <= 55) || (code >= 61 && code <= 65) || (code >= 80 && code <= 82);
  };

  useEffect(() => {
    if (!enabled || !mapContainer) return;

    const map = mapRef?.current;

    if (mode === 'webgl3d' && map) {
      const layer = new Rain3DLayer({
        minZoom: options?.minZoom,
        fullZoom: options?.fullZoom,
        dropCount: options?.dropCount,
      });
      rain3dLayerRef.current = layer;

      const attachLayer = () => {
        if (map && !map.getLayer(layer.id)) {
          map.addLayer(layer);
        }
      };

      if (map.isStyleLoaded && map.isStyleLoaded()) {
        attachLayer();
      } else if (map.once) {
        map.once('load', attachLayer);
      }
    } else {
      rainEffectRef.current = new RainEffect(mapContainer, () => mapRef?.current);
      if (options?.minZoom !== undefined && options?.fullZoom !== undefined) {
        rainEffectRef.current.setZoomRange(options.minZoom, options.fullZoom);
      }
    }

    let lastToggleTime = 0;
    const toggleDebounceMs = 1000;

    const checkWeather = async () => {
      try {
        const weather = await getLocalizedWeather();
        if (weather.length === 0) return;

        const current = weather[0];
        const shouldRain = isRainingCode(current.weatherCode);
        const now = Date.now();

        if (shouldRain && !isRainingRef.current && now - lastToggleTime > toggleDebounceMs) {
          rainEffectRef.current?.start();
          rain3dLayerRef.current?.start();
          isRainingRef.current = true;
          lastToggleTime = now;
        } else if (!shouldRain && isRainingRef.current && now - lastToggleTime > toggleDebounceMs) {
          rainEffectRef.current?.stop();
          rain3dLayerRef.current?.stop();
          isRainingRef.current = false;
          lastToggleTime = now;
        }

        if (shouldRain) {
          const intensity = Math.min(1, (current.rain || 0) / 10);
          rainEffectRef.current?.setIntensity(intensity);
          rain3dLayerRef.current?.setIntensity(intensity);
          if (current.windDirection !== undefined && current.windSpeed !== undefined) {
            rainEffectRef.current?.setWind(current.windDirection, current.windSpeed);
            rain3dLayerRef.current?.setWind(current.windDirection, current.windSpeed);
          }
        }
      } catch (error) {
        console.warn('[RAIN_EFFECT]', error);
      }
    };

    checkWeather();
    weatherCheckIntervalRef.current = setInterval(checkWeather, 3 * 60 * 1000);

    // Sync with map camera changes (required for canvas2d)
    if (map) {
      const syncCamera = () => {
        if (rainEffectRef.current) {
          const zoom = map.getZoom();
          const bearing = map.getBearing();
          const pitch = map.getPitch();
          rainEffectRef.current.syncMapCamera(zoom, bearing, pitch);
        }
      };

      map.on('move', syncCamera);
      map.on('zoom', syncCamera);
      map.on('rotate', syncCamera);
      map.on('pitch', syncCamera);

      syncCamera();

      return () => {
        if (weatherCheckIntervalRef.current) {
          clearInterval(weatherCheckIntervalRef.current);
        }
        map.off('move', syncCamera);
        map.off('zoom', syncCamera);
        map.off('rotate', syncCamera);
        map.off('pitch', syncCamera);

        if (rain3dLayerRef.current && map.getLayer?.(rain3dLayerRef.current.id)) {
          map.removeLayer(rain3dLayerRef.current.id);
          rain3dLayerRef.current = null;
        }
        rainEffectRef.current?.destroy();
        rainEffectRef.current = null;
      };
    }

    return () => {
      if (weatherCheckIntervalRef.current) {
        clearInterval(weatherCheckIntervalRef.current);
      }
      rainEffectRef.current?.destroy();
      rainEffectRef.current = null;
    };
  }, [enabled, mapContainer, mapRef, mode, options?.minZoom, options?.fullZoom, options?.dropCount]);
}
