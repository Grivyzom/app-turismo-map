import { ClerkProvider } from '@clerk/react';
import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as SplashScreen from 'expo-splash-screen';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

import { AuthProvider } from '../src/context/AuthContext';
import { UserLocationProvider } from '../src/context/UserLocationContext';
import { CollectionsProvider } from '../src/context/CollectionsContext';
import { GlobalErrorBoundary } from '../src/components/ui/GlobalErrorBoundary';
import '../global.css';

const publishableKey =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  process.env.PUBLIC_CLERK_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  process.env.CLERK_PUBLISHABLE_KEY ||
  '';

if (!publishableKey) {
  throw new Error(
    'Falta la clave pública de Clerk (EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY / PUBLIC_CLERK_PUBLISHABLE_KEY / NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY). Por favor agrégala a tu archivo .env.',
  );
}

// Web-only: sileo toast portal (renders into document.body, immune to overflow:hidden)
let SileoToaster: React.FC | null = null;
if (Platform.OS === 'web') {
  try {
    const { SileoToaster: LocalToaster } = require('../src/components/ui/ToastNotification.web');
    SileoToaster = () => <LocalToaster offset={{ top: 80, right: 24 }} />;
  } catch (e) {
    console.warn('[Layout] Local toaster not available', e);
  }
}

// Prevent the splash screen from auto-hiding before asset loading is complete on native platforms.
if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync();
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    ...MaterialIcons.font,
    ...Ionicons.font,
  });

  useEffect(() => {
    if (Platform.OS === 'web' || fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <GlobalErrorBoundary>
        <AuthProvider>
          <UserLocationProvider>
            <CollectionsProvider>
              <Stack
                screenOptions={{
                  headerShown: false,
                }}
              >
                <Stack.Screen name="index" options={{}} />
                <Stack.Screen name="login" options={{}} />
                <Stack.Screen name="registro" options={{}} />
                <Stack.Screen name="ingresar" options={{}} />
                <Stack.Screen name="sso-callback" options={{}} />
                <Stack.Screen name="(home)" options={{}} />
              </Stack>
            </CollectionsProvider>
          </UserLocationProvider>
        </AuthProvider>
        {/* sileo Toaster: renders via Portal into document.body, outside any overflow:hidden container */}
        {SileoToaster && <SileoToaster />}
      </GlobalErrorBoundary>
    </ClerkProvider>
  );
}
