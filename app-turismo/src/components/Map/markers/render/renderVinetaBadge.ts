import { Vineta } from '../../types';
import { createSvgIcon } from '../../utils/svgIcons';
import { VINETA_CONFIG } from '../../utils/vinetaConfig';

/**
 * Renderiza una viñeta (badge) circular en el borde superior del pin.
 * La viñeta es un pequeño círculo con ícono + texto superpuesto
 * exactamente en el borde superior del pin principal (28px de diámetro).
 */
export function renderVinetaBadge(pinWrapper: HTMLDivElement, vineta: Vineta) {
  if (vineta.active === false) return;

  const config = VINETA_CONFIG[vineta.type];
  if (!config) return;

  const label = vineta.label || config.defaultLabel;
  const hasLabel = label && label.length > 0;
  const isWideLabel = hasLabel && label.length > 2;

  // Compute dynamic smart coloring and custom animation classes based on values
  let bg = config.bg;
  let glow = config.glow;
  let animClass = '';
  let customStyles: Record<string, string> = {};

  if (vineta.type === 'aforo' && typeof vineta.value === 'number') {
    if (vineta.value >= 80) {
      bg = 'linear-gradient(135deg, #EF4444 0%, #F97316 100%)'; // Red-orange (crowded/busy)
      glow = 'rgba(239, 68, 68, 0.75)';
      animClass = 'vineta-critical-pulse'; // dynamic warning pulse for crowded venues
    } else if (vineta.value >= 50) {
      bg = 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)'; // Amber/Yellow (moderate load)
      glow = 'rgba(245, 158, 11, 0.6)';
    } else {
      bg = 'linear-gradient(135deg, #34D399 0%, #10B981 100%)'; // Emerald/Green (uncongested / quiet)
      glow = 'rgba(16, 185, 129, 0.6)';
    }
  } else if (vineta.type === 'calificacion' && typeof vineta.value === 'number') {
    if (vineta.value >= 4.5) {
      // Luxury Gold gradient with linear sheen sweep animation
      bg = 'linear-gradient(120deg, #F2C94C 0%, #FFF5C0 50%, #F2994A 100%)';
      glow = 'rgba(242, 201, 76, 0.8)';
      animClass = 'vineta-gold-sparkle';
      customStyles = {
        backgroundSize: '200% auto',
      };
    } else if (vineta.value >= 3.8) {
      bg = 'linear-gradient(135deg, #E2E8F0 0%, #94A3B8 100%)'; // Silver
      glow = 'rgba(148, 163, 184, 0.5)';
    } else {
      bg = 'linear-gradient(135deg, #D97706 0%, #78350F 100%)'; // Bronze
      glow = 'rgba(180, 83, 9, 0.4)';
    }
  } else if (vineta.type === 'disponibilidad' && typeof vineta.value === 'number') {
    if (vineta.value <= 5) {
      bg = 'linear-gradient(135deg, #EF4444 0%, #991B1B 100%)'; // Red (urgent/highly limited)
      glow = 'rgba(239, 68, 68, 0.8)';
      animClass = 'vineta-critical-pulse';
    } else {
      bg = 'linear-gradient(135deg, #2DD4BF 0%, #14B8A6 100%)'; // Teal (good availability)
      glow = 'rgba(20, 184, 166, 0.6)';
    }
  } else if (vineta.type === 'oferta') {
    bg = 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)'; // Neon hot pink / purple
    glow = 'rgba(236, 72, 153, 0.75)';
    animClass = 'vineta-heartbeat'; // heartbeat pulse animation for hot offers
  } else if (vineta.type === 'en_vivo') {
    animClass = 'vineta-en_vivo';
  }

  // Badge container: positioned at top center of the 28px pin circle
  const badge = document.createElement('div');
  badge.className = `vineta-badge ${animClass}`;
  badge.dataset.wideLabel = isWideLabel ? 'true' : 'false';
  badge.dataset.vinetaType = vineta.type; // Save type for automatic zoom expansion

  Object.assign(badge.style, {
    position: 'absolute',
    top: '-6px', // Overlap with top edge of 28px pin
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2px',
    height: '16px',
    minWidth: '16px',
    width: '16px', // Start collapsed, dynamically expanded in updateAesthetics
    padding: '0',
    borderRadius: '50%',
    background: bg,
    boxShadow: `0 2px 8px ${glow}, 0 0 0 1.5px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.25)`,
    zIndex: '10',
    pointerEvents: 'none',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    cursor: 'default',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    ...customStyles,
  });

  // Default entry animation if not using customized animClass
  if (!animClass) {
    badge.style.animation = 'vinetaEnter 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
  }

  // Create and append inline SVG icon
  const svg = createSvgIcon(config.iconName, 10, '#FFFFFF');
  if (svg) {
    badge.appendChild(svg);
  }

  // Label text
  if (hasLabel) {
    const labelSpan = document.createElement('span');
    labelSpan.className = 'vineta-label';
    Object.assign(labelSpan.style, {
      fontSize: '8px',
      fontWeight: '700',
      color: '#FFFFFF',
      lineHeight: '1',
      textShadow: '0 1px 2px rgba(0,0,0,0.4)',
      letterSpacing: '0.3px',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    });
    labelSpan.innerText = label;
    badge.appendChild(labelSpan);
  }

  // Glow ring for 'en_vivo' type (pulsing ring behind badge)
  if (vineta.type === 'en_vivo') {
    const glowRing = document.createElement('div');
    glowRing.className = 'vineta-glow-ring';
    Object.assign(glowRing.style, {
      position: 'absolute',
      top: '-3px',
      left: '-3px',
      right: '-3px',
      bottom: '-3px',
      borderRadius: 'inherit',
      border: '1.5px solid rgba(239, 68, 68, 0.6)',
      animation: 'vinetaGlowRing 1.8s infinite ease-in-out',
      pointerEvents: 'none',
    });
    badge.appendChild(glowRing);
  }

  pinWrapper.appendChild(badge);
}
