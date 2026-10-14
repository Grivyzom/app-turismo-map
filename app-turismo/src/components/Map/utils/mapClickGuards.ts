/**
 * Helper para verificar si un click ocurrió dentro de un modal, input, botón u otro control UI
 * flotante, para evitar que el click perfore hacia el lienzo de MapLibre GL.
 */
export function isClickInsideModalOrInput(e: any): boolean {
  if (!e || !e.originalEvent) return false;
  const orig = e.originalEvent;
  if (orig._turismoHandled) return true;
  const target = orig.target as HTMLElement | null;
  if (!target) return false;
  if (
    typeof target.closest === 'function' &&
    target.closest(
      'input, textarea, button, select, [role="button"], [role="tab"], .router-hud-modal, [data-modal="true"], [data-prevent-map-click="true"]'
    )
  ) {
    orig._turismoHandled = true;
    return true;
  }
  return false;
}
