import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { AuthenticateWithRedirectCallback } from '@clerk/react';

WebBrowser.maybeCompleteAuthSession();

export default function SSOCallback() {
  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  return (
    <View style={styles.container}>
      <AuthenticateWithRedirectCallback
        signInForceRedirectUrl="/(home)"
        signUpForceRedirectUrl="/(home)"
        signInFallbackRedirectUrl="/(home)"
        signUpFallbackRedirectUrl="/(home)"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
