import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';

/**
 * Minimal loading placeholder used as the fallback for React.lazy Suspense boundaries.
 * Matches the app's dark background so the screen doesn't flash white during chunk loading.
 */
export function LoadingFallback() {
  return <View style={styles.container} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
    ...Platform.select({
      web: {
        minHeight: '100vh' as any,
      },
    }),
  },
});
