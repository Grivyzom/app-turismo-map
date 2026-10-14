import { TurismoEvent } from '../../types';

/**
 * Renderiza un marcador plano estilo medalla circular sobre el plano del mapa para Bancas y Sillas.
 * Basado en el diseño circular deportivo de alta legibilidad, con proyección plana (pitchAlignment: 'map').
 */
export function renderBenchMarker(
  pinEl: HTMLDivElement,
  event: TurismoEvent,
  isSelected: boolean,
  mapLayer = 'dark',
) {
  pinEl.innerHTML = '';
  pinEl.title = event.title || 'Banca';
  const isDark = mapLayer === 'dark' || mapLayer === 'satellite';

  const container = document.createElement('div');
  container.className = 'flat-ground-marker bench-marker';
  Object.assign(container.style, {
    position: 'relative',
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    background: isSelected
      ? 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)'
      : isDark
      ? 'linear-gradient(135deg, rgba(217, 119, 6, 0.95) 0%, rgba(180, 83, 9, 0.85) 100%)'
      : 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
    border: isSelected
      ? '2px solid #FFFFFF'
      : '1.5px solid rgba(255, 255, 255, 0.75)',
    boxShadow: isSelected
      ? '0 0 16px rgba(245, 158, 11, 0.85), 0 3px 10px rgba(0,0,0,0.5)'
      : '0 2px 8px rgba(0,0,0,0.35)',
    cursor: 'pointer',
    transformOrigin: 'center center',
    transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
  });

  // Icono SVG de banca/silla en contenedor con soporte de opacidad para LOD
  container.innerHTML = `
    <div class="flat-marker-icon" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;pointer-events:none;transition:opacity 0.2s ease;">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="#FFFFFF">
        <!-- Respaldo ergonómico -->
        <path d="M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5z"/>
        <!-- Asiento plano -->
        <path d="M3 12a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2z"/>
        <!-- Patas de soporte -->
        <path d="M5 15h2v5H5v-5zM17 15h2v5h-2v-5z"/>
      </svg>
    </div>
  `;

  pinEl.appendChild(container);
}

/**
 * Renderiza un marcador plano sobre el plano del mapa para Máquinas de Ejercicio / Calistenia.
 * Se proyecta en perspectiva con el terreno (pitchAlignment: 'map').
 */
export function renderFitnessMarker(
  pinEl: HTMLDivElement,
  event: TurismoEvent,
  isSelected: boolean,
  mapLayer = 'dark',
) {
  pinEl.innerHTML = '';
  pinEl.title = event.title || 'Máquinas de Ejercicio';
  const isDark = mapLayer === 'dark' || mapLayer === 'satellite';

  const container = document.createElement('div');
  container.className = 'flat-ground-marker fitness-marker';
  Object.assign(container.style, {
    position: 'relative',
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    background: isSelected
      ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
      : isDark
      ? 'linear-gradient(135deg, rgba(6, 78, 59, 0.95) 0%, rgba(4, 120, 87, 0.85) 100%)'
      : 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    border: isSelected
      ? '2px solid #FFFFFF'
      : '1.5px solid rgba(255, 255, 255, 0.75)',
    boxShadow: isSelected
      ? '0 0 16px rgba(16, 185, 129, 0.85), 0 3px 10px rgba(0,0,0,0.5)'
      : '0 2px 8px rgba(0,0,0,0.35)',
    cursor: 'pointer',
    transformOrigin: 'center center',
    transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
  });

  // Icono de mancuerna / fitness en SVG con soporte de opacidad para LOD
  container.innerHTML = `
    <div class="flat-marker-icon" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;pointer-events:none;transition:opacity 0.2s ease;">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="#FFFFFF">
        <path d="M20.57 14.86L22 13.43L20.57 12L17 15.57L8.43 7L12 3.43L10.57 2L9.14 3.43L7.71 2L5.57 4.14L4.14 2.71L2.71 4.14L4.14 5.57L2 7.71L3.43 9.14L2 10.57L3.43 12L7 8.43L15.57 17L12 20.57L13.43 22L14.86 20.57L16.29 22L18.43 19.86L19.86 21.29L21.29 19.86L19.86 18.43L22 16.29L20.57 14.86Z"/>
      </svg>
    </div>
  `;

  pinEl.appendChild(container);
}

/**
 * Renderiza un marcador plano estilo medalla circular sobre el suelo para Basureros y Puntos Limpios.
 * Basado en el diseño circular deportivo de alta legibilidad, con proyección plana (pitchAlignment: 'map').
 */
export function renderTrashMarker(
  pinEl: HTMLDivElement,
  event: TurismoEvent,
  isSelected: boolean,
  mapLayer = 'dark',
) {
  pinEl.innerHTML = '';
  pinEl.title = event.title || 'Punto Limpio / Basurero';
  const isDark = mapLayer === 'dark' || mapLayer === 'satellite';

  const container = document.createElement('div');
  container.className = 'flat-ground-marker trash-marker';
  Object.assign(container.style, {
    position: 'relative',
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    background: isSelected
      ? 'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)'
      : isDark
      ? 'linear-gradient(135deg, rgba(71, 85, 105, 0.95) 0%, rgba(51, 65, 85, 0.85) 100%)'
      : 'linear-gradient(135deg, #64748B 0%, #475569 100%)',
    border: isSelected
      ? '2px solid #FFFFFF'
      : '1.5px solid rgba(255, 255, 255, 0.75)',
    boxShadow: isSelected
      ? '0 0 16px rgba(14, 165, 233, 0.85), 0 3px 10px rgba(0,0,0,0.5)'
      : '0 2px 8px rgba(0,0,0,0.35)',
    cursor: 'pointer',
    transformOrigin: 'center center',
    transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
  });

  // Icono SVG de basurero / papelera en contenedor con soporte de opacidad para LOD
  container.innerHTML = `
    <div class="flat-marker-icon" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;pointer-events:none;transition:opacity 0.2s ease;">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="#FFFFFF">
        <path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z"/>
      </svg>
    </div>
  `;

  pinEl.appendChild(container);
}

/**
 * Renderiza un marcador plano estilo medalla circular sobre el suelo para Fuentes de Agua y Bebederos.
 * Basado en el diseño circular de alta legibilidad, con proyección plana (pitchAlignment: 'map').
 */
export function renderWaterMarker(
  pinEl: HTMLDivElement,
  event: TurismoEvent,
  isSelected: boolean,
  mapLayer = 'dark',
) {
  pinEl.innerHTML = '';
  pinEl.title = event.title || 'Fuente de Agua / Bebedero';
  const isDark = mapLayer === 'dark' || mapLayer === 'satellite';

  const container = document.createElement('div');
  container.className = 'flat-ground-marker water-marker';
  Object.assign(container.style, {
    position: 'relative',
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    background: isSelected
      ? 'linear-gradient(135deg, #38BDF8 0%, #0284C7 100%)'
      : isDark
      ? 'linear-gradient(135deg, rgba(14, 165, 233, 0.95) 0%, rgba(3, 105, 161, 0.85) 100%)'
      : 'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)',
    border: isSelected
      ? '2px solid #FFFFFF'
      : '1.5px solid rgba(255, 255, 255, 0.75)',
    boxShadow: isSelected
      ? '0 0 16px rgba(14, 165, 233, 0.85), 0 3px 10px rgba(0,0,0,0.5)'
      : '0 2px 8px rgba(0,0,0,0.35)',
    cursor: 'pointer',
    transformOrigin: 'center center',
    transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
  });

  // Icono SVG de gota/fuente en contenedor con soporte de opacidad para LOD
  container.innerHTML = `
    <div class="flat-marker-icon" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;pointer-events:none;transition:opacity 0.2s ease;">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="#FFFFFF">
        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
      </svg>
    </div>
  `;

  pinEl.appendChild(container);
}
