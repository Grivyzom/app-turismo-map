import { TurismoEvent } from '../../types';
import {
  getPinDesign,
  getSonarScale,
  isPinlessCategory,
  withAlpha,
} from '../../design/pinDesignSystem';

/**
 * Capa de suelo del pin (alineada al plano del mapa, no al viewport).
 *
 * Aquí vive todo lo que "toca el terreno": sombra de contacto, punto de
 * anclaje, pedestal y las ondas expansivas. Al estar pitch-aligned, las
 * ondas se ven como círculos en perspectiva sobre el suelo y no como
 * discos flotando frente a la cámara.
 */
export function renderFlatMarker(
  flatEl: HTMLDivElement,
  event: TurismoEvent,
  color: string,
  isEmergencyState: boolean,
  mapLayer = 'dark',
) {
  flatEl.innerHTML = '';

  if (isPinlessCategory(event.category)) {
    flatEl.style.width = '0px';
    flatEl.style.height = '0px';
    flatEl.style.pointerEvents = 'none';
    return;
  }

  const design = getPinDesign(event, mapLayer);
  const accent = color || design.accent;
  const size = design.size;

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

  // ── 1. Sombra de contacto (se estira con el pitch desde el JS) ───────
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
    background: `linear-gradient(to top, rgba(0,0,0,0.75) 0%, ${withAlpha(accent, 0.5)} 100%)`,
    boxShadow: `0 0 4px ${withAlpha(accent, 0.45)}`,
    transformOrigin: 'bottom center',
  });
  shadowContainer.appendChild(shadowStem);

  const shadowPin = document.createElement('div');
  shadowPin.className = 'marker-3d-shadow-pin';
  Object.assign(shadowPin.style, {
    width: `${Math.round(size * 0.58)}px`,
    height: `${Math.round(size * 0.58)}px`,
    borderRadius: '50%',
    background:
      'radial-gradient(circle closest-side, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.3) 58%, rgba(0,0,0,0) 100%)',
    filter: 'blur(1.5px)',
  });
  shadowContainer.appendChild(shadowPin);
  container.appendChild(shadowContainer);

  // ── 2. Punto de anclaje en el terreno ────────────────────────────────
  const puncture = document.createElement('div');
  puncture.className = 'marker-3d-puncture';
  Object.assign(puncture.style, {
    position: 'absolute',
    top: '-2.5px',
    left: '-2.5px',
    width: '5px',
    height: '5px',
    borderRadius: '50%',
    background: `radial-gradient(circle at 35% 30%, ${withAlpha(accent, 0.9)} 0%, #0B1220 70%)`,
    border: '1px solid rgba(255, 255, 255, 0.18)',
    boxShadow: `0 0 4px ${withAlpha(accent, 0.6)}`,
    opacity: '0.9',
    zIndex: '2',
  });
  container.appendChild(puncture);

  // ── 3. Pedestal: señal de "este pin abre ficha completa" ─────────────
  // Aparece sólo en hover/selección (lo activa updateAesthetics), así el
  // mapa en reposo queda limpio y la afordancia sigue estando.
  if (design.preview === 'radial') {
    const pedestal = document.createElement('div');
    pedestal.className = 'pin-pedestal';
    pedestal.style.setProperty('--pedestal-size', `${size + 14}px`);
    pedestal.style.setProperty('--pedestal-color', withAlpha(accent, 0.7));
    pedestal.style.setProperty('--pedestal-glow', withAlpha(accent, 0.35));
    container.appendChild(pedestal);
  }

  // ── 4. Ondas expansivas (sonar) ──────────────────────────────────────
  if (design.ambient === 'sonar' && !isEmergencyState) {
    const maxScale = getSonarScale(event.attendeesCount, design.intensity);
    const duration = 3400 - design.intensity * 700;
    const ECHOES = 3;
    for (let i = 0; i < ECHOES; i++) {
      const wave = document.createElement('div');
      wave.className = 'pin-sonar pin-ambient';
      wave.style.setProperty('--sonar-size', `${size}px`);
      wave.style.setProperty('--sonar-color', withAlpha(accent, 0.75));
      wave.style.setProperty('--sonar-to', String(maxScale));
      wave.style.setProperty('--sonar-peak', String(0.28 + design.intensity * 0.3));
      wave.style.setProperty('--sonar-duration', `${duration}ms`);
      wave.style.setProperty('--sonar-delay', `${(duration / ECHOES) * i}ms`);
      wave.style.zIndex = '2';
      container.appendChild(wave);
    }
  }

  // ── 5. Emergencia: cordón + onda de choque ───────────────────────────
  if (isEmergencyState) {
    const cordon = document.createElement('div');
    cordon.className = 'pin-cordon pin-ambient';
    cordon.style.setProperty('--cordon-size', `${size + 18}px`);
    cordon.style.setProperty('--cordon-color', accent);
    cordon.style.setProperty('--cordon-fill', withAlpha(accent, 0.07));
    cordon.style.zIndex = '2';
    container.appendChild(cordon);

    for (let i = 0; i < 2; i++) {
      const shock = document.createElement('div');
      shock.className = 'pin-sonar pin-sonar-alert pin-ambient';
      shock.style.setProperty('--sonar-size', `${size + 6}px`);
      shock.style.setProperty('--sonar-color', withAlpha(accent, 0.9));
      shock.style.setProperty('--sonar-to', '2.2');
      shock.style.setProperty('--sonar-peak', '0.7');
      shock.style.setProperty('--sonar-duration', '1700ms');
      shock.style.setProperty('--sonar-delay', `${850 * i}ms`);
      shock.style.zIndex = '2';
      container.appendChild(shock);
    }
  }

  // ── 6. Aura de evento popular ────────────────────────────────────────
  if (event.attendeesCount && event.attendeesCount > 200 && !isEmergencyState) {
    const aura = document.createElement('div');
    aura.className = 'pin-aura pin-ambient';
    aura.style.setProperty('--aura-size', `${size + 4}px`);
    aura.style.zIndex = '1';
    container.appendChild(aura);
  }

  // ── 7. Ondas de agua (se muestran sólo si el pin cae sobre agua) ─────
  for (let i = 0; i < 2; i++) {
    const ripple = document.createElement('div');
    ripple.className = i === 0 ? 'water-ripple' : 'water-ripple water-ripple-delay';
    ripple.style.setProperty('--ripple-color', mapLayer === 'light' ? '#2563EB' : '#7DD3FC');
    container.appendChild(ripple);
  }

  flatEl.appendChild(container);
}
