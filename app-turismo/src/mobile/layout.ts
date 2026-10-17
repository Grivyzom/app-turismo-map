/**
 * Layout responsive de la experiencia móvil cuando corre en la web.
 *
 * Sin imports a propósito: se prueba directo con `node --test` (ver tests/layout.test.mjs).
 */

/** Secciones de la app, en el orden del dock y del rail. */
export const SECTIONS = ['inicio', 'mapa', 'guia', 'rutas', 'perfil'] as const;
export type Section = (typeof SECTIONS)[number];

export type LayoutMode = 'compact' | 'wide';

/** Desde este ancho (solo web) el dock pasa a ser un rail lateral. */
export const WIDE_BREAKPOINT = 768;
export const SIDE_RAIL_WIDTH = 88;
/** Ancho máximo de la columna de contenido en escritorio. */
export const WIDE_CONTENT_MAX = 760;
/** Panel lateral derecho para Clima, Avisos y Evento en escritorio. */
export const SIDE_PANEL_WIDTH = 440;
/** Ancho máximo de las hojas inferiores cuando se muestran como diálogo. */
export const DIALOG_MAX_WIDTH = 480;

/** Acciones de enlaces antiguos de la web que abren herramientas del mapa. */
const LEGACY_MAP_ACTIONS = ['create_sector', 'create_route', 'create_point'];

export function layoutModeFor(platform: string, width: number): LayoutMode {
  return platform === 'web' && width >= WIDE_BREAKPOINT ? 'wide' : 'compact';
}

function first(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

/** `?s=` → sección. Ignora mayúsculas y espacios; cualquier otra cosa vuelve al Inicio. */
export function parseSection(value: unknown): Section {
  const raw = first(value);
  if (typeof raw !== 'string') return 'inicio';
  const key = raw.trim().toLowerCase();
  return (SECTIONS as readonly string[]).includes(key) ? (key as Section) : 'inicio';
}

/** Sección con la que arranca la web según la URL de entrada. */
export function initialSection(params: { s?: unknown; action?: unknown }): Section {
  if (first(params.s) !== undefined) return parseSection(params.s);
  const action = first(params.action);
  if (typeof action === 'string' && LEGACY_MAP_ACTIONS.includes(action)) return 'mapa';
  return 'inicio';
}

/** Query string con `s` actualizado, conservando el resto de los params y su orden. */
export function withSectionParam(search: string, section: Section): string {
  const params = new URLSearchParams(search);
  params.set('s', section);
  return `?${params.toString()}`;
}
