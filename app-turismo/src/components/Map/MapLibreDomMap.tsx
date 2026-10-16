'use dom';

import React from 'react';
import type { DOMProps } from 'expo/dom';

import { MapLibreContainer } from './MapLibreContainer.web';
import { MAP_PLACEHOLDER_COLOR, type MapContainerProps } from './types';

/**
 * Expo DOM component: monta el mismo MapLibreContainer de la web (MapLibre +
 * OpenStreetMap/OpenFreeMap, pines DOM y capas) dentro de un WebView en iOS/Android.
 * Así los pines y estilos se mantienen en un solo código para web y móvil.
 *
 * Las props cruzan el puente como JSON y los callbacks llegan como acciones
 * asíncronas, por lo que todo lo que se pase aquí debe ser serializable.
 */
export default function MapLibreDomMap(props: MapContainerProps & { dom?: DOMProps }) {
  const { dom: _dom, ...mapProps } = props;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        touchAction: 'none',
        background: MAP_PLACEHOLDER_COLOR,
      }}
    >
      <MapLibreContainer {...mapProps} />
    </div>
  );
}
