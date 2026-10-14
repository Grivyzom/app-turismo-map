import { useEffect, useState } from 'react';

import { fetchOsrmRoute, OsrmRoute } from '../utils/osrmService';
import { formatWalkLabel } from '../utils/contextualRanking';

interface LatLng {
  latitude: number;
  longitude: number;
}

export interface WalkPreview {
  route: OsrmRoute | null;
  /** "🚶 7 min (520 m por Calle X)" o null mientras carga / sin GPS. */
  label: string | null;
  loading: boolean;
}

const EMPTY: WalkPreview = { route: null, label: null, loading: false };

/**
 * Ruta peatonal real (OSRM) usuario → destino, calculada en cuanto se abre la Peek Card.
 * Nunca usa distancia en línea recta: si falla o no hay GPS, no hay etiqueta.
 */
export function useWalkPreview(origin: LatLng | null | undefined, dest: LatLng | null | undefined): WalkPreview {
  const [state, setState] = useState<WalkPreview>(EMPTY);

  const oLat = origin?.latitude;
  const oLng = origin?.longitude;
  const dLat = dest?.latitude;
  const dLng = dest?.longitude;

  useEffect(() => {
    if (oLat == null || oLng == null || dLat == null || dLng == null) {
      setState(EMPTY);
      return;
    }
    let cancelled = false;
    setState({ route: null, label: null, loading: true });
    fetchOsrmRoute(oLat, oLng, dLat, dLng, 'foot')
      .then((route) => {
        if (cancelled) return;
        const via = route.steps.reduce<{ name: string; d: number }>(
          (best, s) => (s.streetName && s.distance > best.d ? { name: s.streetName, d: s.distance } : best),
          { name: '', d: 0 },
        ).name;
        setState({
          route,
          label: formatWalkLabel(route.duration / 60, route.distance, via || undefined),
          loading: false,
        });
      })
      .catch(() => {
        if (!cancelled) setState(EMPTY);
      });
    return () => {
      cancelled = true;
    };
    // Redondeo ~11 m para no recalcular en cada tick del GPS
  }, [oLat?.toFixed(4), oLng?.toFixed(4), dLat, dLng]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}
