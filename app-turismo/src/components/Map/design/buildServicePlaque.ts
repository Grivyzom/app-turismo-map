import { withAlpha } from './pinDesignSystem';

let plaqueSeq = 0;

export type PlaqueAmbient = 'vital' | 'ember' | 'strobe' | 'orbit' | 'none';

export interface ServicePlaqueOptions {
  /** Clase del contenedor, p.ej. `marker-hospital-container`. */
  className: string;
  /** Fragmento SVG del emblema, en coordenadas del viewBox 0 0 64 64. */
  emblem: string;
  /** Color institucional; tiñe borde, chip interior y ambiental. */
  accent: string;
  isSelected: boolean;
  isDark: boolean;
  /** Lado del marcador en px (por defecto 40). */
  size?: number;
  ambient?: PlaqueAmbient;
  /** HTML extra posicionado sobre la placa (p.ej. el logo de una universidad). */
  overlayHtml?: string;
}

/**
 * Placa de servicio: la gota blanca "oficial" que usan salud, orden público
 * y educación.
 *
 * Todas comparten cuerpo, borde, reflejo y sombra de contacto — sólo cambian
 * el emblema, el color institucional y la animación ambiental. Eso hace que
 * se lean como una misma clase de cosa (un servicio) y a la vez se distingan
 * entre sí de un vistazo.
 */
export function buildServicePlaque(options: ServicePlaqueOptions): HTMLDivElement {
  const {
    className,
    emblem,
    accent,
    isSelected,
    isDark,
    size = 40,
    ambient = 'none',
    overlayHtml,
  } = options;

  const uid = `plq${plaqueSeq++}`;
  const container = document.createElement('div');
  container.className = className;
  Object.assign(container.style, {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: `${size}px`,
    height: `${size}px`,
    transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.3s ease',
    transform: isSelected ? 'scale(1.18)' : 'scale(1)',
    transformOrigin: 'bottom center',
    filter: isSelected
      ? `drop-shadow(0 8px 14px rgba(2,6,14,0.4)) drop-shadow(0 0 10px ${withAlpha(accent, 0.55)})`
      : 'drop-shadow(0 4px 8px rgba(2,6,14,0.26))',
  });

  const rim = isSelected ? accent : withAlpha(accent, isDark ? 0.55 : 0.4);
  const rimWidth = isSelected ? 2 : 1.5;

  container.innerHTML = `
    <svg width="${size}" height="${size}" viewBox="0 0 64 64" style="position:absolute;top:0;left:0;overflow:visible;">
      <defs>
        <linearGradient id="${uid}-body" x1="0.2" y1="0" x2="0.65" y2="1">
          <stop offset="0%" stop-color="#FFFFFF" />
          <stop offset="52%" stop-color="#F6F8FC" />
          <stop offset="100%" stop-color="#E2E8F1" />
        </linearGradient>
        <radialGradient id="${uid}-chip" cx="0.34" cy="0.28" r="0.82">
          <stop offset="0%" stop-color="${withAlpha(accent, 0.2)}" />
          <stop offset="100%" stop-color="${withAlpha(accent, 0.04)}" />
        </radialGradient>
        <radialGradient id="${uid}-ground" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stop-color="rgba(0,0,0,${isDark ? 0.4 : 0.3})" />
          <stop offset="65%" stop-color="rgba(0,0,0,${isDark ? 0.18 : 0.12})" />
          <stop offset="100%" stop-color="rgba(0,0,0,0)" />
        </radialGradient>
      </defs>

      <ellipse cx="32" cy="56" rx="13" ry="3.6" fill="url(#${uid}-ground)" />

      <path
        d="M32 6 C21 6 12 15 12 26 C12 40 32 58 32 58 C32 58 52 40 52 26 C52 15 43 6 32 6 Z"
        fill="url(#${uid}-body)"
        stroke="${rim}"
        stroke-width="${rimWidth}"
        stroke-linejoin="round"
      />

      <circle cx="32" cy="26" r="14.6" fill="url(#${uid}-chip)" />

      <path
        d="M19.8 20.5 A 16 16 0 0 1 33 10.4"
        fill="none"
        stroke="rgba(255,255,255,0.95)"
        stroke-width="2.6"
        stroke-linecap="round"
        opacity="0.85"
      />

      ${emblem}
    </svg>
    ${overlayHtml || ''}
  `;

  appendPlaqueAmbient(container, ambient, accent, size);

  return container;
}

/**
 * Capa ambiental de la placa. Se ancla al centro de la cabeza de la gota
 * (y = 26 de 64 ⇒ ~41 % de la altura), no al centro del cuadro.
 */
function appendPlaqueAmbient(
  container: HTMLDivElement,
  ambient: PlaqueAmbient,
  accent: string,
  size: number,
) {
  if (ambient === 'none') return;

  const headTop = '41%';
  const add = (className: string, vars: Record<string, string>) => {
    const el = document.createElement('div');
    el.className = `${className} pin-ambient`;
    el.style.top = headTop;
    el.style.zIndex = '-1';
    Object.entries(vars).forEach(([k, v]) => el.style.setProperty(k, v));
    container.appendChild(el);
    return el;
  };

  switch (ambient) {
    case 'vital':
      add('pin-vital', {
        '--vital-size': `${Math.round(size * 1.15)}px`,
        '--vital-color': withAlpha(accent, 0.5),
      });
      break;
    case 'ember':
      add('pin-ember', { '--ember-size': `${Math.round(size * 1.15)}px` });
      break;
    case 'strobe':
      add('pin-strobe pin-strobe-a', { '--strobe-size': `${Math.round(size * 1.1)}px` });
      add('pin-strobe pin-strobe-b', { '--strobe-size': `${Math.round(size * 1.1)}px` });
      break;
    case 'orbit': {
      const orbit = document.createElement('div');
      orbit.className = 'pin-orbit pin-ambient';
      orbit.style.top = headTop;
      orbit.style.zIndex = '-1';
      orbit.style.setProperty('--orbit-size', `${Math.round(size * 0.86)}px`);
      orbit.style.setProperty('--orbit-color', accent);
      orbit.style.setProperty('--orbit-duration', '7.5s');
      const dot = document.createElement('div');
      dot.className = 'pin-orbit-dot';
      orbit.appendChild(dot);
      container.appendChild(orbit);
      break;
    }
    default:
      break;
  }
}
