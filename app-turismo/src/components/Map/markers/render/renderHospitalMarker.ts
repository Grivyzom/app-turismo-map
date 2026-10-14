import { TurismoEvent } from '../../types';
import { buildServicePlaque } from '../../design/buildServicePlaque';

import { renderVinetaBadge } from './renderVinetaBadge';

const HOSPITAL_ACCENT = '#DC2626';
const CLINICA_ACCENT = '#F87171';

/** Cruz médica centrada en la cabeza de la placa (viewBox 0 0 64 64). */
function medicalCross(color: string, scale = 1): string {
  const vW = 7 * scale;
  const vH = 18 * scale;
  const hW = 18 * scale;
  const hH = 7 * scale;
  return `
    <rect x="${32 - vW / 2}" y="${26 - vH / 2}" width="${vW}" height="${vH}" rx="1.6" fill="${color}" />
    <rect x="${32 - hW / 2}" y="${26 - hH / 2}" width="${hW}" height="${hH}" rx="1.6" fill="${color}" />
    <rect x="${32 - vW / 2}" y="${26 - vH / 2}" width="${vW}" height="${vH * 0.32}" rx="1.6" fill="rgba(255,255,255,0.28)" />
  `;
}

export function renderHospitalMarker(
  pinEl: HTMLDivElement,
  event: TurismoEvent,
  isSelected: boolean,
  mapLayer: string,
) {
  pinEl.innerHTML = '';
  const container = buildServicePlaque({
    className: 'marker-hospital-container',
    emblem: medicalCross(HOSPITAL_ACCENT),
    accent: HOSPITAL_ACCENT,
    isSelected,
    isDark: mapLayer === 'dark' || mapLayer === 'satellite',
    ambient: 'vital',
  });
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
  // La clínica es la hermana menor del hospital: misma placa, cruz más
  // ligera y un anillo que la diferencia sin cambiar de familia visual.
  const container = buildServicePlaque({
    className: 'marker-clinica-container',
    emblem: `
      <circle cx="32" cy="26" r="12.4" fill="none" stroke="${CLINICA_ACCENT}" stroke-width="1.6" opacity="0.55" />
      ${medicalCross(CLINICA_ACCENT, 0.82)}
    `,
    accent: CLINICA_ACCENT,
    isSelected,
    isDark: mapLayer === 'dark' || mapLayer === 'satellite',
    ambient: 'vital',
  });
  pinEl.appendChild(container);

  if (event.vineta) {
    renderVinetaBadge(container, event.vineta);
  }
}
