import { useState } from 'react';

import type { TurismoEvent } from '../../components/Map/types';
import type { UserLocation } from '../../hooks/useUserLocation';
import { calculateDistance } from '../../utils/locationUtils';

/**
 * El mapa móvil vive en un WebView: cada vez que cambia una prop, TODAS se
 * serializan a JSON y cruzan el puente, y el mapa vuelve a diferenciar sus
 * pines. Estos hooks evitan esos envíos cuando el cambio no se ve en el mapa.
 */

/** Movimiento mínimo (m) para reenviar la ubicación: el GPS tiene jitter de varios metros. */
const MIN_MOVE_M = 4;
/** Giro mínimo (°) para reenviar el rumbo del cono de dirección. */
const MIN_HEADING_DEG = 12;
/** Cambio mínimo (m) en la precisión para reenviar el círculo de precisión. */
const MIN_ACCURACY_DELTA_M = 5;

function headingDelta(a: number | null, b: number | null): number {
  if (a == null || b == null) return a === b ? 0 : 360;
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function locationChanged(prev: UserLocation | null, next: UserLocation | null): boolean {
  if (prev === next) return false;
  if (!prev || !next) return true;
  const moved = calculateDistance(prev.latitude, prev.longitude, next.latitude, next.longitude);
  const accuracyDelta = Math.abs((prev.accuracy ?? 0) - (next.accuracy ?? 0));
  return (
    moved >= MIN_MOVE_M ||
    headingDelta(prev.heading, next.heading) >= MIN_HEADING_DEG ||
    accuracyDelta >= MIN_ACCURACY_DELTA_M
  );
}

/** Ubicación para el mapa que sólo cambia de identidad con un movimiento visible. */
export function useStableMapLocation(location: UserLocation | null): UserLocation | null {
  const [stable, setStable] = useState(location);
  if (locationChanged(stable, location)) {
    setStable(location);
    return location;
  }
  return stable;
}

/** Igualdad superficial ignorando `distanceMeters`, que cambia con cada lectura del GPS. */
function sameForMap(a: TurismoEvent, b: TurismoEvent): boolean {
  if (a === b) return true;
  const ka = Object.keys(a) as (keyof TurismoEvent)[];
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if ((k as string) === 'distanceMeters') continue;
    if (a[k] !== b[k]) return false;
  }
  return true;
}

/**
 * Devuelve el mismo array mientras los lugares sean los mismos para el mapa.
 * Las distancias (y el orden por cercanía) se recalculan con cada lectura del
 * GPS y generan objetos nuevos aunque ningún pin se haya movido.
 */
export function useStableMapEvents<T extends TurismoEvent>(events: T[]): T[] {
  const [stable, setStable] = useState(events);
  if (stable !== events && !sameEventsForMap(stable, events)) {
    setStable(events);
    return events;
  }
  return stable;
}

function sameEventsForMap(prev: TurismoEvent[], next: TurismoEvent[]): boolean {
  if (prev.length !== next.length) return false;
  const byId = new Map(prev.map((p) => [p.id, p]));
  return next.every((e) => {
    const p = byId.get(e.id);
    return p !== undefined && sameForMap(p, e);
  });
}
