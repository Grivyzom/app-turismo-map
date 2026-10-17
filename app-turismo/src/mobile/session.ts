/** Reglas de la sesión del shell móvil, sin dependencias de React Native (testeables con node). */
import type { AuthUser } from '../utils/authUser';

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

/** Identidad que muestran el header, el saludo y el perfil. */
export interface CurrentUser {
  isGuest: boolean;
  /** Nombre visible: apodo elegido → nombre de la cuenta → "Visitante". */
  displayName: string;
  /** Nombre para el saludo ("Hola, Ana"); null para el invitado. */
  greetingName: string | null;
  /** Foto elegida en el perfil → foto de la cuenta → null (se muestran iniciales). */
  avatarUrl: string | null;
  email: string | null;
}

export const GUEST_NAME = 'Visitante';

/**
 * Arma la identidad visible combinando la cuenta con lo que el usuario personalizó en el
 * perfil (apodo y foto, que tienen prioridad). El invitado no usa lo local: puede venir
 * de una sesión anterior en el mismo teléfono.
 */
export function resolveCurrentUser({
  isAuthenticated,
  user,
  nick,
  photoUri,
}: {
  isAuthenticated: boolean;
  user: AuthUser | null;
  nick: string;
  photoUri: string | null;
}): CurrentUser {
  if (!isAuthenticated) {
    return {
      isGuest: true,
      displayName: GUEST_NAME,
      greetingName: null,
      avatarUrl: null,
      email: null,
    };
  }
  const alias = nick.trim();
  const accountFirst = user?.firstName || user?.fullName.split(/\s+/)[0] || null;
  return {
    isGuest: false,
    displayName: alias || user?.fullName || 'Usuario',
    greetingName: alias || accountFirst,
    avatarUrl: photoUri || user?.imageUrl || null,
    email: user?.email || null,
  };
}
