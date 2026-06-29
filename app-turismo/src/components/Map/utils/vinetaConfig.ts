import { VinetaType } from '../types';

// ─── Viñeta (Badge) Configuration ─────────────────────────────────────────────
export const VINETA_CONFIG: Record<
  VinetaType,
  {
    bg: string;
    glow: string;
    iconName: string; // SVG icon name matching SVG_ICON_PATHS
    defaultLabel: string;
  }
> = {
  en_vivo: {
    bg: 'linear-gradient(135deg, #EF4444 0%, #A855F7 100%)',
    glow: 'rgba(239, 68, 68, 0.7)',
    iconName: 'videocam',
    defaultLabel: 'LIVE',
  },
  agendado: {
    bg: 'linear-gradient(135deg, #F97316 0%, #38BDF8 100%)',
    glow: 'rgba(249, 115, 22, 0.6)',
    iconName: 'event',
    defaultLabel: 'Agendado',
  },
  calificacion: {
    bg: 'linear-gradient(135deg, #F59E0B 0%, #EAB308 100%)',
    glow: 'rgba(245, 158, 11, 0.6)',
    iconName: 'star',
    defaultLabel: '★',
  },
  oferta: {
    bg: 'linear-gradient(135deg, #3B82F6 0%, #EC4899 100%)',
    glow: 'rgba(59, 130, 246, 0.6)',
    iconName: 'local_offer',
    defaultLabel: 'Oferta',
  },
  aforo: {
    bg: 'linear-gradient(135deg, #14B8A6 0%, #06B6D4 100%)',
    glow: 'rgba(20, 184, 166, 0.6)',
    iconName: 'groups',
    defaultLabel: 'Aforo',
  },
  disponibilidad: {
    bg: 'linear-gradient(135deg, #34D399 0%, #6EE7B7 100%)',
    glow: 'rgba(52, 211, 153, 0.6)',
    iconName: 'person',
    defaultLabel: 'Disp.',
  },
  mantenimiento: {
    bg: 'linear-gradient(135deg, #22D3EE 0%, #67E8F9 100%)',
    glow: 'rgba(34, 211, 238, 0.6)',
    iconName: 'build',
    defaultLabel: 'Mant.',
  },
};
