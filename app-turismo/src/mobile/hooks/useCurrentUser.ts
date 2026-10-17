import { useMemo } from 'react';

import { useAuth } from '../../context/AuthContext';
import { useMobileApp } from '../MobileAppContext';
import { CurrentUser, resolveCurrentUser } from '../session';

/** Quién está usando la app, para mostrarlo: una sola fuente para header, saludo y perfil. */
export function useCurrentUser(): CurrentUser {
  const { isAuthenticated, user } = useAuth();
  const { prefs } = useMobileApp();
  return useMemo(
    () => resolveCurrentUser({ isAuthenticated, user, nick: prefs.nick, photoUri: prefs.photoUri }),
    [isAuthenticated, user, prefs.nick, prefs.photoUri],
  );
}
