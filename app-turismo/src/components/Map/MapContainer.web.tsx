import React from 'react';

import { MAP_CONFIG } from '../../config/mapConfig';

import { MapContainerProps } from './types';
import { GoogleMapContainer } from './GoogleMapContainer.web';
import { MapLibreContainer } from './MapLibreContainer.web';

export function MapContainer(props: MapContainerProps) {
  if (MAP_CONFIG.provider === 'google') {
    return <GoogleMapContainer {...props} />;
  }

  // Fallback a MapLibre (OpenFreeMap, ESRI, OpenTopoMap)
  return <MapLibreContainer {...props} />;
}
