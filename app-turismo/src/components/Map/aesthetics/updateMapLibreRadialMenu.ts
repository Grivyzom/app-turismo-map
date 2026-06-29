import { radialMenuRegistry } from '../../../utils/radialMenuRegistry';
import { createSvgIcon } from '../utils/svgIcons';
import { TurismoEvent } from '../types';

export function computeRadialAngles(el: HTMLElement): { startAngle: number; endAngle: number } {
  const rect = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cx = (rect.left + rect.width / 2) / vw;
  const cy = (rect.top + rect.height / 2) / vh;
  const EDGE = 0.25;
  const nearLeft = cx < EDGE;
  const nearRight = cx > 1 - EDGE;
  const nearTop = cy < EDGE;
  const nearBottom = cy > 1 - EDGE;
  if (nearTop && nearLeft) return { startAngle: 0, endAngle: 90 };
  if (nearTop && nearRight) return { startAngle: 90, endAngle: 180 };
  if (nearBottom && nearLeft) return { startAngle: 270, endAngle: 360 };
  if (nearBottom && nearRight) return { startAngle: 180, endAngle: 270 };
  if (nearTop) return { startAngle: 10, endAngle: 170 };
  if (nearBottom) return { startAngle: 190, endAngle: 350 };
  if (nearLeft) return { startAngle: -70, endAngle: 70 };
  if (nearRight) return { startAngle: 110, endAngle: 250 };
  return { startAngle: 190, endAngle: 350 };
}

export function updateMapLibreRadialMenu(
  pinEl: HTMLDivElement,
  event: TurismoEvent,
  isSelected: boolean,
  isHovered: boolean,
  onSelectEvent: (event: TurismoEvent | null) => void,
  menuId: string,
  onSaveLocation?: (data: any) => void,
) {
  const pin = pinEl.querySelector('.marker-3d-pin') as HTMLDivElement | null;
  if (!pin) return;

  // Pin actual rendered size (default 28px)
  const pinW = pin.offsetWidth || 28;
  const BUTTON_SIZE = Math.max(18, Math.min(22, pinW - 6)); // never larger than pin - 6px
  const ICON_SIZE = Math.round(BUTTON_SIZE * 0.55);
  const ORBIT_R = pinW / 2 + BUTTON_SIZE / 2 + 6; // gap of 6px

  const showMenu = isSelected || isHovered;
  let menuContainer = pin.querySelector('.radial-menu-container') as HTMLDivElement | null;

  if (showMenu) {
    // Notify registry — closes all other menus (guard to avoid recursive stack overflow)
    if (radialMenuRegistry.getCurrent() !== menuId) {
      radialMenuRegistry.open(menuId);
    }

    if (!menuContainer) {
      menuContainer = document.createElement('div');
      menuContainer.className = 'radial-menu-container';
      Object.assign(menuContainer.style, {
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: '0px',
        height: '0px',
        pointerEvents: 'none',
        zIndex: '100',
      });
      pin.appendChild(menuContainer);
    }

    if (menuContainer.children.length === 0) {
      const radialItems = [
        { id: 'info', icon: 'info', tooltip: 'Detalles', action: 'info' },
        { id: 'bookmark', icon: 'bookmark', tooltip: 'Guardar', action: 'favorite' },
        { id: 'route', icon: 'directions', tooltip: 'Ruta', action: 'route' },
      ];

      const N = radialItems.length;
      const { startAngle, endAngle } = computeRadialAngles(pinEl);

      radialItems.forEach((item, index) => {
        const island = document.createElement('div');
        Object.assign(island.style, {
          position: 'absolute',
          left: '0px',
          top: '0px',
          zIndex: '150',
          transition:
            'transform 0.32s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.25s ease-out',
          transform: 'translate(0px, 0px) translate(-50%, -50%) scale(0)',
          opacity: '0',
          pointerEvents: 'auto',
        });

        const btn = document.createElement('button');
        btn.type = 'button';
        Object.assign(btn.style, {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: `${BUTTON_SIZE}px`,
          height: `${BUTTON_SIZE}px`,
          borderRadius: '50%',
          backgroundColor: 'rgba(255,255,255,0.95)',
          border: '1px solid rgba(255,255,255,0.4)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          cursor: 'pointer',
          transition: 'background-color 0.15s ease, transform 0.15s ease',
        });

        btn.addEventListener('mouseenter', () => {
          btn.style.backgroundColor = '#fff';
          btn.style.transform = 'scale(1.05)';
        });
        btn.addEventListener('mouseleave', () => {
          btn.style.backgroundColor = 'rgba(255,255,255,0.95)';
          btn.style.transform = 'scale(1)';
        });

        const svg = createSvgIcon(item.icon, ICON_SIZE, '#002d20');
        if (svg) {
          btn.appendChild(svg);
        } else {
          const dotSpan = document.createElement('span');
          Object.assign(dotSpan.style, {
            fontSize: `${ICON_SIZE}px`,
            color: '#002d20',
            lineHeight: '1',
            userSelect: 'none',
          });
          dotSpan.innerText = '•';
          btn.appendChild(dotSpan);
        }

        // Tooltip
        const tooltip = document.createElement('span');
        Object.assign(tooltip.style, {
          position: 'absolute',
          left: '50%',
          bottom: `${-BUTTON_SIZE - 4}px`,
          transform: 'translateX(-50%)',
          padding: '2px 6px',
          borderRadius: '4px',
          backgroundColor: 'rgba(24,24,27,0.92)',
          color: '#fff',
          fontSize: '9px',
          fontWeight: '600',
          whiteSpace: 'nowrap',
          opacity: '0',
          transition: 'opacity 0.15s ease',
          pointerEvents: 'none',
          zIndex: '200',
          border: '1px solid rgba(255,255,255,0.1)',
        });
        tooltip.innerText = item.tooltip;

        btn.addEventListener('mouseenter', () => {
          tooltip.style.opacity = '1';
        });
        btn.addEventListener('mouseleave', () => {
          tooltip.style.opacity = '0';
        });

        btn.onclick = (e) => {
          e.stopPropagation();
          if (item.action === 'info') {
            onSelectEvent(event);
          } else if (item.action === 'favorite') {
            if (onSaveLocation) {
              onSaveLocation({
                locationType: 'event',
                refId: event.id,
                latitude: event.latitude,
                longitude: event.longitude,
                title: event.title,
                notes: event.description,
              });
            } else {
              alert(`Guardado en Pasaporte: ${event.title}`);
            }
          } else if (item.action === 'route') {
            alert(`Calculando ruta hacia: ${event.title}`);
          }
          updateMapLibreRadialMenu(pinEl, event, false, false, onSelectEvent, menuId);
          radialMenuRegistry.close(menuId);
        };

        island.appendChild(btn);
        island.appendChild(tooltip);
        menuContainer!.appendChild(island);

        // Angle distribution
        const angleDeg =
          N === 1
            ? (startAngle + endAngle) / 2
            : startAngle + index * ((endAngle - startAngle) / (N - 1));
        const angleRad = (angleDeg * Math.PI) / 180;
        const x = ORBIT_R * Math.cos(angleRad);
        const y = ORBIT_R * Math.sin(angleRad);

        requestAnimationFrame(() => {
          island.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(1)`;
          island.style.opacity = '1';
        });
      });
    }
  } else {
    if (radialMenuRegistry.getCurrent() === menuId) {
      radialMenuRegistry.close(menuId);
    }
    if (menuContainer) {
      const islands = Array.from(menuContainer.children) as HTMLElement[];
      islands.forEach((island) => {
        island.style.transform = 'translate(0px, 0px) translate(-50%, -50%) scale(0)';
        island.style.opacity = '0';
      });

      const toRemove = menuContainer;
      setTimeout(() => {
        if (toRemove && toRemove.parentNode) {
          toRemove.parentNode.removeChild(toRemove);
        }
      }, 350);
    }
  }
}
