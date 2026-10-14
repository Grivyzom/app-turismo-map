import { Platform } from 'react-native';

/**
 * 🌲 Selva Glass Design System Tokens
 * Diseñado exclusivamente para ValdiTurismo SaaS.
 * 
 * Evoca la identidad de la Selva Valdiviana:
 * - Esmeraldas profundos y follaje húmedo.
 * - Bruma fluvial y reflejos de ríos (Calle-Calle, Cruces, Valdivia).
 * - Superficies de cristal carbón-musgo translúcido con blur de alta densidad.
 */
const surfaceColors = {
  glassDark: 'rgba(12, 19, 18, 0.75)',       // Fondo base unificado para todas las islas
  glassDarkHover: 'rgba(18, 29, 27, 0.85)',
  glassDeep: 'rgba(9, 14, 13, 0.95)',        // Paneles densos, modales y dropdowns
  activeItem: 'rgba(16, 185, 129, 0.16)',    // Estado activo unificado para todos los botones
  activeItemHover: 'rgba(16, 185, 129, 0.24)',
} as const;

const borderColors = {
  subtle: 'rgba(255, 255, 255, 0.10)',
  medium: 'rgba(255, 255, 255, 0.16)',
  hover: 'rgba(255, 255, 255, 0.25)',
  active: 'rgba(52, 211, 153, 0.35)',
  focus: '#10B981',
  accentGlow: 'rgba(110, 231, 183, 0.3)',
} as const;

const brandColors = {
  emerald: '#10B981',                       // Verde Selva / Acento primario
  emeraldLight: '#34D399',                  // Esmeralda iluminado / Iconos activos
  riverMist: '#38BDF8',                     // Azul Fluvial / Lluvia y telemetría
  alerceGold: '#F59E0B',                    // Acento Turístico / Madera de Alerce
  notroRed: '#EF4444',                      // Alertas / Notificaciones
  badgeBg: 'rgba(239, 68, 68, 0.14)',
} as const;

const textColors = {
  primary: '#F8FAFC',                       // Blanco puro / Alto contraste
  secondary: '#94A3B8',                     // Gris claro / Iconos inactivos
  muted: '#64748B',                         // Gris medio
  inactive: '#A3A3A3',
  accent: '#34D399',
} as const;

const dividerColor = 'rgba(255, 255, 255, 0.10)';

export const SelvaTokens = {
  colors: {
    surface: surfaceColors,
    border: borderColors,
    brand: brandColors,
    text: textColors,
    divider: dividerColor,
  },
  // Accesos directos convenientes garantizados
  brand: brandColors,
  surface: surfaceColors,
  border: borderColors,
  text: textColors,

  radii: {
    island: 22,                                 // Radio estándar para todas las islas flotantes
    card: 16,                                   // Sub-tarjetas internas
    button: 12,                                 // Botones interiores de islas y dock
    pill: 9999,                                 // Cápsulas y tags
  },

  layout: {
    buttonSizeDesktop: 36,                      // Tamaño uniforme en escritorio
    buttonSizeMobile: 44,                       // Cumplimiento estricto WCAG en móvil (mínimo 44px)
    iconSizeDesktop: 18,
    iconSizeMobile: 22,
  },

  elevation: {
    glassShadow: Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
      web: {
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.25)',
      },
    }) as any,
  },
} as const;
