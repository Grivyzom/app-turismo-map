import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as SplashScreen from 'expo-splash-screen';
import { Platform } from 'react-native';

import { AuthProvider } from '../src/context/AuthContext';
import { UserLocationProvider } from '../src/context/UserLocationContext';
import { CollectionsProvider } from '../src/context/CollectionsContext';
import { GlobalErrorBoundary } from '../src/components/ui/GlobalErrorBoundary';
import '../global.css';

// Web-only: sileo toast portal (renders into document.body, immune to overflow:hidden)
let SileoToaster: React.FC | null = null;
if (Platform.OS === 'web') {
  try {
    // Dynamic require so native bundler never sees sileo
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Toaster } = require('sileo');
    require('sileo/styles.css');
    SileoToaster = () => <Toaster position="top-right" />;
  } catch (e) {
    console.warn('[Layout] sileo not available', e);
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
              <Stack.Screen name="(home)" options={{}} />
              <Stack.Screen name="business" options={{ headerShown: false }} />
              <Stack.Screen name="admin/login/index" options={{}} />
              <Stack.Screen name="admin/dashboard/index" options={{}} />
              <Stack.Screen name="admin/logout/index" options={{}} />
            </Stack>
          </CollectionsProvider>
        </UserLocationProvider>
      </AuthProvider>
      {/* sileo Toaster: renders via Portal into document.body, outside any overflow:hidden container */}
      {SileoToaster && <SileoToaster />}
    </GlobalErrorBoundary>
  );
}
