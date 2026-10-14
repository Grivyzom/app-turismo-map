import { TurismoEvent } from '../../types';

import { renderVinetaBadge } from './renderVinetaBadge';

/** Óptica de una cámara suelta: discreta, es infraestructura y no un POI. */
const LENS_SIZE = 20;
/** Óptica de un grupo: algo mayor para alojar el contador sin tapar la lente. */
const GROUP_LENS_SIZE = 24;

let camaraSeq = 0;

export function renderCamaraMarker(
  pinEl: HTMLDivElement,
  event: TurismoEvent,
  isSelected: boolean,
  _mapLayer: string,
) {
  pinEl.innerHTML = '';

  const groupCount = event.cameraGroup?.count ?? 0;
  const isGroup = groupCount > 1;
  const size = isGroup ? GROUP_LENS_SIZE : LENS_SIZE;

  /*
   * Estructura DOM (bottom = punto geo anclado en suelo):
   *
   *   [pinWrapper]   ← centrado sobre la coordenada
   *     [lens]       ← óptica + barrido de radar (sólo hover/selección)
   *       [count]    ← contador si es un grupo de cámaras
   *
   * La cámara no crece ni se eleva al seleccionarse: es infraestructura, no un
   * punto de interés; su feedback es el barrido y el halo azul.
   */

  const pinWrapper = document.createElement('div');
  pinWrapper.className = 'marker-3d-pin-wrapper marker-camara-wrapper';
  Object.assign(pinWrapper.style, {
    position: 'absolute',
    bottom: '0px',
    left: '50%',
    marginLeft: `${-size / 2}px`,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: `${size}px`,
    transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.15s ease',
    transformOrigin: 'bottom center',
  });

  const lens = document.createElement('div');
  lens.className = 'marker-camara-lens-container';
  Object.assign(lens.style, {
    width: `${size}px`,
    height: `${size}px`,
    flexShrink: '0',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    filter: isSelected
      ? 'drop-shadow(0 2px 6px rgba(2,6,14,0.55)) drop-shadow(0 0 8px rgba(96,165,250,0.6))'
      : 'drop-shadow(0 1px 3px rgba(2,6,14,0.45))',
    transition: 'filter 0.3s ease',
  });

  // Barrido de radar. Con decenas de cámaras en pantalla, un barrido perpetuo
  // en cada una era ruido visual y coste de composición constante; ahora sólo
  // gira en la seleccionada o bajo el cursor (ver `.camara-radar-idle`).
  const radar = document.createElement('div');
  radar.className = isSelected
    ? 'pin-radar pin-ambient'
    : 'pin-radar pin-ambient camara-radar-idle';
  radar.style.setProperty('--radar-size', `${Math.round(size * 2.3)}px`);
  radar.style.setProperty(
    '--radar-color',
    isSelected ? 'rgba(96,165,250,0.65)' : 'rgba(96,165,250,0.45)',
  );
  radar.style.setProperty('--radar-fade', 'rgba(96,165,250,0.12)');
  radar.style.zIndex = '-1';
  lens.appendChild(radar);

  const uid = `cam${camaraSeq++}`;
  const optic = document.createElement('div');
  optic.style.position = 'relative';
  optic.style.lineHeight = '0';
  // Grupo: el LED rojo se omite; su esquina la ocupa el contador.
  optic.innerHTML = `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">
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
      ${isGroup ? '' : '<circle cx="19.4" cy="4.6" r="1.7" fill="#EF4444" />'}
    </svg>
  `;
  lens.appendChild(optic);

  if (isGroup) {
    const count = document.createElement('div');
    count.className = 'marker-camara-count';
    count.textContent = groupCount > 99 ? '99+' : String(groupCount);
    Object.assign(count.style, {
      position: 'absolute',
      top: '-5px',
      right: '-7px',
      minWidth: '15px',
      height: '15px',
      padding: '0 3px',
      boxSizing: 'border-box',
      borderRadius: '8px',
      background: '#1D4ED8',
      border: '1.5px solid #0B1220',
      color: '#FFFFFF',
      font: '700 9px/12px system-ui, -apple-system, sans-serif',
      textAlign: 'center',
      pointerEvents: 'none',
    });
    lens.appendChild(count);
  }

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

  pinEl.setAttribute('role', 'button');
  pinEl.setAttribute(
    'aria-label',
    isGroup ? `${groupCount} cámaras de seguridad, acercar` : event.title || 'Cámara de seguridad',
  );

  if (event.vineta && !isGroup) {
    renderVinetaBadge(lens, event.vineta);
  }
}
