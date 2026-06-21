import React, { Suspense } from 'react';

import { MAP_CONFIG } from '../../config/mapConfig';
import { LoadingFallback } from '../ui/LoadingFallback';
import { lazyWithRetry } from '../../utils/lazyWithRetry';

import { MapContainerProps } from './types';

// Lazy-load both map providers so that maplibre-gl (the heaviest dependency,
// ~200-250 KiB) and the Google Maps SDK are split into separate chunks and only
// downloaded once the map is about to render — not on the initial page load.
const GoogleMapContainer = lazyWithRetry(() =>
  import('./GoogleMapContainer.web').then((m) => ({ default: m.GoogleMapContainer })),
);

const MapLibreContainer = lazyWithRetry(() =>
  import('./MapLibreContainer.web').then((m) => ({ default: m.MapLibreContainer })),
);

export function MapContainer(props: MapContainerProps) {
  if (MAP_CONFIG.provider === 'google') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <GoogleMapContainer {...props} />
      </Suspense>
    );
  }

  // Fallback a MapLibre (OpenFreeMap, ESRI, OpenTopoMap)
  return (
    <Suspense fallback={<LoadingFallback />}>
      <MapLibreContainer {...props} />
    </Suspense>
  );
}
