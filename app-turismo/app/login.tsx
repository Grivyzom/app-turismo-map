import React, { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';

import { saveAuthToken } from '../src/utils/authStorage';
import {
  getDefaultUserProfile,
  loadUserProfile,
  saveUserProfile,
  verifyTwoFactorCode,
  type NormalUserProfile,
} from '../src/utils/userProfileStorage';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [profile, setProfile] = useState<NormalUserProfile | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorError, setTwoFactorError] = useState('');

  const buildFallbackName = (value: string) => {
    const localPart = value.split('@')[0]?.trim();
    if (!localPart) {
      return 'Usuario normal';
    }

    return localPart.replace(/[._-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  };

  useEffect(() => {
    let isMounted = true;

    void loadUserProfile().then((storedProfile) => {
      if (!isMounted) {
        return;
      }

      setProfile(storedProfile ?? getDefaultUserProfile());
      setProfileReady(true);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const requiresTwoFactor =
    profileReady && !!profile?.twoFactorEnabled && !!profile.twoFactorSecret;

  const persistSessionProfile = async () => {
    const storedProfile = profile ?? (await loadUserProfile()) ?? getDefaultUserProfile();

    const nextProfile = await saveUserProfile({
      ...storedProfile,
      fullName:
        storedProfile.fullName?.trim() && storedProfile.fullName !== 'Usuario normal'
          ? storedProfile.fullName
          : buildFallbackName(email),
      email: email.trim() || storedProfile.email || '',
      location: storedProfile.location || 'Sin ubicación definida',
    });

    setProfile(nextProfile);
    return nextProfile;
  };

  const completeLogin = async (sessionToken: string) => {
    saveAuthToken(sessionToken, rememberMe);
    await persistSessionProfile();
    router.replace('/(home)');
  };

  const verifyTwoFactorAndLogin = async (sessionToken: string) => {
    if (requiresTwoFactor) {
      const isValidCode = await verifyTwoFactorCode(profile!.twoFactorSecret!, twoFactorCode);
      if (!isValidCode) {
        setTwoFactorError('Ingresa un código válido de Google Authenticator.');
        return;
      }
    }

    setTwoFactorError('');
    await completeLogin(sessionToken);
  };

  // Solicitar autenticación usando expo-auth-session
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      console.log('Token obtenido:', id_token);

      void (async () => {
        await verifyTwoFactorAndLogin(id_token || 'google-session');
      })();
    }
  }, [response]);

  const handleLogin = () => {
    void (async () => {
      await verifyTwoFactorAndLogin('dummy-user-session');
    })();
  };

  const handleGoogleLogin = async () => {
    promptAsync();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={StyleSheet.absoluteFill} className="bg-[#f5f4fb]" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={styles.card}
          className="w-full rounded-[1.75rem] border border-black/5 bg-white px-6 py-10 sm:px-10 sm:py-12"
        >
          <View className="items-center">
            <Text className="text-[34px] font-extrabold tracking-tight text-[#2e2b5f]">
              Inicia sesión
            </Text>
          </View>

          <View className="mt-8">
            <TouchableOpacity
              style={styles.socialButton}
              className="h-12 w-full flex-row items-center justify-center rounded-xl border border-black/10 bg-white active:opacity-90"
              onPress={handleGoogleLogin}
            >
              <Image
                source={require('../src/img/icons/Google_Favicon.svg')}
                style={{ width: 24, height: 24 }}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>

          <View className="my-8 flex-row items-center">
            <View className="h-px flex-1 bg-black/10" />
            <Text className="mx-3 text-sm font-medium text-[#5f5a86]">o</Text>
            <View className="h-px flex-1 bg-black/10" />
          </View>

          <View className="gap-4">
            <View>
              <Text className="mb-2 text-[13px] text-[#5f6774]">Dirección de email</Text>
              <View className="flex-row items-center rounded-lg border border-[#cbccd0] bg-white px-4 py-3">
                <TextInput
                  className="flex-1 text-base text-[#23262f]"
                  placeholder=""
                  placeholderTextColor="#7b8291"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
            </View>

            <View>
              <Text className="mb-2 text-[13px] text-[#5f6774]">Contraseña</Text>
              <View className="flex-row items-center rounded-lg border border-[#cbccd0] bg-white px-4 py-3">
                <TextInput
                  className="flex-1 text-base text-[#23262f]"
                  placeholder=""
                  placeholderTextColor="#7b8291"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  <MaterialIcons
                    name={showPassword ? 'visibility-off' : 'visibility'}
                    size={22}
                    color="#5f6774"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View className="flex-row items-center justify-between mt-1">
              <TouchableOpacity
                className="flex-row items-center"
                onPress={() => setRememberMe(!rememberMe)}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name={rememberMe ? 'check-box' : 'check-box-outline-blank'}
                  size={22}
                  color={rememberMe ? '#6a44ff' : '#7b8291'}
                />
                <Text className="ml-2 text-[14px] text-[#4b4f63]">Recordarme</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => {}}>
                <Text className="text-[14px] font-bold text-[#5636f3]">
                  ¿Olvidaste tu contraseña?
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              className="mt-2 h-12 rounded-lg bg-[#6a44ff] active:opacity-90"
              onPress={handleLogin}
            >
              <View className="h-full items-center justify-center">
                <Text className="text-[15px] font-bold text-white">Inicia sesión</Text>
              </View>
            </TouchableOpacity>

            {requiresTwoFactor && (
              <View>
                <Text className="mb-2 text-[13px] text-[#5f6774]">
                  Código de Google Authenticator
                </Text>
                <View className="flex-row items-center rounded-lg border border-[#cbccd0] bg-white px-4 py-3">
                  <TextInput
                    className="flex-1 text-base text-[#23262f] tracking-[0.28em]"
                    placeholder="123456"
                    placeholderTextColor="#7b8291"
                    keyboardType="number-pad"
                    value={twoFactorCode}
                    onChangeText={(value) => {
                      setTwoFactorCode(value.replace(/\D/g, '').slice(0, 6));
                      setTwoFactorError('');
                    }}
                    maxLength={6}
                  />
                </View>
                <Text className="mt-2 text-[12px] text-[#5f6774]">
                  Esta cuenta tiene verificación en dos pasos activa.
                </Text>
                {twoFactorError ? (
                  <Text className="mt-2 text-[12px] font-semibold text-[#d92d20]">
                    {twoFactorError}
                  </Text>
                ) : null}
              </View>
            )}
          </View>

          <View className="mt-8 items-center gap-4">
            <Text className="text-[14px] font-bold text-[#5636f3]">
              ¿No puedes acceder a tu cuenta?
            </Text>

            <View className="flex-row flex-wrap items-center justify-center">
              <Text className="text-[14px] text-[#4b4f63]">¿No tienes una cuenta? </Text>
              <TouchableOpacity onPress={() => router.push('/registro')}>
                <Text className="text-[14px] font-bold text-[#5636f3]">Regístrate</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f6f8',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    boxShadow: '0px 10px 40px rgba(0, 0, 0, 0.04)',
    elevation: 3,
  },
  socialButton: {
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.05)',
  },
  primaryButton: {
    boxShadow: '0px 4px 12px rgba(106, 68, 255, 0.25)',
  },
});
