import { TurismoEvent } from '../../types';
import { hexToRgba } from '../../utils/markerHelpers';

export function renderFlatMarker(
  flatEl: HTMLDivElement,
  event: TurismoEvent,
  color: string,
  isEmergencyState: boolean,
) {
  flatEl.innerHTML = '';
  const categoryLower = event.category?.toLowerCase() || '';
  if (
    categoryLower === 'parque' ||
    categoryLower === 'reserva' ||
    categoryLower === 'reservas' ||
    categoryLower === 'naturaleza'
  ) {
    flatEl.style.width = '0px';
    flatEl.style.height = '0px';
    flatEl.style.pointerEvents = 'none';
    return;
  }
  const container = document.createElement('div');
  container.className = 'marker-flat-container';
  Object.assign(container.style, {
    position: 'absolute',
    width: '0px',
    height: '0px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transformOrigin: 'center center',
  });

  // 1. Realistic 3D Shadow Container
  const shadowContainer = document.createElement('div');
  shadowContainer.className = 'marker-3d-shadow-container';
  Object.assign(shadowContainer.style, {
    position: 'absolute',
    bottom: '0px',
    display: 'flex',
    flexDirection: 'column-reverse',
    alignItems: 'center',
    justifyContent: 'flex-start',
    pointerEvents: 'none',
    zIndex: '0',
    transformOrigin: 'bottom center',
  });

  const shadowStem = document.createElement('div');
  shadowStem.className = 'marker-3d-shadow-stem';
  Object.assign(shadowStem.style, {
    width: '2px',
    height: '0px',
    background: `linear-gradient(to top, rgba(0,0,0,0.8) 0%, ${color} 100%)`,
    boxShadow: `0 0 4px ${hexToRgba(color, 0.6)}`,
    transformOrigin: 'bottom center',
  });
  shadowContainer.appendChild(shadowStem);

  const shadowPin = document.createElement('div');
  shadowPin.className = 'marker-3d-shadow-pin';
  Object.assign(shadowPin.style, {
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    filter: 'blur(1.5px)',
  });
  shadowContainer.appendChild(shadowPin);

  container.appendChild(shadowContainer);

  // 1b. Puncture point
  const puncture = document.createElement('div');
  puncture.className = 'marker-3d-puncture';
  Object.assign(puncture.style, {
    position: 'absolute',
    top: '-2px',
    left: '-2px',
    width: '4px',
    height: '4px',
    borderRadius: '50%',
    backgroundColor: '#111827',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    boxShadow: '0 0 2px rgba(0,0,0,0.8) inset',
    opacity: '0.8',
    zIndex: '2',
  });
  container.appendChild(puncture);

  // 2. Flat Waves (Ondas redimensionadas y centradas)
  if (event.category === 'publico' && !isEmergencyState) {
    const wave1 = document.createElement('div');
    Object.assign(wave1.style, {
      position: 'absolute',
      top: '-12px',
      left: '-12px',
      width: '24px',
      height: '24px',
      borderRadius: '50%',
      backgroundColor: color,
      animation: 'webPublicPulse 2.5s infinite ease-out',
      pointerEvents: 'none',
      zIndex: '-1',
    });
    const maxScale = 1.2 + (Math.min(event.attendeesCount || 0, 1000) / 1000) * 0.8;
    wave1.style.setProperty('--max-scale', String(maxScale));

    const wave2 = document.createElement('div');
    Object.assign(wave2.style, {
      position: 'absolute',
      top: '-12px',
      left: '-12px',
      width: '24px',
      height: '24px',
      borderRadius: '50%',
      backgroundColor: color,
      animation: 'webPublicPulse 2.5s infinite ease-out',
      animationDelay: '1.25s',
      pointerEvents: 'none',
      zIndex: '-1',
    });
    wave2.style.setProperty('--max-scale', String(maxScale * 0.7));

    container.appendChild(wave1);
    container.appendChild(wave2);
  }

  // 3. Flat Rotating Security Cordon
  if (isEmergencyState) {
    const cordon = document.createElement('div');
    Object.assign(cordon.style, {
      position: 'absolute',
      top: '-22px',
      left: '-22px',
      width: '44px',
      height: '44px',
      borderRadius: '50%',
      border: `2.5px dashed ${color}`,
      backgroundColor: `${color}10`,
      animation:
        'emergencyPerimeterRotate 16s linear infinite, emergencyPerimeterFlash 2s infinite ease-in-out',
      pointerEvents: 'none',
      zIndex: '-1',
    });
    container.appendChild(cordon);
  }

  // 4. Social Proof
  if (event.attendeesCount && event.attendeesCount > 200 && !isEmergencyState) {
    const popularAura = document.createElement('div');
    Object.assign(popularAura.style, {
      position: 'absolute',
      top: '-14px',
      left: '-14px',
      width: '28px',
      height: '28px',
      borderRadius: '50%',
      border: '2px solid #FCD34D',
      boxShadow: '0 0 12px #FCD34D',
      animation: 'popularAuraPulse 3s infinite ease-out',
      pointerEvents: 'none',
      zIndex: '-2',
    });
    container.appendChild(popularAura);
  }

  flatEl.appendChild(container);
}
