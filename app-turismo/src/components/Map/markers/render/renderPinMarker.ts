import { TurismoEvent } from '../../types';
import { createSvgIcon } from '../../utils/svgIcons';
import {
  getPinDesign,
  isPinlessCategory,
  withAlpha,
  shade,
  PinDesign,
} from '../../design/pinDesignSystem';

import { renderVinetaBadge } from './renderVinetaBadge';

/**
 * Cuerpo del pin (capa vertical, alineada al viewport).
 *
 * Construcción por capas, de atrás hacia adelante:
 *   stem → halo/órbita ambiental → cuerpo (gradiente + gloss + sheen) → icono
 *
 * El ancla del menú radial va fuera del cuerpo porque el cuerpo puede estar
 * rotado (gota a -45°, rombo a +45°) y arrastraría al menú con él.
 */
export function renderPinMarker(
  pinEl: HTMLDivElement,
  event: TurismoEvent,
  color: string,
  iconName: string,
  isEmergencyState: boolean,
  isSelected: boolean,
  mapLayer = 'dark',
  /** Sólo la primera aparición cae del cielo; los re-render no. */
  animateEntry = false,
) {
  pinEl.innerHTML = '';

  if (isPinlessCategory(event.category)) {
    pinEl.style.width = '0px';
    pinEl.style.height = '0px';
    pinEl.style.pointerEvents = 'none';
    return;
  }

  const design = getPinDesign(event, mapLayer);
  const accent = color || design.accent;
  const size = design.size;

  // Al rotar 45° un cuadrado, su vértice inferior baja (√2−1)/2 · lado por
  // debajo del borde original. Sin compensar, la punta de la gota y del rombo
  // quedaría ~6 px enterrada bajo su coordenada real.
  const groundOffset = design.bodyRotate ? ((Math.SQRT2 - 1) / 2) * size : 0;

  pinEl.dataset.pinFamily = design.family;
  pinEl.dataset.pinShape = design.shape;
  pinEl.dataset.pinPreview = design.preview;
  pinEl.dataset.pinAmbient = design.ambient;
  // Geometría que necesita updateAesthetics para estirar la aguja hasta el
  // centro del cuerpo elevado, sea cual sea el tamaño y la silueta.
  pinEl.dataset.pinHalf = String(size / 2);
  pinEl.dataset.pinOffset = String(groundOffset);

  // ── Contenedor + animación de entrada ───────────────────────────────
  const container = document.createElement('div');
  container.className = animateEntry ? 'marker-3d-container pin-enter' : 'marker-3d-container';
  if (animateEntry) {
    container.addEventListener(
      'animationend',
      () => {
        container.classList.remove('pin-enter');
      },
      { once: true },
    );
  }
  Object.assign(container.style, {
    position: 'relative',
    width: `${size}px`,
    height: `${size}px`,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-end',
  });
  // Escalona la entrada por posición para que un lote de pines no "explote" a la vez
  container.style.setProperty('--enter-delay', `${(Math.abs(hashId(event.id)) % 7) * 45}ms`);

  // ── Aguja de anclaje al suelo ───────────────────────────────────────
  const stem = document.createElement('div');
  stem.className = 'marker-3d-stem';
  Object.assign(stem.style, {
    position: 'absolute',
    bottom: '0px',
    width: '2.5px',
    height: '0px',
    background: `linear-gradient(to top, rgba(2,6,14,0.9) 0%, ${withAlpha(accent, 0.75)} 70%, ${withAlpha(accent, 0.95)} 100%)`,
    boxShadow: `0 0 5px ${withAlpha(accent, 0.5)}`,
    opacity: '0',
    transformOrigin: 'bottom center',
    transition: 'height 0.15s ease, opacity 0.15s ease',
    zIndex: '1',
    pointerEvents: 'none',
    clipPath: 'polygon(0% 0%, 100% 0%, 50% 100%)',
  });
  container.appendChild(stem);

  // ── Wrapper (elevación 3D + escala; su transform lo maneja el JS) ────
  const pinWrapper = document.createElement('div');
  pinWrapper.className = 'marker-3d-pin-wrapper';
  Object.assign(pinWrapper.style, {
    position: 'absolute',
    bottom: `${groundOffset}px`,
    width: `${size}px`,
    height: `${size}px`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.34s cubic-bezier(0.34, 1.45, 0.5, 1), opacity 0.15s ease',
    zIndex: '2',
    transformOrigin: 'bottom center',
  });

  appendAmbientBackdrop(pinWrapper, design);

  // ── Cuerpo flotante (aloja bobbing/flotación sin pisar la rotación) ──
  const body = document.createElement('div');
  body.className = 'pin-body';
  Object.assign(body.style, {
    width: `${size}px`,
    height: `${size}px`,
  });
  if (design.ambient === 'float') {
    body.classList.add('pin-float', 'pin-ambient');
  }

  // ── El cuerpo del pin ────────────────────────────────────────────────
  const pin = document.createElement('div');
  pin.className = isEmergencyState ? 'marker-3d-pin emergency-pin' : 'marker-3d-pin';
  const baseTransform = design.bodyRotate ? `rotate(${design.bodyRotate}deg)` : '';
  pin.dataset.baseTransform = baseTransform;

  const rimWidth = design.finish === 'solid' ? 2 : 1.5;
  // El estado de reposo se guarda en el DOM para que updateAesthetics pueda
  // restaurarlo sin recalcular el diseño en cada frame de movimiento.
  pin.dataset.restShadow = restingShadow(design);
  pin.dataset.restRim = design.rimColor;
  pin.dataset.restRimWidth = String(rimWidth);
  pin.dataset.accent = accent;
  Object.assign(pin.style, {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: design.borderRadius,
    background: design.bodyBackground,
    backdropFilter: design.finish === 'glass' ? 'blur(9px) saturate(1.25)' : 'none',
    WebkitBackdropFilter: design.finish === 'glass' ? 'blur(9px) saturate(1.25)' : 'none',
    border: `${rimWidth}px solid ${design.rimColor}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: restingShadow(design),
    transform: baseTransform,
    zIndex: '2',
    position: 'relative',
  });
  pin.style.setProperty('--emergency-color', accent);

  // Capa recortada: reflejo fijo + barrido especular
  const surface = document.createElement('div');
  surface.className = 'pin-surface';
  const gloss = document.createElement('div');
  gloss.className = 'pin-gloss';
  gloss.style.background =
    design.finish === 'pearl'
      ? 'radial-gradient(115% 85% at 30% 8%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.35) 34%, rgba(255,255,255,0) 62%)'
      : 'radial-gradient(120% 90% at 28% 10%, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.1) 38%, rgba(255,255,255,0) 64%)';
  surface.appendChild(gloss);

  if (design.ambient === 'sheen') {
    const sheen = document.createElement('div');
    sheen.className = 'pin-sheen pin-ambient';
    sheen.style.setProperty(
      '--sheen-color',
      design.finish === 'pearl' ? withAlpha(accent, 0.35) : 'rgba(255,255,255,0.55)',
    );
    sheen.style.setProperty('--sheen-delay', `${(Math.abs(hashId(event.id)) % 5) * 900}ms`);
    surface.appendChild(sheen);
  }
  pin.appendChild(surface);

  // Contra-rotación para que el icono siempre quede a plomo
  const rotator = document.createElement('div');
  rotator.className = 'pin-icon-rotator';
  if (design.bodyRotate) rotator.style.transform = `rotate(${-design.bodyRotate}deg)`;

  const icon = document.createElement('div');
  icon.className = 'marker-3d-icon';
  Object.assign(icon.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'opacity 0.15s ease',
    animation: isEmergencyState ? 'none' : 'iconBreathing 2.8s infinite ease-in-out',
  });

  const svg = createSvgIcon(iconName || design.iconName, design.iconSize, design.iconColor);
  if (svg) {
    if (design.finish !== 'pearl') {
      svg.style.filter = `drop-shadow(0 0 4px ${withAlpha(accent, 0.55)})`;
    }
    icon.appendChild(svg);
  } else {
    const dot = document.createElement('span');
    Object.assign(dot.style, {
      width: '6px',
      height: '6px',
      borderRadius: '50%',
      backgroundColor: design.iconColor,
    });
    icon.appendChild(dot);
  }

  rotator.appendChild(icon);
  pin.appendChild(rotator);
  body.appendChild(pin);
  pinWrapper.appendChild(body);

  // Ancla del menú radial: sin rotación, mismo centro que el cuerpo
  const menuAnchor = document.createElement('div');
  menuAnchor.className = 'pin-menu-anchor';
  menuAnchor.dataset.pinSize = String(size);
  pinWrapper.appendChild(menuAnchor);

  container.appendChild(pinWrapper);

  // ── Partículas de emergencia ────────────────────────────────────────
  if (event.category === 'incendio') {
    container.insertBefore(buildParticles('fire'), pinWrapper);
  } else if (event.category === 'accidente' || event.category === 'choque') {
    container.insertBefore(buildParticles('smoke'), pinWrapper);
  }

  // ── Notas musicales flotantes ───────────────────────────────────────
  if (event.category === 'musica') {
    pinWrapper.appendChild(buildMusicNotes(accent));
  }

  if (event.vineta) {
    renderVinetaBadge(pinWrapper, event.vineta);
  }

  pinEl.appendChild(container);

  if (animateEntry) {
    window.setTimeout(() => container.classList.remove('pin-enter'), 900);
  }
}

/** Sombra en reposo, calibrada por acabado. */
function restingShadow(design: PinDesign): string {
  if (design.finish === 'pearl') {
    return `0 6px 14px rgba(15, 23, 42, 0.28), 0 1px 3px rgba(15, 23, 42, 0.22), inset 0 1px 0 rgba(255,255,255,0.9)`;
  }
  if (design.finish === 'solid') {
    return `0 4px 10px rgba(2, 6, 14, 0.55), 0 0 14px ${withAlpha(design.accent, 0.35)}, inset 0 1px 0 rgba(255,255,255,0.32)`;
  }
  return `0 7px 18px rgba(2, 6, 14, 0.5), 0 0 0 0.5px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.16)`;
}

/**
 * Capa ambiental detrás del cuerpo. Cada familia tiene su propio lenguaje
 * de movimiento — es el segundo canal de identificación después de la silueta.
 */
function appendAmbientBackdrop(pinWrapper: HTMLDivElement, design: PinDesign) {
  const { ambient, accent, size, intensity } = design;

  const makeLayer = (className: string, sizePx: number, vars: Record<string, string>) => {
    const el = document.createElement('div');
    el.className = `${className} pin-ambient`;
    Object.entries(vars).forEach(([k, v]) => el.style.setProperty(k, v));
    el.style.setProperty('--halo-size', `${sizePx}px`);
    pinWrapper.appendChild(el);
    return el;
  };

  switch (ambient) {
    case 'halo':
    case 'sonar': // el sonar vive en el suelo; arriba sólo queda el halo tenue
      makeLayer('pin-halo', Math.round(size * 1.5), {
        '--halo-color': withAlpha(accent, 0.55),
        '--halo-min': String(0.16 + intensity * 0.14),
        '--halo-max': String(0.34 + intensity * 0.3),
      });
      break;

    case 'alert':
      makeLayer('pin-halo', Math.round(size * 1.7), {
        '--halo-color': withAlpha(accent, 0.7),
        '--halo-min': '0.3',
        '--halo-max': '0.75',
      });
      break;

    case 'orbit': {
      makeLayer('pin-halo', Math.round(size * 1.45), {
        '--halo-color': withAlpha(accent, 0.45),
        '--halo-min': '0.18',
        '--halo-max': '0.4',
      });
      const orbit = document.createElement('div');
      orbit.className = 'pin-orbit pin-ambient';
      orbit.style.setProperty('--orbit-size', `${size + 12}px`);
      orbit.style.setProperty('--orbit-color', shade(accent, 0.35));
      orbit.style.setProperty('--orbit-duration', `${6 + (1 - intensity) * 3}s`);
      const dot = document.createElement('div');
      dot.className = 'pin-orbit-dot';
      orbit.appendChild(dot);
      pinWrapper.appendChild(orbit);
      break;
    }

    case 'float':
      makeLayer('pin-halo', Math.round(size * 1.4), {
        '--halo-color': withAlpha(accent, 0.4),
        '--halo-min': '0.14',
        '--halo-max': '0.32',
      });
      break;

    case 'sheen':
      // El brillo va dentro del cuerpo; aquí sólo un asiento de luz muy tenue
      makeLayer('pin-halo', Math.round(size * 1.35), {
        '--halo-color': withAlpha(accent, 0.35),
        '--halo-min': '0.1',
        '--halo-max': '0.24',
      });
      break;

    default:
      break;
  }
}

function buildParticles(kind: 'fire' | 'smoke'): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.className = `marker-${kind}-container`;
  Object.assign(wrapper.style, {
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
    particle.className = `marker-${kind}-particle ${kind}-particle-${i + 1}`;
    wrapper.appendChild(particle);
  }
  return wrapper;
}

function buildMusicNotes(accent: string): HTMLDivElement {
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
    color: accent,
  });

  const noteSpecs: { icon: string; size: number; anim: string; delay: string }[] = [
    { icon: 'music-note', size: 12, anim: 'floatNote1 2.5s infinite linear', delay: '0s' },
    { icon: 'queue-music', size: 14, anim: 'floatNote2 2.5s infinite linear', delay: '0.8s' },
    { icon: 'music-note', size: 10, anim: 'floatNote3 2.5s infinite linear', delay: '1.6s' },
  ];

  noteSpecs.forEach(({ icon, size, anim, delay }) => {
    const note = document.createElement('div');
    note.className = 'marker-note';
    note.style.animation = anim;
    note.style.animationDelay = delay;
    const noteSvg = createSvgIcon(icon, size, shade(accent, 0.3));
    if (noteSvg) note.appendChild(noteSvg);
    notesContainer.appendChild(note);
  });

  return notesContainer;
}

/** Hash estable para escalonar animaciones sin romper el determinismo. */
function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h << 5) - h + id.charCodeAt(i);
    h |= 0;
  }
  return h;
}
