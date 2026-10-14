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

// Los polígonos de zona (humedal/agua/parque/reserva) deben quedar por
// debajo de los puentes (capas 'bridge_*' del estilo liberty/OpenMapTiles,
// que ya vienen antes de 'building'/'building-3d' en el stack) para que un
// puente sobre un río/lago/humedal se vea encima del relleno en vez de
// "flotar" bajo él. Usar 'building-3d' como beforeId sin más empuja las
// capas custom por encima de TODOS los bridge_*, porque building-3d está
// después de ellos en el array de capas del estilo base.
export function getBeforeBridgesOrBuildingLayerId(map: any): string | undefined {
  const style = map.getStyle();
  if (!style || !style.layers) return undefined;

  const bridgeLayer = style.layers.find(
    (l: any) => typeof l.id === 'string' && l.id.startsWith('bridge_'),
  );
  if (bridgeLayer) return bridgeLayer.id;

  if (map.getLayer('building-3d')) return 'building-3d';

  return getBeforeRoadsOrLabelsLayerId(map);
}

export function updateMarkerDomRefs(markerObj: any) {
  const { pinEl, flatEl } = markerObj;
  if (!pinEl) return;
  markerObj.domRefs = {
    pinWrapper: pinEl.querySelector('.marker-3d-pin-wrapper'),
    pin: pinEl.querySelector('.marker-3d-pin'),
    // Capa libre entre wrapper y cuerpo: aloja bobbing/flotación sin pisar
    // la rotación de silueta que el cuerpo lleva en su transform inline.
    body: pinEl.querySelector('.pin-body'),
    stem: pinEl.querySelector('.marker-3d-stem'),
    stemCamara: pinEl.querySelector('.marker-3d-stem-camara'),
    lensContainer: pinEl.querySelector('.marker-camara-lens-container'),
    icon: pinEl.querySelector('.marker-3d-icon'),
    flatContainer: flatEl ? flatEl.querySelector('.marker-flat-container') : null,
    shadowPin: flatEl ? flatEl.querySelector('.marker-3d-shadow-pin') : null,
    shadowStem: flatEl ? flatEl.querySelector('.marker-3d-shadow-stem') : null,
    puncture: flatEl ? flatEl.querySelector('.marker-3d-puncture') : null,
    pedestal: flatEl ? flatEl.querySelector('.pin-pedestal') : null,
    ripples: flatEl ? flatEl.querySelectorAll('.water-ripple') : null,
    storeModal: pinEl.querySelector('.store-modal-container'),
    notesContainer: pinEl.querySelector('.marker-notes-container'),
    badgeEl: pinEl.querySelector('.vineta-badge'),
    loboSVG: pinEl.querySelector('.marker-lobo-marino-container svg g'),
    boatBody: pinEl.querySelector('.marker-boat-body'),
    wakeContainer: flatEl ? flatEl.querySelector('.boat-wake-container') : null,
    flatGroundEl: pinEl.querySelector('.flat-ground-marker'),
    flatMarkerIcon: pinEl.querySelector('.flat-marker-icon'),
  };
}
