import React, { useState, useEffect, useRef } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ImageBackground,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { Animated } from 'react-native';

import { useAuth } from '../src/context/AuthContext';
import { saveAuthTokenAsync } from '../src/utils/authStorage';
import {
  getDefaultUserProfile,
  loadUserProfile,
  saveUserProfile,
  verifyTwoFactorCode,
  type NormalUserProfile,
} from '../src/utils/userProfileStorage';

WebBrowser.maybeCompleteAuthSession();

// ─── Máquina de estados ───────────────────────────────────────────────────────
const VISTAS = {
  REGISTER: 'register',
  LOGIN: 'login',
  RECOVERY: 'recovery',
} as const;
type Vista = (typeof VISTAS)[keyof typeof VISTAS];

// ─── Temas estacionales ───────────────────────────────────────────────────────
const THEMES = [
  {
    name: 'summer',
    accent: '#0ea5e9',
    bgImage:
      'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?q=80&w=2074&auto=format&fit=crop',
    icon: 'sunny-outline' as const,
  },
  {
    name: 'autumn',
    accent: '#d97706',
    bgImage:
      'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=2070&auto=format&fit=crop',
    icon: 'leaf-outline' as const,
  },
  {
    name: 'winter',
    accent: '#64748b',
    bgImage:
      'https://images.unsplash.com/photo-1482862549707-f63cb32c5fd9?q=80&w=2070&auto=format&fit=crop',
    icon: 'snow-outline' as const,
  },
];

const getInitialThemeIndex = () => {
  const m = new Date().getMonth();
  if (m >= 2 && m <= 4) return 1; // otoño
  if (m >= 5 && m <= 8) return 2; // invierno
  return 0; // verano
};

// ─── Helpers para Web ────────────────────────────────────────────────────────
const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    alert(`${title}: ${message}`);
  } else {
    Alert.alert(title, message);
  }
};

const getBackendUrl = () => {
  const url = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (!url || url === 'undefined') {
    return 'http://localhost:8081';
  }
  return url;
};

// ─── Componente principal ─────────────────────────────────────────────────────
export default function IngresarScreen() {
  const { signIn } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // ── Hidratación SSR ──
  const [isMounted, setIsMounted] = useState(false);
  const [themeIndex, setThemeIndex] = useState(0);

  // ── Estado de la vista ──
  const [vista, setVista] = useState<Vista>(VISTAS.LOGIN);
  const [tabsWidth, setTabsWidth] = useState(0);

  // ── Campos comunes ──
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);
  const nameRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // ── Campos de login ──
  const [rememberMe, setRememberMe] = useState(true);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorError, setTwoFactorError] = useState('');
  const [formError, setFormError] = useState('');
  const [profile, setProfile] = useState<NormalUserProfile | null>(null);
  const [profileReady, setProfileReady] = useState(false);

  // ── Campos de registro ──
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [visitorType, setVisitorType] = useState<'citizen' | 'tourist'>('citizen');

  // ── Estado general ──
  const [isLoading, setIsLoading] = useState(false);

  const theme = THEMES[themeIndex];
  const isMobile = width <= 480;
  const isRegister = vista === VISTAS.REGISTER;
  const isLogin = vista === VISTAS.LOGIN;
  const isRecovery = vista === VISTAS.RECOVERY;

  const requiresTwoFactor =
    profileReady && !!profile?.twoFactorEnabled && !!profile.twoFactorSecret;

  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const tabWidth = tabsWidth > 8 ? (tabsWidth - 8) / 2 : 0;
    Animated.spring(slideAnim, {
      toValue: vista === VISTAS.REGISTER ? tabWidth : 0,
      useNativeDriver: false,
      damping: 20,
      stiffness: 200,
    }).start();
  }, [vista, tabsWidth]);

  // ── Montaje ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    setIsMounted(true);
    setThemeIndex(getInitialThemeIndex());

    void loadUserProfile().then((stored) => {
      if (!alive) return;
      setProfile(stored ?? getDefaultUserProfile());
      setProfileReady(true);
    });

    return () => {
      alive = false;
    };
  }, []);

  // ── Google OAuth (retorno desde redirect) ──
  useEffect(() => {
    if (Platform.OS !== 'web') {
      GoogleSignin.configure({
        webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
        offlineAccess: true,
      });
    } else if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash) {
        const params = new URLSearchParams(hash.substring(1));
        const idToken = params.get('id_token');
        if (idToken) {
          window.history.replaceState(null, '', window.location.pathname);
          setTimeout(() => void handleGoogleToken(idToken, isRegister), 0);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Helpers ────────────────────────────────────────────────────────────────
  const buildFallbackName = (value: string) => {
    const local = value.split('@')[0]?.trim();
    if (!local) return 'Usuario';
    return local.replace(/[._-]+/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const persistSessionProfile = async () => {
    const stored = profile ?? (await loadUserProfile()) ?? getDefaultUserProfile();
    const next = await saveUserProfile({
      ...stored,
      fullName:
        stored.fullName?.trim() && stored.fullName !== 'Usuario normal'
          ? stored.fullName
          : buildFallbackName(email),
      email: email.trim() || stored.email || '',
      location: stored.location || 'Sin ubicación definida',
    });
    setProfile(next);
  };

  const completeLogin = async (token: string) => {
    await persistSessionProfile();
    await signIn(token, rememberMe);
  };

  // ─── Autenticación con Google ────────────────────────────────────────────────
  async function handleGoogleToken(idToken: string, asRegister: boolean) {
    try {
      setIsLoading(true);
      const endpoint = asRegister ? '/auth/google' : '/auth/google';
      const res = await fetch(`${getBackendUrl()}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, userType: visitorType }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        if (asRegister) {
          await saveUserProfile({
            fullName: data.user?.name ?? buildFallbackName(data.user?.email ?? ''),
            email: data.user?.email ?? '',
            location: 'Sin ubicación definida',
            avatarIcon: 'person',
            userType: data.user?.userType ?? 'citizen',
          });
          await signIn(data.token, true, '/');
        } else {
          await completeLogin(data.token);
        }
      } else {
        setFormError(`Error Google: ${data.message || 'Error al autenticar con Google'}`);
      }
    } catch (err) {
      console.error('Google auth error:', err);
      setFormError('Error de conexión: No se pudo conectar con el servidor.');
    } finally {
      setIsLoading(false);
    }
  }

  const handleGooglePress = async () => {
    if (Platform.OS === 'web') {
      const clientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
      if (!clientId) {
        setFormError('Error: Google Client ID no configurado.');
        return;
      }
      const redirectUri = window.location.origin + window.location.pathname;
      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=id_token&scope=openid%20email%20profile&nonce=${Math.random().toString(36).substring(2)}`;
      return;
    }
    try {
      setIsLoading(true);
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      const idToken = response.data?.idToken;
      if (idToken) await handleGoogleToken(idToken, isRegister);
    } catch (error: any) {
      if (error.code !== statusCodes.SIGN_IN_CANCELLED) {
        setFormError('Error: No se pudo iniciar sesión con Google.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Login ───────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!email || !password) {
      const missing = [];
      if (!email) missing.push('correo');
      if (!password) missing.push('contraseña');
      const faltanStr = missing.length > 1 ? 'Faltan' : 'Falta';
      setFormError(`Error: Por favor completa todos los campos obligatorios. (${faltanStr}: ${missing.join(' y ')})`);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${getBackendUrl()}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (requiresTwoFactor) {
          const valid = await verifyTwoFactorCode(profile!.twoFactorSecret!, twoFactorCode);
          if (!valid) {
            setTwoFactorError('Ingresa un código válido de Google Authenticator.');
            return;
          }
          setTwoFactorError('');
        }
        await completeLogin(data.token);
      } else {
        setFormError('Error de inicio de sesión: Email o contraseña incorrectos');
      }
    } catch (err) {
      console.error('Login error:', err);
      setFormError('Error de conexión: No se pudo conectar con el servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Registro ────────────────────────────────────────────────────────────────
  const handleRegister = async () => {
    if (!fullName || !email || !password) {
      const missing = [];
      if (!fullName) missing.push('nombre completo');
      if (!email) missing.push('correo');
      if (!password) missing.push('contraseña');
      const faltanStr = missing.length > 1 ? 'Faltan' : 'Falta';
      setFormError(`Error: Por favor completa todos los campos obligatorios. (${faltanStr}: ${missing.join(', ')})`);
      return;
    }
    if (password !== confirmPassword) {
      setFormError('Error: Las contraseñas no coinciden.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${getBackendUrl()}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          name: fullName,
          userType: visitorType,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await saveAuthTokenAsync(data.token, true);
        await saveUserProfile({
          fullName: data.user?.name ?? fullName,
          email: data.user?.email ?? email,
          location: 'Sin ubicación definida',
          avatarIcon: 'person',
          userType: data.user?.userType ?? visitorType,
        });
        router.replace('/');
      } else {
        setFormError(`Error de registro: ${data.message || 'No se pudo crear la cuenta'}`);
      }
    } catch (err) {
      console.error('Register error:', err);
      setFormError('Error de conexión: No se pudo conectar con el servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Recuperación ────────────────────────────────────────────────────────────
  const handleRecovery = () => {
    if (!email) {
      setFormError('Error: Por favor completa todos los campos obligatorios. (Falta: correo)');
      return;
    }
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      showAlert('Restablecer contraseña', 'Se ha enviado un enlace de recuperación a tu correo.');
      setVista(VISTAS.LOGIN);
    }, 1000);
  };

  // ─── Handlers de UI ──────────────────────────────────────────────────────────
  const handleSubmit = () => {
    if (isRegister) return handleRegister();
    if (isRecovery) return handleRecovery();
    return handleLogin();
  };

  // ─── Textos dinámicos ────────────────────────────────────────────────────────
  const title = isRegister
    ? 'Crea tu cuenta'
    : isRecovery
      ? 'Recuperar contraseña'
      : 'Iniciar sesión';
  const subtitle = isRegister
    ? 'Únete para explorar increíbles lugares'
    : isRecovery
      ? 'Ingresa tu correo para recibir un enlace de restauración'
      : 'Bienvenido de nuevo, ingresa a tu cuenta';
  const dividerText = isRegister ? 'O regístrate con tu correo' : 'O inicia sesión con tu correo';
  const submitText = isRegister ? 'Registrarse' : isRecovery ? 'Enviar enlace' : 'Ingresar';
  const footerQuestion = isRecovery
    ? '¿Recordaste tu contraseña?'
    : isLogin
      ? '¿No tienes una cuenta?'
      : '¿Ya tienes una cuenta?';
  const footerAction = isRecovery || isRegister ? 'Inicia sesión' : 'Regístrate';

  // ─── SSR guard ───────────────────────────────────────────────────────────────
  if (!isMounted) {
    return (
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: '#ffffff', justifyContent: 'center', alignItems: 'center' },
        ]}
      >
        <ActivityIndicator size="large" color="#64748b" />
      </View>
    );
  }

  // ─── Tarjeta de autenticación ────────────────────────────────────────────────
  const card = (
    <View
      style={!isMobile ? styles.cardShadow : undefined}
      className={`w-full bg-white ${
        !isMobile
          ? 'max-w-[440px] rounded-2xl px-10 py-11 border border-black/5'
          : 'min-h-screen px-6 py-10 justify-center'
      }`}
    >
      {/* Animated Tabs & Header */}
      {!isRecovery && (
        <View className="mb-6 w-full">
          <View 
            className="flex-row bg-gray-100/80 rounded-xl p-1 relative w-full"
            onLayout={(e) => setTabsWidth(e.nativeEvent.layout.width)}
          >
            {tabsWidth > 0 && (
              <Animated.View 
                className="absolute top-1 bottom-1 left-1 bg-white rounded-lg"
                style={[
                  { 
                    shadowColor: '#000', 
                    shadowOffset: { width: 0, height: 1 }, 
                    shadowOpacity: 0.1, 
                    shadowRadius: 2, 
                    elevation: 1,
                    width: tabsWidth > 8 ? (tabsWidth - 8) / 2 : 0,
                    transform: [{ translateX: slideAnim }]
                  }
                ]}
              />
            )}
            <TouchableOpacity 
              className="flex-1 py-2 items-center justify-center z-10"
              onPress={() => {
                if (!isLogin) {
                  setPassword('');
                  setConfirmPassword('');
                  setTwoFactorCode('');
                  setTwoFactorError('');
                  setFormError('');
                  setVista(VISTAS.LOGIN);
                }
              }}
              activeOpacity={0.7}
            >
              <Text className={`text-sm font-semibold ${isLogin ? 'text-gray-900' : 'text-gray-500'}`}>
                Iniciar sesión
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              className="flex-1 py-2 items-center justify-center z-10"
              onPress={() => {
                if (!isRegister) {
                  setPassword('');
                  setConfirmPassword('');
                  setTwoFactorCode('');
                  setTwoFactorError('');
                  setFormError('');
                  setVista(VISTAS.REGISTER);
                }
              }}
              activeOpacity={0.7}
            >
              <Text className={`text-sm font-semibold ${isRegister ? 'text-gray-900' : 'text-gray-500'}`}>
                Registrarse
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View className="items-center mb-5">
        <Text className="text-2xl font-bold tracking-tight text-gray-900 mb-1 text-center">
          {title}
        </Text>
        <Text className="text-[13px] text-gray-500 text-center leading-relaxed max-w-[280px]">
          {subtitle}
        </Text>
      </View>

      {/* Social Buttons (ocultos en Recovery) */}
      {!isRecovery && (
        <>
          <View className="flex-row mb-6">
            <TouchableOpacity
              onPress={handleGooglePress}
              className="w-full flex-row justify-center items-center gap-2 px-3.5 py-2.5 rounded-lg border border-gray-200 bg-[#f9fafb] active:opacity-85 h-11"
            >
              <Image
                source={{ uri: 'https://www.svgrepo.com/show/475656/google-color.svg' }}
                style={{ width: 18, height: 18 }}
                resizeMode="contain"
              />
              <Text className="text-sm font-semibold text-gray-900">Google</Text>
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View className="flex-row items-center mb-6">
            <View className="h-px bg-gray-100 flex-1" />
            <Text className="px-4 text-[13px] text-gray-400 font-normal">{dividerText}</Text>
            <View className="h-px bg-gray-100 flex-1" />
          </View>
        </>
      )}

      {/* Formulario */}
      <View className="gap-4">
        {/* Nombre completo (solo registro) */}
        {isRegister && (
          <View className="relative flex-row items-center w-full">
            <View className="absolute left-3.5 z-10 pointer-events-none">
              <Ionicons name="person-outline" size={16} color="#9ca3af" />
            </View>
            <TextInput
              ref={nameRef}
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              placeholder="Nombre completo"
              placeholderTextColor="#9ca3af"
              autoCapitalize="words"
              value={fullName}
              onChangeText={(v) => { setFullName(v); setFormError(''); }}
              onFocus={() => setFocusedField('name')}
              onBlur={() => setFocusedField(null)}
              style={{
                paddingLeft: 42,
                paddingRight: 16,
                borderColor: focusedField === 'name' ? theme.accent : '#e5e7eb',
                borderWidth: 1,
              }}
              className="w-full h-11 rounded-lg text-base text-gray-900 bg-white"
            />
          </View>
        )}

        {/* Email */}
        <View className="relative flex-row items-center w-full">
          <View className="absolute left-3.5 z-10 pointer-events-none">
            <Ionicons name="mail-outline" size={16} color="#9ca3af" />
          </View>
          <TextInput
            ref={emailRef}
            returnKeyType={isRecovery ? "done" : "next"}
            onSubmitEditing={() => isRecovery ? handleSubmit() : passwordRef.current?.focus()}
            placeholder="tu@ejemplo.com"
            placeholderTextColor="#9ca3af"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={(v) => { setEmail(v); setFormError(''); }}
            onFocus={() => setFocusedField('email')}
            onBlur={() => setFocusedField(null)}
            style={{
              paddingLeft: 42,
              paddingRight: 16,
              borderColor: focusedField === 'email' ? theme.accent : '#e5e7eb',
              borderWidth: 1,
            }}
            className="w-full h-11 rounded-lg text-base text-gray-900 bg-white"
          />
        </View>

        {/* Error de recovery */}
        {isRecovery && formError ? (
          <View className="flex-row items-center gap-1.5 mt-1.5 px-1 w-full">
            <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
            <Text className="text-[13px] text-red-500 flex-1 leading-tight">
              {formError}
            </Text>
          </View>
        ) : null}

        {/* Contraseña (oculta en Recovery) */}
        {!isRecovery && (
          <View className="gap-2">
            <View className="relative flex-row items-center w-full">
              <View className="absolute left-3.5 z-10 pointer-events-none">
                <Ionicons name="lock-closed-outline" size={16} color="#9ca3af" />
              </View>
              <TextInput
                ref={passwordRef}
                returnKeyType={isRegister ? "next" : "done"}
                onSubmitEditing={() => isRegister ? confirmPasswordRef.current?.focus() : handleSubmit()}
                placeholder="Contraseña"
                placeholderTextColor="#9ca3af"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={(v) => { setPassword(v); setFormError(''); }}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                style={{
                  paddingLeft: 42,
                  paddingRight: 42,
                  borderColor: focusedField === 'password' ? theme.accent : '#e5e7eb',
                  borderWidth: 1,
                }}
                className="w-full h-11 rounded-lg text-base text-gray-900 bg-white"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 w-7 h-7 justify-center items-center"
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color="#4b5563"
                />
              </TouchableOpacity>
            </View>

            {/* Confirmar contraseña (solo cuando hay texto y es registro) */}
            {isRegister && password.length > 0 && (
              <View className="relative flex-row items-center w-full">
                <View className="absolute left-3.5 z-10 pointer-events-none">
                  <Ionicons name="lock-closed-outline" size={16} color="#9ca3af" />
                </View>
                <TextInput
                  ref={confirmPasswordRef}
                  returnKeyType="done"
                  onSubmitEditing={() => handleSubmit()}
                  placeholder="Confirmar contraseña"
                  placeholderTextColor="#9ca3af"
                  secureTextEntry={!showPassword}
                  value={confirmPassword}
                  onChangeText={(v) => { setConfirmPassword(v); setFormError(''); }}
                  onFocus={() => setFocusedField('confirm')}
                  onBlur={() => setFocusedField(null)}
                  style={{
                    paddingLeft: 42,
                    paddingRight: 42,
                    borderColor: focusedField === 'confirm' ? theme.accent : '#e5e7eb',
                    borderWidth: 1,
                  }}
                  className="w-full h-11 rounded-lg text-base text-gray-900 bg-white"
                />
              </View>
            )}

            {/* Error del formulario */}
            {!isRecovery && formError ? (
              <View className="flex-row items-center gap-1.5 mt-1 px-1 w-full">
                <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
                <Text className="text-[13px] text-red-500 flex-1 leading-tight">
                  {formError}
                </Text>
              </View>
            ) : null}

            {/* Recordarme + Olvidaste contraseña (solo login) */}
            {isLogin && (
              <View className="flex-row items-center justify-between mt-1">
                <TouchableOpacity
                  onPress={() => setRememberMe(!rememberMe)}
                  className="flex-row items-center gap-2"
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={rememberMe ? 'checkbox' : 'square-outline'}
                    size={18}
                    color={rememberMe ? theme.accent : '#d1d5db'}
                  />
                  <Text className="text-[13px] font-medium text-gray-900">Recordarme</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setVista(VISTAS.RECOVERY)}>
                  <Text
                    style={{ color: theme.accent }}
                    className="text-[13px] font-medium text-right"
                  >
                    ¿Olvidaste tu contraseña?
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* 2FA (solo login, cuando está habilitado) */}
        {isLogin && requiresTwoFactor && (
          <View className="gap-2 mt-2">
            <Text className="text-[13px] text-gray-500 font-semibold pl-1">
              Código de Google Authenticator
            </Text>
            <View className="relative flex-row items-center w-full">
              <View className="absolute left-3.5 z-10 pointer-events-none">
                <Ionicons name="shield-checkmark-outline" size={16} color="#9ca3af" />
              </View>
              <TextInput
                placeholder="123456"
                placeholderTextColor="#9ca3af"
                keyboardType="number-pad"
                value={twoFactorCode}
                onChangeText={(v) => {
                  setTwoFactorCode(v.replace(/\D/g, '').slice(0, 6));
                  setTwoFactorError('');
                }}
                maxLength={6}
                onFocus={() => setFocusedField('2fa')}
                onBlur={() => setFocusedField(null)}
                style={{
                  paddingLeft: 42,
                  paddingRight: 16,
                  borderColor: focusedField === '2fa' ? theme.accent : '#e5e7eb',
                  borderWidth: 1,
                  letterSpacing: twoFactorCode ? 4 : 0,
                }}
                className="w-full h-11 rounded-lg text-base text-gray-900 bg-white"
              />
            </View>
            {twoFactorError ? (
              <Text className="text-xs font-semibold text-red-600 pl-1">{twoFactorError}</Text>
            ) : null}
          </View>
        )}

        {/* Selector de tipo de usuario (solo registro) */}
        {isRegister && password.length > 0 && confirmPassword.length > 0 && password === confirmPassword && (
          <View className="mt-2">
            <Text className="text-[13px] text-gray-500 font-semibold mb-2 text-center">
              ¿Qué te trae por aquí?
            </Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setVisitorType('citizen')}
                style={{
                  borderColor: visitorType === 'citizen' ? theme.accent : '#e5e7eb',
                  backgroundColor: visitorType === 'citizen' ? `${theme.accent}10` : '#ffffff',
                }}
                className="flex-1 border rounded-xl py-3 px-2 items-center flex-row justify-center gap-2"
                activeOpacity={0.7}
              >
                <Ionicons
                  name="home"
                  size={18}
                  color={visitorType === 'citizen' ? theme.accent : '#4b5563'}
                />
                <Text
                  style={{ color: visitorType === 'citizen' ? theme.accent : '#4b5563' }}
                  className="text-sm font-semibold"
                >
                  Vivo aquí
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setVisitorType('tourist')}
                style={{
                  borderColor: visitorType === 'tourist' ? theme.accent : '#e5e7eb',
                  backgroundColor: visitorType === 'tourist' ? `${theme.accent}10` : '#ffffff',
                }}
                className="flex-1 border rounded-xl py-3 px-2 items-center flex-row justify-center gap-2"
                activeOpacity={0.7}
              >
                <Ionicons
                  name="airplane"
                  size={18}
                  color={visitorType === 'tourist' ? theme.accent : '#4b5563'}
                />
                <Text
                  style={{ color: visitorType === 'tourist' ? theme.accent : '#4b5563' }}
                  className="text-sm font-semibold"
                >
                  Estoy de visita
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Botón principal */}
        <TouchableOpacity
          onPress={handleSubmit}
          style={[styles.btnShadow, { backgroundColor: theme.accent }]}
          className="w-full h-11 rounded-lg justify-center items-center mt-2 active:opacity-90"
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="text-sm font-semibold text-white">{submitText}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Footer */}
      {isRecovery ? (
        <View className="mt-6 flex-row justify-center items-center gap-1.5">
          <Text className="text-sm text-gray-500">{footerQuestion}</Text>
          <TouchableOpacity onPress={() => { setFormError(''); setVista(VISTAS.LOGIN); }}>
            <Text style={{ color: theme.accent }} className="text-sm font-semibold">
              {footerAction}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );

  // ─── Layout final ─────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!isMobile ? (
          <ImageBackground
            source={{ uri: theme.bgImage }}
            style={styles.bgImage}
            resizeMode="cover"
            blurRadius={2}
          >
            <View
              style={styles.overlay}
              className="w-full min-h-screen items-center justify-center"
            >
              {card}
            </View>
          </ImageBackground>
        ) : (
          card
        )}

        {/* Botón de ciclo de tema */}
        <TouchableOpacity
          onPress={() => setThemeIndex((prev) => (prev + 1) % THEMES.length)}
          style={[
            styles.themeBtn,
            isMobile ? { top: Math.max(insets.top, 20), right: 20 } : { top: 24, left: 24 },
          ]}
        >
          <Ionicons name={theme.icon} size={16} color="#4b5563" />
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    flexGrow: 1,
    width: '100%',
  },
  bgImage: {
    flex: 1,
    width: '100%',
    minHeight: '100%' as unknown as number,
  },
  overlay: {
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  cardShadow: {
    ...Platform.select({
      web: { boxShadow: '0 20px 40px rgba(0,0,0,0.1), 0 4px 10px rgba(0,0,0,0.05)' },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.1,
        shadowRadius: 40,
      },
      android: { elevation: 10 },
    }),
  },
  btnShadow: {
    ...Platform.select({
      web: { boxShadow: '0 4px 6px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.08)' },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: { elevation: 3 },
    }),
  },
  themeBtn: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
});
