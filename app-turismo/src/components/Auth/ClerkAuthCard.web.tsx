import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSignIn, useSignUp } from '@clerk/react/legacy';
import { useClerk, useUser } from '@clerk/react';
import Svg, { Path } from 'react-native-svg';

interface ClerkAuthCardProps {
  isRegister: boolean;
  onToggleMode?: (mode: 'login' | 'register') => void;
  onClose?: () => void;
}

const GoogleIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <Path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <Path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <Path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </Svg>
);

export const ClerkAuthCard: React.FC<ClerkAuthCardProps> = ({ isRegister, onToggleMode, onClose }) => {
  const clerk = useClerk();
  const { user: clerkUser, isSignedIn: isUserSignedIn } = useUser();
  const { signIn, setActive: setSignInActive, isLoaded: isSignInLoaded } = useSignIn();
  const { signUp, setActive: setSignUpActive, isLoaded: isSignUpLoaded } = useSignUp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Estado para verificación de código (OTP)
  const [pendingVerification, setPendingVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    setErrorMessage('');
    setPendingVerification(false);
  }, [isRegister]);

  const isLoaded = isSignInLoaded && isSignUpLoaded;

  if (!isLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  // ─── Si el usuario ya está autenticado en Clerk ──────────────────────────────
  if (isUserSignedIn && clerkUser) {
    return (
      <View style={styles.card}>
        <View style={styles.badgeRow}>
          <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
          <Text style={styles.badgeText}>Sesión activa</Text>
        </View>

        <Text style={styles.title}>¡Ya has iniciado sesión!</Text>
        <Text style={styles.subtitle}>
          Has ingresado como{' '}
          <Text style={{ color: '#F9FAFB', fontWeight: '700' }}>
            {clerkUser.fullName || clerkUser.primaryEmailAddress?.emailAddress || 'Usuario'}
          </Text>
        </Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => {
            onClose?.();
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>Continuar al mapa</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.googleButton, { marginTop: 12 }]}
          onPress={async () => {
            try {
              setIsLoading(true);
              await clerk.signOut(() => {});
            } finally {
              setIsLoading(false);
            }
          }}
          disabled={isLoading}
          activeOpacity={0.85}
        >
          <Ionicons name="log-out-outline" size={18} color="#9CA3AF" />
          <Text style={styles.googleButtonText}>Cerrar sesión / Cambiar cuenta</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Helper para verificar si el error de Clerk indica que ya hay sesión
  const checkAlreadySignedIn = (err: any) => {
    return (
      err?.errors?.[0]?.code === 'session_exists' ||
      err?.message?.toLowerCase?.()?.includes('already signed in') ||
      err?.errors?.[0]?.message?.toLowerCase?.()?.includes('already signed in')
    );
  };

  // ─── Google OAuth Flow ────────────────────────────────────────────────────────
  const handleGoogleAuth = async () => {
    try {
      setIsGoogleLoading(true);
      setErrorMessage('');

      const redirectUrl = `${window.location.origin}/sso-callback`;
      const redirectUrlComplete = window.location.origin;

      if (isRegister) {
        await signUp?.authenticateWithRedirect({
          strategy: 'oauth_google',
          redirectUrl,
          redirectUrlComplete,
        });
      } else {
        await signIn?.authenticateWithRedirect({
          strategy: 'oauth_google',
          redirectUrl,
          redirectUrlComplete,
        });
      }
    } catch (err: any) {
      console.warn('[Clerk] Google auth error:', err);
      if (checkAlreadySignedIn(err)) {
        if (clerk.session) {
          try {
            await clerk.setActive({ session: clerk.session.id });
          } catch (_) {}
        }
        onClose?.();
        return;
      }
      const msg =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        (err instanceof Error ? err.message : 'No se pudo iniciar autenticación con Google.');
      setErrorMessage(msg);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // ─── Email & Password Sign In ────────────────────────────────────────────────
  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      setErrorMessage('Por favor ingresa tu correo y contraseña.');
      return;
    }
    try {
      setIsLoading(true);
      setErrorMessage('');
      const result = await signIn.create({
        identifier: email.trim(),
        password,
      });

      if (result.status === 'complete' && result.createdSessionId) {
        await setSignInActive({ session: result.createdSessionId });
        onClose?.();
      } else {
        console.log('[Clerk] Sign in status:', result.status);
      }
    } catch (err: any) {
      console.warn('[Clerk] Sign in error:', err);
      if (checkAlreadySignedIn(err)) {
        if (clerk.session) {
          try {
            await clerk.setActive({ session: clerk.session.id });
          } catch (_) {}
        }
        onClose?.();
        return;
      }
      const msg =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        'Correo o contraseña incorrectos.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Email & Password Sign Up ────────────────────────────────────────────────
  const handleSignUp = async () => {
    if (!email.trim() || !password) {
      setErrorMessage('Por favor completa todos los campos.');
      return;
    }
    if (password.length < 8) {
      setErrorMessage('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    try {
      setIsLoading(true);
      setErrorMessage('');
      const result = await signUp.create({
        emailAddress: email.trim(),
        password,
        firstName: name.trim() || undefined,
      });

      if (result.status === 'complete' && result.createdSessionId) {
        await setSignUpActive({ session: result.createdSessionId });
        onClose?.();
      } else if (
        result.status === 'missing_requirements' ||
        result.unverifiedFields?.includes('email_address')
      ) {
        // Enviar código de verificación al correo
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        setPendingVerification(true);
      }
    } catch (err: any) {
      console.warn('[Clerk] Sign up error:', err);
      if (checkAlreadySignedIn(err)) {
        if (clerk.session) {
          try {
            await clerk.setActive({ session: clerk.session.id });
          } catch (_) {}
        }
        onClose?.();
        return;
      }
      const msg =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        'No se pudo crear la cuenta.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // ─── OTP Code Verification ───────────────────────────────────────────────────
  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) {
      setErrorMessage('Ingresa el código de 6 dígitos enviado a tu correo.');
      return;
    }
    try {
      setIsLoading(true);
      setErrorMessage('');
      const result = await signUp.attemptEmailAddressVerification({
        code: verificationCode.trim(),
      });

      if (result.status === 'complete' && result.createdSessionId) {
        await setSignUpActive({ session: result.createdSessionId });
      } else {
        setErrorMessage('El código no es válido o ha expirado.');
      }
    } catch (err: any) {
      console.warn('[Clerk] Verification error:', err);
      const msg =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        'Código incorrecto o expirado.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Vista de Verificación OTP ────────────────────────────────────────────────
  if (pendingVerification) {
    return (
      <View style={styles.card}>
        <View style={styles.badgeRow}>
          <View style={styles.statusDot} />
          <Text style={styles.badgeText}>Verificación requerida</Text>
        </View>

        <Text style={styles.title}>Revisa tu correo</Text>
        <Text style={styles.subtitle}>
          Hemos enviado un código de verificación a <Text style={{ color: '#F9FAFB' }}>{email}</Text>
        </Text>

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color="#EF4444" />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <View style={styles.inputWrapper}>
          <Text style={styles.label}>Código de verificación</Text>
          <TextInput
            style={[styles.input, { letterSpacing: 4, textAlign: 'center', fontSize: 20 }]}
            placeholder="000000"
            placeholderTextColor="#6B7280"
            keyboardType="number-pad"
            maxLength={6}
            value={verificationCode}
            onChangeText={(text) => {
              setVerificationCode(text);
              if (errorMessage) setErrorMessage('');
            }}
          />
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, isLoading && { opacity: 0.7 }]}
          onPress={handleVerifyCode}
          disabled={isLoading}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.primaryButtonText}>Verificar y entrar</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.textButton}
          onPress={() => setPendingVerification(false)}
        >
          <Text style={styles.textButtonText}>Volver al registro</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Vista Principal de Login / Registro ───────────────────────────────────────
  return (
    <View style={styles.card}>
      {/* Header Clerk */}
      <View style={styles.badgeRow}>
        <View style={styles.statusDot} />
        <Text style={styles.badgeText}>Clerk Authentication</Text>
      </View>

      <Text style={styles.title}>{isRegister ? 'Crea tu cuenta' : 'Iniciar sesión'}</Text>
      <Text style={styles.subtitle}>
        {isRegister
          ? 'Explora rutas exclusivas, guarda favoritos y participa'
          : 'Bienvenido de nuevo a la plataforma'}
      </Text>

      {/* Botón Google OAuth */}
      <TouchableOpacity
        style={[styles.googleButton, isGoogleLoading && { opacity: 0.7 }]}
        onPress={handleGoogleAuth}
        disabled={isGoogleLoading || isLoading}
        activeOpacity={0.85}
      >
        {isGoogleLoading ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <>
            <GoogleIcon size={18} />
            <Text style={styles.googleButtonText}>Continuar con Google</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Separador */}
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>o con tu correo</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Mensaje de error */}
      {errorMessage ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={16} color="#EF4444" />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      {/* Formulario */}
      {isRegister && (
        <View style={styles.inputWrapper}>
          <Text style={styles.label}>Nombre completo</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej. Francisca Silva"
            placeholderTextColor="#6B7280"
            autoCapitalize="words"
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (errorMessage) setErrorMessage('');
            }}
          />
        </View>
      )}

      <View style={styles.inputWrapper}>
        <Text style={styles.label}>Correo electrónico</Text>
        <TextInput
          style={styles.input}
          placeholder="tu@email.com"
          placeholderTextColor="#6B7280"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            if (errorMessage) setErrorMessage('');
          }}
        />
      </View>

      <View style={styles.inputWrapper}>
        <Text style={styles.label}>Contraseña</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            style={[styles.input, { flex: 1, paddingRight: 40 }]}
            placeholder={isRegister ? 'Mínimo 8 caracteres' : 'Tu contraseña'}
            placeholderTextColor="#6B7280"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (errorMessage) setErrorMessage('');
            }}
            onSubmitEditing={isRegister ? handleSignUp : handleSignIn}
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowPassword(!showPassword)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color="#9CA3AF"
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Botón principal */}
      <TouchableOpacity
        style={[styles.primaryButton, isLoading && { opacity: 0.7 }]}
        onPress={isRegister ? handleSignUp : handleSignIn}
        disabled={isLoading || isGoogleLoading}
        activeOpacity={0.85}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Text style={styles.primaryButtonText}>
            {isRegister ? 'Crear cuenta' : 'Ingresar'}
          </Text>
        )}
      </TouchableOpacity>

      {/* Switch Iniciar sesión / Registrarse */}
      <View style={styles.footerRow}>
        <Text style={styles.footerText}>
          {isRegister ? '¿Ya tienes una cuenta?' : '¿No tienes una cuenta?'}
        </Text>
        <TouchableOpacity
          onPress={() => onToggleMode?.(isRegister ? 'login' : 'register')}
          activeOpacity={0.7}
        >
          <Text style={styles.footerLink}>
            {isRegister ? 'Inicia sesión' : 'Regístrate'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Botón para reiniciar sesión si el navegador quedó con datos huérfanos */}
      <TouchableOpacity
        style={{ marginTop: 16, alignItems: 'center' }}
        onPress={async () => {
          try {
            setIsLoading(true);
            await clerk.signOut(() => {});
            setErrorMessage('Sesión previa limpiada. Ya puedes ingresar de nuevo.');
          } catch (_) {
          } finally {
            setIsLoading(false);
          }
        }}
        activeOpacity={0.7}
      >
        <Text style={{ color: '#6B7280', fontSize: 11, textDecorationLine: 'underline' }}>
          ¿Problemas al ingresar? Limpiar sesión previa
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    width: '100%',
    minHeight: 380,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#111827',
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    ...Platform.select({
      web: {
        boxShadow:
          '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.08)',
      } as any,
      default: {
        elevation: 12,
      },
    }),
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    marginBottom: 14,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  badgeText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4,
    marginBottom: 20,
    lineHeight: 18,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 12,
    borderRadius: 12,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'background-color 0.15s ease',
      } as any,
    }),
  },
  googleButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  dividerText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '500',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 14,
  },
  errorText: {
    color: '#F87171',
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  inputWrapper: {
    marginBottom: 14,
  },
  label: {
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      } as any,
    }),
  },
  passwordContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    padding: 4,
  },
  primaryButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
      } as any,
    }),
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 18,
  },
  footerText: {
    color: '#9CA3AF',
    fontSize: 13,
  },
  footerLink: {
    color: '#34D399',
    fontSize: 13,
    fontWeight: '700',
  },
  textButton: {
    marginTop: 12,
    alignItems: 'center',
  },
  textButtonText: {
    color: '#9CA3AF',
    fontSize: 13,
  },
});

