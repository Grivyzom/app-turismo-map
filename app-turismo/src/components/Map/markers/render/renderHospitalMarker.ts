import { TurismoEvent } from '../../types';
import { renderVinetaBadge } from './renderVinetaBadge';

export function renderHospitalMarker(
  pinEl: HTMLDivElement,
  event: TurismoEvent,
  isSelected: boolean,
  mapLayer: string,
) {
  pinEl.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'marker-hospital-container';
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
      <rect x="28.5" y="18" width="7" height="18" fill="#DC2626" rx="1" />
      <rect x="21" y="25.5" width="22" height="7" fill="#DC2626" rx="1" />
      <circle cx="32" cy="29.5" r="12" fill="none" stroke="#FEE2E2" stroke-width="0.5" />
    </svg>
  `;
  pinEl.appendChild(container);

  if (event.vineta) {
    renderVinetaBadge(container, event.vineta);
  }
}

export function renderClinicaMarker(
  pinEl: HTMLDivElement,
  event: TurismoEvent,
  isSelected: boolean,
  mapLayer: string,
) {
  pinEl.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'marker-clinica-container';
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
      <rect x="28.5" y="18" width="7" height="18" fill="#F87171" rx="1" />
      <rect x="21" y="25.5" width="22" height="7" fill="#F87171" rx="1" />
      <circle cx="32" cy="29.5" r="11" fill="none" stroke="#FECACA" stroke-width="0.8" />
    </svg>
  `;
  pinEl.appendChild(container);

  if (event.vineta) {
    renderVinetaBadge(container, event.vineta);
  }
}
