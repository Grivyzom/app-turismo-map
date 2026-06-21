import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Audio } from 'react-loader-spinner';

/**
 * Minimal loading placeholder used as the fallback for React.lazy Suspense boundaries.
 * Matches the app's dark background so the screen doesn't flash white during chunk loading.
 */
export function LoadingFallback() {
  return (
    <View style={styles.container}>
      <Audio
        height={80}
        width={80}
        radius={9}
        color="#22c55e"
        ariaLabel="audio-loading"
        wrapperStyle={{}}
        wrapperClass=""
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        minHeight: '100vh' as any,
      },
    }),
  },
});
