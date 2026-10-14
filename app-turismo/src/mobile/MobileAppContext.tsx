import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { useUserLocationContext } from '../context/UserLocationContext';

import { buildRecommendedRoute, RecommendedRoute } from './data/routes';
import { QuickCategory } from './data/categories';
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

export type MobileTab = 'inicio' | 'mapa' | 'guia' | 'rutas' | 'perfil';
export type MobileOverlay = 'clima' | null;

export interface ActiveRoute {
  route: RecommendedRoute;
  stopIndex: number;
}

interface MobileAppContextValue {
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

  // Preferencias
  prefs: MobilePreferences;
  updatePrefs: (patch: Partial<MobilePreferences>) => void;
  resetPrefs: () => Promise<void>;
  textScale: number;

  // Ubicación y sector
  origin: Coordinate;
  hasGps: boolean;
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

  // Ruta en curso
  activeRoute: ActiveRoute | null;
  startRoute: (route: RecommendedRoute) => void;
  advanceRoute: () => void;
  endRoute: () => void;

  toggleSavedEvent: (id: string) => void;
}

const MobileAppContext = createContext<MobileAppContextValue | undefined>(undefined);

export function MobileAppProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const { userLocation, retryLocation } = useUserLocationContext();
  const { prefs, update: updatePrefs, reset: resetPrefs } = useMobilePreferences();

  const [tab, setTab] = useState<MobileTab>('inicio');
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
      setTab('mapa');
    },
    [],
  );

  const askGuide = useCallback((question: string) => {
    setGuidePrompt((prev) => ({ text: question, nonce: (prev?.nonce ?? 0) + 1 }));
    setOverlay(null);
    setTab('guia');
  }, []);

  const recenter = useCallback(() => {
    setSectorOverride(null);
    retryLocation();
  }, [retryLocation]);

  const startRoute = useCallback((route: RecommendedRoute) => {
    setActiveRoute({ route, stopIndex: 0 });
    setTab('rutas');
  }, []);

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
      const saved = prefs.savedEventIds.includes(id)
        ? prefs.savedEventIds.filter((x) => x !== id)
        : [...prefs.savedEventIds, id];
      updatePrefs({ savedEventIds: saved });
    },
    [prefs.savedEventIds, updatePrefs],
  );

  const value: MobileAppContextValue = {
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
    prefs,
    updatePrefs,
    resetPrefs,
    textScale: TEXT_SCALE[prefs.textSize],
    origin,
    hasGps: gps !== null,
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
    activeRoute,
    startRoute,
    advanceRoute,
    endRoute,
    toggleSavedEvent,
  };

  return <MobileAppContext.Provider value={value}>{children}</MobileAppContext.Provider>;
}

export function useMobileApp() {
  const ctx = useContext(MobileAppContext);
  if (!ctx) throw new Error('useMobileApp debe usarse dentro de MobileAppProvider');
  return ctx;
}
