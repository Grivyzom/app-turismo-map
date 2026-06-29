import { TurismoEvent } from '../../types';
import { renderVinetaBadge } from './renderVinetaBadge';

export function renderBomberoMarker(
  pinEl: HTMLDivElement,
  event: TurismoEvent,
  isSelected: boolean,
  mapLayer: string,
) {
  pinEl.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'marker-bombero-container';
  Object.assign(container.style, {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
    transform: isSelected ? 'scale(1.2)' : 'scale(1)',
    transformOrigin: 'bottom center',
    filter: isSelected
      ? 'drop-shadow(0px 8px 12px rgba(0,0,0,0.3))'
      : 'drop-shadow(0px 4px 6px rgba(0,0,0,0.2))',
  });

  container.innerHTML = `
    <svg width="40" height="40" viewBox="0 0 64 64">
      <ellipse cx="32" cy="54" rx="20" ry="6" fill="rgba(0,0,0,0.2)" />
      <path d="M32 6 C21 6 12 15 12 26 C12 40 32 58 32 58 C32 58 52 40 52 26 C52 15 43 6 32 6 Z" fill="#FFFFFF" stroke="#CBD5E0" stroke-width="1.5" />
      <path d="M32 12 Q29 16 29 20 Q29 24 32 25 Q35 24 35 20 Q35 16 32 12 Z" fill="#E53E3E" />
      <path d="M32 14 Q30 17 30 20 Q30 22 32 23 Q34 22 34 20 Q34 17 32 14 Z" fill="#F97316" />
    </svg>
  `;
  pinEl.appendChild(container);

  if (event.vineta) {
    renderVinetaBadge(container, event.vineta);
  }
}
