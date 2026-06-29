export function getBeforeRoadsOrLabelsLayerId(map: any): string | undefined {
  const style = map.getStyle();
  if (!style || !style.layers) return undefined;

  // Insertar polígonos antes del bloque final de etiquetas, no antes del primer
  // symbol que aparezca: algunos estilos CARTO (positron/voyager) intercalan
  // un symbol (waterway_label) muy temprano, antes de calles y edificios,
  // mientras que dark-matter lo deja al final. Buscar el último layer no-symbol
  // evita que los polígonos queden debajo de calles/edificios en day themes.
  let lastNonSymbolIndex = -1;
  for (let i = 0; i < style.layers.length; i++) {
    if (style.layers[i].type !== 'symbol') lastNonSymbolIndex = i;
  }

  const nextLayer = style.layers[lastNonSymbolIndex + 1];
  return nextLayer ? nextLayer.id : undefined;
}

export function updateMarkerDomRefs(markerObj: any) {
  const { pinEl, flatEl } = markerObj;
  if (!pinEl) return;
  markerObj.domRefs = {
    pinWrapper: pinEl.querySelector('.marker-3d-pin-wrapper'),
    pin: pinEl.querySelector('.marker-3d-pin'),
    stem: pinEl.querySelector('.marker-3d-stem'),
    stemCamara: pinEl.querySelector('.marker-3d-stem-camara'),
    lensContainer: pinEl.querySelector('.marker-camara-lens-container'),
    icon: pinEl.querySelector('.marker-3d-icon'),
    flatContainer: flatEl ? flatEl.querySelector('.marker-flat-container') : null,
    shadowPin: flatEl ? flatEl.querySelector('.marker-3d-shadow-pin') : null,
    shadowStem: flatEl ? flatEl.querySelector('.marker-3d-shadow-stem') : null,
    puncture: flatEl ? flatEl.querySelector('.marker-3d-puncture') : null,
    ripples: flatEl ? flatEl.querySelectorAll('.water-ripple') : null,
    storeModal: pinEl.querySelector('.store-modal-container'),
    notesContainer: pinEl.querySelector('.marker-notes-container'),
    badgeEl: pinEl.querySelector('.vineta-badge'),
    loboSVG: pinEl.querySelector('.marker-lobo-marino-container svg g'),
    boatBody: pinEl.querySelector('.marker-boat-body'),
    wakeContainer: flatEl ? flatEl.querySelector('.boat-wake-container') : null,
  };
}
