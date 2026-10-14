import type maplibregl from 'maplibre-gl';

// ── Helpers para Trazado 2D Procedural con Flechas Direccionales ─────────────
export const ROUTE_CHEVRON_ID = 'route-direction-chevron';

export function ensureRouteChevronImage(map: maplibregl.Map, onReady?: () => void) {
  if (map.hasImage(ROUTE_CHEVRON_ID)) {
    if (onReady) onReady();
    return;
  }
  if (typeof document === 'undefined') return;
  try {
    const size = 48;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, size, size);

      // Casing verde oscuro para contraste máximo sobre cualquier fondo o satélite
      ctx.strokeStyle = '#022c22';
      ctx.lineWidth = 11;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(14, 10);
      ctx.lineTo(34, 24);
      ctx.lineTo(14, 38);
      ctx.stroke();

      // Flecha central blanca de alto brillo
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 5.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(14, 10);
      ctx.lineTo(34, 24);
      ctx.lineTo(14, 38);
      ctx.stroke();

      const imgData = ctx.getImageData(0, 0, size, size);
      map.addImage(ROUTE_CHEVRON_ID, imgData, { pixelRatio: 2 });
    }
  } catch (err) {
    console.warn('[MapLibre] Could not generate chevron canvas image:', err);
  }
  if (onReady) onReady();
}

export function ensureDraftRouteMarkerStyles() {
  const styleId = 'draft-route-marker-styles';
  let style = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = styleId;
    document.head.appendChild(style);
  }
  style.innerHTML = `
    .draft-route-pin-wrapper {
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      cursor: pointer;
      user-select: none;
      pointer-events: auto;
      z-index: 3000 !important;
      opacity: 1 !important;
      visibility: visible !important;
      will-change: transform;
    }
    .draft-pin-waypoint.draft-route-pin-wrapper {
      width: 30px;
      height: 30px;
    }
    .draft-route-pin-wrapper.maplibregl-marker-covered {
      opacity: 1 !important;
      visibility: visible !important;
    }
    .draft-pin-enter {
      animation: draftPinPop 0.22s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    @keyframes draftPinPop {
      0% { transform: scale(0.2); opacity: 0; }
      100% { transform: scale(1); opacity: 1; }
    }
    .draft-route-pulse {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      animation: draftRoutePulse 1.8s cubic-bezier(0.25, 1, 0.5, 1) infinite;
    }
    @keyframes draftRoutePulse {
      0% { transform: translate(-50%, -50%) scale(0.65); opacity: 0.85; }
      70% { transform: translate(-50%, -50%) scale(1.6); opacity: 0; }
      100% { transform: translate(-50%, -50%) scale(0.65); opacity: 0; }
    }
    .draft-route-pin-body {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2.5px solid #FFFFFF;
      font-weight: 800;
      font-size: 13px;
      color: #FFFFFF;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45);
      position: relative;
      z-index: 2;
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    .draft-pin-origin .draft-route-pin-body {
      background: linear-gradient(135deg, #10B981 0%, #059669 100%);
      box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.35), 0 4px 16px rgba(16, 185, 129, 0.7), 0 2px 6px rgba(0,0,0,0.4);
    }
    .draft-pin-origin .draft-route-pulse {
      background: rgba(16, 185, 129, 0.45);
    }
    .draft-pin-destination .draft-route-pin-body {
      background: linear-gradient(135deg, #EF4444 0%, #B91C1C 100%);
      box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.35), 0 4px 16px rgba(239, 68, 68, 0.7), 0 2px 6px rgba(0,0,0,0.4);
    }
    .draft-pin-destination .draft-route-pulse {
      background: rgba(239, 68, 68, 0.45);
    }
    .draft-pin-waypoint .draft-route-pin-body {
      background: linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%);
      box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.35), 0 4px 12px rgba(14, 165, 233, 0.5), 0 2px 5px rgba(0,0,0,0.35);
      width: 26px;
      height: 26px;
      font-size: 12px;
    }
    .draft-pin-waypoint .draft-route-pulse {
      display: none;
    }
    .draft-route-label-pill {
      position: absolute;
      bottom: calc(100% + 7px);
      left: 50%;
      transform: translateX(-50%);
      background: rgba(15, 23, 42, 0.92);
      border: 1px solid rgba(255, 255, 255, 0.25);
      backdrop-filter: blur(8px);
      color: #F8FAFC;
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 9999px;
      white-space: nowrap;
      pointer-events: none;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      letter-spacing: 0.3px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      z-index: 10;
    }
  `;
}
