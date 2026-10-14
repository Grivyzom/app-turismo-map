import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { MapLayer } from '../components/Map/types';

const MAP_LAYER_STORAGE_KEY = 'app-turismo.map-layer';

const isValidMapLayer = (value: string | null): value is MapLayer => {
  return (
    value === 'dark' ||
    value === 'streets' ||
    value === 'light' ||
    value === 'satellite' ||
    value === 'terrain' ||
    value === '3d' ||
    value === 'google3d'
  );
};

export const DEFAULT_MAP_LAYER: MapLayer = 'dark';

export const loadPersistedMapLayer = async (): Promise<MapLayer | null> => {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const storedValue = window.localStorage.getItem(MAP_LAYER_STORAGE_KEY);
      return isValidMapLayer(storedValue) ? storedValue : null;
    }

    const storedValue = await AsyncStorage.getItem(MAP_LAYER_STORAGE_KEY);
    return isValidMapLayer(storedValue) ? storedValue : null;
  } catch {
    return null;
  }
};

export const savePersistedMapLayer = async (mapLayer: MapLayer): Promise<void> => {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.setItem(MAP_LAYER_STORAGE_KEY, mapLayer);
      return;
    }

    await AsyncStorage.setItem(MAP_LAYER_STORAGE_KEY, mapLayer);
  } catch {
    // Si el storage no está disponible, la app sigue funcionando con el valor en memoria.
  }
};

// ─── Preferencias de Animaciones y Efectos de Cámara (GTA V) ─────────────────
const CAMERA_ANIMATIONS_STORAGE_KEY = 'app-turismo.camera-animations';
export const DEFAULT_CAMERA_ANIMATIONS = true;

export const loadPersistedCameraAnimations = async (): Promise<boolean> => {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const storedValue = window.localStorage.getItem(CAMERA_ANIMATIONS_STORAGE_KEY);
      return storedValue !== null ? storedValue === 'true' : DEFAULT_CAMERA_ANIMATIONS;
    }

    const storedValue = await AsyncStorage.getItem(CAMERA_ANIMATIONS_STORAGE_KEY);
    return storedValue !== null ? storedValue === 'true' : DEFAULT_CAMERA_ANIMATIONS;
  } catch {
    return DEFAULT_CAMERA_ANIMATIONS;
  }
};

export const savePersistedCameraAnimations = async (enabled: boolean): Promise<void> => {
  try {
    const value = enabled ? 'true' : 'false';
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.setItem(CAMERA_ANIMATIONS_STORAGE_KEY, value);
      return;
    }

    await AsyncStorage.setItem(CAMERA_ANIMATIONS_STORAGE_KEY, value);
  } catch {
    // Silently ignore storage errors
  }
};

// ─── Cámaras de seguridad (capa opcional, apagada por defecto) ───────────────
// Son infraestructura de nicho: la mayoría de los usuarios no las necesita y en
// el centro saturan el mapa, así que se activan explícitamente desde Herramientas.
const SECURITY_CAMERAS_STORAGE_KEY = 'app-turismo.security-cameras';
export const DEFAULT_SHOW_SECURITY_CAMERAS = false;

export const loadPersistedShowSecurityCameras = async (): Promise<boolean> => {
  try {
    const storedValue =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.localStorage.getItem(SECURITY_CAMERAS_STORAGE_KEY)
        : await AsyncStorage.getItem(SECURITY_CAMERAS_STORAGE_KEY);
    return storedValue !== null ? storedValue === 'true' : DEFAULT_SHOW_SECURITY_CAMERAS;
  } catch {
    return DEFAULT_SHOW_SECURITY_CAMERAS;
  }
};

export const savePersistedShowSecurityCameras = async (enabled: boolean): Promise<void> => {
  try {
    const value = enabled ? 'true' : 'false';
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.setItem(SECURITY_CAMERAS_STORAGE_KEY, value);
      return;
    }
    await AsyncStorage.setItem(SECURITY_CAMERAS_STORAGE_KEY, value);
  } catch {
    // Silently ignore storage errors
  }
};
