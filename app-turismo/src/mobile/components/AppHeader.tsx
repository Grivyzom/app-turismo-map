import React from 'react';
import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';

import { useMobileApp } from '../MobileAppContext';
import type { IoniconName } from '../data/categories';
import { MobileRadii } from '../theme';

import { Avatar, Card, T, Tap, useColors } from './ui';

const BAR_HEIGHT = 56;
const BADGE_COLOR = '#FF4D4F';

/** "Sector Collico" → "Collico": la etiqueta superior ya dice "Sector". */
function placeName(sectorName: string) {
  return sectorName.replace(/^sector\s+/i, '') || sectorName;
}

/**
 * Barra superior compartida (56px): [perfil + sector] ········ [avisos].
 * El control de GPS vive en el mapa (ver GpsButton), no aquí.
 *
 * Nota: el layout de cada botón va en un View interno porque NativeWind puede
 * descartar el `style` del Pressable en Android.
 */
export function AppHeader({ hasNotifications = true }: { hasNotifications?: boolean }) {
  const { prefs, sectorName, setSectorPickerOpen, setTab } = useMobileApp();
  const colors = useColors();

  const notifOff = !Object.entries(prefs.notifications).some(
    ([key, value]) => key !== 'quietFrom' && value === true,
  );
  const notifIcon: IoniconName = notifOff
    ? 'notifications-off-outline'
    : hasNotifications
      ? 'notifications'
      : 'notifications-outline';
  const showBadge = hasNotifications && !notifOff;

  return (
    <Card style={styles.bar}>
      <View style={styles.left}>
        <Tap
          onPress={() => setTab('perfil')}
          accessibilityRole="button"
          accessibilityLabel="Abrir mi perfil"
          hitSlop={6}
        >
          <Avatar name={prefs.nick || 'Visitante'} uri={prefs.photoUri} size={40} />
        </Tap>

        <Tap
          onPress={() => setSectorPickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Sector ${placeName(sectorName)}. Cambiar sector`}
          style={styles.sectorTap}
        >
          <View style={styles.sector}>
            <View style={styles.row}>
              <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
              <T variant="caption" color={colors.textSecondary} style={styles.sectorLabel}>
                Sector
              </T>
            </View>
            <View style={styles.row}>
              <T variant="small" weight="600" numberOfLines={1} style={styles.sectorName}>
                {placeName(sectorName)}
              </T>
              <Ionicons name="chevron-down" size={14} color={colors.text} />
            </View>
          </View>
        </Tap>
      </View>

      <Tap
        onPress={() => router.push('/notifications')}
        accessibilityRole="button"
        accessibilityLabel={
          notifOff ? 'Avisos desactivados' : showBadge ? 'Avisos, hay novedades' : 'Avisos'
        }
      >
        <View style={styles.iconBtn}>
          <View>
            <Ionicons
              name={notifIcon}
              size={22}
              color={notifOff ? colors.textSecondary : colors.text}
            />
            {showBadge ? <View style={[styles.badge, { borderColor: colors.surface }]} /> : null}
          </View>
        </View>
      </Tap>
    </Card>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: BAR_HEIGHT,
    paddingVertical: 0,
    paddingLeft: 8,
    paddingRight: 6,
    borderRadius: MobileRadii.pill,
  },
  left: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectorTap: { flexShrink: 1, minWidth: 0 },
  sector: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderRadius: MobileRadii.pill,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  sectorLabel: { marginLeft: 3 },
  sectorName: { flexShrink: 1, marginRight: 2 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -3,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
    backgroundColor: BADGE_COLOR,
  },
});
