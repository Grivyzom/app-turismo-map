import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { Platform } from 'react-native';

import { getAuthTokenAsync, saveAuthTokenAsync, clearAuthTokenAsync } from '../utils/authStorage';
import { loadUserProfile, clearUserProfile } from '../utils/userProfileStorage';
import { clearTokenCache } from '../utils/collectionsApi';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  userType: string | null;
}

interface AuthContextType extends AuthState {
  signIn: (token: string, remember?: boolean, redirectPath?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

function useProtectedRoute(user: AuthState) {
  const segments = useSegments() as string[];
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();

  useEffect(() => {
    // Esperar a que la navegación de root esté lista antes de intentar redirigir
    // En Web, no requerimos obligatoriamente rootNavigationState?.key para evitar deadlocks en producción.
    const isNavigationReady = Platform.OS === 'web' ? true : !!rootNavigationState?.key;
    if (!isNavigationReady) return;
    if (user.isLoading) return;

    // Si estamos en la ruta de negocios
    if (segments[0] === 'business') {
      const inBusinessAuth =
        segments[1] === 'ingresar' || segments[1] === 'register' || segments[1] === 'login';

      if (!user.isAuthenticated) {
        if (!inBusinessAuth) {
          router.replace('/business/ingresar');
        }
      } else {
        // Logueado
        if (
          user.userType !== 'partner_owner' &&
          user.userType !== 'partner_worker' &&
          user.userType !== 'admin'
        ) {
          // Si el usuario no tiene rol de empresa pero intenta acceder a una ruta de negocios,
          // lo redirigimos a la pantalla de login de negocios.
          if (!inBusinessAuth) {
            router.replace('/business/ingresar');
          }
        } else if (inBusinessAuth) {
          // Ya logueado como empresa, no mostrar login
          router.replace('/business/dashboard');
        }
      }
      return;
    }

    // Si estamos en la ruta de administración, ignoramos el flujo de redirección de usuario normal
    if (segments[0] === 'admin') {
      return;
    }

    const inAuthGroup =
      segments[0] === 'login' || segments[0] === 'registro' || segments[0] === 'ingresar';
    const isGuestAllowedRoute = !segments[0] || segments[0] === 'index' || segments[0] === '(home)';

    if (!user.isAuthenticated && !inAuthGroup) {
      if (isGuestAllowedRoute) {
        if (!segments[0] || segments[0] === 'index') {
          router.replace('/(home)');
        }
      } else {
        // Redirigir a ingresar si el usuario no está autenticado y está tratando de acceder a una ruta protegida
        router.replace('/ingresar');
      }
    } else if (user.isAuthenticated && (!segments[0] || segments[0] === 'index')) {
      // Redirigir según el rol del usuario si estamos en la raíz
      if (user.userType === 'partner_owner' || user.userType === 'partner_worker') {
        router.replace('/business');
      } else {
        router.replace('/(home)');
      }
    }
  }, [user.isAuthenticated, user.isLoading, user.userType, segments, rootNavigationState?.key]);
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    token: null,
    userType: null,
  });
  const router = useRouter();

  useEffect(() => {
    async function loadInitialState() {
      try {
        const token = await getAuthTokenAsync();
        const profile = await loadUserProfile();
        setState({
          isAuthenticated: !!token,
          isLoading: false,
          token,
          userType: profile?.userType ?? null,
        });
      } catch (error) {
        setState({
          isAuthenticated: false,
          isLoading: false,
          token: null,
          userType: null,
        });
      }
    }
    loadInitialState();
  }, []);

  // Proteger las rutas automáticamente
  useProtectedRoute(state);

  const signIn = async (token: string, remember: boolean = true, redirectPath?: string) => {
    await saveAuthTokenAsync(token, remember);
    const profile = await loadUserProfile();
    setState({
      isAuthenticated: true,
      isLoading: false,
      token,
      userType: profile?.userType ?? null,
    });
    if (redirectPath) {
      router.replace(redirectPath);
    } else {
      router.replace('/(home)');
    }
  };

  const signOut = async () => {
    clearTokenCache();
    await clearAuthTokenAsync();
    await clearUserProfile();
    setState({
      isAuthenticated: false,
      isLoading: false,
      token: null,
      userType: null,
    });
  };

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut }}>{children}</AuthContext.Provider>
  );
}
