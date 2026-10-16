/**
 * ─── Marker Stylesheet ──────────────────────────────────────────────────
 *
 * Toda la CSS de marcadores del mapa vive aquí (antes estaba embebida en
 * MapLibreContainer.web.tsx). Se inyecta una sola vez por documento.
 *
 * Convenciones:
 *  · `.pin-ambient`     → animación ambiental; se puede silenciar en bloque.
 *  · `.pin-ambient-off` → puesto en el pinEl/flatEl, apaga las ambientales
 *                         (zoom bajo, mapas muy densos, reduced-motion).
 *  · Las animaciones ambientales sólo tocan `transform` y `opacity` para que
 *    corran en el compositor y no disparen layout/paint por frame.
 */

export const MARKER_STYLE_ID = 'maplibre-custom-attribution-styles';

export const MAP_MARKER_CSS = `
        .maplibregl-ctrl-attrib {
          opacity: 0.25 !important;
          transition: opacity 0.2s ease !important;
          background-color: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }
        .maplibregl-ctrl-attrib:hover {
          opacity: 0.85 !important;
        }
        .maplibregl-ctrl-attrib-button {
          background-color: rgba(34, 34, 34, 0.6) !important;
          border-radius: 50% !important;
        }

        /* ══════════════════════════════════════════════════════════════
           1. ESTRUCTURA DEL PIN PREMIUM
           ══════════════════════════════════════════════════════════════ */

        .marker-3d-container {
          -webkit-font-smoothing: antialiased;
        }

        /* Capa que recorta gloss y barrido especular al contorno del cuerpo */
        .pin-surface {
          position: absolute;
          inset: 0;
          border-radius: inherit;
          overflow: hidden;
          pointer-events: none;
        }

        /* Reflejo especular fijo: da volumen al cuerpo */
        .pin-gloss {
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
        }

        /* Contenedor libre para flotación/bobbing — el pin en sí lleva la
           rotación de silueta en su transform inline, no se puede compartir */
        .pin-body {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          will-change: transform;
        }

        /* Ancla no rotada para el menú radial (el cuerpo puede ir a -45°) */
        .pin-menu-anchor {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .pin-icon-rotator {
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }

        /* ── Entrada: despliegue desde el punto de anclaje ────────────── */
        @keyframes pinDropIn {
          0%   { transform: scale(0.1) translateY(12px); opacity: 0; }
          50%  { transform: scale(1.08) translateY(-2px); opacity: 1; }
          75%  { transform: scale(0.97) translateY(0); }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        .pin-enter {
          animation: pinDropIn 500ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
          animation-delay: var(--enter-delay, 0ms);
        }

        /* ── Salida: colapso de vuelta al punto de anclaje ─────────────── */
        @keyframes pinDropOut {
          0%   { transform: scale(1) translateY(0); opacity: 1; }
          40%  { transform: scale(1.04) translateY(-2px); opacity: 1; }
          100% { transform: scale(0) translateY(10px); opacity: 0; }
        }
        .pin-dismiss {
          animation: pinDropOut 180ms cubic-bezier(0.4, 0, 1, 1) both;
          pointer-events: none !important;
        }

        /* ══════════════════════════════════════════════════════════════
           2. ONDA EXPANSIVA (SONAR) — sistema unificado
           ══════════════════════════════════════════════════════════════
           Anillo de gradiente radial en vez de disco relleno: al escalar,
           el borde se ensancha y difumina solo, que es como se comporta
           una onda al perder energía. Expansión monótona (nunca "vuelve"),
           entrada rápida y salida exponencial.                          */

        @keyframes pinSonar {
          0%   { transform: translate(-50%, -50%) scale(var(--sonar-from, 0.45)); opacity: 0; }
          9%   { opacity: var(--sonar-peak, 0.5); }
          100% { transform: translate(-50%, -50%) scale(var(--sonar-to, 2.8)); opacity: 0; }
        }
        .pin-sonar {
          position: absolute;
          top: 50%;
          left: 50%;
          width: var(--sonar-size, 30px);
          height: var(--sonar-size, 30px);
          border-radius: 50%;
          background: radial-gradient(
            circle closest-side,
            transparent 50%,
            var(--sonar-color, rgba(255,255,255,0.55)) 74%,
            transparent 92%
          );
          opacity: 0;
          pointer-events: none;
          will-change: transform, opacity;
          transform: translate(-50%, -50%) scale(var(--sonar-from, 0.45));
          animation: pinSonar var(--sonar-duration, 3200ms) cubic-bezier(0.16, 0.84, 0.34, 1) infinite;
          animation-delay: var(--sonar-delay, 0ms);
        }
        /* Variante urgente: anillo más duro y tempo corto */
        .pin-sonar.pin-sonar-alert {
          background: radial-gradient(
            circle closest-side,
            transparent 62%,
            var(--sonar-color, rgba(239,68,68,0.85)) 73%,
            var(--sonar-color, rgba(239,68,68,0.85)) 80%,
            transparent 88%
          );
        }

        /* Aura de popularidad: anillo dorado lento sobre el suelo */
        @keyframes pinAuraPulse {
          0%   { transform: translate(-50%, -50%) scale(0.92); opacity: 0.75; }
          100% { transform: translate(-50%, -50%) scale(1.75); opacity: 0; }
        }
        .pin-aura {
          position: absolute;
          top: 50%;
          left: 50%;
          width: var(--aura-size, 32px);
          height: var(--aura-size, 32px);
          border-radius: 50%;
          border: 1.5px solid #FCD34D;
          box-shadow: 0 0 10px rgba(252, 211, 77, 0.55);
          transform: translate(-50%, -50%) scale(0.92);
          pointer-events: none;
          will-change: transform, opacity;
          animation: pinAuraPulse 3.4s cubic-bezier(0.16, 0.84, 0.34, 1) infinite;
        }

        /* Pedestal: anillo de contacto en el suelo, marca "pin accionable" */
        .pin-pedestal {
          position: absolute;
          top: 50%;
          left: 50%;
          width: var(--pedestal-size, 34px);
          height: var(--pedestal-size, 34px);
          border-radius: 50%;
          border: 1.5px solid var(--pedestal-color, rgba(255,255,255,0.4));
          box-shadow: 0 0 12px var(--pedestal-glow, rgba(255,255,255,0.2));
          transform: translate(-50%, -50%) scale(0.65);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.24s ease, transform 0.34s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .pin-pedestal.is-active {
          opacity: 1;
          transform: translate(-50%, -50%) scale(1);
        }

        /* Cordón de seguridad (emergencias) */
        @keyframes pinCordonSpin { to { transform: translate(-50%, -50%) rotate(360deg); } }
        @keyframes pinCordonFlash { 0%, 100% { opacity: 0.32; } 50% { opacity: 0.78; } }
        .pin-cordon {
          position: absolute;
          top: 50%;
          left: 50%;
          width: var(--cordon-size, 46px);
          height: var(--cordon-size, 46px);
          border-radius: 50%;
          border: 2.5px dashed var(--cordon-color, #EF4444);
          background: var(--cordon-fill, rgba(239, 68, 68, 0.06));
          transform: translate(-50%, -50%);
          pointer-events: none;
          will-change: transform, opacity;
          animation: pinCordonSpin 18s linear infinite, pinCordonFlash 2.1s ease-in-out infinite;
        }

        /* ══════════════════════════════════════════════════════════════
           3. AMBIENTALES POR FAMILIA
           ══════════════════════════════════════════════════════════════ */

        /* Halo: respiración de luz alrededor del cuerpo */
        @keyframes pinHaloBreath {
          0%, 100% { transform: translate(-50%, -50%) scale(1);    opacity: var(--halo-min, 0.3); }
          50%      { transform: translate(-50%, -50%) scale(1.16); opacity: var(--halo-max, 0.62); }
        }
        .pin-halo {
          position: absolute;
          top: 50%;
          left: 50%;
          width: var(--halo-size, 40px);
          height: var(--halo-size, 40px);
          border-radius: 50%;
          background: radial-gradient(
            circle closest-side,
            var(--halo-color, rgba(59,130,246,0.5)) 0%,
            transparent 72%
          );
          transform: translate(-50%, -50%);
          opacity: var(--halo-min, 0.3);
          pointer-events: none;
          will-change: transform, opacity;
          animation: pinHaloBreath 3.8s ease-in-out infinite;
        }

        /* Barrido especular: destello que cruza el cuerpo cada ~5s */
        @keyframes pinSheen {
          0%, 72%  { transform: translateX(-170%) rotate(18deg); }
          100%     { transform: translateX(330%) rotate(18deg); }
        }
        .pin-sheen {
          position: absolute;
          top: -45%;
          left: 0;
          width: 42%;
          height: 190%;
          background: linear-gradient(
            90deg,
            rgba(255,255,255,0) 0%,
            var(--sheen-color, rgba(255,255,255,0.6)) 50%,
            rgba(255,255,255,0) 100%
          );
          transform: translateX(-170%) rotate(18deg);
          pointer-events: none;
          will-change: transform;
          animation: pinSheen 5.4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          animation-delay: var(--sheen-delay, 0ms);
        }

        /* Flotación orgánica (naturaleza / fauna / agua) */
        @keyframes pinFloat {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-2.5px); }
        }
        .pin-float { animation: pinFloat 3.6s ease-in-out infinite; }

        /* Órbita: satélite girando (academia / cultura) */
        @keyframes pinOrbitSpin { to { transform: translate(-50%, -50%) rotate(360deg); } }
        .pin-orbit {
          position: absolute;
          top: 50%;
          left: 50%;
          width: var(--orbit-size, 40px);
          height: var(--orbit-size, 40px);
          transform: translate(-50%, -50%);
          pointer-events: none;
          will-change: transform;
          animation: pinOrbitSpin var(--orbit-duration, 6.5s) linear infinite;
        }
        .pin-orbit-dot {
          position: absolute;
          top: 0;
          left: 50%;
          width: 4px;
          height: 4px;
          margin-left: -2px;
          border-radius: 50%;
          background: var(--orbit-color, #FFFFFF);
          box-shadow: 0 0 7px var(--orbit-color, #FFFFFF);
        }

        /* Barrido de radar (cámaras) */
        @keyframes pinRadarSweep { to { transform: translate(-50%, -50%) rotate(360deg); } }
        .pin-radar {
          position: absolute;
          top: 50%;
          left: 50%;
          width: var(--radar-size, 54px);
          height: var(--radar-size, 54px);
          border-radius: 50%;
          background: conic-gradient(
            from 0deg,
            var(--radar-color, rgba(96,165,250,0.5)) 0deg,
            var(--radar-fade, rgba(96,165,250,0.14)) 26deg,
            transparent 54deg,
            transparent 360deg
          );
          -webkit-mask: radial-gradient(circle closest-side, transparent 26%, #000 30%);
          mask: radial-gradient(circle closest-side, transparent 26%, #000 30%);
          transform: translate(-50%, -50%);
          pointer-events: none;
          will-change: transform;
          animation: pinRadarSweep 3.6s linear infinite;
        }
        /* Cámaras en reposo: sin barrido (display:none ⇒ ni se compone la
           animación). Gira sólo bajo el cursor o con foco de teclado. */
        .camara-radar-idle { display: none; }
        [data-hovered="true"] .camara-radar-idle,
        :focus-visible .camara-radar-idle { display: block; }

        /* Latido vital (salud): doble pulso tipo ECG */
        @keyframes pinVital {
          0%, 100% { transform: translate(-50%, -50%) scale(1);    opacity: 0.38; }
          10%      { transform: translate(-50%, -50%) scale(1.24); opacity: 0.8; }
          22%      { transform: translate(-50%, -50%) scale(1);    opacity: 0.38; }
          32%      { transform: translate(-50%, -50%) scale(1.15); opacity: 0.66; }
          46%      { transform: translate(-50%, -50%) scale(1);    opacity: 0.38; }
        }
        .pin-vital {
          position: absolute;
          top: 50%;
          left: 50%;
          width: var(--vital-size, 44px);
          height: var(--vital-size, 44px);
          border-radius: 50%;
          background: radial-gradient(circle closest-side, var(--vital-color, rgba(220,38,38,0.45)) 0%, transparent 70%);
          transform: translate(-50%, -50%);
          pointer-events: none;
          will-change: transform, opacity;
          animation: pinVital 2.6s ease-in-out infinite;
        }

        /* Brasa (bomberos): parpadeo irregular cálido */
        @keyframes pinEmber {
          0%, 100% { transform: translate(-50%, -50%) scale(1);    opacity: 0.34; }
          28%      { transform: translate(-50%, -50%) scale(1.14); opacity: 0.72; }
          44%      { transform: translate(-50%, -50%) scale(1.03); opacity: 0.46; }
          66%      { transform: translate(-50%, -50%) scale(1.18); opacity: 0.66; }
          82%      { transform: translate(-50%, -50%) scale(1.05); opacity: 0.4; }
        }
        .pin-ember {
          position: absolute;
          top: 50%;
          left: 50%;
          width: var(--ember-size, 44px);
          height: var(--ember-size, 44px);
          border-radius: 50%;
          background: radial-gradient(circle closest-side, rgba(249,115,22,0.55) 0%, rgba(229,62,62,0.18) 45%, transparent 72%);
          transform: translate(-50%, -50%);
          pointer-events: none;
          will-change: transform, opacity;
          animation: pinEmber 2.4s ease-in-out infinite;
        }

        /* Estrobo bicolor (carabineros) */
        @keyframes pinStrobeA { 0%, 46% { opacity: 0.85; } 50%, 100% { opacity: 0; } }
        @keyframes pinStrobeB { 0%, 46% { opacity: 0; } 50%, 100% { opacity: 0.85; } }
        .pin-strobe {
          position: absolute;
          top: 50%;
          left: 50%;
          width: var(--strobe-size, 42px);
          height: var(--strobe-size, 42px);
          border-radius: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
          will-change: opacity;
        }
        .pin-strobe-a {
          background: radial-gradient(circle closest-side at 30% 50%, rgba(37,99,235,0.6) 0%, transparent 62%);
          animation: pinStrobeA 1.6s steps(1, end) infinite;
        }
        .pin-strobe-b {
          background: radial-gradient(circle closest-side at 70% 50%, rgba(220,38,38,0.55) 0%, transparent 62%);
          animation: pinStrobeB 1.6s steps(1, end) infinite;
        }

        /* ══════════════════════════════════════════════════════════════
           4. ESTADOS: seleccionado / hover
           ══════════════════════════════════════════════════════════════ */

        @keyframes pinSelectRing {
          0%   { transform: scale(0.92); opacity: 0.95; }
          70%  { opacity: 0.16; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        .marker-3d-pin.selected-pin-glow::before {
          content: '';
          position: absolute;
          top: -3px; left: -3px; right: -3px; bottom: -3px;
          border-radius: inherit;
          border: 1.5px solid var(--selected-glow-color, #3B82F6);
          animation: pinSelectRing 1.7s cubic-bezier(0.16, 0.84, 0.34, 1) infinite;
          pointer-events: none;
          z-index: -1;
        }

        .marker-3d-pin.emergency-pin::after {
          content: '';
          position: absolute;
          top: -2px; left: -2px; right: -2px; bottom: -2px;
          border-radius: inherit;
          border: 2px solid var(--emergency-color, #EF4444);
          animation: emergencyRipple 1.5s infinite cubic-bezier(0.25, 1, 0.5, 1);
          pointer-events: none;
        }
        @keyframes emergencyRipple {
          0%   { transform: scale(1);    opacity: 0.85; }
          100% { transform: scale(1.55); opacity: 0; }
        }

        /* ══════════════════════════════════════════════════════════════
           5. SILENCIADO DE AMBIENTALES
           ══════════════════════════════════════════════════════════════ */

        .pin-ambient-off .pin-ambient {
          animation: none !important;
          opacity: 0 !important;
        }
        .pin-ambient-off .pin-halo.pin-ambient {
          opacity: var(--halo-min, 0.28) !important;
        }

        /* Mapa congelado (pestaña oculta en móvil): sin trabajo de composición */
        .map-frozen *,
        .map-frozen *::before,
        .map-frozen *::after {
          animation-play-state: paused !important;
        }

        @media (prefers-reduced-motion: reduce) {
          .pin-ambient,
          .pin-enter,
          .marker-3d-pin.selected-pin-glow::before,
          .marker-3d-pin.emergency-pin::after {
            animation: none !important;
          }
          .pin-sonar, .pin-aura, .pin-sheen, .pin-radar, .pin-orbit {
            opacity: 0 !important;
          }
          .pin-halo { opacity: var(--halo-max, 0.5) !important; }
        }

        /* ══════════════════════════════════════════════════════════════
           6. ANIMACIONES HEREDADAS (clusters, fuego, humo, barcos, viñetas)
           ══════════════════════════════════════════════════════════════ */

        @keyframes clusterDataRing {
          0% { transform: scale(1) rotate(0deg); opacity: 0.6; }
          50% { transform: scale(1.6) rotate(180deg); opacity: 0.3; }
          100% { transform: scale(1.1) rotate(360deg); opacity: 0; }
        }
        @keyframes rewardPop {
          0% { transform: translate(-50%, 0) scale(0.5); opacity: 0; }
          50% { transform: translate(-50%, -20px) scale(1.2); opacity: 1; }
          100% { transform: translate(-50%, -30px) scale(1); opacity: 0; }
        }
        @keyframes floatNote1 {
          0% { transform: translate(-50%, 0) translateY(0) scale(0.6) rotate(0deg); opacity: 0; }
          15% { opacity: 0.85; }
          85% { opacity: 0.85; }
          100% { transform: translate(-50%, 0) translateY(-65px) translateX(-18px) scale(1.1) rotate(-15deg); opacity: 0; }
        }
        @keyframes floatNote2 {
          0% { transform: translate(-50%, 0) translateY(0) scale(0.6) rotate(0deg); opacity: 0; }
          15% { opacity: 0.85; }
          85% { opacity: 0.85; }
          100% { transform: translate(-50%, 0) translateY(-75px) translateX(18px) scale(1) rotate(15deg); opacity: 0; }
        }
        @keyframes floatNote3 {
          0% { transform: translate(-50%, 0) translateY(0) scale(0.6) rotate(0deg); opacity: 0; }
          15% { opacity: 0.85; }
          85% { opacity: 0.85; }
          100% { transform: translate(-50%, 0) translateY(-55px) translateX(-5px) scale(1.2) rotate(5deg); opacity: 0; }
        }
        .marker-note {
          position: absolute;
          bottom: 12px;
          left: 50%;
          font-size: 14px;
          color: inherit;
          text-shadow: 0 0 3px rgba(0,0,0,0.6);
          pointer-events: none;
          opacity: 0;
          transform-origin: bottom center;
        }
        @keyframes webClusterPulse {
          0% { transform: scale(1); opacity: 0.65; }
          50% { transform: scale(2.0); opacity: 0.3; }
          100% { transform: scale(1.2); opacity: 0; }
        }
        .cluster-marker-container {
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease;
        }
        .cluster-marker-entering {
          animation: clusterEnter 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        @keyframes clusterEnter {
          0% { transform: scale(0); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes pinBobbing {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-1.5px); }
        }
        .marker-bobbing {
          animation: pinBobbing 2.2s infinite ease-in-out !important;
        }
        @keyframes iconBreathing {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.11); opacity: 0.92; }
        }
        @keyframes fireRise {
          0% { transform: translateY(0) scale(1) rotate(0deg); opacity: 0.8; background: #fb923c; }
          50% { transform: translateY(-10px) scale(1.2) rotate(15deg); opacity: 0.9; background: #ef4444; }
          100% { transform: translateY(-20px) scale(0.5) rotate(-15deg); opacity: 0; background: #b91c1c; }
        }
        .marker-fire-particle {
          position: absolute;
          bottom: 16px;
          left: 50%;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          transform-origin: center;
          filter: blur(1px);
        }
        .fire-particle-1 { animation: fireRise 1.2s infinite ease-in; margin-left: -4px; }
        .fire-particle-2 { animation: fireRise 1.4s infinite ease-in 0.3s; margin-left: -1px; width: 10px; height: 10px; }
        .fire-particle-3 { animation: fireRise 1.1s infinite ease-in 0.6s; margin-left: 2px; }

        @keyframes smokeRise {
          0% { transform: translateY(0) scale(1); opacity: 0.7; }
          100% { transform: translateY(-25px) scale(2.5); opacity: 0; }
        }
        .marker-smoke-particle {
          position: absolute;
          bottom: 16px;
          left: 50%;
          width: 10px;
          height: 10px;
          background: #94a3b8;
          border-radius: 50%;
          filter: blur(2px);
        }
        .smoke-particle-1 { animation: smokeRise 1.5s infinite ease-out; margin-left: -5px; }
        .smoke-particle-2 { animation: smokeRise 1.8s infinite ease-out 0.4s; margin-left: -2px; }
        .smoke-particle-3 { animation: smokeRise 1.6s infinite ease-out 0.8s; margin-left: 3px; }
        @keyframes boatBobbing {
          0%, 100% { transform: translateZ(0); }
          50% { transform: translateZ(1.5px) rotateX(0.5deg) rotateY(0.5deg); }
        }
        .marker-boat-bobbing {
          animation: boatBobbing 3s infinite ease-in-out !important;
          transform-style: preserve-3d;
        }
        @keyframes cloudMove {
          0% { transform: translate(-120%, -120%) scale(1); opacity: 0; }
          10% { opacity: 0.15; }
          90% { opacity: 0.15; }
          100% { transform: translate(250%, 250%) scale(1.5); opacity: 0; }
        }
        .cloud-shadows-container {
          position: absolute;
          top: 0; left: 0; width: 100%; height: 100%;
          overflow: hidden;
          pointer-events: none;
          z-index: 5;
        }
        .cloud-shadow {
          position: absolute;
          background: rgba(0, 0, 0, 0.2);
          filter: blur(80px);
          border-radius: 50%;
          width: 600px;
          height: 400px;
          animation: cloudMove 60s infinite linear;
        }
        @keyframes waterRipple {
          0%   { transform: translate(-50%, -50%) scale(0.35); opacity: 0; }
          12%  { opacity: 0.65; }
          100% { transform: translate(-50%, -50%) scale(1.9);  opacity: 0; }
        }
        .water-ripple {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          border: 1.5px solid var(--ripple-color, #60A5FA);
          pointer-events: none;
          transform: translate(-50%, -50%) scale(0.35);
          will-change: transform, opacity;
          animation: waterRipple 2.6s cubic-bezier(0.16, 0.84, 0.34, 1) infinite;
          z-index: 1;
          display: none; /* hidden by default, toggled in JS */
        }
        .water-ripple-delay { animation-delay: 1.3s; }
        @keyframes boatWakeLeft {
          0% { transform: scale(0.5, 0.5) translate(0, 0) rotate(10deg); opacity: 0; }
          20% { opacity: 0.6; }
          100% { transform: scale(1.5, 3.0) translate(-18px, 45px) rotate(20deg); opacity: 0; }
        }
        @keyframes boatWakeRight {
          0% { transform: scale(0.5, 0.5) translate(0, 0) rotate(-10deg); opacity: 0; }
          20% { opacity: 0.6; }
          100% { transform: scale(1.5, 3.0) translate(18px, 45px) rotate(-20deg); opacity: 0; }
        }
        @keyframes boatBowWave {
          0% { transform: scale(0.4) translateX(-50%); opacity: 0; }
          30% { opacity: 0.4; }
          100% { transform: scale(1.4) translateX(-50%); opacity: 0; }
        }
        @keyframes boatFoam {
          0% { transform: scale(0.7) translate(-50%, 0); opacity: 0.7; }
          100% { transform: scale(2.2) translate(-50%, 25px); opacity: 0; }
        }
        .boat-bow-wave {
          position: absolute;
          top: -4px;
          left: 50%;
          width: 24px;
          height: 12px;
          border-top: 2px solid rgba(255, 255, 255, 0.4);
          border-radius: 50% 50% 0 0;
          transform: translateX(-50%);
          filter: blur(1.5px);
          animation: boatBowWave 2.8s infinite ease-out;
          pointer-events: none;
          z-index: 1;
        }
        .marker-flat-container {
          overflow: visible; /* las ondas deben poder salirse del cuadro */
        }

        /* ─── Viñeta (Badge) Animations ─────────────────────────────── */
        @keyframes vinetaEnter {
          0% { transform: translateX(-50%) scale(0); opacity: 0; }
          60% { transform: translateX(-50%) scale(1.15); opacity: 1; }
          100% { transform: translateX(-50%) scale(1); opacity: 1; }
        }
        @keyframes vinetaPulse {
          0%, 100% { transform: translateX(-50%) scale(1); opacity: 1; }
          50% { transform: translateX(-50%) scale(1.12); opacity: 0.85; }
        }
        @keyframes vinetaGlowRing {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes vinetaGoldShine {
          0% { background-position: 0% center; }
          100% { background-position: 200% center; }
        }
        @keyframes vinetaHeartbeat {
          0%, 100% { transform: translateX(-50%) scale(1); }
          14% { transform: translateX(-50%) scale(1.15); }
          28% { transform: translateX(-50%) scale(1); }
          42% { transform: translateX(-50%) scale(1.15); }
          70% { transform: translateX(-50%) scale(1); }
        }
        @keyframes vinetaCriticalPulse {
          0%, 100% { transform: translateX(-50%) scale(1); box-shadow: 0 2px 8px rgba(220, 38, 38, 0.6), 0 0 0 1.5px rgba(0,0,0,0.3); }
          50% { transform: translateX(-50%) scale(1.15); box-shadow: 0 2px 12px rgba(220, 38, 38, 0.95), 0 0 0 1.5px rgba(220,38,38,0.5); }
        }
        .vineta-badge {
          transition: width 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
                      padding 0.35s ease,
                      border-radius 0.35s ease,
                      transform 0.2s ease,
                      box-shadow 0.2s ease;
        }
        .vineta-label {
          transition: opacity 0.2s ease, max-width 0.35s cubic-bezier(0.25, 1, 0.5, 1), margin-left 0.35s ease;
          display: inline-block;
          max-width: 0;
          opacity: 0;
          overflow: hidden;
          vertical-align: middle;
          white-space: nowrap;
        }
        .vineta-badge.vineta-expanded .vineta-label {
          max-width: 80px;
          opacity: 1;
          margin-left: 2px;
        }
        .vineta-en_vivo {
          animation: vinetaPulse 1.8s infinite ease-in-out !important;
        }
        .vineta-gold-sparkle {
          background-size: 200% auto !important;
          animation: vinetaGoldShine 2.5s infinite linear, vinetaEnter 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards !important;
        }
        .vineta-heartbeat {
          animation: vinetaHeartbeat 2s infinite ease-in-out !important;
        }
        .vineta-critical-pulse {
          animation: vinetaCriticalPulse 1.2s infinite ease-in-out !important;
        }

        /* ══════════════════════════════════════════════════════════════
           MARCADORES PLANOS AL SUELO (Mobiliario, Deporte, Basureros)
           ══════════════════════════════════════════════════════════════ */
        .flat-ground-marker {
          user-select: none;
          -webkit-user-select: none;
          will-change: transform, opacity;
          cursor: pointer;
        }
        .flat-ground-marker .flat-marker-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          pointer-events: none;
          transition: opacity 0.2s ease;
        }
      `;

/** Inyecta la hoja una sola vez por documento. */
export function injectMarkerStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(MARKER_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = MARKER_STYLE_ID;
  style.innerHTML = MAP_MARKER_CSS;
  document.head.appendChild(style);
}
