import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

/**
 * Versión nativa del fallback de Suspense: react-loader-spinner depende del DOM
 * (styled-components web) y rompe el bundle de Android/iOS.
 */
export function LoadingFallback() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#22c55e" accessibilityLabel="Cargando" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
