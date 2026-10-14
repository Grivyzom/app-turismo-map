import type React from 'react';
import type maplibregl from 'maplibre-gl';
import { getCategoryColor } from '../../../utils/mapUtils';
import { hexToRgba } from './markerHelpers';
import { updateMarkerDomRefs } from './mapHelpers';
import { AMBIENT_MIN_ZOOM, AMBIENT_MAX_MARKERS } from './mapLibreConfig';
import {
  isEmergencyCategory,
  isMiniModalCategory,
  isUtilityCategory,
} from '../design/pinDesignSystem';
import { updateMapLibreStoreModal } from '../aesthetics/updateMapLibreStoreModal';
import { updateMapLibreRadialMenu } from '../aesthetics/updateMapLibreRadialMenu';

/** Refs del contenedor que lee la pasada de estética en cada ejecución. */
export interface AestheticsRefs {
  activeParkIdRef: React.MutableRefObject<any>;
  isDraggingRef: React.MutableRefObject<any>;
  isMovingRef: React.MutableRefObject<any>;
  isPitchingRef: React.MutableRefObject<any>;
  isRotatingRef: React.MutableRefObject<any>;
  isZoomingRef: React.MutableRefObject<any>;
  lastZonePatternPitchTRef: React.MutableRefObject<any>;
  markersRef: React.MutableRefObject<any>;
  mapLayerRef: React.MutableRefObject<string>;
  onSaveLocationRef: React.MutableRefObject<any>;
  onSelectEventRef: React.MutableRefObject<any>;
  selectedEventRef: React.MutableRefObject<any>;
  userAccuracyRef: React.MutableRefObject<any>;
  updateAestheticsRef: React.MutableRefObject<any>;
}

/**
 * Crea la función que reaplica estética dependiente de zoom/pitch/rotación:
 * fade de patrones, estilos y animaciones de pines, menús radiales, etc.
 */
export function createAestheticsUpdater(
  map: maplibregl.Map,
  {
    activeParkIdRef,
    isDraggingRef,
    isMovingRef,
    isPitchingRef,
    isRotatingRef,
    isZoomingRef,
    lastZonePatternPitchTRef,
    markersRef,
    mapLayerRef,
    onSaveLocationRef,
    onSelectEventRef,
    selectedEventRef,
    userAccuracyRef,
    updateAestheticsRef,
  }: AestheticsRefs,
) {
  const updateAesthetics = () => {
    // map.getLayer() delega en map.style, que queda undefined tras
    // map.remove() (desmontaje / doble montaje de StrictMode / Fast Refresh).
    // Un rAF o timeout pendiente puede llegar después: no hay nada que pintar.
    if (!map.style) return;
    const z = map.getZoom();
    const pitch = map.getPitch();

    // Los fill-pattern SVG (reservas) se tilean en
    // espacio de textura del tile: con pitch alto la proyección en
    // perspectiva desalinea las costuras del patrón entre tiles
    // ("efecto cierre/zipper"). MapLibre no tiene corrección de
    // perspectiva para fill-pattern, así que en vez de arreglar el
    // patrón se desvanece hacia un color plano translúcido a medida
    // que el pitch sube — el patrón solo se ve nítido en vista casi
    // top-down, donde no hay distorsión que lo arruine.
    const patternPitchT = Math.max(0, Math.min(1, (pitch - 20) / 20));
    if (Math.abs(patternPitchT - lastZonePatternPitchTRef.current) > 0.01) {
      lastZonePatternPitchTRef.current = patternPitchT;
      const setFade = (layerId: string, baseOpacity: number) => {
        if (map.getLayer(layerId)) {
          try {
            map.setPaintProperty(layerId, 'fill-opacity', baseOpacity * (1 - patternPitchT));
          } catch {}
        }
      };
      const setFallback = (layerId: string, maxOpacity: number) => {
        if (map.getLayer(layerId)) {
          try {
            map.setPaintProperty(layerId, 'fill-opacity', maxOpacity * patternPitchT);
          } catch {}
        }
      };
      setFade('zones-reserva-pattern', 0.8);
      setFallback('zones-reserva-flat-fallback', 0.35);
    }

    const accuracyState = userAccuracyRef.current;
    if (accuracyState && map.getLayer('user-wave-layer')) {
      userAccuracyRef.current = { ...accuracyState, latitude: accuracyState.latitude };
    }

    // Presupuesto de animación: a zoom bajo o con el mapa saturado sólo
    // dejamos vivas las ambientales críticas (emergencias) y la del pin activo.
    const markerCount = Object.keys(markersRef.current).length;
    const ambientBudgetTight = z < AMBIENT_MIN_ZOOM || markerCount > AMBIENT_MAX_MARKERS;

    Object.keys(markersRef.current).forEach((id) => {
      const markerObj = markersRef.current[id];
      if (!markerObj) return;

      if (markerObj.isCluster) {
        // Clusters are now rendered as native MapLibre layers — skip DOM handling
        return;
      }

      const pinEl = markerObj.pinEl;
      const flatEl = markerObj.flatEl;
      const isSelected =
        selectedEventRef.current?.id === id || pinEl.dataset.localSelected === 'true';

      const cat = pinEl.dataset.category || '';
      const isEmergencyState = isEmergencyCategory(cat);

      // 1. Zoom Adaptation
      let zoomScale = 1;
      let zoomOpacity = 1;
      let showIcon = true;
      let isVisible = true;

      const isBoat = cat === 'embarcacion';
      const isUtility = isUtilityCategory(cat);
      const isFlat = isBoat || markerObj.event?.isFlat === true || isUtility;
      const boatVisibilityThreshold = 14;

      if (isBoat && z < boatVisibilityThreshold) {
        isVisible = false;
        zoomScale = 0;
        zoomOpacity = 0;
      }

      // Mobiliario urbano y utilidades (papeleras, bancas, sillas, basureros, ejercicio):
      // Sistema LOD Adaptativo por Zoom para Plazas y Zonas de Alta Densidad:
      // - z < 14.6: Oculto para vista panorámica de ciudad
      // - 14.6 <= z < 16.5: Micro-gemas compactas (~12px, escala 0.44) sin icono. Reduce la carga visual en un 80%
      //   mostrando cada elemento en su punto exacto sin solapamientos.
      // - 16.5 <= z < 17.3: Transición continua donde la micro-gema florece suavemente hacia la medalla completa (28px).
      // - z >= 17.3: Medalla completa a nivel de calle con icono SVG nítido.
      // - isSelected: Siempre medalla completa destacada (1.0) con su halo.
      const microAmenityMinZoom = 14.6;
      let utilityScale = 1.0;
      let utilityIconOpacity = 1.0;

      if (isUtility) {
        // REGLA: Los pines de utilidad SOLO son visibles cuando su parque correspondiente
        // está seleccionado o activo (en modo Turismo)
        const isParkActive = Boolean(
          markerObj.event?.parkId &&
            activeParkIdRef.current &&
            markerObj.event.parkId === activeParkIdRef.current,
        );
        if (!isParkActive && !isSelected) {
          isVisible = false;
        }

        if (isSelected) {
          utilityScale = 1.0;
          utilityIconOpacity = 1.0;
          zoomOpacity = 1.0;
        } else {
          if (z < microAmenityMinZoom) {
            isVisible = false;
            zoomScale = 0;
            zoomOpacity = 0;
            utilityScale = 0;
            utilityIconOpacity = 0;
          } else if (z < 16.5) {
            // Vista de Plaza / Sector: micro-gema elegante de 12px (escala 0.44)
            const appearProgress = Math.min(1, Math.max(0, (z - microAmenityMinZoom) / 0.8));
            zoomOpacity = appearProgress;
            utilityScale = 0.44;
            utilityIconOpacity = 0;
          } else if (z < 17.3) {
            // Transición suave: florecimiento hacia medalla completa
            zoomOpacity = 1.0;
            const lodProgress = (z - 16.5) / 0.8;
            utilityScale = 0.44 + (1.0 - 0.44) * lodProgress;
            utilityIconOpacity = Math.max(0, Math.min(1, (lodProgress - 0.2) / 0.8));
          } else {
            // Nivel de calle y detalle
            zoomOpacity = 1.0;
            utilityScale = 1.0;
            utilityIconOpacity = 1.0;
          }
        }
      }

      // Update z-index dynamically: selected or hovered pins get high priority.
      // Los pines de utilidad no tienen estado hover.
      const isHovered = !isUtility && pinEl.dataset.hovered === 'true';
      const baseZ = isFlat ? '2' : isBoat ? '1' : '10';
      pinEl.style.zIndex = isSelected || isHovered ? '9999' : baseZ;

      const flatScale = 1;

      const surface = pinEl.dataset.surface || 'land';

      // Pitch 3D Effect Calculation
      const isCamara = cat === 'camara';

      const baseMaxElevation = isFlat ? 0 : isCamara ? 0 : isSelected ? 26 : isHovered ? 22 : 18;
      const elevationGrow =
        isSelected && !isCamara && !isFlat && !isUtility && z > 13 ? (z - 13) * 5.0 : 0;
      const maxElevation = baseMaxElevation + elevationGrow;

      const tentativeElevation = isVisible
        ? Math.sin((pitch * Math.PI) / 180) * maxElevation * zoomScale
        : 0;

      // Oclusión real por edificios 3D.
      // OPTIMIZACIÓN ANTI-PARPADEO CRÍTICA: durante cualquier movimiento de cámara
      // (arrastre, paneo, rotación, pitch o zoom), NO ejecutamos queryRenderedFeatures.
      // Consultar el framebuffer WebGL en cada frame de arrastre provoca caídas severas de FPS
      // y hace que los pines (especialmente cámaras y tiendas) parpadeen de forma violenta
      // al tocar intermitentemente los bordes extruidos de los edificios 3D.
      const isCameraInMotion =
        isMovingRef.current ||
        isDraggingRef.current ||
        isPitchingRef.current ||
        isRotatingRef.current ||
        isZoomingRef.current;

      let occludedByBuilding: boolean = (markerObj as any)._occludedCache ?? false;
      const canQueryOcclusion =
        isVisible &&
        !isBoat &&
        !isFlat &&
        !isUtility &&
        pitch > 20 &&
        markerObj.event &&
        map.getLayer('building-3d') &&
        !isCameraInMotion;

      if (canQueryOcclusion) {
        const groundPoint = map.project([
          markerObj.event!.longitude,
          markerObj.event!.latitude,
        ]);
        // Las cámaras no se elevan, pero su óptica se dibuja sobre el ancla: se
        // testea el centro de la lente (~10-12px arriba). Testear el ancla misma
        // colisiona falsamente con el footprint del edificio detrás de ella.
        const queryElevation = isCamara ? 11 : tentativeElevation;
        const queryY = groundPoint.y - queryElevation;
        const hits = map.queryRenderedFeatures(
          [groundPoint.x, queryY],
          { layers: ['building-3d'] },
        );

        // Histeresis: si el pin ya estaba visible, solo se oculta si una muestra adicional
        // ligeramente más arriba también colisiona con el edificio (evita falsos positivos en bordes).
        if (hits.length > 0) {
          if ((markerObj as any)._occludedCache === false) {
            const confirmHits = map.queryRenderedFeatures(
              [groundPoint.x, queryY - 4],
              { layers: ['building-3d'] },
            );
            occludedByBuilding = confirmHits.length > 0;
          } else {
            occludedByBuilding = true;
          }
        } else {
          occludedByBuilding = false;
        }

        // Guardar en caché para los frames en movimiento
        (markerObj as any)._occludedCache = occludedByBuilding;
      } else if (!isVisible || pitch <= 20 || !map.getLayer('building-3d')) {
        // Limpiar caché cuando las condiciones de oclusión ya no aplican
        (markerObj as any)._occludedCache = false;
        occludedByBuilding = false;
      }

      if (occludedByBuilding) {
        isVisible = false;
      }

      if (!isVisible) {
        pinEl.style.visibility = 'hidden';
        pinEl.style.pointerEvents = 'none';
        if (flatEl) {
          flatEl.style.visibility = 'hidden';
          flatEl.style.pointerEvents = 'none';
        }
        return;
      }

      const elevation = tentativeElevation;

      // Apply visibility and pointer-events
      pinEl.style.visibility = 'visible';
      pinEl.style.pointerEvents = 'auto';

      // Silenciado de animaciones ambientales.
      const muteAmbient = ambientBudgetTight && !isEmergencyState && !isSelected && !isHovered;
      pinEl.classList.toggle('pin-ambient-off', muteAmbient);
      if (flatEl) flatEl.classList.toggle('pin-ambient-off', muteAmbient);

      const baseScale = (isCamara || isFlat || isUtility)
        ? 1.0
        : isSelected
          ? 1.12
          : isHovered
            ? 1.08
            : 1.0;
      let finalScale = baseScale * zoomScale;
      if (isUtility) {
        finalScale = utilityScale;
      }

      if (!markerObj.domRefs) {
        updateMarkerDomRefs(markerObj);
      }
      const domRefs = markerObj.domRefs!;
      const pinWrapper = domRefs.pinWrapper;
      const pin = domRefs.pin;
      const stem = domRefs.stem;
      const icon = domRefs.icon;

      if (flatEl) {
        flatEl.style.visibility = isVisible ? 'visible' : 'hidden';
        flatEl.style.pointerEvents = isVisible ? 'auto' : 'none';

        // Update flat container scale/opacity based on zoom
        const flatContainer = domRefs.flatContainer;
        if (flatContainer) {
          flatContainer.style.opacity = `${zoomOpacity}`;
          flatContainer.style.transform = `scale(${flatScale})`;
        }

        // Fetch shadow/puncture/ripple elements
        const shadowPin = domRefs.shadowPin;
        const shadowStem = domRefs.shadowStem;
        const puncture = domRefs.puncture;
        const ripples = domRefs.ripples;

        if (surface === 'water') {
          // Water layout
          if (puncture) puncture.style.display = 'none';
          if (shadowStem) shadowStem.style.display = 'none';
          if (ripples) {
            ripples.forEach((r: HTMLElement) => (r.style.display = isVisible ? 'block' : 'none'));
          }

          if (shadowPin) {
            shadowPin.style.display = isVisible ? 'block' : 'none';
            // Sombra refractada bajo el agua: más difusa y más tenue
            shadowPin.style.background =
              'radial-gradient(circle closest-side, rgba(8,17,33,0.34) 0%, rgba(8,17,33,0.14) 60%, rgba(8,17,33,0) 100%)';
            shadowPin.style.filter = 'blur(2.5px)';
            shadowPin.style.transform = `translateY(0px) scale(${finalScale * 0.75})`;
            shadowPin.style.opacity = `${zoomOpacity}`;
          }

          // El bobbing vive en `.pin-body`: el cuerpo del pin lleva su
          // rotación de silueta en el transform inline y una animación
          // sobre el mismo elemento se la comería.
          const bobTarget = domRefs.body || pin;
          if (bobTarget) {
            if (isBoat) {
              bobTarget.classList.remove('marker-bobbing');
              bobTarget.classList.add('marker-boat-bobbing');
            } else {
              bobTarget.classList.add('marker-bobbing');
              bobTarget.classList.remove('marker-boat-bobbing');
            }
          }
          if (stem) {
            stem.style.height = '0px';
            stem.style.opacity = '0';
          }
        } else {
          // Land layout
          if (puncture) puncture.style.display = isVisible ? 'block' : 'none';
          if (shadowStem) {
            shadowStem.style.display = isVisible ? 'block' : 'none';
            shadowStem.style.opacity = isVisible ? `${(pitch / 60) * 0.55}` : '0';
            // Stretch the stem shadow backwards on the ground
            shadowStem.style.height = `${elevation * 0.8}px`;
          }
          if (ripples) {
            ripples.forEach((r: HTMLElement) => (r.style.display = 'none'));
          }

          if (shadowPin) {
            shadowPin.style.display = isVisible ? 'block' : 'none';
            shadowPin.style.background =
              'radial-gradient(circle closest-side, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.3) 58%, rgba(0,0,0,0) 100%)';
            shadowPin.style.filter = 'blur(1.5px)';
            // The flex layout pushes shadowPin upward, we just need scale
            shadowPin.style.transform = `scale(${finalScale})`;
            shadowPin.style.opacity = isVisible ? `${zoomOpacity * 0.9}` : '0';
          }

          const landBobTarget = domRefs.body || pin;
          if (landBobTarget) {
            landBobTarget.classList.remove('marker-bobbing');
          }

          // Standing metallic needle stretches to the center of the elevated pin
          if (stem) {
            if (pitch > 0 && isVisible) {
              // El centro del cuerpo depende del tamaño y de la compensación
              // de silueta; el renderer los deja en el dataset del pin.
              const pinHalf = Number(pinEl.dataset.pinHalf) || 14;
              const pinOffset = Number(pinEl.dataset.pinOffset) || 0;
              stem.style.height = `${elevation + pinOffset + pinHalf * finalScale}px`;
              stem.style.opacity = `${(pitch / 60) * 0.95}`;
            } else {
              stem.style.height = '0px';
              stem.style.opacity = '0';
            }
          }
        }

        // Pedestal: anillo de contacto que sólo aparece en hover/selección.
        // Es la afordancia de "este pin abre ficha completa".
        const pedestal = domRefs.pedestal;
        if (pedestal) {
          pedestal.classList.toggle('is-active', isVisible && (isSelected || isHovered));
        }
      }

      // Apply wrapper translation/scaling
      if (pinWrapper) {
        if (cat === 'camara') {
          // Cámara: sin elevation (tooltip no sube) y sin scale (no crece al seleccionar)
          pinWrapper.style.transform = 'translateY(0px) scale(1)';
        } else {
          pinWrapper.style.transform = `translateY(-${elevation}px) scale(${finalScale})`;
        }
        pinWrapper.style.opacity = `${zoomOpacity}`;
      }

      // Marcadores planos al suelo (bancas, sillas, basureros, ejercicio)
      let flatGroundEl = domRefs.flatGroundEl as HTMLElement | null;
      if (!flatGroundEl) {
        flatGroundEl = pinEl.querySelector('.flat-ground-marker');
        if (flatGroundEl) domRefs.flatGroundEl = flatGroundEl;
      }
      if (flatGroundEl) {
        if ((markerObj as any)._lastScale !== finalScale) {
          flatGroundEl.style.transform = `scale(${finalScale})`;
          (markerObj as any)._lastScale = finalScale;
        }
        if ((markerObj as any)._lastOpacity !== zoomOpacity) {
          flatGroundEl.style.opacity = `${zoomOpacity}`;
          (markerObj as any)._lastOpacity = zoomOpacity;
        }

        let iconEl = domRefs.flatMarkerIcon as HTMLElement | null;
        if (!iconEl) {
          iconEl = flatGroundEl.querySelector('.flat-marker-icon');
          if (iconEl) domRefs.flatMarkerIcon = iconEl;
        }
        if (iconEl) {
          const targetIconOp = isSelected ? '1' : `${utilityIconOpacity}`;
          if ((markerObj as any)._lastIconOp !== targetIconOp) {
            iconEl.style.opacity = targetIconOp;
            (markerObj as any)._lastIconOp = targetIconOp;
          }
        }
      }

      // Apply translation to store modal container without scaling it
      let storeModal = domRefs.storeModal;
      if (!storeModal) {
        storeModal = pinEl.querySelector('.store-modal-container') as HTMLDivElement | null;
        if (storeModal) domRefs.storeModal = storeModal;
      }
      if (storeModal) {
        storeModal.style.transform = `translateY(-${elevation}px)`;
      }

      // Silueta, brillo y borde del cuerpo del pin
      if (pin) {
        // La rotación de silueta (gota -45°, rombo +45°) la fija el renderer;
        // aquí sólo la reponemos, nunca la sobrescribimos.
        pin.style.transform = pin.dataset.baseTransform || '';
        pin.style.opacity = `${zoomOpacity}`;

        const eventColor =
          pin.dataset.accent ||
          (markerObj.event
            ? getCategoryColor(markerObj.event.category, markerObj.event.musicStyle)
            : '#3B82F6');

        if (isSelected) {
          pin.classList.add('selected-pin-glow');
          pin.style.setProperty('--selected-glow-color', eventColor);
          pin.style.boxShadow = `0 0 22px ${hexToRgba(eventColor, 0.8)}, 0 10px 26px rgba(2,6,14,0.55), inset 0 1px 0 rgba(255,255,255,0.34)`;
          pin.style.borderColor = eventColor;
          pin.style.borderWidth = '2.5px';
        } else if (isHovered) {
          pin.classList.remove('selected-pin-glow');
          pin.style.boxShadow = `0 0 14px ${hexToRgba(eventColor, 0.55)}, 0 8px 20px rgba(2,6,14,0.5), inset 0 1px 0 rgba(255,255,255,0.28)`;
          pin.style.borderColor = hexToRgba(eventColor, 0.9);
          pin.style.borderWidth = `${pin.dataset.restRimWidth || 1.5}px`;
        } else {
          pin.classList.remove('selected-pin-glow');
          pin.style.boxShadow =
            pin.dataset.restShadow ||
            (isEmergencyState ? '0px 2px 4px rgba(0,0,0,0.5)' : '0px 6px 16px rgba(0,0,0,0.4)');
          pin.style.borderColor = pin.dataset.restRim || hexToRgba(eventColor, 0.6);
          pin.style.borderWidth = `${pin.dataset.restRimWidth || (isEmergencyState ? 2 : 1.5)}px`;
        }
      }

      const notesContainer = domRefs.notesContainer;
      if (notesContainer) {
        notesContainer.style.display = (z >= 15 || isSelected) && isVisible ? 'block' : 'none';
      }

      if (icon) {
        icon.style.opacity = showIcon ? '1' : '0';
      }

      // Dynamically update smart badge (viñeta) expansion
      const badgeEl = domRefs.badgeEl;
      if (badgeEl) {
        const isWideLabel = badgeEl.dataset.wideLabel === 'true';
        const type = badgeEl.dataset.vinetaType || '';

        // Smart Badge Expansion Rules:
        // 1. If the pin is selected or hovered, ALWAYS expand.
        // 2. High zoom (z >= 16) auto-expands ALL badges for glanceability.
        // 3. Medium zoom (14.5 <= z < 16) auto-expands only high priority badges (en_vivo, oferta).
        // 4. Otherwise, keep it collapsed (icon only) to avoid clutter.
        const isHighPriority = type === 'en_vivo' || type === 'oferta';
        const shouldExpand = isSelected || isHovered || z >= 16 || (z >= 14.5 && isHighPriority);

        if (shouldExpand) {
          badgeEl.classList.add('vineta-expanded');
          badgeEl.style.width = isWideLabel ? 'auto' : '16px';
          badgeEl.style.padding = isWideLabel ? '0 6px' : '0';
          badgeEl.style.borderRadius = isWideLabel ? '10px' : '50%';
        } else {
          badgeEl.classList.remove('vineta-expanded');
          badgeEl.style.width = '16px';
          badgeEl.style.padding = '0';
          badgeEl.style.borderRadius = '50%';
        }
      }

      // Dynamically update contextual radial menu or store modal for the pin
      if (markerObj.event) {
        const loboSVG = domRefs.loboSVG;
        if (loboSVG) {
          loboSVG.setAttribute('fill', isSelected ? '#3B82F6' : '#2D3748');
        }

        // La familia del pin decide el tipo de preview: mini-modal in-situ
        // para POI/servicios, menú radial para lo que abre ficha extensa.
        if (isMiniModalCategory(markerObj.event.category)) {
          // Cámara: modal sale del anchor centrado en la lente, no del pinEl
          const camaraAnchor = pinEl.querySelector(
            '.camara-modal-anchor',
          ) as HTMLDivElement | null;
          updateMapLibreStoreModal(
            camaraAnchor ?? pinEl,
            markerObj.event,
            isSelected,
            isHovered,
            mapLayerRef.current === 'light' || mapLayerRef.current === 'streets',
          );
        } else {
          updateMapLibreRadialMenu(
            pinEl,
            markerObj.event,
            isSelected && isVisible,
            isHovered && isVisible,
            onSelectEventRef.current,
            `maplibre-pin-${markerObj.event.id}`,
            onSaveLocationRef.current,
          );
        }
      }
    });
  };

  return updateAesthetics;
}
