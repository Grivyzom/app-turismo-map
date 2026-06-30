import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MiniModal } from '../Markers/MiniModal';
import { AuthorityModal } from '../Markers/AuthorityModal';
import { UniversityModal } from '../Markers/UniversityModal';
import { StoreModal } from '../Markers/StoreModal';
import { TurismoEvent } from '../types';

export function updateMapLibreStoreModal(
  pinEl: HTMLDivElement,
  event: TurismoEvent,
  isSelected: boolean,
  isHovered: boolean,
  isLightMode: boolean,
) {
  const showModal = isSelected || isHovered;
  let modalContainer = pinEl.querySelector('.store-modal-container') as HTMLDivElement | null;

  if (showModal) {
    if (!modalContainer) {
      modalContainer = document.createElement('div');
      modalContainer.className = 'store-modal-container';
      Object.assign(modalContainer.style, {
        position: 'absolute',
        left: '50%',
        bottom: '100%',
        width: '0px',
        height: '0px',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: '100',
        pointerEvents: 'auto',
        transition:
          'opacity 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        opacity: '0',
        transform: 'scale(0.3) translateY(40px)',
        transformOrigin: 'bottom center',
      });

      // Solución basada en geometría ("Safe Triangle")
      // Puente invisible entre el pin y el modal para evitar mouseleave
      const safeBridge = document.createElement('div');
      Object.assign(safeBridge.style, {
        position: 'absolute',
        top: '100%',
        left: '-20px',
        right: '-20px',
        height: '20px',
        backgroundColor: 'transparent',
        zIndex: '-1',
      });
      modalContainer.appendChild(safeBridge);

      // Eventos directos en el minimodal
      // Aseguramos que se mantenga abierto mientras el cursor esté dentro
      modalContainer.addEventListener('mouseenter', () => {
        pinEl.dataset.hovered = 'true';
        pinEl.dispatchEvent(new Event('mouseenter'));
      });
      modalContainer.addEventListener('mouseleave', () => {
        pinEl.dispatchEvent(new Event('mouseleave'));
      });

      pinEl.appendChild(modalContainer);

      const root = createRoot(modalContainer);
      (modalContainer as any)._reactRoot = root;

      // Trigger fade-in on next frame
      requestAnimationFrame(() => {
        if (modalContainer) {
          modalContainer.style.opacity = '1';
          modalContainer.style.transform = 'scale(1) translateY(0)';
        }
      });
    }

    const root: Root = (modalContainer as any)._reactRoot;
    if (root) {
      const catLower = event.category?.toLowerCase() || '';
      const isAuthorityEvent = ['hospital', 'clinica', 'bombero', 'carabinero'].includes(catLower);
      const isUniversityEvent = catLower === 'universidad';
      const isStoreEvent = ['tienda', 'gastronomia'].includes(catLower);

      let modalContent;
      if (isAuthorityEvent) {
        modalContent = <AuthorityModal event={event} isLightMode={isLightMode} />;
      } else if (isUniversityEvent) {
        modalContent = <UniversityModal event={event} isLightMode={isLightMode} />;
      } else if (isStoreEvent) {
        modalContent = <StoreModal event={event} isLightMode={isLightMode} />;
      } else {
        modalContent = (
          <MiniModal event={event} isLightMode={isLightMode} isSelected={isSelected} />
        );
      }

      root.render(modalContent);
    }
  } else if (modalContainer) {
    // Punto 3: animación de salida — fade out antes de destruir el React root
    modalContainer.style.opacity = '0';
    modalContainer.style.transform = 'scale(0.8) translateY(15px)';
    const capturedContainer = modalContainer;
    setTimeout(() => {
      const root = (capturedContainer as any)._reactRoot;
      if (root) {
        root.unmount();
        delete (capturedContainer as any)._reactRoot;
      }
      capturedContainer.remove();
    }, 220);
  }
}
