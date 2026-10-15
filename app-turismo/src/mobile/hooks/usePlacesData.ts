import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_URL } from '../../config/api';
import { INITIAL_EVENTS } from '../../data/mockEvents';
import type { TurismoEvent } from '../../components/Map/types';
import { calculateDistance, getZoneCentroid } from '../../utils/locationUtils';
import { isEventLike, isVisitable } from '../data/categories';

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface PlaceWithDistance extends TurismoEvent {
  distanceMeters: number;
}

export interface Sector {
  id: number | string;
  name: string;
  center: Coordinate;
}

/** Centro de Valdivia: punto de partida cuando aún no hay GPS. */
export const DEFAULT_CENTER: Coordinate = { latitude: -39.8142, longitude: -73.2459 };

export const WALK_SPEED_MPS = 1.25; // ~4.5 km/h

export function formatMeters(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function walkMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / WALK_SPEED_MPS / 60));
}

const OFFLINE_PREFIX = 'app-turismo.offline-places.';

/** Guarda los lugares cercanos a un sector para usarlos sin señal. Devuelve el tamaño en bytes. */
export async function saveOfflineSnapshot(
  sectorName: string,
  items: TurismoEvent[],
): Promise<number> {
  // Sin campos pesados que la vista móvil no usa
  const slim = items.map(
    ({ polygon, catalog, galeria, markerSvg, activeUpdates, ...rest }) => rest,
  );
  const json = JSON.stringify(slim);
  await AsyncStorage.setItem(OFFLINE_PREFIX + sectorName, json);
  return json.length;
}

export async function removeOfflineSnapshot(sectorName: string): Promise<void> {
  await AsyncStorage.removeItem(OFFLINE_PREFIX + sectorName);
}

async function loadOfflineSnapshots(): Promise<TurismoEvent[]> {
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(OFFLINE_PREFIX));
  if (keys.length === 0) return [];
  const entries = await AsyncStorage.multiGet(keys);
  return entries.flatMap(([, raw]) => {
    try {
      return raw ? (JSON.parse(raw) as TurismoEvent[]) : [];
    } catch {
      return [];
    }
  });
}

async function fetchPlacesBundle(
  token: string | null,
  useHistory: boolean,
): Promise<{ remote: TurismoEvent[]; sectors: Sector[] | null }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const getJson = (url: string, init?: RequestInit) =>
    fetch(url, init)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);

  const [places, recs, zones] = await Promise.all([
    getJson(`${API_URL}/api/v1/places/search?viewMode=turismo`, { headers }),
    token && useHistory ? getJson(`${API_URL}/api/v1/recommendations`, { headers }) : null,
    getJson(`${API_URL}/api/v1/zones`),
  ]);

  // Sin respuesta del servidor: usar los sectores descargados para uso sin conexión
  const offline = places ? [] : await loadOfflineSnapshots().catch(() => []);

  const merged = new Map<string, TurismoEvent>();
  for (const item of [...(places?.results ?? []), ...offline, ...(recs?.results ?? [])]) {
    if (item?.id && typeof item.latitude === 'number') merged.set(String(item.id), item);
  }

  const sectors = Array.isArray(zones)
    ? (zones
        .map((z: { id: number | string; name?: string; geojson?: unknown }) => {
          const center = getZoneCentroid(z.geojson);
          return center && z.name ? { id: z.id, name: z.name, center } : null;
        })
        .filter(Boolean) as Sector[])
    : null;

  return { remote: [...merged.values()], sectors };
}

/**
 * Lugares, eventos y sectores para las pantallas móviles.
 * Combina el catálogo local con /api/v1/places/search y, con sesión y si el usuario lo permite,
 * /api/v1/recommendations. Sin conexión usa los sectores descargados desde el Perfil.
 */
export function usePlacesData(origin: Coordinate, token: string | null, useHistory: boolean) {
  const [remote, setRemote] = useState<TurismoEvent[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    () =>
      fetchPlacesBundle(token, useHistory).then((bundle) => {
        setRemote(bundle.remote);
        if (bundle.sectors) setSectors(bundle.sectors);
        setLoading(false);
      }),
    [token, useHistory],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Pull-to-refresh: el indicador se activa desde el gesto, no desde un efecto
  const refresh = useCallback(() => {
    setLoading(true);
    load();
  }, [load]);

  const all = useMemo<PlaceWithDistance[]>(() => {
    const byId = new Map<string, TurismoEvent>();
    for (const e of [...INITIAL_EVENTS, ...remote]) byId.set(String(e.id), e);
    return [...byId.values()]
      .filter((e) => Number.isFinite(e.latitude) && Number.isFinite(e.longitude))
      .map((e) => ({
        ...e,
        distanceMeters: calculateDistance(
          origin.latitude,
          origin.longitude,
          e.latitude,
          e.longitude,
        ),
      }))
      .sort((a, b) => a.distanceMeters - b.distanceMeters);
  }, [remote, origin.latitude, origin.longitude]);

  const places = useMemo(() => all.filter(isVisitable), [all]);

  const events = useMemo(() => {
    const live = places.filter(isEventLike);
    // Sin agenda publicada: mostramos panoramas culturales cercanos para no dejar el carrusel vacío
    return live.length > 0 ? live.slice(0, 10) : places.slice(0, 6);
  }, [places]);

  const restrooms = useMemo(() => all.filter((e) => e.category === 'bano'), [all]);

  return { all, places, events, restrooms, sectors, loading, refresh };
}

/** Sector cuyo centro está más cerca del punto dado. */
export function nearestSector(sectors: Sector[], point: Coordinate): Sector | null {
  let best: Sector | null = null;
  let bestDist = Infinity;
  for (const s of sectors) {
    const d = calculateDistance(
      point.latitude,
      point.longitude,
      s.center.latitude,
      s.center.longitude,
    );
    if (d < bestDist) {
      best = s;
      bestDist = d;
    }
  }
  return best;
}
