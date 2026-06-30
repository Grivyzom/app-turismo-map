import { useEffect, useRef } from 'react';

import { RainEffect } from './rainEffect';
import { getLocalizedWeather } from './weatherUtils';

/**
 * Hook para controlar efecto de lluvia basado en datos climáticos
 * Sincroniza con eventos del mapa (zoom, pan, rotate)
 */
export function useRainEffect(mapContainer: HTMLElement | null, mapRef?: any, enabled = true) {
  const rainEffectRef = useRef<RainEffect | null>(null);
  const weatherCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRainingRef = useRef(false);

  const isRainingCode = (code: number): boolean => {
    return (code >= 51 && code <= 55) || (code >= 61 && code <= 65) || (code >= 80 && code <= 82);
  };

  useEffect(() => {
    if (!enabled || !mapContainer) return;

    rainEffectRef.current = new RainEffect(mapContainer);
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
          isRainingRef.current = true;
          lastToggleTime = now;
        } else if (!shouldRain && isRainingRef.current && now - lastToggleTime > toggleDebounceMs) {
          rainEffectRef.current?.stop();
          isRainingRef.current = false;
          lastToggleTime = now;
        }

        if (shouldRain && rainEffectRef.current) {
          const intensity = Math.min(1, (current.rain || 0) / 10);
          rainEffectRef.current.setIntensity(intensity);
        }
      } catch (error) {
        console.warn('[RAIN_EFFECT]', error);
      }
    };

    checkWeather();
    weatherCheckIntervalRef.current = setInterval(checkWeather, 3 * 60 * 1000);

    // Sync with map camera changes
    if (mapRef?.current) {
      const map = mapRef.current;

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
        rainEffectRef.current?.destroy();
      };
    }

    return () => {
      if (weatherCheckIntervalRef.current) {
        clearInterval(weatherCheckIntervalRef.current);
      }
      rainEffectRef.current?.destroy();
    };
  }, [enabled, mapContainer, mapRef]);
}
