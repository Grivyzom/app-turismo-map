import { TurismoEvent } from '../../types';
import { renderVinetaBadge } from './renderVinetaBadge';

export function renderUniversityMarker(
  pinEl: HTMLDivElement,
  event: TurismoEvent,
  isSelected: boolean,
  mapLayer: string,
) {
  pinEl.innerHTML = '';
  const isDark = mapLayer === 'dark' || mapLayer === 'satellite';
  const container = document.createElement('div');
  container.className = 'marker-university-container';
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

  const lowerTitle = (event.title || '').toLowerCase();
  let logoFilename = '';
  if (
    lowerTitle.includes('sebastián') ||
    lowerTitle.includes('sebastian') ||
    lowerTitle.includes('uss')
  ) {
    logoFilename = 'logo_uss.svg';
  } else if (
    lowerTitle.includes('tomas') ||
    lowerTitle.includes('tomás') ||
    lowerTitle.includes('ust')
  ) {
    logoFilename = 'logo_santo_tomas.svg';
  } else if (lowerTitle.includes('inacap')) {
    logoFilename = 'logo_inacap.svg';
  }

  if (logoFilename) {
    const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8080';
    const logoUrl = `${baseUrl}/assets/svg/${logoFilename}`;
    container.innerHTML = `
      <svg width="40" height="40" viewBox="0 0 64 64" style="position: absolute; top: 0; left: 0;">
        <!-- Shadow -->
        <ellipse cx="32" cy="54" rx="20" ry="6" fill="${isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.1)'}" />
        
        <!-- Pin shape with white background -->
        <path 
          d="M32 6 C21 6 12 15 12 26 C12 40 32 58 32 58 C32 58 52 40 52 26 C52 15 43 6 32 6 Z" 
          fill="#FFFFFF" 
          stroke="#CBD5E0" 
          stroke-width="1.5" 
        />
      </svg>
      <div style="position: absolute; top: 7.5px; left: 11.25px; width: 17.5px; height: 17.5px; display: flex; align-items: center; justify-content: center;">
        <img src="${logoUrl}" style="width: 100%; height: 100%; object-fit: contain;" />
      </div>
    `;
  } else {
    const svgColorMain = isDark ? '#2B6CB0' : '#4299E1';
    const svgColorTower = isDark ? '#2A4365' : '#3182CE';
    const svgColorRoof = isDark ? '#1A365D' : '#2B6CB0';
    const svgColorDoor = isDark ? '#E2E8F0' : '#E2E8F0';
    const svgColorClockStroke = '#2D3748';

    container.innerHTML = `
      <svg width="40" height="40" viewBox="0 0 64 64">
        <path d="M12 48 L24 48 L24 28 L12 28 Z" fill="${svgColorMain}" />
        <path d="M40 48 L52 48 L52 28 L40 28 Z" fill="${svgColorMain}" />
        <path d="M24 48 L40 48 L40 16 L24 16 Z" fill="${svgColorTower}" />
        <path d="M10 28 L24 22 L24 28 Z" fill="${svgColorRoof}" />
        <path d="M54 28 L40 22 L40 28 Z" fill="${svgColorRoof}" />
        <path d="M22 16 L32 6 L42 16 Z" fill="${svgColorRoof}" />
        <ellipse cx="32" cy="24" rx="4" ry="4" fill="#E2E8F0" />
        <path d="M32 24 L32 22 M32 24 L34 24" stroke="${svgColorClockStroke}" stroke-width="1" />
        <path d="M28 48 L36 48 L36 38 Q32 34 28 38 Z" fill="${svgColorDoor}" />
        <rect x="15" y="32" width="6" height="8" fill="${svgColorDoor}" />
        <rect x="43" y="32" width="6" height="8" fill="${svgColorDoor}" />
      </svg>
    `;
  }
  pinEl.appendChild(container);

  if (event.vineta) {
    renderVinetaBadge(container, event.vineta);
  }
}
