import { Platform } from 'react-native';

/**
 * Tokens de la vista móvil nativa (Android / iOS).
 *
 * Sigue el wireframe "Guía": superficies claras, tarjetas blancas muy redondeadas
 * sobre un fondo gris suave y un único acento casi negro para acciones primarias.
 * Todo color de la vista móvil sale de aquí para poder re-tematizar en un solo lugar.
 */
export const MobileColors = {
  background: '#EFEFEF',
  surface: '#FFFFFF',
  surfaceMuted: '#F2F2F2',
  surfaceSunken: '#E6E6E6',
  placeholder: '#E3E3E3',
  border: '#E2E2E2',
  borderStrong: '#CFCFCF',
  text: '#141414',
  textSecondary: '#6B6B6B',
  textMuted: '#9A9A9A',
  accent: '#141414',
  onAccent: '#FFFFFF',
  danger: '#C62828',
  /** Punto de "hay novedades" (mismo rojo que el badge de la web). */
  badge: '#FF4D4F',
  /** Oscurecimiento detrás de hojas y modales; se aplica con un fundido, nunca de golpe. */
  scrim: 'rgba(20,20,20,0.42)',
  mapLand: '#E4E4E4',
  mapRoad: '#CDD3D4',
} as const;

export const MobileRadii = {
  card: 24,
  inner: 16,
  button: 14,
  pill: 999,
} as const;

export const MobileSpacing = {
  screen: 16,
  gap: 12,
  cardPadding: 16,
} as const;

/** Duraciones de las transiciones (ms): entrar un poco más lento que salir. */
export const MobileMotion = {
  enter: 260,
  exit: 200,
} as const;

/** Escala de texto; se multiplica por la preferencia de accesibilidad "Tamaño del texto". */
export const MobileFont = {
  caption: 12,
  small: 13,
  body: 15,
  title: 17,
  headline: 22,
  display: 64,
} as const;

/** Altura visual del dock inferior (sin contar el inset del sistema). */
export const TAB_BAR_HEIGHT = 64;

export const cardShadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  android: { elevation: 1 },
  default: {},
}) as object;

export const dockShadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  android: { elevation: 10 },
  default: {},
}) as object;
