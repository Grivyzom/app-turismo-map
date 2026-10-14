import { Platform } from 'react-native';
import { VALDIVIA_LAT, VALDIVIA_LNG } from '../../../constants/location';

export interface CameraLocationTarget {
  latitude: number;
  longitude: number;
  heading?: number | null;
}

export const GTA_V_CAMERA_CONFIG = {
  // Spawn target parameters (over user pin)
  spawnZoom: 16.8,
  spawnPitch: 48,
  spawnCurve: 1.85,
  spawnSpeed: 1.2,

  // Sky altitude parameters (GTA V atmospheric perspective)
  skyZoom: 11.8,
  skyPitch: 10,

  // Default city center parameters
  defaultZoom: 13,
  defaultPitch: 0,
  defaultBearing: 0,
};

const CAMERA_SPAWNED_SESSION_KEY = 'app-turismo.camera-spawned';
let nativeSessionSpawned = false;

/**
 * Consulta si el efecto de spawn GTA V ya fue ejecutado en esta sesión de navegación.
 * En Web utiliza sessionStorage, el cual sobrevive a recargas (F5/refresh) dentro de la misma pestaña,
 * pero se reinicia al cerrar la pestaña o al hacer logout explícito.
 */
export function hasCameraSpawnedInSession(): boolean {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
    try {
      return window.sessionStorage.getItem(CAMERA_SPAWNED_SESSION_KEY) === 'true';
    } catch {
      return nativeSessionSpawned;
    }
  }
  return nativeSessionSpawned;
}

/**
 * Marca que el efecto de spawn GTA V ya fue ejecutado en la sesión actual.
 */
export function markCameraSpawnedInSession(): void {
  nativeSessionSpawned = true;
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.setItem(CAMERA_SPAWNED_SESSION_KEY, 'true');
    } catch {}
  }
}

/**
 * Limpia la marca de spawn en la sesión (invocado en logout o nuevo login explícito).
 */
export function resetCameraSpawnInSession(): void {
  nativeSessionSpawned = false;
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.removeItem(CAMERA_SPAWNED_SESSION_KEY);
    } catch {}
  }
}

/**
 * Efecto de cambio de vista suave y cinematográfico hacia un pin (estilo GTA V refinado).
 * Realiza un vuelo parabólico elegante con deceleración cúbica progresiva,
 * situando la cámara en perspectiva 3D (pitch 45°) a zoom de detalle de forma fluida.
 */
export function executeSmoothPinFocus(
  map: any,
  location: CameraLocationTarget,
  animated: boolean = true,
  onComplete?: () => void,
) {
  if (!map) return;

  const currentBearing = typeof map.getBearing === 'function' ? map.getBearing() : 0;
  const targetBearing =
    location.heading && location.heading > 0 ? location.heading : currentBearing;

  // Respetar estrictamente el ángulo de inclinación (pitch) del usuario
  const currentPitch = typeof map.getPitch === 'function' ? map.getPitch() : 0;
  const targetPitch = currentPitch;

  const currentZoom = typeof map.getZoom === 'function' ? map.getZoom() : 16;
  // Para mobiliario y pines de utilidad se requiere zoom cercano de detalle (mínimo 17.8).
  // Si el usuario ya está a un zoom mayor (ej. 18 o 19), se preserva para NUNCA alejar la vista.
  const targetZoom = Math.min(19.5, Math.max(currentZoom, 17.8));

  if (!animated) {
    if (typeof map.jumpTo === 'function') {
      map.jumpTo({
        center: [location.longitude, location.latitude],
        zoom: targetZoom,
        pitch: targetPitch,
        bearing: targetBearing,
      });
    }
    onComplete?.();
    return;
  }

  let completed = false;
  const finish = () => {
    if (!completed) {
      completed = true;
      onComplete?.();
    }
  };

  // Determinar si el pin está lejos del centro actual o ya en pantalla
  const currentCenter = typeof map.getCenter === 'function' ? map.getCenter() : null;
  let isFar = false;
  if (currentCenter) {
    const dx = currentCenter.lng - location.longitude;
    const dy = currentCenter.lat - location.latitude;
    if (Math.sqrt(dx * dx + dy * dy) > 0.025) {
      isFar = true;
    }
  }

  if (isFar && typeof map.flyTo === 'function') {
    // Si está en otro sector distante de la ciudad, volar pero con minZoom protegido
    // para no alejarse hasta el espacio exterior ni perder el contexto
    map.flyTo({
      center: [location.longitude, location.latitude],
      zoom: targetZoom,
      pitch: targetPitch,
      bearing: targetBearing,
      minZoom: 15.0, // Nunca alejarse por debajo del umbral de utilidades
      speed: 0.9,
      essential: true,
    });
  } else if (typeof map.easeTo === 'function') {
    // Si el pin está en pantalla o cercano: deslizamiento directo con easeTo.
    // Esto garantiza que la cámara NUNCA se aleje hacia arriba en una parábola
    // y respeta exactamente el ángulo de inclinación actual del usuario.
    map.easeTo({
      center: [location.longitude, location.latitude],
      zoom: targetZoom,
      pitch: targetPitch,
      bearing: targetBearing,
      duration: 750,
      easing: (t: number) => 1 - Math.pow(1 - t, 3), // Deceleración cúbica suave
      essential: true,
    });
  } else if (typeof map.flyTo === 'function') {
    map.flyTo({
      center: [location.longitude, location.latitude],
      zoom: targetZoom,
      pitch: 45,
      bearing: targetBearing,
      essential: true,
    });
  } else {
    onComplete?.();
    return;
  }

  if (typeof map.once === 'function') {
    map.once('moveend', finish);
  }
  setTimeout(finish, 1800);
}

/**
 * Ejecuta el efecto de aparición de cámara GTA V en MapLibre GL.
 * Si animated es true:
 *   1. Eleva la cámara a vista satelital/cielo (zoom ~11.8, pitch 10°).
 *   2. Desciende rápidamente y se inclina a 48° situándose justo sobre el pin del usuario.
 * Si animated es false:
 *   Se sitúa inmediatamente sobre el usuario sin animación.
 */
export function executeMapLibreGtaVSpawn(
  map: any,
  location: CameraLocationTarget,
  animated: boolean = true,
  onComplete?: () => void,
) {
  if (!map) return;

  const targetBearing =
    location.heading && location.heading > 0 ? location.heading : 15;

  if (!animated) {
    if (typeof map.jumpTo === 'function') {
      map.jumpTo({
        center: [location.longitude, location.latitude],
        zoom: 15.5,
        pitch: 0,
        bearing: 0,
      });
    }
    onComplete?.();
    return;
  }

  // Fase 1: Ascenso al cielo / perspectiva atmosférica
  const currentZoom = typeof map.getZoom === 'function' ? map.getZoom() : 13;
  const skyZoom = Math.min(currentZoom, GTA_V_CAMERA_CONFIG.skyZoom);

  let phase2Started = false;
  const startPhase2 = () => {
    if (phase2Started || !map) return;
    phase2Started = true;

    if (typeof map.flyTo === 'function') {
      map.flyTo({
        center: [location.longitude, location.latitude],
        zoom: GTA_V_CAMERA_CONFIG.spawnZoom,
        pitch: GTA_V_CAMERA_CONFIG.spawnPitch,
        bearing: targetBearing,
        curve: GTA_V_CAMERA_CONFIG.spawnCurve,
        speed: GTA_V_CAMERA_CONFIG.spawnSpeed,
        essential: true,
        easing: (t: number) => 1 - Math.pow(1 - t, 3), // Deceleración cúbica suave
      });

      map.once('moveend', () => {
        onComplete?.();
      });
    } else {
      onComplete?.();
    }
  };

  if (typeof map.easeTo === 'function') {
    map.easeTo({
      zoom: skyZoom,
      pitch: GTA_V_CAMERA_CONFIG.skyPitch,
      duration: 500,
      easing: (t: number) => t * (2 - t),
    });

    // Encadenar Fase 2 tan pronto termine Fase 1
    map.once('moveend', startPhase2);
    // Timeout de seguridad en caso de que moveend no dispare
    setTimeout(startPhase2, 540);
  } else {
    startPhase2();
  }
}

/**
 * Ejecuta la transición suave de logout en MapLibre GL.
 * Conserva el centro y nivel de zoom actuales del mapa para evitar:
 * 1. Recargas de teselas (tiles) fuera de caché que causan parpadeos/flashes.
 * 2. Re-agrupamiento violento de clusters (Mega-Clusters de zoom < 11).
 * 3. Movimientos bruscos de cámara que desorientan al usuario.
 * Si la cámara estaba inclinada (pitch 3D) o rotada, suavemente regresa a vista cenital (pitch 0).
 */
export function executeMapLibreGtaVLogout(
  map: any,
  animated: boolean = true,
  onComplete?: () => void,
) {
  resetCameraSpawnInSession();
  if (!map) return;

  const currentPitch = typeof map.getPitch === 'function' ? map.getPitch() : 0;
  const currentBearing = typeof map.getBearing === 'function' ? map.getBearing() : 0;

  // Si hay inclinación o rotación 3D, nivelamos suavemente a 0 sin alterar zoom ni centro
  if (currentPitch !== 0 || currentBearing !== 0) {
    if (animated && typeof map.easeTo === 'function') {
      map.easeTo({
        pitch: 0,
        bearing: 0,
        duration: 350,
        easing: (t: number) => 1 - Math.pow(1 - t, 2),
      });
    } else if (typeof map.setPitch === 'function') {
      map.setPitch(0);
      if (typeof map.setBearing === 'function') {
        map.setBearing(0);
      }
    }
  }

  onComplete?.();
}

/**
 * Implementación del spawn GTA V en React Native Maps (Mobile).
 */
export function executeNativeGtaVSpawn(
  mapView: any,
  location: CameraLocationTarget,
  animated: boolean = true,
) {
  if (!mapView) return;

  const targetBearing =
    location.heading && location.heading > 0 ? location.heading : 15;

  if (typeof mapView.animateCamera === 'function') {
    mapView.animateCamera(
      {
        center: { latitude: location.latitude, longitude: location.longitude },
        zoom: GTA_V_CAMERA_CONFIG.spawnZoom,
        pitch: animated ? GTA_V_CAMERA_CONFIG.spawnPitch : 0,
        heading: animated ? targetBearing : 0,
      },
      { duration: animated ? 2200 : 300 },
    );
  }
}

/**
 * Implementación de logout suave en React Native Maps (Mobile).
 * Mantiene la ubicación y zoom actuales, nivelando pitch y rumbo a 0 si estaban inclinados.
 */
export function executeNativeGtaVLogout(mapView: any, animated: boolean = true) {
  resetCameraSpawnInSession();
  if (!mapView) return;

  if (typeof mapView.animateCamera === 'function') {
    mapView.animateCamera(
      {
        pitch: 0,
        heading: 0,
      },
      { duration: animated ? 300 : 0 },
    );
  }
}

/**
 * Implementación del spawn GTA V en Google Maps JS SDK (Web).
 */
export function executeGoogleMapsGtaVSpawn(
  map: any,
  location: CameraLocationTarget,
  animated: boolean = true,
) {
  if (!map) return;

  if (typeof map.moveCamera === 'function') {
    map.moveCamera({
      center: { lat: location.latitude, lng: location.longitude },
      zoom: GTA_V_CAMERA_CONFIG.spawnZoom,
      tilt: animated ? GTA_V_CAMERA_CONFIG.spawnPitch : 0,
      heading: animated && location.heading && location.heading > 0 ? location.heading : 15,
    });
  } else if (typeof map.panTo === 'function') {
    map.panTo({ lat: location.latitude, lng: location.longitude });
    if (typeof map.setZoom === 'function') {
      map.setZoom(16);
    }
  }
}

/**
 * Implementación de logout suave en Google Maps JS SDK (Web).
 * Mantiene la ubicación y zoom actuales, nivelando tilt y rumbo a 0 si estaban inclinados.
 */
export function executeGoogleMapsGtaVLogout(map: any, animated: boolean = true) {
  resetCameraSpawnInSession();
  if (!map) return;

  if (typeof map.moveCamera === 'function') {
    map.moveCamera({
      tilt: 0,
      heading: 0,
    });
  }
}
