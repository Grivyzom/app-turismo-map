import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Preferencias del perfil móvil (pantallas "Mi perfil" del wireframe).
 * Se persisten localmente en AsyncStorage; no requieren sesión iniciada.
 */

export type DayRhythm = 'tranquilo' | 'moderado' | 'intenso';
export type Budget = 'economico' | 'medio' | 'alto';
export type TransportKey = 'a_pie' | 'bicicleta' | 'micro' | 'auto' | 'lancha';
export type TextSize = 'sm' | 'md' | 'lg';
export type LanguageCode = 'es' | 'en' | 'pt';
export type CurrencyCode = 'CLP' | 'USD' | 'EUR' | 'ARS' | 'BRL';
export type LocationUse = 'uso' | 'siempre' | 'nunca';

export interface MobilePreferences {
  nick: string;
  photoUri: string | null;
  lodging: {
    street: string;
    reference: string;
    latitude: number | null;
    longitude: number | null;
  };
  rhythm: DayRhythm;
  budget: Budget;
  transport: TransportKey[];
  diet: string;
  textSize: TextSize;
  highContrast: boolean;
  reducedMobility: boolean;
  language: LanguageCode;
  currency: CurrencyCode;
  notifications: {
    nearbyEvents: boolean;
    weatherAndCity: boolean;
    routeChanges: boolean;
    businessBenefits: boolean;
    quietFrom: string;
  };
  offline: {
    downloadedSectors: string[];
    wifiOnly: boolean;
  };
  emergencyContact: { name: string; phone: string };
  shareActiveRoute: boolean;
  locationUse: LocationUse;
  historyRecommendations: boolean;
  savedEventIds: string[];
  likedEventIds: string[];
  dismissedAlert: string | null;
}

export const DEFAULT_MOBILE_PREFERENCES: MobilePreferences = {
  nick: '',
  photoUri: null,
  lodging: { street: '', reference: '', latitude: null, longitude: null },
  rhythm: 'moderado',
  budget: 'medio',
  transport: ['a_pie'],
  diet: '',
  textSize: 'md',
  highContrast: false,
  reducedMobility: false,
  language: 'es',
  currency: 'CLP',
  notifications: {
    nearbyEvents: true,
    weatherAndCity: true,
    routeChanges: true,
    businessBenefits: false,
    quietFrom: '22:00',
  },
  offline: { downloadedSectors: [], wifiOnly: true },
  emergencyContact: { name: '', phone: '' },
  shareActiveRoute: false,
  locationUse: 'uso',
  historyRecommendations: true,
  savedEventIds: [],
  likedEventIds: [],
  dismissedAlert: null,
};

const STORAGE_KEY = 'app-turismo.mobile-preferences-v1';

export const TEXT_SCALE: Record<TextSize, number> = { sm: 0.9, md: 1, lg: 1.15 };

/** true si el usuario apagó todas las categorías de avisos en Perfil. */
export function notificationsMuted(prefs: MobilePreferences) {
  const { nearbyEvents, weatherAndCity, routeChanges, businessBenefits } = prefs.notifications;
  return !(nearbyEvents || weatherAndCity || routeChanges || businessBenefits);
}

function mergeWithDefaults(raw: Partial<MobilePreferences>): MobilePreferences {
  return {
    ...DEFAULT_MOBILE_PREFERENCES,
    ...raw,
    lodging: { ...DEFAULT_MOBILE_PREFERENCES.lodging, ...(raw.lodging ?? {}) },
    notifications: { ...DEFAULT_MOBILE_PREFERENCES.notifications, ...(raw.notifications ?? {}) },
    offline: { ...DEFAULT_MOBILE_PREFERENCES.offline, ...(raw.offline ?? {}) },
    emergencyContact: {
      ...DEFAULT_MOBILE_PREFERENCES.emergencyContact,
      ...(raw.emergencyContact ?? {}),
    },
  };
}

export function useMobilePreferences() {
  const [prefs, setPrefs] = useState<MobilePreferences>(DEFAULT_MOBILE_PREFERENCES);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        setPrefs(mergeWithDefaults(JSON.parse(raw)));
      })
      .catch((err) => console.warn('[MobilePreferences] No se pudieron leer', err))
      .finally(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  // Guardado con debounce para no escribir en cada tecla de los inputs
  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)).catch((err) =>
        console.warn('[MobilePreferences] No se pudieron guardar', err),
      );
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [prefs, loaded]);

  const update = useCallback((patch: Partial<MobilePreferences>) => {
    setPrefs((prev) => ({ ...prev, ...patch }));
  }, []);

  const reset = useCallback(async () => {
    setPrefs(DEFAULT_MOBILE_PREFERENCES);
    await AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
  }, []);

  return { prefs, loaded, update, reset };
}
