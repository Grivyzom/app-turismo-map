import { TurismoEvent } from '../../types';

import { renderVinetaBadge } from './renderVinetaBadge';

const LENS_SIZE = 24;

let camaraSeq = 0;

export function renderCamaraMarker(
  pinEl: HTMLDivElement,
  event: TurismoEvent,
  isSelected: boolean,
  _mapLayer: string,
) {
  pinEl.innerHTML = '';

  /*
   * Estructura DOM (bottom = punto geo anclado en suelo):
   *
   *   [pinWrapper]        ← sube con elevation (translateY), contiene la lente
   *     [stem]            ← estira hacia abajo desde la lente al suelo
   *     [lens]            ← óptica siempre visible + barrido de radar
   *
   * La cámara no crece al seleccionarse: es infraestructura, no un punto de
   * interés; su feedback es el barrido y el LED, no el tamaño.
   */

  const pinWrapper = document.createElement('div');
  pinWrapper.className = 'marker-3d-pin-wrapper marker-camara-wrapper';
  Object.assign(pinWrapper.style, {
    position: 'absolute',
    bottom: '0px',
    // Centrado real sobre el punto geo: `left: -12px` dejaba la óptica
    // desplazada media caja a la izquierda de su coordenada.
    left: '50%',
    marginLeft: `${-LENS_SIZE / 2}px`,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: `${LENS_SIZE}px`,
    transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.15s ease',
    transformOrigin: 'bottom center',
  });

  // Mástil: conecta la óptica elevada con el suelo cuando hay pitch
  const stem = document.createElement('div');
  stem.className = 'marker-3d-stem-camara';
  Object.assign(stem.style, {
    width: '2px',
    height: '0px',
    background:
      'linear-gradient(to bottom, rgba(148,163,184,0.95) 0%, rgba(100,116,139,0.45) 55%, rgba(100,116,139,0.12) 100%)',
    boxShadow: '0 0 3px rgba(15,23,42,0.5)',
    opacity: '0',
    transition: 'height 0.15s ease, opacity 0.15s ease',
    pointerEvents: 'none',
    flexShrink: '0',
    order: '1',
  });
  pinWrapper.appendChild(stem);

  // Óptica
  const lens = document.createElement('div');
  lens.className = 'marker-camara-lens-container';
  Object.assign(lens.style, {
    width: `${LENS_SIZE}px`,
    height: `${LENS_SIZE}px`,
    flexShrink: '0',
    order: '0',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    filter: isSelected
      ? 'drop-shadow(0 2px 6px rgba(2,6,14,0.55)) drop-shadow(0 0 8px rgba(96,165,250,0.6))'
      : 'drop-shadow(0 2px 4px rgba(2,6,14,0.45))',
    transition: 'filter 0.3s ease',
  });

  // Barrido de radar: la firma de movimiento propia de la vigilancia
  const radar = document.createElement('div');
  radar.className = 'pin-radar pin-ambient';
  radar.style.setProperty('--radar-size', '54px');
  radar.style.setProperty(
    '--radar-color',
    isSelected ? 'rgba(96,165,250,0.65)' : 'rgba(96,165,250,0.42)',
  );
  radar.style.setProperty('--radar-fade', 'rgba(96,165,250,0.12)');
  radar.style.zIndex = '-1';
  lens.appendChild(radar);

  const uid = `cam${camaraSeq++}`;
  const optic = document.createElement('div');
  optic.style.position = 'relative';
  optic.style.lineHeight = '0';
  optic.innerHTML = `
    <svg width="${LENS_SIZE}" height="${LENS_SIZE}" viewBox="0 0 24 24">
      <defs>
        <linearGradient id="${uid}-body" x1="0.25" y1="0" x2="0.75" y2="1">
          <stop offset="0%" stop-color="#94A3B8" />
          <stop offset="45%" stop-color="#64748B" />
          <stop offset="100%" stop-color="#334155" />
        </linearGradient>
        <radialGradient id="${uid}-glass" cx="0.36" cy="0.3" r="0.75">
          <stop offset="0%" stop-color="#1E293B" />
          <stop offset="60%" stop-color="#0B1220" />
          <stop offset="100%" stop-color="#020617" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="11.2" fill="url(#${uid}-body)" />
      <circle cx="12" cy="12" r="11.2" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="0.9" />
      <circle cx="12" cy="12" r="8.2" fill="#1F2937" />
      <circle cx="12" cy="12" r="6.6" fill="url(#${uid}-glass)" />
      <circle cx="12" cy="12" r="6.6" fill="none" stroke="rgba(96,165,250,0.45)" stroke-width="0.7" />
      <circle cx="12" cy="12" r="2.3" fill="#020617" />
      <path d="M6.6 8.2 A 7 7 0 0 1 12 5.2" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="1.3" stroke-linecap="round" />
      <circle cx="9.4" cy="9.4" r="1.15" fill="#BFDBFE" opacity="0.9" />
      <circle cx="19.4" cy="4.6" r="1.7" fill="#EF4444" />
      <circle cx="19.4" cy="4.6" r="1.7" fill="#EF4444" opacity="0.55" style="filter: blur(1.5px)" />
    </svg>
  `;
  lens.appendChild(optic);

  // Anchor del mini-modal — centrado sobre la óptica
  const modalAnchor = document.createElement('div');
  modalAnchor.className = 'camara-modal-anchor';
  Object.assign(modalAnchor.style, {
    position: 'absolute',
    bottom: '100%',
    left: '50%',
    width: '0px',
    height: '0px',
    pointerEvents: 'none',
  });
  lens.appendChild(modalAnchor);

  pinWrapper.appendChild(lens);
  pinEl.appendChild(pinWrapper);

  if (event.vineta) {
    renderVinetaBadge(lens, event.vineta);
  }
}
