import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CHECKIN_STORAGE_KEY = 'app-turismo.geo-checkins';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface CheckInRecord {
  eventId: string;
  eventTitle: string;
  category: string;
  latitude: number;
  longitude: number;
  checkedInAt: string; // ISO timestamp
  pointsEarned: number;
  /** Ícono MaterialIcons representativo de la categoría */
  icon: string;
}

// ─── Puntos XP por categoría ──────────────────────────────────────────────────

export const CHECKIN_POINTS: Record<string, number> = {
  naturaleza: 150,
  cultura: 120,
  gastronomia: 100,
  musica: 110,
  deportes: 130,
  publico: 80,
};

/** Categorías que NO participan del sistema de check-in / sellos */
export const CHECKIN_EXCLUDED_CATEGORIES = new Set([
  'choque',
  'incendio',
  'accidente',
  'calle_cortada',
]);

/** XP para una categoría. Devuelve 0 si está excluida. */
export function getCheckInPoints(category: string): number {
  if (CHECKIN_EXCLUDED_CATEGORIES.has(category)) return 0;
  return CHECKIN_POINTS[category] ?? 80;
}

// ─── Lectura ──────────────────────────────────────────────────────────────────

export async function loadCheckIns(): Promise<CheckInRecord[]> {
  try {
    let raw: string | null = null;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      raw = window.localStorage.getItem(CHECKIN_STORAGE_KEY);
    } else {
      raw = await AsyncStorage.getItem(CHECKIN_STORAGE_KEY);
    }

    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ─── Escritura ────────────────────────────────────────────────────────────────

export async function saveCheckIn(record: CheckInRecord): Promise<void> {
  try {
    const existing = await loadCheckIns();

    // Evitar duplicados
    const alreadyExists = existing.some((r) => r.eventId === record.eventId);
    if (alreadyExists) return;

    const updated = [record, ...existing];
    const serialized = JSON.stringify(updated);

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.setItem(CHECKIN_STORAGE_KEY, serialized);
    } else {
      await AsyncStorage.setItem(CHECKIN_STORAGE_KEY, serialized);
    }
  } catch {
    // Storage silently fails — estado local sigue siendo válido
  }
}

// ─── Consulta ─────────────────────────────────────────────────────────────────

export async function hasCheckedIn(eventId: string): Promise<boolean> {
  const existing = await loadCheckIns();
  return existing.some((r) => r.eventId === eventId);
}

/** Versión síncrona para consultas rápidas usando un cache en memoria */
export function hasCheckedInSync(eventId: string, cache: CheckInRecord[]): boolean {
  return cache.some((r) => r.eventId === eventId);
}

// ─── Limpieza ─────────────────────────────────────────────────────────────────

export async function clearCheckIns(): Promise<void> {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.removeItem(CHECKIN_STORAGE_KEY);
    } else {
      await AsyncStorage.removeItem(CHECKIN_STORAGE_KEY);
    }
  } catch {
    // Ignore
  }
}
