import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';

import { clearAdminAuthAsync } from '../../../src/utils/adminAuthStorage';

export default function AdminLogoutScreen() {
  const router = useRouter();

  useEffect(() => {
    const performLogout = async () => {
      try {
        await clearAdminAuthAsync();
      } catch (err) {
        console.error('Error al cerrar sesión:', err);
      } finally {
        router.replace('/admin/login/');
      }
    };

    performLogout();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#3b82f6" />
      <Text style={styles.text}>Cerrando sesión de forma segura...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#9ca3af',
    marginTop: 15,
    fontSize: 15,
  },
});
