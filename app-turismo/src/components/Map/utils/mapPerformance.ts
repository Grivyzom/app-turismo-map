/**
 * Perfil de rendimiento del mapa MapLibre.
 *
 * En iOS/Android el mapa corre dentro de un WebView (Expo DOM component) y
 * comparte CPU/GPU con la app nativa, en teléfonos de cualquier gama. El
 * "modo liviano" recorta lo que más cuesta sin cambiar lo que se ve:
 * pixel ratio, animaciones simultáneas y efectos decorativos.
 *
 * El flag es de módulo porque cada WebView monta un único mapa y así lo leen
 * también las pasadas de estética, que no reciben props.
 */

let lite = false;

export function setMapPerformanceLite(value: boolean): void {
  lite = value;
}

export function isMapPerformanceLite(): boolean {
  return lite;
}

/** Con modo liviano, cuántos pines pueden tener animaciones ambientales a la vez. */
export const LITE_AMBIENT_MAX_MARKERS = 12;

/** Con más pines nuevos que esto en un mismo lote no se anima su entrada. */
export const MAX_ANIMATED_PIN_ENTRIES = 8;

/**
 * Equipo modesto: pocos núcleos o poca RAM (deviceMemory sólo existe en
 * Chromium, es decir Android). En iOS WKWebView no hay pistas, se asume medio.
 */
export function isLowEndDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency || 0;
  const memory = nav.deviceMemory || 0;
  return (cores > 0 && cores <= 4) || (memory > 0 && memory <= 3);
}

/** Pixel ratio del canvas en modo liviano: 1.5 en gama baja, 2 en el resto. */
export function getLitePixelRatio(): number {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  return Math.min(dpr, isLowEndDevice() ? 1.5 : 2);
}
