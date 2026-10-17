import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { useUserLocationContext } from '../context/UserLocationContext';

import type { Section } from './layout';
import { buildRecommendedRoute, RecommendedRoute } from './data/routes';
import { IoniconName, QuickCategory } from './data/categories';
import { useMobileNotifications } from './hooks/useMobileNotifications';
import { shouldShowWelcome } from './session';
import { MobilePreferences, TEXT_SCALE, useMobilePreferences } from './hooks/useMobilePreferences';
import { MobileWeather, useMobileWeather } from './hooks/useMobileWeather';
import {
  Coordinate,
  DEFAULT_CENTER,
  nearestSector,
  PlaceWithDistance,
  Sector,
  usePlacesData,
} from './hooks/usePlacesData';

export type MobileTab = Section;
export type MobileOverlay = 'clima' | 'avisos' | null;

/** Funciones que requieren cuenta: el invitado ve una hoja que lo invita a iniciar sesión. */
export type GatedFeature = 'guardar' | 'meGusta' | 'guia' | 'rutas' | 'perfil';

export const GATED_FEATURE_COPY: Record<GatedFeature, { icon: IoniconName; message: string }> = {
  guardar: {
    icon: 'bookmark-outline',
    message: 'Crea una cuenta para guardar eventos y lugares y encontrarlos después.',
  },
  meGusta: {
    icon: 'heart-outline',
    message: 'Crea una cuenta para marcar lo que te gusta y recibir mejores recomendaciones.',
  },
  guia: {
    icon: 'sparkles-outline',
    message: 'Inicia sesión para preguntarle a la guía y planear tu día.',
  },
  rutas: {
    icon: 'walk-outline',
    message: 'Inicia sesión para seguir rutas guiadas paso a paso.',
  },
  perfil: {
    icon: 'person-outline',
    message:
      'Con una cuenta puedes guardar tu alojamiento, preferencias, mapas sin conexión y más.',
  },
};

export interface ActiveRoute {
  route: RecommendedRoute;
  stopIndex: number;
}

interface MobileAppContextValue {
  // Sesión e invitado
  isGuest: boolean;
  /** La sesión todavía se está restaurando (no sabemos si es invitado). */
  authLoading: boolean;
  /** Bienvenida con login/registro: sale en cada apertura mientras no haya sesión. */
  showWelcome: boolean;
  continueAsGuest: () => void;
  /** Devuelve true si hay sesión; si no, abre la hoja "Necesitas una cuenta". */
  requireAccount: (feature: GatedFeature) => boolean;
  accountGate: GatedFeature | null;
  closeAccountGate: () => void;

  // Navegación
  tab: MobileTab;
  setTab: (tab: MobileTab) => void;
  overlay: MobileOverlay;
  setOverlay: (overlay: MobileOverlay) => void;
  sectorPickerOpen: boolean;
  setSectorPickerOpen: (open: boolean) => void;
  /** Abre el Mapa con un lugar seleccionado y/o un filtro de categoría. */
  openOnMap: (place?: PlaceWithDistance | null, category?: QuickCategory) => void;
  mapFocus: { place: PlaceWithDistance | null; category: QuickCategory; nonce: number };
  /** Abre la Guía con una pregunta precargada. */
  askGuide: (question: string) => void;
  guidePrompt: { text: string; nonce: number } | null;
  /** Ficha "Acerca del evento" abierta sobre la pestaña actual. */
  eventDetail: PlaceWithDistance | null;
  openEvent: (event: PlaceWithDistance) => void;
  closeEvent: () => void;

  // Preferencias
  prefs: MobilePreferences;
  updatePrefs: (patch: Partial<MobilePreferences>) => void;
  resetPrefs: () => Promise<void>;
  textScale: number;

  // Ubicación y sector
  origin: Coordinate;
  hasGps: boolean;
  gpsAccuracy: number | null;
  gpsLoading: boolean;
  gpsError: string | null;
  usingSectorOverride: boolean;
  recenter: () => void;
  sectors: Sector[];
  sectorName: string;
  setSectorOverride: (sector: Sector | null) => void;

  // Datos
  weather: MobileWeather | null;
  weatherError: string | null;
  refreshWeather: () => void;
  /** Recarga clima y lugares (pull-to-refresh). */
  refresh: () => void;
  places: PlaceWithDistance[];
  events: PlaceWithDistance[];
  restrooms: PlaceWithDistance[];
  loadingPlaces: boolean;
  recommendedRoute: RecommendedRoute | null;
  notifications: ReturnType<typeof useMobileNotifications>;

  // Ruta en curso
  activeRoute: ActiveRoute | null;
  startRoute: (route: RecommendedRoute) => void;
  advanceRoute: () => void;
  endRoute: () => void;

  toggleSavedEvent: (id: string) => void;
  toggleLikedEvent: (id: string) => void;
}

const AUTH_WAIT_MS = 6000;

const MobileAppContext = createContext<MobileAppContextValue | undefined>(undefined);

export function MobileAppProvider({
  children,
  initialTab = 'inicio',
}: {
  children: React.ReactNode;
  /** Sección de arranque (en la web sale de `?s=`). */
  initialTab?: MobileTab;
}) {
  const { token, isAuthenticated, isLoading: authLoading } = useAuth();
  const { userLocation, retryLocation, locationError, isLoadingLocation } =
    useUserLocationContext();
  const { prefs, update: updatePrefs, reset: resetPrefs } = useMobilePreferences();

  const [tab, setTab] = useState<MobileTab>(initialTab);
  const [overlay, setOverlay] = useState<MobileOverlay>(null);
  const [sectorPickerOpen, setSectorPickerOpen] = useState(false);
  const [mapFocus, setMapFocus] = useState<MobileAppContextValue['mapFocus']>({
    place: null,
    category: 'todo',
    nonce: 0,
  });
  const [guidePrompt, setGuidePrompt] = useState<MobileAppContextValue['guidePrompt']>(null);
  const [sectorOverride, setSectorOverride] = useState<Sector | null>(null);
  const [activeRoute, setActiveRoute] = useState<ActiveRoute | null>(null);
  const [eventDetail, setEventDetail] = useState<PlaceWithDistance | null>(null);
  const [guestDismissed, setGuestDismissed] = useState(false);
  const [accountGate, setAccountGate] = useState<GatedFeature | null>(null);
  // Si la sesión tarda demasiado en restaurarse (p. ej. sin conexión) se deja de esperar y sale la bienvenida
  const [authWaitExpired, setAuthWaitExpired] = useState(false);
  useEffect(() => {
    if (!authLoading) return;
    const timer = setTimeout(() => {
      console.warn('[MobileApp] La sesión no se resolvió en 6 s; se muestra la bienvenida');
      setAuthWaitExpired(true);
    }, AUTH_WAIT_MS);
    return () => clearTimeout(timer);
  }, [authLoading]);

  // Al iniciar sesión se olvida el "seguir como invitado": si luego cierra sesión, vuelve la bienvenida
  const [prevAuthenticated, setPrevAuthenticated] = useState(isAuthenticated);
  if (prevAuthenticated !== isAuthenticated) {
    setPrevAuthenticated(isAuthenticated);
    if (isAuthenticated) {
      setGuestDismissed(false);
      setAccountGate(null);
    }
  }

  const requireAccount = useCallback(
    (feature: GatedFeature) => {
      if (isAuthenticated) return true;
      setAccountGate(feature);
      return false;
    },
    [isAuthenticated],
  );

  const gps = useMemo<Coordinate | null>(
    () =>
      userLocation ? { latitude: userLocation.latitude, longitude: userLocation.longitude } : null,
    [userLocation],
  );

  // Con un sector elegido a mano, las distancias se calculan desde su centro
  const origin = sectorOverride?.center ?? gps ?? DEFAULT_CENTER;

  const {
    places,
    events,
    restrooms,
    sectors,
    loading,
    refresh: refreshPlaces,
  } = usePlacesData(origin, token, prefs.historyRecommendations);
  const {
    weather,
    error: weatherError,
    refresh: refreshWeather,
  } = useMobileWeather(origin.latitude, origin.longitude);
  const notifications = useMobileNotifications(token);

  const sectorName = useMemo(() => {
    if (sectorOverride) return sectorOverride.name;
    return nearestSector(sectors, origin)?.name ?? 'Valdivia';
  }, [sectorOverride, sectors, origin]);

  const recommendedRoute = useMemo(
    () =>
      buildRecommendedRoute(places, origin, {
        rhythm: prefs.rhythm,
        isRainy: weather?.isRainy ?? false,
        reducedMobility: prefs.reducedMobility,
        sectorName,
      }),
    [places, origin, prefs.rhythm, prefs.reducedMobility, weather?.isRainy, sectorName],
  );

  const openOnMap = useCallback(
    (place?: PlaceWithDistance | null, category: QuickCategory = 'todo') => {
      setMapFocus((prev) => ({ place: place ?? null, category, nonce: prev.nonce + 1 }));
      setOverlay(null);
      setEventDetail(null);
      setTab('mapa');
    },
    [],
  );

  const askGuide = useCallback(
    (question: string) => {
      if (!requireAccount('guia')) return;
      setGuidePrompt((prev) => ({ text: question, nonce: (prev?.nonce ?? 0) + 1 }));
      setOverlay(null);
      setEventDetail(null);
      setTab('guia');
    },
    [requireAccount],
  );

  const recenter = useCallback(() => {
    setSectorOverride(null);
    retryLocation();
  }, [retryLocation]);

  const startRoute = useCallback(
    (route: RecommendedRoute) => {
      if (!requireAccount('rutas')) return;
      setActiveRoute({ route, stopIndex: 0 });
      setEventDetail(null);
      setTab('rutas');
    },
    [requireAccount],
  );

  const advanceRoute = useCallback(() => {
    setActiveRoute((prev) => {
      if (!prev) return prev;
      const next = prev.stopIndex + 1;
      return next >= prev.route.stops.length ? null : { ...prev, stopIndex: next };
    });
  }, []);

  const endRoute = useCallback(() => setActiveRoute(null), []);

  const toggleSavedEvent = useCallback(
    (id: string) => {
      if (!requireAccount('guardar')) return;
      const saved = prefs.savedEventIds.includes(id)
        ? prefs.savedEventIds.filter((x) => x !== id)
        : [...prefs.savedEventIds, id];
      updatePrefs({ savedEventIds: saved });
    },
    [prefs.savedEventIds, updatePrefs, requireAccount],
  );

  const toggleLikedEvent = useCallback(
    (id: string) => {
      if (!requireAccount('meGusta')) return;
      const liked = prefs.likedEventIds.includes(id)
        ? prefs.likedEventIds.filter((x) => x !== id)
        : [...prefs.likedEventIds, id];
      updatePrefs({ likedEventIds: liked });
    },
    [prefs.likedEventIds, updatePrefs, requireAccount],
  );

  const openEvent = useCallback((event: PlaceWithDistance) => setEventDetail(event), []);
  const closeEvent = useCallback(() => setEventDetail(null), []);

  const value: MobileAppContextValue = {
    isGuest: !isAuthenticated,
    authLoading: authLoading && !authWaitExpired,
    showWelcome: shouldShowWelcome({
      authLoading,
      authWaitExpired,
      isAuthenticated,
      guestDismissed,
    }),
    continueAsGuest: () => setGuestDismissed(true),
    requireAccount,
    accountGate,
    closeAccountGate: () => setAccountGate(null),
    tab,
    setTab,
    overlay,
    setOverlay,
    sectorPickerOpen,
    setSectorPickerOpen,
    openOnMap,
    mapFocus,
    askGuide,
    guidePrompt,
    eventDetail,
    openEvent,
    closeEvent,
    prefs,
    updatePrefs,
    resetPrefs,
    textScale: TEXT_SCALE[prefs.textSize],
    origin,
    hasGps: gps !== null,
    gpsAccuracy: userLocation?.accuracy ?? null,
    gpsLoading: isLoadingLocation,
    gpsError: locationError,
    usingSectorOverride: sectorOverride !== null,
    recenter,
    sectors,
    sectorName,
    setSectorOverride,
    weather,
    weatherError,
    refreshWeather,
    refresh: () => {
      refreshWeather();
      refreshPlaces();
    },
    places,
    events,
    restrooms,
    loadingPlaces: loading,
    recommendedRoute,
    notifications,
    activeRoute,
    startRoute,
    advanceRoute,
    endRoute,
    toggleSavedEvent,
    toggleLikedEvent,
  };

  return <MobileAppContext.Provider value={value}>{children}</MobileAppContext.Provider>;
}

export function useMobileApp() {
  const ctx = useContext(MobileAppContext);
  if (!ctx) throw new Error('useMobileApp debe usarse dentro de MobileAppProvider');
  return ctx;
}
