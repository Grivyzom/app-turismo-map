/** Reglas de la sesión del shell móvil, sin dependencias de React Native (testeables con node). */

export interface WelcomeState {
  /** La sesión todavía se está restaurando. */
  authLoading: boolean;
  /** Pasó el tiempo máximo de espera de la sesión. */
  authWaitExpired: boolean;
  isAuthenticated: boolean;
  /** Eligió "Continuar como invitado" en esta apertura. */
  guestDismissed: boolean;
}

/**
 * La bienvenida sale mientras no haya sesión. Si la sesión no se resuelve a tiempo
 * (p. ej. Clerk no carga sin conexión) también sale: nunca se entra sin elegir.
 */
export function shouldShowWelcome({
  authLoading,
  authWaitExpired,
  isAuthenticated,
  guestDismissed,
}: WelcomeState): boolean {
  return (!authLoading || authWaitExpired) && !isAuthenticated && !guestDismissed;
}
