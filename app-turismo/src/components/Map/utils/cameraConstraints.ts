/**
 * Restricciones de cámara (pitch/bearing) para el mapa web.
 * Por debajo de MIN_ZOOM_FOR_PITCH_AND_ROTATE el mapa es estrictamente 2D con
 * el norte arriba: evita que un pinch-to-zoom a una mano rote el mapa sin querer.
 */
export const CAMERA_CONSTRAINTS = {
  /** Tope duro de inclinación (jamás superar en móvil). */
  maxPitch: 50,
  /** Pitch de la vista 3D (capa '3d' y botón 3D). */
  pitch3D: 45,
  /** Bearing de la vista 3D: norte arriba. */
  bearing3D: 0,
  /** Con zoom menor los gestos de rotación/inclinación quedan deshabilitados. */
  minZoomForPitchAndRotate: 15,
  /** Al alejarse por debajo de este zoom se nivela a pitch 0 / bearing 0. */
  resetBelowZoom: 14.5,
  resetDurationMs: 450,
  /** La brújula aparece con |bearing| o pitch por encima de estos umbrales. */
  compassBearingThresholdDeg: 3,
  compassPitchThresholdDeg: 5,
  compassResetDurationMs: 400,
} as const;

/** Habilita o deshabilita rotación/inclinación por gesto según el zoom actual. */
export function applyCameraGate(map: any): void {
  if (!map) return;
  const allowed = map.getZoom() >= CAMERA_CONSTRAINTS.minZoomForPitchAndRotate;
  if (allowed) {
    map.dragRotate?.enable();
    map.touchZoomRotate?.enableRotation?.();
    map.touchPitch?.enable();
  } else {
    map.dragRotate?.disable();
    map.touchZoomRotate?.disableRotation?.();
    map.touchPitch?.disable();
  }
}

/** Vuelve a norte arriba y vista cenital. */
export function resetNorthPitch(
  map: any,
  duration: number = CAMERA_CONSTRAINTS.compassResetDurationMs,
): void {
  if (!map) return;
  map.easeTo({ pitch: 0, bearing: 0, duration, essential: true });
}
