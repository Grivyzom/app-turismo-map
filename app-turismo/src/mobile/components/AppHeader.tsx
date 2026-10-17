import React from 'react';
import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useAuth } from '../../context/AuthContext';
import { useMobileApp } from '../MobileAppContext';
import type { IoniconName } from '../data/categories';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { notificationsMuted } from '../hooks/useMobilePreferences';
import { MobileRadii } from '../theme';

import { Avatar, BadgeDot, Card, T, Tap, useColors } from './ui';

const BAR_HEIGHT = 56;

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
export function AppHeader() {
  const { prefs, sectorName, setSectorPickerOpen, setTab, setOverlay, notifications } =
    useMobileApp();
  const { openAuthModal } = useAuth();
  const me = useCurrentUser();
  const colors = useColors();

  // El punto rojo solo aparece cuando hay avisos sin leer (como en la web)
  const notifOff = notificationsMuted(prefs);
  const unread = notifications.unreadCount;
  const showBadge = unread > 0 && !notifOff;
  const notifIcon: IoniconName = notifOff
    ? 'notifications-off-outline'
    : showBadge
      ? 'notifications'
      : 'notifications-outline';

  return (
    <Card style={styles.bar}>
      <View style={styles.left}>
        {/* Invitado: el avatar abre el acceso; con sesión, el perfil */}
        <Tap
          onPress={me.isGuest ? () => openAuthModal('login') : () => setTab('perfil')}
          accessibilityRole="button"
          accessibilityLabel={
            me.isGuest ? 'Iniciar sesión o crear cuenta' : `Abrir mi perfil (${me.displayName})`
          }
          hitSlop={6}
        >
          <Avatar
            name={me.displayName}
            uri={me.avatarUrl}
            icon={me.isGuest ? 'person-outline' : undefined}
            size={40}
          />
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
        onPress={() => setOverlay('avisos')}
        accessibilityRole="button"
        accessibilityLabel={
          notifOff
            ? 'Avisos desactivados'
            : showBadge
              ? `Avisos, ${unread} sin leer`
              : 'Avisos, no hay novedades'
        }
      >
        <View style={styles.iconBtn}>
          <View>
            <Ionicons
              name={notifIcon}
              size={22}
              color={notifOff ? colors.textSecondary : colors.text}
            />
            {showBadge ? <BadgeDot /> : null}
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
});
