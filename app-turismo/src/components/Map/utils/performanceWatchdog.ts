/**
 * Watchdog de rendimiento: degrada el mapa a modo liviano 2D cuando el
 * dispositivo no sostiene el framerate, está con batería crítica o el
 * usuario pidió ahorro de datos. Sólo muestrea frames MIENTRAS el mapa se
 * mueve (movestart→moveend), así que en reposo no agrega ningún bucle.
 */

export const PERF_WATCHDOG = {
  /** Ventana de evaluación mientras hay gesto activo. */
  evalWindowMs: 2000,
  /** p90 del frame time por encima de esto (~<35 FPS) cuenta como ventana mala. */
  p90BudgetMs: 28.5,
  /** Ventanas malas consecutivas necesarias para degradar (evita falsos positivos). */
  badWindowsToDegrade: 2,
  /** Mínimo de frames por ventana para que el p90 sea confiable. */
  minSamples: 30,
  /** Frames más largos que esto son stalls (tab oculta, GC) y se descartan. */
  stallMs: 250,
  batteryCriticalLevel: 0.2,
  /** Tope del pixel ratio en modo liviano. */
  lightPixelRatio: 1.75,
  lowEndGpuRegex: /Mali-G52|Mali-G57|Mali-4|Mali-T|Adreno \(?TM\)? ?(5\d\d|610|612)|PowerVR/i,
} as const;

export type DegradeReason = 'frame-time' | 'low-end-gpu' | 'battery' | 'save-data';

export function getGlRenderer(map: any): string {
  try {
    const gl = map.painter?.context?.gl ?? map.getCanvas?.().getContext?.('webgl2');
    const ext = gl?.getExtension?.('WEBGL_debug_renderer_info');
    return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
  } catch {
    return '';
  }
}

export function calculateP90(samples: number[]): number {
  if (!samples.length) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))];
}

/** Aplica el modo liviano: 2D, sin inclinación y pixel ratio acotado. */
export function enableLightweightMode(map: any): void {
  try {
    map.setMaxPitch(0);
    if (map.getPitch() > 0) map.easeTo({ pitch: 0, duration: 400, essential: true });
    map.touchPitch?.disable();
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    map.setPixelRatio(Math.min(dpr, PERF_WATCHDOG.lightPixelRatio));
  } catch {}
}

/**
 * Adjunta el watchdog al mapa. Devuelve un cleanup.
 * `onDegrade` se llama una sola vez por sesión del mapa.
 */
export function attachPerformanceWatchdog(
  map: any,
  onDegrade: (reason: DegradeReason) => void,
): () => void {
  let degraded = false;
  let rafId: number | null = null;
  let lastTs = 0;
  let windowStart = 0;
  let samples: number[] = [];
  let badWindows = 0;

  const degrade = (reason: DegradeReason) => {
    if (degraded) return;
    degraded = true;
    stopSampling();
    enableLightweightMode(map);
    onDegrade(reason);
  };

  // Chequeos estáticos (una vez, sin muestreo).
  const nav: any = typeof navigator !== 'undefined' ? navigator : {};
  if (nav.connection?.saveData === true) {
    degrade('save-data');
    return () => {};
  }
  if (PERF_WATCHDOG.lowEndGpuRegex.test(getGlRenderer(map))) {
    degrade('low-end-gpu');
    return () => {};
  }
  let battery: any = null;
  nav.getBattery?.().then((b: any) => { battery = b; }).catch(() => {});

  const evaluate = () => {
    const p90 = calculateP90(samples);
    const enough = samples.length >= PERF_WATCHDOG.minSamples;
    samples = [];
    windowStart = performance.now();
    if (
      battery &&
      !battery.charging &&
      battery.level < PERF_WATCHDOG.batteryCriticalLevel
    ) {
      degrade('battery');
      return;
    }
    if (!enough) return;
    badWindows = p90 > PERF_WATCHDOG.p90BudgetMs ? badWindows + 1 : 0;
    if (badWindows >= PERF_WATCHDOG.badWindowsToDegrade) degrade('frame-time');
  };

  const tick = (ts: number) => {
    const dt = ts - lastTs;
    lastTs = ts;
    if (dt > 0 && dt < PERF_WATCHDOG.stallMs) samples.push(dt);
    if (ts - windowStart >= PERF_WATCHDOG.evalWindowMs) evaluate();
    rafId = degraded ? null : requestAnimationFrame(tick);
  };

  const startSampling = () => {
    if (degraded || rafId !== null) return;
    lastTs = performance.now();
    windowStart = lastTs;
    samples = [];
    rafId = requestAnimationFrame(tick);
  };

  function stopSampling() {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
  }

  const onMoveEnd = () => {
    // Cierra la ventana parcial sólo si ya tiene muestras suficientes.
    if (samples.length >= PERF_WATCHDOG.minSamples) evaluate();
    stopSampling();
    // Un gesto interrumpido no debe encadenar ventanas malas con el siguiente.
    badWindows = Math.min(badWindows, PERF_WATCHDOG.badWindowsToDegrade - 1);
  };

  map.on('movestart', startSampling);
  map.on('moveend', onMoveEnd);
  return () => {
    stopSampling();
    map.off('movestart', startSampling);
    map.off('moveend', onMoveEnd);
  };
}
