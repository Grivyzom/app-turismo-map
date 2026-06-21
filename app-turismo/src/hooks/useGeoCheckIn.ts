import { useState, useCallback, useEffect, useRef } from 'react';

import { TurismoEvent } from '../components/Map/types';
import {
  CheckInRecord,
  CHECKIN_EXCLUDED_CATEGORIES,
  getCheckInPoints,
  hasCheckedIn,
  loadCheckIns,
  saveCheckIn,
} from '../utils/checkInStorage';
import { getCategoryIcon } from '../utils/mapUtils';

import { UserLocation } from './useUserLocation';

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Radio mínimo de check-in en metros */
const CHECK_IN_RADIUS_DEFAULT = 300;

/** Tolerancia extra por imprecisión de GPS en dispositivos móviles */
const GPS_TOLERANCE_METERS = 80;

// ─── Haversine (reutilizada de useUserLocation) ───────────────────────────────

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Tipos de resultado ───────────────────────────────────────────────────────

export type CheckInResult =
  | 'success'
  | 'too_far'
  | 'no_location'
  | 'already_done'
  | 'excluded_category'
  | 'error';

export interface UseGeoCheckInReturn {
  /** true si el usuario ya realizó check-in en el evento activo */
  isCheckedIn: boolean;
  /** true mientras se valida la ubicación */
  isProcessing: boolean;
  /** Mensaje de error descriptivo, o null */
  checkInError: string | null;
  /** Distancia en metros al evento activo, o null si no hay ubicación */
  distanceMeters: number | null;
  /** Radio efectivo de check-in en metros (incluyendo tolerancia) */
  effectiveRadius: number;
  /** Todos los check-ins del usuario (cache en memoria) */
  checkIns: CheckInRecord[];
  /** Intenta hacer check-in en el evento dado */
  attemptCheckIn: (
    event: TurismoEvent,
    userLocation: UserLocation | null,
  ) => Promise<CheckInResult>;
  /** Recarga los check-ins desde storage */
  reloadCheckIns: () => Promise<void>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGeoCheckIn(
  selectedEvent: TurismoEvent | null,
  userLocation: UserLocation | null,
): UseGeoCheckInReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([]);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const isMounted = useRef(true);

  // ── Carga inicial de check-ins desde storage ──────────────────────────────
  const reloadCheckIns = useCallback(async () => {
    const records = await loadCheckIns();
    if (!isMounted.current) return;
    setCheckIns(records);
  }, []);

  useEffect(() => {
    isMounted.current = true;
    reloadCheckIns();
    return () => {
      isMounted.current = false;
    };
  }, [reloadCheckIns]);

  // ── Detectar si el evento actual ya fue visitado ──────────────────────────
  useEffect(() => {
    if (!selectedEvent) {
      setIsCheckedIn(false);
      setCheckInError(null);
      return;
    }

    const found = checkIns.some((r) => r.eventId === selectedEvent.id);
    setIsCheckedIn(found);
    setCheckInError(null);
  }, [selectedEvent, checkIns]);

  // ── Distancia en tiempo real al evento activo ─────────────────────────────
  const distanceMeters = (() => {
    if (!selectedEvent || !userLocation) return null;
    return Math.round(
      haversineDistance(
        userLocation.latitude,
        userLocation.longitude,
        selectedEvent.latitude,
        selectedEvent.longitude,
      ),
    );
  })();

  // ── Radio efectivo del evento ─────────────────────────────────────────────
  const effectiveRadius = selectedEvent
    ? Math.max(selectedEvent.radius ?? CHECK_IN_RADIUS_DEFAULT, CHECK_IN_RADIUS_DEFAULT) +
      GPS_TOLERANCE_METERS
    : CHECK_IN_RADIUS_DEFAULT + GPS_TOLERANCE_METERS;

  // ── Función principal de check-in ─────────────────────────────────────────
  const attemptCheckIn = useCallback(
    async (event: TurismoEvent, location: UserLocation | null): Promise<CheckInResult> => {
      setCheckInError(null);

      // 1. Verificar categoría excluida (alertas de emergencia)
      if (CHECKIN_EXCLUDED_CATEGORIES.has(event.category)) {
        return 'excluded_category';
      }

      // 2. Verificar si ya hizo check-in
      const alreadyDone = await hasCheckedIn(event.id);
      if (alreadyDone) {
        setIsCheckedIn(true);
        return 'already_done';
      }

      // 3. Verificar ubicación disponible
      if (!location) {
        setCheckInError('No se pudo obtener tu ubicación. Activa el GPS e intenta de nuevo.');
        return 'no_location';
      }

      setIsProcessing(true);

      try {
        // 4. Calcular distancia
        const distance = haversineDistance(
          location.latitude,
          location.longitude,
          event.latitude,
          event.longitude,
        );

        const radius =
          Math.max(event.radius ?? CHECK_IN_RADIUS_DEFAULT, CHECK_IN_RADIUS_DEFAULT) +
          GPS_TOLERANCE_METERS;

        // 5. Validar proximidad
        if (distance > radius) {
          const remaining = Math.round(distance - radius + GPS_TOLERANCE_METERS);
          setCheckInError(
            `Estás a ${Math.round(distance)}m del lugar. Acércate ${remaining}m más para el check-in.`,
          );
          return 'too_far';
        }

        // 6. ✅ Check-in exitoso → guardar registro
        const record: CheckInRecord = {
          eventId: event.id,
          eventTitle: event.title,
          category: event.category,
          latitude: event.latitude,
          longitude: event.longitude,
          checkedInAt: new Date().toISOString(),
          pointsEarned: getCheckInPoints(event.category),
          icon: getCategoryIcon(event.category, event.musicStyle),
        };

        await saveCheckIn(record);

        if (isMounted.current) {
          setCheckIns((prev) => [record, ...prev]);
          setIsCheckedIn(true);
        }

        return 'success';
      } catch {
        setCheckInError('Ocurrió un error al procesar el check-in. Intenta de nuevo.');
        return 'error';
      } finally {
        if (isMounted.current) setIsProcessing(false);
      }
    },
    [],
  );

  return {
    isCheckedIn,
    isProcessing,
    checkInError,
    distanceMeters,
    effectiveRadius,
    checkIns,
    attemptCheckIn,
    reloadCheckIns,
  };
}
