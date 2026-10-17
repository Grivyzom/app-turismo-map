import React from 'react';
import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useMobileApp } from '../MobileAppContext';
import { Card, PillButton, T, useColors } from '../components/ui';

/** Recordatorio para crear cuenta; solo se muestra al invitado. */
export function GuestBanner() {
  const { isGuest, requireAccount } = useMobileApp();
  const colors = useColors();
  if (!isGuest) return null;

  return (
    <Card style={styles.card}>
      <View style={[styles.icon, { backgroundColor: colors.surfaceMuted }]}>
        <Ionicons name="person-outline" size={18} color={colors.text} />
      </View>
      <View style={{ flex: 1 }}>
        <T variant="small" weight="600">
          Estás como invitado
        </T>
        <T variant="caption" color={colors.textSecondary}>
          Inicia sesión para guardar lugares, usar la guía y seguir rutas.
        </T>
      </View>
      <PillButton label="Entrar" onPress={() => requireAccount('perfil')} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
