// ─────────────────────────────────────────────────────────────────────────────
// Estilo de la capa de contexto natural (agua / humedal / parque).
//
// Jerarquía visual: estas áreas son FONDO. Deben leerse por debajo de calles,
// edificios, etiquetas y sobre todo de los pines. Por eso:
//   • tinte plano y translúcido, sin patrones (los fill-pattern SVG competían
//     con los pines, generaban "zipper" en pitch y costaban un pase extra),
//   • el agua no se rellena: el mapa base ya la pinta; sólo se resalta al
//     seleccionarla,
//   • aparecen recién a escala de barrio (z≈13) y se atenúan a escala de
//     calle (z≥17), donde mandan los pines,
//   • el contorno sólo existe para el área seleccionada / parque activo.
// ─────────────────────────────────────────────────────────────────────────────
import type { MapLayer } from '../types';
import type { NatureAreaCategory } from '../../../data/natureAreas';

export interface NatureAreaPalette {
  color: Record<NatureAreaCategory, string>;
  /** Opacidad de reposo por categoría (0 = sólo hit-area / resaltado). */
  restOpacity: Record<NatureAreaCategory, number>;
  selectedOpacity: number;
}

const LIGHT: NatureAreaPalette = {
  color: { agua: '#2563EB', humedal: '#6B8F5E', parque: '#16A34A' },
  restOpacity: { agua: 0, humedal: 0.14, parque: 0.1 },
  selectedOpacity: 0.24,
};

const DARK: NatureAreaPalette = {
  color: { agua: '#60A5FA', humedal: '#7FA06F', parque: '#34D399' },
  restOpacity: { agua: 0, humedal: 0.12, parque: 0.08 },
  selectedOpacity: 0.22,
};

// Sobre imagen satelital la vegetación y el agua ya se ven; un tinte sólo ensucia.
const SATELLITE: NatureAreaPalette = {
  color: { agua: '#93C5FD', humedal: '#BEF264', parque: '#86EFAC' },
  restOpacity: { agua: 0, humedal: 0, parque: 0 },
  selectedOpacity: 0.2,
};

export const getNatureAreaPalette = (mapLayer?: MapLayer | string): NatureAreaPalette => {
  if (mapLayer === 'satellite' || mapLayer === 'google3d') return SATELLITE;
  if (mapLayer === 'dark') return DARK;
  return LIGHT;
};

/** Zoom desde el que aparece el tinte (debajo sólo se ve el mapa base). */
export const NATURE_AREA_MIN_ZOOM = 13;
/** Zoom a partir del cual se atenúa para ceder protagonismo a los pines. */
export const NATURE_AREA_FADE_ZOOM = 17;
export const NATURE_AREA_FADE_FACTOR = 0.6;
export const NATURE_AREA_OUTLINE_WIDTH = 2;

/** Hex #RRGGBB + opacidad 0..1 → #RRGGBBAA (react-native-maps). */
export const withAlpha = (hex: string, opacity: number): string =>
  `${hex}${Math.round(Math.max(0, Math.min(1, opacity)) * 255)
    .toString(16)
    .padStart(2, '0')}`;
