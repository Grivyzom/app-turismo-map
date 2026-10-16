import type { TurismoEvent } from '../../components/Map/types';

/** Utilidades de presentación para la ficha "Acerca del evento". */

function parseDate(iso?: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function hhmm(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "Hoy", "Mañana" o "Sábado 18 de octubre". */
export function dayLabel(d: Date, now = new Date()) {
  if (sameDay(d, now)) return 'Hoy';
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (sameDay(d, tomorrow)) return 'Mañana';
  return capitalize(
    d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' }),
  );
}

export interface EventWhen {
  /** Día ("Hoy", "Sábado 18 de octubre") o el horario libre del evento. */
  primary: string;
  /** Rango horario ("19:00 – 23:00") u horario de atención. */
  secondary?: string;
  start: Date | null;
  end: Date | null;
}

export function eventWhen(e: TurismoEvent, now = new Date()): EventWhen {
  const start = parseDate(e.startTime);
  const end = parseDate(e.endTime);
  if (start) {
    let secondary = hhmm(start);
    if (end) {
      secondary = sameDay(start, end)
        ? `${hhmm(start)} – ${hhmm(end)}`
        : `${hhmm(start)} · hasta ${dayLabel(end, now).toLowerCase()} ${hhmm(end)}`;
    }
    return { primary: dayLabel(start, now), secondary, start, end };
  }
  return {
    primary: e.time?.trim() || 'Horario por confirmar',
    secondary: e.openingHours && e.openingHours !== e.time ? e.openingHours : undefined,
    start: null,
    end: null,
  };
}

export type LiveStatus = 'en_curso' | 'pronto' | 'agendado' | 'finalizado';

export interface EventStatus {
  key: LiveStatus;
  label: string;
}

function untilLabel(ms: number) {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `Empieza en ${minutes} min`;
  return `Empieza en ${Math.round(minutes / 60)} h`;
}

/** Estado según las fechas reales; si no hay fechas, el `status` publicado. */
export function eventStatus(e: TurismoEvent, now = new Date()): EventStatus | null {
  const { start, end } = eventWhen(e, now);
  if (start) {
    const t = now.getTime();
    if (end && t > end.getTime()) return { key: 'finalizado', label: 'Finalizado' };
    if (t >= start.getTime()) return { key: 'en_curso', label: 'En curso' };
    const until = start.getTime() - t;
    if (until < 24 * 3600_000) return { key: 'pronto', label: untilLabel(until) };
    return { key: 'agendado', label: 'Agendado' };
  }
  switch (e.status) {
    case 'en_proceso':
      return { key: 'en_curso', label: 'En curso' };
    case 'agendado':
      return { key: 'agendado', label: 'Agendado' };
    case 'finalizado':
      return { key: 'finalizado', label: 'Finalizado' };
    default:
      return null;
  }
}

/** Duración legible ("3 h", "1 h 30 min") si el evento tiene inicio y término. */
export function eventDuration(e: TurismoEvent): string | null {
  const { start, end } = eventWhen(e);
  if (!start || !end) return null;
  const minutes = Math.round((end.getTime() - start.getTime()) / 60_000);
  if (minutes <= 0) return null;
  if (minutes >= 48 * 60) return `${Math.round(minutes / 1440)} días`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function formatCLP(amount: number) {
  return `$${Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

export interface EventPrice {
  label: string;
  free: boolean;
  /** false cuando el organizador no informó el valor. */
  known: boolean;
}

export function eventPrice(e: TurismoEvent): EventPrice {
  if (e.priceLabel?.trim()) return { label: e.priceLabel.trim(), free: e.price === 0, known: true };
  if (e.price === 0) return { label: 'Gratis', free: true, known: true };
  if (typeof e.price === 'number' && e.price > 0)
    return { label: formatCLP(e.price), free: false, known: true };
  return { label: 'Por confirmar', free: false, known: false };
}

/** URL navegable para un usuario de Instagram/Facebook escrito como "@usuario" o como enlace. */
export function socialUrl(network: 'instagram' | 'facebook', value: string) {
  const v = value.trim();
  if (/^https?:\/\//.test(v)) return v;
  const handle = v.replace(/^@/, '');
  return network === 'instagram'
    ? `https://instagram.com/${handle}`
    : `https://facebook.com/${handle}`;
}

export function webUrl(value: string) {
  const v = value.trim();
  return /^https?:\/\//.test(v) ? v : `https://${v}`;
}
