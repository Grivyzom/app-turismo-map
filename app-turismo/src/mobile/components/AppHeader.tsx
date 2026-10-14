import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';

import { useMobileApp } from '../MobileAppContext';
import type { IoniconName } from '../data/categories';
import { MobileRadii } from '../theme';

import { Avatar, Card, T, useColors } from './ui';

type PrecisionState = 'searching' | 'high' | 'medium' | 'low' | 'denied' | 'manual';

const STATE_COLOR: Record<PrecisionState, string | null> = {
  searching: null,
  high: '#2E9E5B',
  medium: '#E0A126',
  low: '#D9822B',
  denied: '#D64545',
  manual: null,
};

const STATE_ICON: Record<PrecisionState, IoniconName> = {
  searching: 'locate-outline',
  high: 'locate',
  medium: 'locate',
  low: 'locate-outline',
  denied: 'location-outline',
  manual: 'pin-outline',
};

const STATE_LABEL: Record<PrecisionState, string> = {
  searching: 'Buscando tu ubicación',
  high: 'Precisión alta',
  medium: 'Precisión media',
  low: 'Precisión baja',
  denied: 'Ubicación no disponible',
  manual: 'Sector elegido a mano',
};

/** Botón circular con icono de estado, punto de color y animación mientras busca señal. */
function StatusButton({
  icon,
  dotColor,
  badge,
  pulsing,
  slashed,
  onPress,
  accessibilityLabel,
}: {
  icon: IoniconName;
  dotColor?: string | null;
  badge?: boolean;
  pulsing?: boolean;
  slashed?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const colors = useColors();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!pulsing) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulsing, pulse]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      style={({ pressed }) => [
        styles.statusBtn,
        { backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Animated.View style={{ opacity: pulse }}>
        <Ionicons name={icon} size={20} color={slashed ? colors.textSecondary : colors.text} />
      </Animated.View>
      {dotColor ? (
        <View style={[styles.dot, { backgroundColor: dotColor, borderColor: colors.surfaceMuted }]} />
      ) : null}
      {badge ? (
        <View style={[styles.dot, { backgroundColor: colors.text, borderColor: colors.surfaceMuted }]} />
      ) : null}
    </Pressable>
  );
}

/** Barra superior compartida: [perfil] — [sector] — [precisión] [avisos]. */
export function AppHeader({ hasNotifications = true }: { hasNotifications?: boolean }) {
  const {
    prefs,
    sectorName,
    setSectorPickerOpen,
    setTab,
    recenter,
    hasGps,
    gpsAccuracy,
    gpsLoading,
    gpsError,
    usingSectorOverride,
  } = useMobileApp();
  const colors = useColors();

  let state: PrecisionState;
  if (usingSectorOverride) state = 'manual';
  else if (prefs.locationUse === 'nunca' || (gpsError && !hasGps)) state = 'denied';
  else if (!hasGps || (gpsLoading && gpsAccuracy === null)) state = 'searching';
  else if (gpsAccuracy === null || gpsAccuracy <= 30) state = 'high';
  else if (gpsAccuracy <= 100) state = 'medium';
  else state = 'low';

  const meters = state === 'high' || state === 'medium' || state === 'low' ? gpsAccuracy : null;
  const precisionLabel = `${STATE_LABEL[state]}${meters !== null ? ` (±${Math.round(meters)} m)` : ''}. Toca para recentrar`;

  const notifOff = !Object.entries(prefs.notifications).some(
    ([key, value]) => key !== 'quietFrom' && value === true,
  );
  const notifIcon: IoniconName = notifOff
    ? 'notifications-off-outline'
    : hasNotifications
      ? 'notifications'
      : 'notifications-outline';

  return (
    <Card style={styles.bar}>
      <Pressable
        onPress={() => setTab('perfil')}
        accessibilityRole="button"
        accessibilityLabel="Abrir mi perfil"
        hitSlop={6}
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
        <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
      </Pressable>

      <View style={styles.actions}>
        <StatusButton
          icon={STATE_ICON[state]}
          dotColor={STATE_COLOR[state]}
          pulsing={state === 'searching'}
          slashed={state === 'denied'}
          onPress={recenter}
          accessibilityLabel={precisionLabel}
        />
        <StatusButton
          icon={notifIcon}
          badge={hasNotifications && !notifOff}
          slashed={notifOff}
          onPress={() => router.push('/notifications')}
          accessibilityLabel={notifOff ? 'Avisos desactivados' : 'Avisos'}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
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
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 4 },
  statusBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
});
