import React, { Suspense } from 'react';

import { GlobalErrorBoundary } from '../../components/ui/GlobalErrorBoundary';
import { LoadingFallback } from '../../components/ui/LoadingFallback';
import { lazyWithRetry } from '../../utils/lazyWithRetry';

const LegacyWebMap = lazyWithRetry(() => import('../../web/LegacyWebMap'));

/**
 * Sección Mapa en la web: el mapa web completo de siempre (filtros, rutas, colecciones…),
 * cargado aparte para no pesar en el Inicio. Su re-tema es el sub-proyecto 2.
 */
export function MapSection() {
  return (
    <GlobalErrorBoundary>
      <Suspense fallback={<LoadingFallback />}>
        <LegacyWebMap />
      </Suspense>
    </GlobalErrorBoundary>
  );
}
