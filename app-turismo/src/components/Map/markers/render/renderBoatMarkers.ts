import { TurismoEvent } from '../../types';

export function renderBoatFlatMarker(flatEl: HTMLDivElement, event: TurismoEvent) {
  flatEl.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'marker-flat-container';
  Object.assign(container.style, {
    position: 'relative',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transformOrigin: 'center center',
  });

  const heading = event.boatHeading || 0;
  const size = event.boatSize || 'mediana';
  const type = event.boatType || 'deportivo';

  // Determine size dimensions for boat shadow and wake offsets
  let w = 24;
  let h = 24;
  let wakeWidth = 8;
  let wakeHeight = 20;
  let wakeLeftOffset = '10px';
  let wakeRightOffset = '10px';
  let foamBottom = '-10px';
  let foamSize = '6px';

  if (size === 'grande') {
    w = 32;
    h = 32;
    wakeWidth = 10;
    wakeHeight = 28;
    wakeLeftOffset = '13px';
    wakeRightOffset = '13px';
    foamBottom = '-14px';
    foamSize = '9px';
  } else if (size === 'mediana') {
    w = 28;
    h = 28;
    wakeWidth = 9;
    wakeHeight = 24;
    wakeLeftOffset = '11px';
    wakeRightOffset = '11px';
    foamBottom = '-12px';
    foamSize = '8px';
  } else {
    // pequena
    w = 24;
    h = 24;
    wakeWidth = 7;
    wakeHeight = 18;
    wakeLeftOffset = '9px';
    wakeRightOffset = '9px';
    foamBottom = '-8px';
    foamSize = '6px';
  }

  // Dynamic V-shaped wake trailing behind the boat
  const wakeContainer = document.createElement('div');
  wakeContainer.className = 'boat-wake-container';
  Object.assign(wakeContainer.style, {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: '32px',
    height: '32px',
    transform: `translate(-50%, -50%) rotate(${heading}deg)`,
    pointerEvents: 'none',
    zIndex: '0',
  });

  // Soft, blurred, rotated underwater shadow representing the boat hull
  const boatShadow = document.createElement('div');
  boatShadow.className = 'boat-underwater-shadow';
  Object.assign(boatShadow.style, {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: `${w}px`,
    height: `${h}px`,
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
    zIndex: '-1',
    filter: 'blur(3.5px)',
    opacity: '0.45',
  });

  // Determine shadow hull shape SVG path based on boat type
  let shadowPath = 'M16 2 C19 6, 21 16, 21 26 C21 28, 11 28, 11 26 C11 16, 13 6, 16 2 Z'; // default (yacht/deportivo)
  if (type === 'velero') {
    shadowPath = 'M16 2 C18 6, 23 18, 23 24 C23 26, 9 26, 9 24 C9 18, 14 6, 16 2 Z';
  } else if (type === 'transbordador') {
    shadowPath = 'M16 2 C19 5, 21 12, 21 26 C21 29, 11 29, 11 26 C11 12, 13 5, 16 2 Z';
  }

  boatShadow.innerHTML = `
    <svg width="100%" height="100%" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="${shadowPath}" fill="#082f49"/>
    </svg>
  `;

  // Left wake wave
  const wakeL = document.createElement('div');
  wakeL.className = 'boat-wake-left';
  Object.assign(wakeL.style, {
    position: 'absolute',
    bottom: '0px',
    left: wakeLeftOffset,
    width: `${wakeWidth}px`,
    height: `${wakeHeight}px`,
    borderLeft: '1.5px dashed rgba(96, 165, 250, 0.65)',
    filter: 'blur(0.5px)',
    transformOrigin: 'bottom center',
    animation: 'boatWakeLeft 1.8s infinite linear',
  });

  // Right wake wave
  const wakeR = document.createElement('div');
  wakeR.className = 'boat-wake-right';
  Object.assign(wakeR.style, {
    position: 'absolute',
    bottom: '0px',
    right: wakeRightOffset,
    width: `${wakeWidth}px`,
    height: `${wakeHeight}px`,
    borderRight: '1.5px dashed rgba(96, 165, 250, 0.65)',
    filter: 'blur(0.5px)',
    transformOrigin: 'bottom center',
    animation: 'boatWakeRight 1.8s infinite linear',
  });

  // Soft wake bubble/foam directly behind the boat
  const wakeFoam = document.createElement('div');
  Object.assign(wakeFoam.style, {
    position: 'absolute',
    bottom: foamBottom,
    left: '50%',
    width: foamSize,
    height: foamSize,
    borderRadius: '50%',
    backgroundColor: 'rgba(219, 234, 254, 0.45)',
    filter: 'blur(1.5px)',
    animation: 'boatFoam 1.5s infinite ease-out',
    transformOrigin: 'top center',
  });

  const bowWave = document.createElement('div');
  bowWave.className = 'boat-bow-wave';

  wakeContainer.appendChild(boatShadow);
  wakeContainer.appendChild(wakeL);
  wakeContainer.appendChild(wakeR);
  wakeContainer.appendChild(wakeFoam);
  wakeContainer.appendChild(bowWave);
  container.appendChild(wakeContainer);

  flatEl.appendChild(container);
}

export function renderBoatMarker(pinEl: HTMLDivElement, event: TurismoEvent, isSelected: boolean) {
  pinEl.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'marker-boat-container';

  const size = event.boatSize || 'mediana';
  const heading = event.boatHeading || 0;
  const type = event.boatType || 'deportivo';

  // Determine size dimensions
  let w = 24;
  let h = 24;
  let color = '#06B6D4'; // cyan for small
  if (size === 'grande') {
    w = 32;
    h = 32;
    color = '#F8FAFC'; // white for large
  } else if (size === 'mediana') {
    w = 28;
    h = 28;
    color = '#F59E0B'; // orange for medium
  }

  Object.assign(container.style, {
    position: 'relative',
    width: `${w}px`,
    height: `${h}px`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  });

  // Inner wrapper that handles scale / hover / selection
  const wrapper = document.createElement('div');
  wrapper.className = 'marker-3d-pin-wrapper';
  Object.assign(wrapper.style, {
    position: 'absolute',
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
    transformOrigin: 'center center',
  });

  // Bobbing container (removed bobbing class for boats so they stick to the surface)
  const bobbingContainer = document.createElement('div');
  // bobbingContainer.className = 'marker-bobbing';
  Object.assign(bobbingContainer.style, {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  });

  // The actual Boat SVG Element
  const boat = document.createElement('div');
  boat.className = 'marker-boat-body'; // subtle bobbing parent, static rotation child
  Object.assign(boat.style, {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transform: `rotate(${heading}deg)`,
  });

  // Select SVG based on boat type
  let svgContent = '';
  if (type === 'velero') {
    // Sailboat SVG
    svgContent = `
      <svg width="100%" height="100%" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 2 C18 6, 23 18, 23 24 C23 26, 9 26, 9 24 C9 18, 14 6, 16 2 Z" fill="${color}" stroke="#111827" stroke-width="2"/>
        <path d="M16 4 L16 22 M16 8 L21 16 L16 18" stroke="#111827" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
    `;
  } else if (type === 'transbordador') {
    // Ferry/Large ship SVG
    svgContent = `
      <svg width="100%" height="100%" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 2 C19 5, 21 12, 21 26 C21 29, 11 29, 11 26 C11 12, 13 5, 16 2 Z" fill="${color}" stroke="#111827" stroke-width="2"/>
        <rect x="13" y="10" width="6" height="12" rx="1" fill="#475569" stroke="#111827" stroke-width="1.5"/>
        <rect x="14" y="14" width="4" height="4" fill="#E2E8F0"/>
      </svg>
    `;
  } else {
    // Yacht / Speedboat SVG (default)
    svgContent = `
      <svg width="100%" height="100%" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 2 C19 6, 21 16, 21 26 C21 28, 11 28, 11 26 C11 16, 13 6, 16 2 Z" fill="${color}" stroke="#111827" stroke-width="2"/>
        <path d="M13 14 L19 14 L17 22 L15 22 Z" fill="#E2E8F0" stroke="#111827" stroke-width="1.5"/>
        <rect x="14" y="8" width="4" height="4" rx="0.5" fill="#1E293B"/>
      </svg>
    `;
  }

  boat.innerHTML = svgContent;
  bobbingContainer.appendChild(boat);
  wrapper.appendChild(bobbingContainer);
  container.appendChild(wrapper);

  pinEl.appendChild(container);
}
