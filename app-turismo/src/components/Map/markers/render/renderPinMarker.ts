import { TurismoEvent, Vineta } from '../../types';
import { getCategoryColor } from '../../../../utils/mapUtils';
import { hexToRgba } from '../../utils/markerHelpers';
import { createSvgIcon } from '../../utils/svgIcons';
import { renderVinetaBadge } from './renderVinetaBadge';

export function renderPinMarker(
  pinEl: HTMLDivElement,
  event: TurismoEvent,
  color: string,
  iconName: string,
  isEmergencyState: boolean,
  isSelected: boolean,
) {
  pinEl.innerHTML = '';
  const categoryLower = event.category?.toLowerCase() || '';
  if (
    categoryLower === 'parque' ||
    categoryLower === 'reserva' ||
    categoryLower === 'reservas' ||
    categoryLower === 'naturaleza'
  ) {
    pinEl.style.width = '0px';
    pinEl.style.height = '0px';
    pinEl.style.pointerEvents = 'none';
    return;
  }
  const container = document.createElement('div');
  container.className = 'marker-3d-container';
  Object.assign(container.style, {
    position: 'relative',
    width: '28px',
    height: '28px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-end',
  });

  // Standing Stem (Tapered Metallic Needle)
  const stem = document.createElement('div');
  stem.className = 'marker-3d-stem';
  Object.assign(stem.style, {
    position: 'absolute',
    bottom: '0px', // Anchored at ground level
    width: '3px',
    height: '0px',
    background: `linear-gradient(to top, rgba(0,0,0,0.8) 0%, ${color} 100%)`,
    boxShadow: `0 0 4px ${hexToRgba(color, 0.6)}`,
    opacity: '0',
    transformOrigin: 'bottom center',
    transition: 'height 0.15s ease, opacity 0.15s ease',
    zIndex: '1',
    pointerEvents: 'none',
    clipPath: 'polygon(0% 0%, 100% 0%, 50% 100%)', // Tapered point pointing down
  });
  container.appendChild(stem);

  // Pin Wrapper (handles translation/scale JS styling)
  const pinWrapper = document.createElement('div');
  pinWrapper.className = 'marker-3d-pin-wrapper';
  Object.assign(pinWrapper.style, {
    position: 'absolute',
    bottom: '0px', // Center/base coordinate
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.15s ease',
    zIndex: '2',
    transformOrigin: 'bottom center',
  });

  // The Interactive Pin (handles local CSS anims like bobbing)
  const pin = document.createElement('div');
  pin.className = isEmergencyState ? 'marker-3d-pin emergency-pin' : 'marker-3d-pin';
  Object.assign(pin.style, {
    width: '28px',
    height: '28px',
    borderRadius: isEmergencyState ? '6px' : '50%',
    backgroundColor: isEmergencyState ? color : 'rgba(15, 23, 42, 0.85)', // Dark frosted glass
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    border: isEmergencyState ? '2px solid #111827' : `1.5px solid ${hexToRgba(color, 0.6)}`, // Colored glass edge
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: isEmergencyState ? '0px 2px 4px rgba(0,0,0,0.5)' : '0px 6px 16px rgba(0,0,0,0.4)', // Stronger shadow for dark mode
    zIndex: '2',
    position: 'relative',
  });
  pin.style.setProperty('--emergency-color', color);

  // Icon inside pin
  const icon = document.createElement('div');
  icon.className = 'marker-3d-icon';
  Object.assign(icon.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'opacity 0.15s ease',
    transform: isEmergencyState ? 'rotate(-45deg)' : 'none',
    animation: isEmergencyState ? 'none' : 'iconBreathing 2.5s infinite ease-in-out', // Micro-animation
  });

  const svgColor = isEmergencyState ? '#FFFFFF' : color;
  const svg = createSvgIcon(iconName, 15, svgColor);
  if (svg) {
    icon.appendChild(svg);
  } else {
    icon.innerText = '•';
  }

  pin.appendChild(icon);
  pinWrapper.appendChild(pin);
  container.appendChild(pinWrapper);

  // Emergency specific animations (Fire / Smoke)
  if (event.category === 'incendio') {
    const fireContainer = document.createElement('div');
    fireContainer.className = 'marker-fire-container';
    Object.assign(fireContainer.style, {
      position: 'absolute',
      top: '0px',
      left: '0px',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '1',
    });
    for (let i = 0; i < 3; i++) {
      const particle = document.createElement('div');
      particle.className = `marker-fire-particle fire-particle-${i + 1}`;
      fireContainer.appendChild(particle);
    }
    container.insertBefore(fireContainer, pinWrapper);
  } else if (event.category === 'accidente' || event.category === 'choque') {
    const smokeContainer = document.createElement('div');
    smokeContainer.className = 'marker-smoke-container';
    Object.assign(smokeContainer.style, {
      position: 'absolute',
      top: '0px',
      left: '0px',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '1',
    });
    for (let i = 0; i < 3; i++) {
      const particle = document.createElement('div');
      particle.className = `marker-smoke-particle smoke-particle-${i + 1}`;
      smokeContainer.appendChild(particle);
    }
    container.insertBefore(smokeContainer, pinWrapper);
  }

  // Floating Music Notes Animation
  if (event.category === 'musica') {
    const notesContainer = document.createElement('div');
    notesContainer.className = 'marker-notes-container';
    Object.assign(notesContainer.style, {
      position: 'absolute',
      top: '0px',
      left: '0px',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      display: 'none',
      color: color,
    });

    const note1 = document.createElement('div');
    note1.className = 'marker-note';
    Object.assign(note1.style, {
      animation: 'floatNote1 2.5s infinite linear',
      animationDelay: '0s',
    });
    const n1Svg = createSvgIcon('music-note', 12, '#F6AD55');
    if (n1Svg) note1.appendChild(n1Svg);

    const note2 = document.createElement('div');
    note2.className = 'marker-note';
    Object.assign(note2.style, {
      animation: 'floatNote2 2.5s infinite linear',
      animationDelay: '0.8s',
    });
    const n2Svg = createSvgIcon('queue-music', 14, '#F6AD55');
    if (n2Svg) note2.appendChild(n2Svg);

    const note3 = document.createElement('div');
    note3.className = 'marker-note';
    Object.assign(note3.style, {
      animation: 'floatNote3 2.5s infinite linear',
      animationDelay: '1.6s',
    });
    const n3Svg = createSvgIcon('music-note', 10, '#F6AD55');
    if (n3Svg) note3.appendChild(n3Svg);

    notesContainer.appendChild(note1);
    notesContainer.appendChild(note2);
    notesContainer.appendChild(note3);
    pinWrapper.appendChild(notesContainer); // Anchored to pinWrapper to move with translation elevation!
  }

  // ─── Viñeta (Badge) ───────────────────────────────────────────────────────
  if (event.vineta) {
    renderVinetaBadge(pinWrapper, event.vineta);
  }

  pinEl.appendChild(container);
}
