import React from 'react';
import { View, Text, StyleSheet, Platform, Animated } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { useNetworkStatus } from '../../hooks/useNetworkStatus';

export function OfflineIndicator() {
  const { isOnline } = useNetworkStatus();

  if (isOnline) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.banner}>
        <MaterialIcons name="cloud-off" size={18} color="#FFFFFF" style={styles.icon} />
        <Text style={styles.text}>
          Modo sin conexión. Tus reportes se guardarán para sincronizarse después.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 44 : 24, // Ajuste simple de safe area (MVP)
    left: 0,
    right: 0,
    zIndex: 1000,
    alignItems: 'center',
    pointerEvents: 'none',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(186, 26, 26, 0.9)', // Color error de la paleta Selva Valdiviana
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24, // Island Design pill shape
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    maxWidth: '90%',
  },
  icon: {
    marginRight: 8,
  },
  text: {
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'web' ? 'Inter, sans-serif' : 'System',
    fontSize: 12,
    fontWeight: '600',
  },
});
