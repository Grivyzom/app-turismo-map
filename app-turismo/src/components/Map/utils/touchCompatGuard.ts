/**
 * Tras un tap, los navegadores móviles (WebView de Android/iOS en Expo DOM)
 * emulan eventos de mouse de compatibilidad: mouseenter, focus, y a veces
 * mouseleave. En WebKit (iOS) el mouseleave nunca llega, así que el hover
 * queda pegado; en Chromium llega justo después del click y cierra el
 * mini-modal que el tap acababa de fijar. Los handlers de hover deben
 * ignorar esos eventos: en táctil la interacción la resuelve el `click`.
 */
const COMPAT_WINDOW_MS = 800;

let lastTouchAt = -Infinity;

if (typeof window !== 'undefined') {
  const markTouch = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') lastTouchAt = performance.now();
  };
  window.addEventListener('pointerdown', markTouch, { capture: true, passive: true });
  window.addEventListener('pointerup', markTouch, { capture: true, passive: true });
}

export function isTouchCompatMouseEvent(): boolean {
  return performance.now() - lastTouchAt < COMPAT_WINDOW_MS;
}
