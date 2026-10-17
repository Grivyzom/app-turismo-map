/**
 * Datos de la cuenta que la app muestra (nombre, email, foto).
 * Sin dependencias de React Native para poder testearlo con `node --test`.
 */
export interface AuthUser {
  fullName: string;
  firstName: string | null;
  email: string;
  imageUrl: string | null;
}

/** Lo mínimo que se lee del usuario de Clerk (sus tipos difieren entre @clerk/expo y @clerk/react). */
export interface ClerkUserLike {
  fullName?: string | null;
  firstName?: string | null;
  primaryEmailAddress?: { emailAddress?: string | null } | null;
  imageUrl?: string | null;
  hasImage?: boolean;
}

/**
 * Arma el usuario de la sesión desde Clerk, con el perfil guardado como respaldo.
 * Sin foto subida, Clerk igual entrega una imagen genérica: en ese caso `imageUrl` es null.
 */
export function toAuthUser(
  clerkUser: ClerkUserLike | null | undefined,
  profile?: { fullName?: string | null; email?: string | null } | null,
): AuthUser {
  const firstName = clerkUser?.firstName?.trim() || null;
  return {
    fullName: clerkUser?.fullName?.trim() || firstName || profile?.fullName?.trim() || 'Usuario',
    firstName,
    email: clerkUser?.primaryEmailAddress?.emailAddress || profile?.email || '',
    imageUrl: clerkUser?.hasImage && clerkUser.imageUrl ? clerkUser.imageUrl : null,
  };
}
