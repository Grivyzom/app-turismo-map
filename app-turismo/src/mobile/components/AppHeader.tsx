import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';

import { useMobileApp } from '../MobileAppContext';
import { MobileRadii } from '../theme';

import { Avatar, Card, IconButton, T, useColors } from './ui';

/** Barra superior compartida: avatar, sector actual, recentrar y avisos. */
export function AppHeader({ hasNotifications = true }: { hasNotifications?: boolean }) {
  const { prefs, sectorName, setSectorPickerOpen, setTab, recenter } = useMobileApp();
  const colors = useColors();

  return (
    <Card style={styles.bar}>
      <Pressable
        onPress={() => setTab('perfil')}
        accessibilityRole="button"
        accessibilityLabel="Abrir mi perfil"
      >
        <Avatar name={prefs.nick || 'Visitante'} uri={prefs.photoUri} />
      </Pressable>

      <Pressable
        onPress={() => setSectorPickerOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Sector ${sectorName}. Cambiar sector`}
        style={({ pressed }) => [
          styles.sector,
          { backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Ionicons name="location-outline" size={18} color={colors.text} />
        <View style={{ flex: 1, marginLeft: 6 }}>
          <T variant="caption" color={colors.textSecondary}>
            Sector
          </T>
          <T variant="small" weight="600" numberOfLines={1}>
            {sectorName}
          </T>
        </View>
        <T variant="caption" color={colors.textSecondary}>
          Cambiar
        </T>
      </Pressable>

      <IconButton icon="locate-outline" onPress={recenter} accessibilityLabel="Usar mi ubicación" />
      <IconButton
        icon="notifications-outline"
        badge={hasNotifications}
        onPress={() => router.push('/notifications')}
        accessibilityLabel="Avisos"
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: MobileRadii.pill,
  },
  sector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: MobileRadii.pill,
  },
});
