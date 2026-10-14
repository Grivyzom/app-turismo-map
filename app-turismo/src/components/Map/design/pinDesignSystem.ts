/**
 * ─── Pin Design System ──────────────────────────────────────────────────
 *
 * Fuente única de verdad del lenguaje visual de los pines del mapa.
 *
 * El sistema se apoya en tres ejes de lectura, en este orden de prioridad
 * (así es como el ojo desambigua un mapa denso):
 *
 *   1. SILUETA  → qué clase de cosa es
 *        · disc     (círculo, cuerpo oscuro)  → evento / algo que ocurre
 *        · droplet  (gota clásica, perlada)   → lugar / comercio permanente
 *        · shield   (escudo, perlado)         → institución / patrimonio
 *        · diamond  (rombo, color sólido)     → emergencia / alerta
 *        · plaque   (SVG dedicado)            → servicios (salud, orden, U.)
 *        · lens / sprite                      → cámara, fauna, embarcación
 *
 *   2. ACABADO  → temporalidad
 *        · glass  (vidrio oscuro)  = temporal, sucede ahora
 *        · pearl  (blanco perlado) = permanente, siempre está
 *        · solid  (color pleno)    = urgente
 *
 *   3. COLOR + ICONO → subcategoría concreta
 *
 * Y un cuarto eje de comportamiento, no visual pero sí de interacción:
 *   · preview 'mini'   → hover abre mini-modal in-situ
 *   · preview 'radial' → hover abre menú radial (info/guardar/ruta)
 *   · click 'full'     → abre la ficha extensa
 *   · click 'toggle'   → fija/suelta el mini-modal
 */

import { getCategoryColor, getCategoryIcon } from '../../../utils/mapUtils';
import { TurismoEvent } from '../types';

export type PinShape = 'disc' | 'droplet' | 'shield' | 'diamond' | 'plaque' | 'lens' | 'sprite';
export type PinFinish = 'glass' | 'pearl' | 'solid';
export type PinFamily =
  | 'evento'
  | 'lugar'
  | 'institucion'
  | 'servicio'
  | 'emergencia'
  | 'natura'
  | 'vigilancia'
  | 'movil';

/** Animación ambiental permanente del pin (la que corre sin interacción). */
export type PinAmbient =
  | 'sonar' // ondas expansivas concéntricas (afluencia)
  | 'halo' // respiración de halo suave
  | 'sheen' // barrido especular sobre el cuerpo
  | 'alert' // cordón + onda de choque urgente
  | 'radar' // barrido cónico (cámaras)
  | 'float' // flotación orgánica (naturaleza)
  | 'orbit' // satélite orbitando (academia/cultura)
  | 'vital' // doble latido (salud)
  | 'ember' // parpadeo de brasa (bomberos)
  | 'strobe' // estrobo bicolor (carabineros)
  | 'none';

export type PinPreview = 'mini' | 'radial';
export type PinClick = 'full' | 'toggle';

export interface PinDesign {
  category: string;
  family: PinFamily;
  shape: PinShape;
  finish: PinFinish;
  /** Lado del cuerpo en px. */
  size: number;
  iconSize: number;
  /** Rotación del cuerpo, en grados (el icono se contrarrota). */
  bodyRotate: number;
  borderRadius: string;
  accent: string;
  accentSoft: string;
  accentDeep: string;
  bodyBackground: string;
  rimColor: string;
  iconColor: string;
  iconName: string;
  ambient: PinAmbient;
  /** 0..1 — modula opacidades/escalas de la animación ambiental. */
  intensity: number;
  preview: PinPreview;
  click: PinClick;
  /** Prioridad de apilamiento base (mayor = más al frente). */
  priority: number;
}

// ─── Color helpers ────────────────────────────────────────────────────────

function parseHex(hex: string): [number, number, number] {
  if (!hex || hex[0] !== '#') return [59, 130, 246];
  const full = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
  return [
    parseInt(full.slice(1, 3), 16) || 0,
    parseInt(full.slice(3, 5), 16) || 0,
    parseInt(full.slice(5, 7), 16) || 0,
  ];
}

const toHex = (v: number) =>
  Math.max(0, Math.min(255, Math.round(v)))
    .toString(16)
    .padStart(2, '0');

/** Mezcla `hex` con blanco (`amount` > 0) o negro (`amount` < 0). */
export function shade(hex: string, amount: number): string {
  const [r, g, b] = parseHex(hex);
  const target = amount >= 0 ? 255 : 0;
  const t = Math.abs(amount);
  return `#${toHex(r + (target - r) * t)}${toHex(g + (target - g) * t)}${toHex(b + (target - b) * t)}`;
}

export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Luminancia relativa aproximada (0 = negro, 1 = blanco). */
export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

// ─── Taxonomía ────────────────────────────────────────────────────────────

export const EMERGENCY_CATEGORIES = ['choque', 'incendio', 'accidente', 'calle_cortada'];

/** Categorías cuyo hover abre un mini-modal in-situ en vez del menú radial. */
export const MINI_MODAL_CATEGORIES = [
  'tienda',
  'gastronomia',
  'fauna',
  'hospital',
  'clinica',
  'universidad',
  'bombero',
  'carabinero',
  'camara',
];

/** Categorías cuyo click fija el mini-modal en vez de abrir la ficha extensa. */
export const TOGGLE_CLICK_CATEGORIES = [
  'hospital',
  'clinica',
  'universidad',
  'bombero',
  'carabinero',
  'camara',
  'fauna',
];

/** Categorías dibujadas como polígono/zona: no llevan pin propio. */
export const PINLESS_CATEGORIES = ['parque', 'reserva', 'reservas', 'naturaleza'];

/** Categorías con renderer SVG dedicado (no pasan por renderPinMarker). */
export const CUSTOM_RENDERER_CATEGORIES = [
  'hospital',
  'clinica',
  'universidad',
  'bombero',
  'carabinero',
  'camara',
  'fauna',
  'embarcacion',
  'banca',
  'silla',
  'basurero',
  'papelera',
  'maquina_ejercicio',
  'ejercicio',
];

/** Categorías de utilidad y mobiliario urbano que tienen comportamiento cinematográfico sin hover */
export const UTILITY_CATEGORIES = [
  'papelera',
  'basurero',
  'banca',
  'silla',
  'maquina_ejercicio',
  'ejercicio',
  'bebedero',
  'bano',
];

export const isUtilityCategory = (category?: string) =>
  UTILITY_CATEGORIES.includes((category || '').toLowerCase());

/** Categorías de mobiliario urbano y servicios básicos que NO deben abrir ningún modal informativo al hacer click */
export const NO_MODAL_CATEGORIES = [
  'banca',
  'banco',
  'silla',
  'basurero',
  'papelera',
  'waste_basket',
  'bebedero',
  'fuente',
  'fuente_agua',
  'drinking_water',
];

export const isNoModalCategory = (category?: string): boolean =>
  NO_MODAL_CATEGORIES.includes((category || '').toLowerCase());

export const isEmergencyCategory = (category?: string) =>
  EMERGENCY_CATEGORIES.includes((category || '').toLowerCase());

export const isMiniModalCategory = (category?: string) =>
  MINI_MODAL_CATEGORIES.includes((category || '').toLowerCase());

export const isToggleClickCategory = (category?: string) =>
  TOGGLE_CLICK_CATEGORIES.includes((category || '').toLowerCase());

export const isPinlessCategory = (category?: string) =>
  PINLESS_CATEGORIES.includes((category || '').toLowerCase());

interface FamilySpec {
  family: PinFamily;
  shape: PinShape;
  finish: PinFinish;
  size: number;
  ambient: PinAmbient;
  priority: number;
}

const FAMILY_SPEC: Record<PinFamily, FamilySpec> = {
  evento: {
    family: 'evento',
    shape: 'disc',
    finish: 'glass',
    size: 28,
    ambient: 'halo',
    priority: 30,
  },
  lugar: {
    family: 'lugar',
    shape: 'droplet',
    finish: 'pearl',
    size: 30,
    ambient: 'sheen',
    priority: 20,
  },
  institucion: {
    family: 'institucion',
    shape: 'shield',
    finish: 'pearl',
    size: 28,
    ambient: 'none',
    priority: 20,
  },
  servicio: {
    family: 'servicio',
    shape: 'plaque',
    finish: 'pearl',
    size: 40,
    ambient: 'none',
    priority: 40,
  },
  emergencia: {
    family: 'emergencia',
    shape: 'diamond',
    finish: 'solid',
    size: 30,
    ambient: 'alert',
    priority: 60,
  },
  natura: {
    family: 'natura',
    shape: 'disc',
    finish: 'glass',
    size: 26,
    ambient: 'float',
    priority: 15,
  },
  vigilancia: {
    family: 'vigilancia',
    shape: 'lens',
    finish: 'solid',
    size: 24,
    ambient: 'radar',
    priority: 10,
  },
  movil: {
    family: 'movil',
    shape: 'sprite',
    finish: 'solid',
    size: 28,
    ambient: 'none',
    priority: 10,
  },
};

const CATEGORY_FAMILY: Record<string, PinFamily> = {
  // Eventos — algo que ocurre en un momento
  publico: 'evento',
  musica: 'evento',
  cultura: 'evento',
  deportes: 'evento',
  teatro: 'evento',
  mercado: 'evento',
  new_item: 'evento',
  invitation_club: 'evento',
  invitation_sports: 'evento',
  new_spot: 'evento',
  // Lugares / comercio — permanentes, de a pie
  tienda: 'lugar',
  gastronomia: 'lugar',
  supermercado: 'lugar',
  estatua: 'lugar',
  escultura: 'lugar',
  arte: 'lugar',
  // Instituciones / patrimonio
  museo: 'institucion',
  coliseo: 'institucion',
  puerto: 'institucion',
  torreon: 'institucion',
  edificio: 'institucion',
  municipalidad: 'institucion',
  // Servicios con renderer propio
  hospital: 'servicio',
  clinica: 'servicio',
  bombero: 'servicio',
  carabinero: 'servicio',
  universidad: 'servicio',
  // Emergencias
  choque: 'emergencia',
  incendio: 'emergencia',
  accidente: 'emergencia',
  calle_cortada: 'emergencia',
  // Naturaleza
  agua: 'natura',
  humedal: 'natura',
  bosque: 'natura',
  fauna: 'natura',
  // Otros
  camara: 'vigilancia',
  embarcacion: 'movil',
  banca: 'servicio',
  silla: 'servicio',
  maquina_ejercicio: 'servicio',
  ejercicio: 'servicio',
  bebedero: 'servicio',
  bano: 'servicio',
  basurero: 'servicio',
  papelera: 'servicio',
};

/** Ajustes finos por categoría sobre el spec de familia. */
const CATEGORY_OVERRIDE: Record<string, Partial<FamilySpec> & { intensity?: number }> = {
  maquina_ejercicio: { size: 28, ambient: 'none', priority: 12 },
  ejercicio: { size: 28, ambient: 'none', priority: 12 },
  banca: { size: 28, ambient: 'none', priority: 10 },
  silla: { size: 28, ambient: 'none', priority: 10 },
  basurero: { size: 28, ambient: 'none', priority: 8 },
  papelera: { size: 28, ambient: 'none', priority: 8 },
  bebedero: { size: 28, ambient: 'sonar', intensity: 0.8, priority: 15 },
  bano: { size: 30, ambient: 'halo', intensity: 0.6, priority: 20 },
  publico: { size: 30, ambient: 'sonar', intensity: 0.9, priority: 45 },
  musica: { ambient: 'sonar', intensity: 0.55, priority: 40 },
  cultura: { ambient: 'orbit', intensity: 0.6 },
  teatro: { ambient: 'orbit', intensity: 0.5 },
  deportes: { ambient: 'halo', intensity: 0.7 },
  tienda: { intensity: 0.7 },
  gastronomia: { intensity: 0.7 },
  supermercado: { intensity: 0.55 },
  estatua: { size: 26, ambient: 'none' },
  escultura: { size: 26, ambient: 'none' },
  arte: { size: 26, ambient: 'sheen', intensity: 0.5 },
  museo: { size: 30, ambient: 'sheen', intensity: 0.4 },
  municipalidad: { size: 30 },
  fauna: { shape: 'sprite', size: 48, ambient: 'float', intensity: 0.8 },
  agua: { ambient: 'float', intensity: 0.6 },
  humedal: { ambient: 'float', intensity: 0.5 },
  bosque: { ambient: 'float', intensity: 0.45 },
  hospital: { ambient: 'vital', intensity: 0.85 },
  clinica: { ambient: 'vital', intensity: 0.55 },
  bombero: { ambient: 'ember', intensity: 0.85 },
  carabinero: { ambient: 'strobe', intensity: 0.8 },
  universidad: { ambient: 'orbit', intensity: 0.6 },
  camara: { intensity: 0.75 },
  incendio: { intensity: 1 },
  choque: { intensity: 0.95 },
  accidente: { intensity: 0.95 },
  calle_cortada: { intensity: 0.6, ambient: 'halo' },
};

const BORDER_RADIUS: Record<PinShape, string> = {
  disc: '50%',
  // Gota: esquina viva abajo-izquierda + rotación -45° ⇒ punta al suelo.
  droplet: '50% 50% 50% 3px',
  shield: '34% 34% 46% 46% / 30% 30% 62% 62%',
  diamond: '7px',
  plaque: '9px',
  lens: '50%',
  sprite: '0',
};

const BODY_ROTATE: Record<PinShape, number> = {
  disc: 0,
  droplet: -45,
  shield: 0,
  diamond: 45,
  plaque: 0,
  lens: 0,
  sprite: 0,
};

/**
 * Resuelve el diseño completo de un pin.
 *
 * `mapLayer` sólo afecta al contraste del cuerpo: sobre capas oscuras el
 * vidrio se aclara un punto y el borde gana alfa, para que el pin no se
 * funda con el mapa.
 */
export function getPinDesign(
  event: Pick<TurismoEvent, 'category' | 'musicStyle'> & {
    attendeesCount?: number;
    ambient?: TurismoEvent['ambient'];
    shape?: TurismoEvent['shape'];
    finish?: TurismoEvent['finish'];
    customColor?: string;
  },
  mapLayer = 'dark',
): PinDesign {
  const category = (event.category || '').toLowerCase();
  const family = CATEGORY_FAMILY[category] || 'evento';
  const override = CATEGORY_OVERRIDE[category] || {};
  const spec = { ...FAMILY_SPEC[family], ...override };

  // Permite sobreescribir silueta, acabado y animación ambiental a nivel de evento individual
  if (event.shape) spec.shape = event.shape;
  if (event.finish) spec.finish = event.finish;
  if (event.ambient) spec.ambient = event.ambient;

  const accent = event.customColor || getCategoryColor(event.category, event.musicStyle);
  const accentSoft = shade(accent, 0.28);
  const accentDeep = shade(accent, -0.3);
  const isDarkBasemap = mapLayer === 'dark' || mapLayer === 'satellite';

  let bodyBackground: string;
  let iconColor: string;
  let rimColor: string;

  const lum = luminance(accent);

  if (spec.finish === 'pearl') {
    // Perla: blanco cálido con degradado sutil y borde teñido del acento.
    // Los acentos claros se oscurecen o no se leerían sobre el cuerpo blanco.
    bodyBackground = 'linear-gradient(160deg, #FFFFFF 0%, #F7F8FB 55%, #E8ECF3 100%)';
    iconColor = lum > 0.6 ? accentDeep : accent;
    rimColor = withAlpha(accentDeep, 0.55);
  } else if (spec.finish === 'solid') {
    bodyBackground = `linear-gradient(160deg, ${accentSoft} 0%, ${accent} 52%, ${accentDeep} 100%)`;
    iconColor = '#FFFFFF';
    rimColor = 'rgba(9, 12, 20, 0.85)';
  } else {
    // Vidrio: obsidiana translúcida; se aclara un punto sobre mapas oscuros.
    const top = isDarkBasemap ? 'rgba(32, 42, 62, 0.92)' : 'rgba(17, 24, 39, 0.9)';
    const bottom = isDarkBasemap ? 'rgba(14, 20, 32, 0.94)' : 'rgba(7, 11, 20, 0.92)';
    bodyBackground = `linear-gradient(160deg, ${top} 0%, ${bottom} 100%)`;
    // Sobre obsidiana, los acentos apagados (marrón humedal, gris edificio,
    // azul medio) desaparecen: se levantan proporcionalmente a lo oscuros
    // que sean, sin tocar los que ya contrastan.
    iconColor = lum < 0.58 ? shade(accent, Math.min(0.62, (0.6 - lum) * 1.35)) : accent;
    rimColor = withAlpha(accent, isDarkBasemap ? 0.85 : 0.68);
  }

  const iconSize =
    spec.shape === 'diamond' ? Math.round(spec.size * 0.46) : Math.round(spec.size * 0.52);

  return {
    category,
    family: spec.family,
    shape: spec.shape,
    finish: spec.finish,
    size: spec.size,
    iconSize,
    bodyRotate: BODY_ROTATE[spec.shape],
    borderRadius: BORDER_RADIUS[spec.shape],
    accent,
    accentSoft,
    accentDeep,
    bodyBackground,
    rimColor,
    iconColor,
    iconName: getCategoryIcon(event.category, event.musicStyle),
    ambient: spec.ambient,
    intensity: override.intensity ?? 0.6,
    preview: isMiniModalCategory(category) ? 'mini' : 'radial',
    click: isToggleClickCategory(category) ? 'toggle' : 'full',
    priority: spec.priority,
  };
}

/**
 * Escala máxima de la onda expansiva. Crece con la afluencia, pero con
 * rendimientos decrecientes para que un evento de 5.000 personas no tape
 * medio mapa.
 */
export function getSonarScale(attendeesCount = 0, intensity = 1): number {
  const normalized = Math.min(attendeesCount, 2000) / 2000;
  const eased = Math.sqrt(normalized); // decrecimiento suave
  return 1.9 + eased * 1.5 * intensity;
}
