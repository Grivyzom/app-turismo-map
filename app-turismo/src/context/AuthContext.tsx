import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { Platform } from 'react-native';
import { useAuth as useClerkAuth, useUser as useClerkUser, useClerk } from '@clerk/react';

import { getAuthTokenAsync, saveAuthTokenAsync, clearAuthTokenAsync } from '../utils/authStorage';
import {
  loadUserProfile,
  saveUserProfile,
  clearUserProfile,
  NormalUserProfile,
} from '../utils/userProfileStorage';
import { clearTokenCache } from '../utils/collectionsApi';
import { resetCameraSpawnInSession } from '../components/Map/camera/cameraAnimationEngine';
import { API_URL } from '../config/api';

export type AuthModalMode = 'login' | 'register';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  userType: string | null;
  clerkUser?: any;
  isAuthModalOpen: boolean;
  authModalMode: AuthModalMode;
}

interface AuthContextType extends AuthState {
  signIn: (token: string, remember?: boolean, redirectPath?: string) => Promise<void>;
  signOut: () => Promise<void>;
  openAuthModal: (mode?: AuthModalMode) => void;
  closeAuthModal: () => void;
  setAuthModalMode: (mode: AuthModalMode) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

function useProtectedRoute(
  user: AuthState & { openAuthModal?: (mode?: AuthModalMode) => void },
) {
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
        // En rutas permitidas para invitados (home o raíz) no forzamos replace
        // para evitar que Expo Router desmonte MapContainer y produzca flashes de WebGL.
        if (segments[0] === 'index') {
          router.replace('/(home)');
        }
      } else {
        // Redirigir a (home) y abrir modal de login si el usuario no está autenticado y está tratando de acceder a una ruta protegida
        router.replace('/(home)');
        user.openAuthModal?.('login');
      }
    } else if (inAuthGroup) {
      // Las rutas /ingresar, /login, /registro ya no existen como pantallas aisladas.
      // Redirigimos a home y abrimos el modal solo si el usuario no está autenticado.
      router.replace('/(home)');
      if (!user.isAuthenticated) {
        const mode: AuthModalMode = segments[0] === 'registro' ? 'register' : 'login';
        user.openAuthModal?.(mode);
      }
    } else if (user.isAuthenticated && segments[0] === 'index') {
      // Redirigir según el rol del usuario únicamente si está en la pantalla index
      if (user.userType === 'partner_owner' || user.userType === 'partner_worker') {
        router.replace('/business');
      } else {
        router.replace('/(home)');
      }
    }
  }, [user.isAuthenticated, user.isLoading, user.userType, segments, rootNavigationState?.key, user.openAuthModal]);
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const clerk = useClerk();
  const {
    isLoaded: isClerkLoaded,
    isSignedIn: isClerkSignedIn,
    getToken,
    signOut: clerkSignOut,
  } = useClerkAuth();
  const { user: clerkUser } = useClerkUser();

  const isActuallySignedIn = Boolean(
    isClerkSignedIn || clerk?.session || clerkUser || clerk?.user,
  );
  const activeUser = clerkUser || clerk?.user;

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthModalMode>('login');

  const openAuthModal = useCallback((mode: AuthModalMode = 'login') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
  }, []);

  const [state, setState] = useState<Omit<AuthState, 'isAuthModalOpen' | 'authModalMode'>>({
    isAuthenticated: false,
    isLoading: true,
    token: null,
    userType: null,
    clerkUser: null,
  });
  const router = useRouter();

  useEffect(() => {
    async function loadInitialState() {
      if (!isClerkLoaded) return;

      if (isActuallySignedIn) {
        try {
          let clerkToken: string | null = null;
          try {
            clerkToken = await getToken();
          } catch (tokErr) {
            console.warn('[AuthProvider] getToken warning:', tokErr);
          }
          if (!clerkToken && clerk?.session) {
            try {
              clerkToken = await clerk.session.getToken();
            } catch (sTokErr) {
              console.warn('[AuthProvider] session.getToken warning:', sTokErr);
            }
          }

          let appToken = clerkToken ?? 'clerk_session';
          let userType = (activeUser?.publicMetadata?.userType as any) || 'citizen';

          // Sincronizar con el backend Go para obtener el token interno y asegurar el registro en PostgreSQL
          if (clerkToken) {
            try {
              const resp = await fetch(`${API_URL}/auth/clerk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: clerkToken, userType }),
              });
              if (resp.ok) {
                const data = await resp.json();
                if (data.success && data.token) {
                  appToken = data.token;
                  if (data.user?.userType) userType = data.user.userType;
                  await saveAuthTokenAsync(appToken, true);
                }
              }
            } catch (syncErr) {
              console.warn('[AuthProvider] Sincronización con backend /auth/clerk:', syncErr);
            }
          }

          const profile = await loadUserProfile();
          const newProfile: NormalUserProfile = {
            fullName:
              activeUser?.fullName ||
              activeUser?.firstName ||
              profile?.fullName ||
              'Usuario',
            email:
              activeUser?.primaryEmailAddress?.emailAddress ||
              profile?.email ||
              '',
            location: profile?.location || 'Chile',
            avatarIcon: profile?.avatarIcon || 'verified-user',
            userType: userType,
            twoFactorEnabled: false,
            twoFactorSecret: null,
            createdAt: profile?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          await saveUserProfile(newProfile);

          setState({
            isAuthenticated: true,
            isLoading: false,
            token: appToken,
            userType: userType,
            clerkUser: activeUser,
          });
          return;
        } catch (e) {
          console.warn('[AuthProvider] Error syncing Clerk state:', e);
          setState({
            isAuthenticated: true,
            isLoading: false,
            token: 'clerk_session',
            userType: (activeUser?.publicMetadata?.userType as any) || 'citizen',
            clerkUser: activeUser,
          });
          return;
        }
      }

      try {
        const token = await getAuthTokenAsync();
        const profile = await loadUserProfile();
        setState({
          isAuthenticated: !!token,
          isLoading: false,
          token,
          userType: profile?.userType ?? null,
          clerkUser: null,
        });
      } catch (error) {
        setState({
          isAuthenticated: false,
          isLoading: false,
          token: null,
          userType: null,
          clerkUser: null,
        });
      }
    }
    loadInitialState();
  }, [isClerkLoaded, isActuallySignedIn, activeUser]);

  // Proteger las rutas automáticamente
  useProtectedRoute({ ...state, isAuthModalOpen, authModalMode, openAuthModal });

  // Cerrar modal automáticamente cuando el usuario esté autenticado
  useEffect(() => {
    if ((state.isAuthenticated || isActuallySignedIn) && isAuthModalOpen) {
      setIsAuthModalOpen(false);
    }
  }, [state.isAuthenticated, isActuallySignedIn, isAuthModalOpen]);

  const signIn = async (token: string, remember: boolean = true, redirectPath?: string) => {
    resetCameraSpawnInSession();
    await saveAuthTokenAsync(token, remember);
    const profile = await loadUserProfile();
    setState({
      isAuthenticated: true,
      isLoading: false,
      token,
      userType: profile?.userType ?? null,
      clerkUser: null,
    });
    setIsAuthModalOpen(false);
    if (redirectPath) {
      router.replace(redirectPath);
    } else {
      router.replace('/(home)');
    }
  };

  const signOut = async () => {
    resetCameraSpawnInSession();
    clearTokenCache();
    await clearAuthTokenAsync();
    await clearUserProfile();
    try {
      // Pasamos un callback a signOut para evitar que Clerk ejecute un redirect duro
      // (window.location.href) que recargaría toda la página y destruiría el canvas WebGL.
      if (clerk?.signOut) {
        await clerk.signOut(() => {});
      } else if (clerkSignOut) {
        await clerkSignOut(() => {});
      }
    } catch (e) {
      console.warn('[AuthProvider] Error signing out of Clerk:', e);
    }
    setState({
      isAuthenticated: false,
      isLoading: false,
      token: null,
      userType: null,
      clerkUser: null,
    });
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        isAuthModalOpen,
        authModalMode,
        openAuthModal,
        closeAuthModal,
        setAuthModalMode,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
