import { TurismoEvent } from '../../types';
import { renderVinetaBadge } from './renderVinetaBadge';

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
   *     [lens svg]        ← icono visible siempre
   *
   * El pinWrapper usa el mismo sistema de transformación que otros markers
   * (translateY(-elevation)) para que la lente flote con pitch 3D.
   * El stem rellena el gap entre lente y suelo.
   */

  // pinWrapper — se mueve con elevation igual que otros markers
  const pinWrapper = document.createElement('div');
  pinWrapper.className = 'marker-3d-pin-wrapper marker-camara-wrapper';
  Object.assign(pinWrapper.style, {
    position: 'absolute',
    bottom: '0px',
    left: '-12px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '24px',
    transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.15s ease',
    transformOrigin: 'bottom center',
  });

  // Stem — se extiende desde base de lente hasta el suelo
  const stem = document.createElement('div');
  stem.className = 'marker-3d-stem-camara';
  Object.assign(stem.style, {
    width: '2px',
    height: '0px',
    background: 'linear-gradient(to bottom, rgba(113,128,150,0.9) 0%, rgba(113,128,150,0.2) 100%)',
    opacity: '0',
    transition: 'height 0.15s ease, opacity 0.15s ease',
    pointerEvents: 'none',
    flexShrink: '0',
    order: '1',
  });
  pinWrapper.appendChild(stem);

  // Lens svg — siempre visible, arriba del stem. NO escala al seleccionar.
  const lens = document.createElement('div');
  lens.className = 'marker-camara-lens-container';
  Object.assign(lens.style, {
    width: '24px',
    height: '24px',
    flexShrink: '0',
    order: '0',
    position: 'relative',
    filter: 'drop-shadow(0px 1px 3px rgba(0,0,0,0.3))',
  });
  lens.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="11" fill="#4A5568" />
      <circle cx="12" cy="12" r="8"  fill="#718096" />
      <circle cx="12" cy="12" r="5"  fill="#2D3748" />
      <circle cx="12" cy="12" r="2.5" fill="#1A202C" />
      <circle cx="9.5" cy="9.5" r="1.2" fill="#90CDF4" opacity="0.9" />
      <circle cx="19.5" cy="4.5" r="1.8" fill="#E53E3E" opacity="0.95" />
    </svg>
  `;

  // Anchor para el modal — centrado sobre la lente
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
