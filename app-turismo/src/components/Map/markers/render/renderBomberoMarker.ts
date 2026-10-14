import { TurismoEvent } from '../../types';
import { buildServicePlaque } from '../../design/buildServicePlaque';

import { renderVinetaBadge } from './renderVinetaBadge';

const BOMBERO_ACCENT = '#E53E3E';

export function renderBomberoMarker(
  pinEl: HTMLDivElement,
  event: TurismoEvent,
  isSelected: boolean,
  mapLayer: string,
) {
  pinEl.innerHTML = '';

  // Llama a dos tonos: silueta roja + núcleo ámbar, centrada en (32, 26).
  const emblem = `
    <path
      d="M32 13.6 C27.4 19.4 25.8 22.6 25.8 26.4 C25.8 31 28.6 34.2 32 35.8 C35.4 34.2 38.2 31 38.2 26.4 C38.2 22.6 36.6 19.4 32 13.6 Z"
      fill="${BOMBERO_ACCENT}"
    />
    <path
      d="M32 20.4 C29.6 23.6 28.9 25.5 28.9 27.6 C28.9 30.1 30.3 31.8 32 32.6 C33.7 31.8 35.1 30.1 35.1 27.6 C35.1 25.5 34.4 23.6 32 20.4 Z"
      fill="#F97316"
    />
    <path
      d="M32 25.4 C30.9 27.1 30.6 28.1 30.6 29.1 C30.6 30.3 31.2 31.1 32 31.5 C32.8 31.1 33.4 30.3 33.4 29.1 C33.4 28.1 33.1 27.1 32 25.4 Z"
      fill="#FDE68A"
    />
  `;

  const container = buildServicePlaque({
    className: 'marker-bombero-container',
    emblem,
    accent: BOMBERO_ACCENT,
    isSelected,
    isDark: mapLayer === 'dark' || mapLayer === 'satellite',
    ambient: 'ember',
  });
  pinEl.appendChild(container);

  if (event.vineta) {
    renderVinetaBadge(container, event.vineta);
  }
}
