import { TurismoEvent } from '../../types';
import { buildServicePlaque } from '../../design/buildServicePlaque';

import { renderVinetaBadge } from './renderVinetaBadge';

const UNIVERSIDAD_ACCENT = '#8B5CF6';

/** Resuelve el logo institucional a partir del nombre del plantel. */
function resolveLogoFilename(title: string): string {
  const lower = (title || '').toLowerCase();
  if (lower.includes('sebastián') || lower.includes('sebastian') || lower.includes('uss')) {
    return 'logo_uss.svg';
  }
  if (lower.includes('tomas') || lower.includes('tomás') || lower.includes('ust')) {
    return 'logo_santo_tomas.svg';
  }
  if (lower.includes('inacap')) return 'logo_inacap.svg';
  return '';
}

/** Silueta de campus, reescalada para caber en la cabeza de la placa. */
function campusEmblem(isDark: boolean): string {
  const main = isDark ? '#4C51BF' : '#6366F1';
  const tower = isDark ? '#3730A3' : '#4F46E5';
  const roof = isDark ? '#312E81' : '#3730A3';
  const door = '#E9EAFE';

  return `
    <g transform="translate(32 26) scale(0.62) translate(-32 -27)">
      <path d="M12 48 L24 48 L24 28 L12 28 Z" fill="${main}" />
      <path d="M40 48 L52 48 L52 28 L40 28 Z" fill="${main}" />
      <path d="M24 48 L40 48 L40 16 L24 16 Z" fill="${tower}" />
      <path d="M10 28 L24 22 L24 28 Z" fill="${roof}" />
      <path d="M54 28 L40 22 L40 28 Z" fill="${roof}" />
      <path d="M22 16 L32 6 L42 16 Z" fill="${roof}" />
      <circle cx="32" cy="24" r="4" fill="#F8FAFC" />
      <path d="M32 24 L32 21.4 M32 24 L34.2 24" stroke="#312E81" stroke-width="1.3" stroke-linecap="round" />
      <path d="M28 48 L36 48 L36 38 Q32 34 28 38 Z" fill="${door}" />
      <rect x="15" y="32" width="6" height="8" rx="0.8" fill="${door}" />
      <rect x="43" y="32" width="6" height="8" rx="0.8" fill="${door}" />
    </g>
  `;
}

export function renderUniversityMarker(
  pinEl: HTMLDivElement,
  event: TurismoEvent,
  isSelected: boolean,
  mapLayer: string,
) {
  pinEl.innerHTML = '';
  const isDark = mapLayer === 'dark' || mapLayer === 'satellite';
  const logoFilename = resolveLogoFilename(event.title);

  let emblem = '';
  let overlayHtml: string | undefined;

  if (logoFilename) {
    const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8080';
    const logoUrl = `${baseUrl}/assets/svg/${logoFilename}`;
    // El logo va como capa HTML sobre la placa, centrado en la cabeza:
    // (32, 26) del viewBox de 64 ⇒ (20 px, 16.25 px) en un marcador de 40 px.
    overlayHtml = `
      <div style="position:absolute;top:7.25px;left:11px;width:18px;height:18px;display:flex;align-items:center;justify-content:center;pointer-events:none;">
        <img src="${logoUrl}" alt="" style="width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 1px 1px rgba(15,23,42,0.25));" />
      </div>
    `;
  } else {
    emblem = campusEmblem(isDark);
  }

  const container = buildServicePlaque({
    className: 'marker-university-container',
    emblem,
    accent: UNIVERSIDAD_ACCENT,
    isSelected,
    isDark,
    ambient: 'orbit',
    overlayHtml,
  });
  pinEl.appendChild(container);

  if (event.vineta) {
    renderVinetaBadge(container, event.vineta);
  }
}
