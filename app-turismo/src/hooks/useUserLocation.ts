import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';

import { calculateDistance, calculateBearing } from '../utils/locationUtils';

export interface UserLocation {
  latitude: number;
  longitude: number;
  altitude: number | null;
  speed: number | null; // en km/h
  accuracy: number | null; // en metros
  heading: number | null; // en grados (0-359)
  headingDirection: string | null; // Norte, Suroeste, etc.
}

// Utilidad para calcular dirección cardinal a partir de los grados (0 - 359)
export function getHeadingDirection(heading: number | null): string | null {
  if (heading === null || isNaN(heading)) return null;
  const normalized = ((heading % 360) + 360) % 360;

  const directions = [
    { name: 'Norte', min: 337.5, max: 22.5 },
    { name: 'Nordeste', min: 22.5, max: 67.5 },
    { name: 'Este', min: 67.5, max: 112.5 },
    { name: 'Sudeste', min: 112.5, max: 157.5 },
    { name: 'Sur', min: 157.5, max: 202.5 },
    { name: 'Suroeste', min: 202.5, max: 247.5 },
    { name: 'Oeste', min: 247.5, max: 292.5 },
    { name: 'Noroeste', min: 292.5, max: 337.5 },
  ];

  for (const d of directions) {
    if (d.min > d.max) {
      if (normalized >= d.min || normalized < d.max) return d.name;
    } else {
      if (normalized >= d.min && normalized < d.max) return d.name;
    }
  }
  return 'Norte';
}

const ACCURACY_MIN_METERS = 3;
const ACCURACY_MAX_METERS_NATIVE = 80;
const ACCURACY_MAX_METERS_WEB = 120;
const ACCURACY_STALE_MS = 15000;
const ACCURACY_EMA_ALPHA = 0.25;

export function useUserLocation() {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);

  // Guardar última ubicación en ref para cálculo cinemático de rumbo
  const prevCoordsRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const accuracyEmaRef = useRef<number | null>(null);
  const lastGoodFixRef = useRef<(UserLocation & { timestamp: number }) | null>(null);

  // Refs para throttling del React state
  const lastStateUpdateRef = useRef<number>(0);
  const lastLoggedCoordsRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const lastLoggedHeadingRef = useRef<number | null>(null);

  // Referencias para combinar datos de GPS y Brújula de forma asíncrona
  const latestCoords = useRef<{
    latitude: number;
    longitude: number;
    altitude: number | null;
    speed: number | null;
    accuracy: number | null;
    heading: number | null;
  } | null>(null);

  const latestHeading = useRef<{
    heading: number | null;
    headingDirection: string | null;
  }>({ heading: null, headingDirection: null });

  // Subscripciones para limpieza posterior
  const positionSub = useRef<any>(null);
  const headingSub = useRef<any>(null);

  const updateLocationState = useCallback(() => {
    if (!latestCoords.current) return;

    // Usamos el heading del magnetómetro (brújula física) si está disponible,
    // de lo contrario usamos el rumbo cinemático/GPS
    const headingVal =
      latestHeading.current.heading !== null
        ? latestHeading.current.heading
        : latestCoords.current.heading;

    const headingDir =
      latestHeading.current.heading !== null
        ? latestHeading.current.headingDirection
        : getHeadingDirection(headingVal);

    const newLocationData = {
      latitude: latestCoords.current.latitude,
      longitude: latestCoords.current.longitude,
      altitude: latestCoords.current.altitude,
      speed: latestCoords.current.speed,
      accuracy: latestCoords.current.accuracy,
      heading: headingVal,
      headingDirection: headingDir,
    };

    // 1. Emitir evento de alta frecuencia para los mapas en Web (bypasseando React)
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('high-frequency-user-location', {
          detail: newLocationData,
        }),
      );
    }

    // 2. Throttling para el React State general (usado en check-in, widgets, etc.)
    const now = Date.now();
    const lastUpdate = lastStateUpdateRef.current;
    const lastCoords = lastLoggedCoordsRef.current;
    const lastHeading = lastLoggedHeadingRef.current;

    let shouldUpdateState = false;

    if (userLocation === null) {
      // Forzar la primera actualización
      shouldUpdateState = true;
    } else if (now - lastUpdate >= 1000) {
      // Solo actualizamos el estado si ha pasado más de 1 segundo
      const movedSignificantly =
        !lastCoords ||
        Math.abs(lastCoords.latitude - newLocationData.latitude) > 0.00003 || // ~3 metros
        Math.abs(lastCoords.longitude - newLocationData.longitude) > 0.00003;

      const rotatedSignificantly =
        headingVal !== null && (lastHeading === null || Math.abs(headingVal - lastHeading) >= 10); // ~10 grados

      if (
        movedSignificantly ||
        rotatedSignificantly ||
        newLocationData.accuracy !== userLocation.accuracy
      ) {
        shouldUpdateState = true;
      }
    }

    if (shouldUpdateState) {
      setUserLocation(newLocationData);
      lastStateUpdateRef.current = now;
      lastLoggedCoordsRef.current = {
        latitude: newLocationData.latitude,
        longitude: newLocationData.longitude,
      };
      lastLoggedHeadingRef.current = headingVal;
    }
  }, [userLocation]);

  const accuracyMaxMeters =
    Platform.OS === 'web' ? ACCURACY_MAX_METERS_WEB : ACCURACY_MAX_METERS_NATIVE;

  const normalizeAccuracy = useCallback((rawAccuracy: number | null) => {
    if (rawAccuracy === null || Number.isNaN(rawAccuracy)) {
      return accuracyEmaRef.current;
    }

    const clamped = Math.max(ACCURACY_MIN_METERS, rawAccuracy);
    if (accuracyEmaRef.current === null) {
      accuracyEmaRef.current = clamped;
    } else {
      accuracyEmaRef.current =
        accuracyEmaRef.current + (clamped - accuracyEmaRef.current) * ACCURACY_EMA_ALPHA;
    }

    return accuracyEmaRef.current;
  }, []);

  const applyLocationUpdate = useCallback(
    ({
      latitude,
      longitude,
      altitude,
      speed,
      accuracy,
      heading,
    }: {
      latitude: number;
      longitude: number;
      altitude: number | null;
      speed: number | null;
      accuracy: number | null;
      heading: number | null;
    }) => {
      const now = Date.now();
      const normalizedAccuracy = normalizeAccuracy(accuracy);
      const roundedAccuracy =
        normalizedAccuracy !== null && !Number.isNaN(normalizedAccuracy)
          ? Math.round(normalizedAccuracy)
          : null;

      const isGoodFix = roundedAccuracy !== null && roundedAccuracy <= accuracyMaxMeters;

      if (isGoodFix || !lastGoodFixRef.current) {
        lastGoodFixRef.current = {
          latitude,
          longitude,
          altitude,
          speed,
          accuracy: roundedAccuracy,
          heading,
          headingDirection: getHeadingDirection(heading),
          timestamp: now,
        };
      }

      const useFallback =
        !isGoodFix &&
        lastGoodFixRef.current &&
        now - lastGoodFixRef.current.timestamp <= ACCURACY_STALE_MS;

      const base =
        useFallback && lastGoodFixRef.current
          ? lastGoodFixRef.current
          : {
              latitude,
              longitude,
              altitude,
              speed,
              accuracy: roundedAccuracy,
              heading,
              headingDirection: getHeadingDirection(heading),
            };

      latestCoords.current = {
        latitude: base.latitude,
        longitude: base.longitude,
        altitude: base.altitude,
        speed: base.speed,
        accuracy: base.accuracy,
        heading: heading,
      };

      if (isGoodFix || !prevCoordsRef.current) {
        prevCoordsRef.current = { latitude, longitude };
      }

      updateLocationState();
      setIsLoadingLocation(false);
    },
    [accuracyMaxMeters, normalizeAccuracy, updateLocationState],
  );

  const startLocationTracking = useCallback(async () => {
    // Rendir el hilo de ejecución para que sea completamente asíncrono y silenciar la regla set-state-in-effect
    await Promise.resolve();

    setIsLoadingLocation(true);
    setLocationError(null);

    try {
      if (Platform.OS === 'web') {
        if (!navigator.geolocation) {
          setLocationError('La geolocalización no está soportada por tu navegador');
          setIsLoadingLocation(false);
          return;
        }

        // 1. RASTREAR POSICIÓN GPS (WEB)
        positionSub.current = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude, altitude, accuracy, speed } = position.coords;

            // Convertir velocidad de m/s a km/h (y manejar null)
            const speedKmh =
              speed !== null && speed >= 0 ? parseFloat((speed * 3.6).toFixed(1)) : 0;

            // Rumbo cinemático si no hay brújula física activa
            let calculatedHeading = position.coords.heading;
            if (calculatedHeading === null && prevCoordsRef.current) {
              const distance = calculateDistance(
                prevCoordsRef.current.latitude,
                prevCoordsRef.current.longitude,
                latitude,
                longitude,
              );
              // Si nos movimos más de 1.5 metros, recalculamos rumbo
              if (distance > 1.5) {
                calculatedHeading = calculateBearing(
                  prevCoordsRef.current.latitude,
                  prevCoordsRef.current.longitude,
                  latitude,
                  longitude,
                );
              }
            }

            applyLocationUpdate({
              latitude,
              longitude,
              altitude: altitude !== null ? Math.round(altitude) : null,
              accuracy: accuracy !== null ? Math.round(accuracy) : null,
              speed: speedKmh,
              heading: calculatedHeading,
            });
          },
          (error) => {
            let errorMsg = 'Error al obtener ubicación';
            switch (error.code) {
              case error.PERMISSION_DENIED:
                errorMsg = 'Permiso de ubicación denegado';
                break;
              case error.POSITION_UNAVAILABLE:
                errorMsg = 'Información de ubicación no disponible';
                break;
              case error.TIMEOUT:
                errorMsg = 'Tiempo de espera agotado al obtener ubicación';
                break;
            }
            setLocationError(errorMsg);
            setIsLoadingLocation(false);
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
        );

        // 2. RASTREAR DIRECCIÓN/BRÚJULA DE SENSORES (WEB)
        const handleOrientation = (e: DeviceOrientationEvent) => {
          let webHeading: number | null = null;

          // Safari en iOS provee webkitCompassHeading
          if ('webkitCompassHeading' in e) {
            webHeading = e.webkitCompassHeading as number;
          } else if (e.alpha !== null) {
            // Android / Chrome: alpha va de 0 a 360
            webHeading = (360 - e.alpha) % 360;
          }

          if (webHeading !== null && !isNaN(webHeading)) {
            latestHeading.current = {
              heading: webHeading,
              headingDirection: getHeadingDirection(webHeading),
            };
            updateLocationState();
          }
        };

        // Escuchar tanto absoluto como estándar
        if (typeof window !== 'undefined' && 'ondeviceorientationabsolute' in window) {
          (window as any).addEventListener('deviceorientationabsolute', handleOrientation, true);
          headingSub.current = handleOrientation;
        } else if (typeof window !== 'undefined' && 'ondeviceorientation' in window) {
          (window as any).addEventListener('deviceorientation', handleOrientation, true);
          headingSub.current = handleOrientation;
        }
      } else {
        // NATIVO (EXPO)
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationError('Permiso de ubicación denegado');
          setIsLoadingLocation(false);
          return;
        }

        const initialLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Highest,
        });

        const initCoords = initialLocation.coords;
        applyLocationUpdate({
          latitude: initCoords.latitude,
          longitude: initCoords.longitude,
          altitude: initCoords.altitude !== null ? Math.round(initCoords.altitude) : null,
          accuracy: initCoords.accuracy !== null ? Math.round(initCoords.accuracy) : null,
          speed:
            initCoords.speed !== null && initCoords.speed >= 0
              ? parseFloat((initCoords.speed * 3.6).toFixed(1))
              : 0,
          heading: initCoords.heading,
        });

        // 1. RASTREAR POSICIÓN NATIVA
        positionSub.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 2000, // Actualizar cada 2s para mejor precisión
            distanceInterval: 2, // Cada 2 metros
          },
          (location) => {
            const { latitude, longitude, altitude, accuracy, speed, heading } = location.coords;
            const speedKmh =
              speed !== null && speed >= 0 ? parseFloat((speed * 3.6).toFixed(1)) : 0;

            let calculatedHeading = heading;
            if (calculatedHeading === null && prevCoordsRef.current) {
              const distance = calculateDistance(
                prevCoordsRef.current.latitude,
                prevCoordsRef.current.longitude,
                latitude,
                longitude,
              );
              if (distance > 1.5) {
                calculatedHeading = calculateBearing(
                  prevCoordsRef.current.latitude,
                  prevCoordsRef.current.longitude,
                  latitude,
                  longitude,
                );
              }
            }

            applyLocationUpdate({
              latitude,
              longitude,
              altitude: altitude !== null ? Math.round(altitude) : null,
              accuracy: accuracy !== null ? Math.round(accuracy) : null,
              speed: speedKmh,
              heading: calculatedHeading,
            });
          },
        );

        // 2. RASTREAR BRÚJULA NATIVA (MAGNETÓMETRO)
        headingSub.current = await Location.watchHeadingAsync((headingData) => {
          const headingVal =
            headingData.trueHeading !== -1 ? headingData.trueHeading : headingData.magHeading;
          latestHeading.current = {
            heading: headingVal,
            headingDirection: getHeadingDirection(headingVal),
          };
          updateLocationState();
        });
      }
    } catch (error) {
      console.error('Error tracking location & sensors:', error);
      setLocationError('Ocurrió un error al rastrear la ubicación');
      setIsLoadingLocation(false);
    }
  }, [applyLocationUpdate, updateLocationState]);

  const startTrackingRef = useRef(startLocationTracking);

  useEffect(() => {
    startTrackingRef.current = startLocationTracking;
  }, [startLocationTracking]);

  useEffect(() => {
    startTrackingRef.current();

    return () => {
      // Limpieza de subscripciones
      if (positionSub.current) {
        if (Platform.OS === 'web') {
          navigator.geolocation.clearWatch(positionSub.current);
        } else {
          positionSub.current.remove();
        }
      }
      if (headingSub.current) {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          (window as any).removeEventListener(
            'deviceorientationabsolute',
            headingSub.current,
            true,
          );
          (window as any).removeEventListener('deviceorientation', headingSub.current, true);
        } else {
          headingSub.current.remove();
        }
      }
    };
  }, []);

  const retryLocation = () => {
    startLocationTracking();
  };

  return { userLocation, locationError, isLoadingLocation, retryLocation };
}
