import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useAuth } from '../../context/AuthContext';
import { useMobileApp } from '../MobileAppContext';
import { Screen } from '../components/Screen';
import { Card, EmptyState, OverlayHeader, PillButton, T, Tap, useColors } from '../components/ui';
import type { IoniconName } from '../data/categories';
import type { MobileNotification } from '../hooks/useMobileNotifications';
import { notificationsMuted } from '../hooks/useMobilePreferences';
import { MobileRadii } from '../theme';

function typeIcon(type: string): IoniconName {
  switch (type) {
    case 'business_update':
      return 'storefront-outline';
    case 'event':
      return 'calendar-outline';
    case 'weather':
    case 'warning':
      return 'alert-circle-outline';
    default:
      return 'notifications-outline';
  }
}

/** "hace 5 min", "hace 3 h", "ayer" o la fecha corta. */
function relativeTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  if (hours < 48) return 'ayer';
  return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

function NotificationRow({
  item,
  last,
  onPress,
}: {
  item: MobileNotification;
  last: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const unread = !item.isRead;
  return (
    <Tap
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'No leído. ' : ''}${item.title}. ${item.message}`}
    >
      <View
        style={[
          styles.row,
          !last && {
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View
          style={[
            styles.typeIcon,
            { backgroundColor: unread ? colors.accent : colors.surfaceMuted },
          ]}
        >
          <Ionicons
            name={typeIcon(item.type)}
            size={18}
            color={unread ? colors.onAccent : colors.textSecondary}
          />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          {item.title ? (
            <T weight={unread ? '700' : '500'} numberOfLines={1}>
              {item.title}
            </T>
          ) : null}
          {item.message ? (
            <T variant="small" color={colors.textSecondary} numberOfLines={3}>
              {item.message}
            </T>
          ) : null}
          <T variant="caption" color={colors.textMuted} style={{ marginTop: 4 }}>
            {relativeTime(item.createdAt)}
          </T>
        </View>
        {unread ? <View style={[styles.unreadDot, { backgroundColor: colors.badge }]} /> : null}
      </View>
    </Tap>
  );
}

/** "Avisos": lista de notificaciones del usuario con el mismo lenguaje visual que el resto de la app. */
export function AvisosScreen() {
  const { setOverlay, openProfile, prefs, notifications } = useMobileApp();
  const { isAuthenticated, openAuthModal } = useAuth();
  const colors = useColors();
  const { items, unreadCount, loading, error, refresh, markAsRead, markAllAsRead } = notifications;

  const header = (
    <OverlayHeader
      caption={unreadCount > 0 ? `${unreadCount} sin leer` : 'Al día'}
      title="Avisos"
      onBack={() => setOverlay(null)}
      action={unreadCount > 0 ? <PillButton label="Marcar leídos" onPress={markAllAsRead} /> : null}
    />
  );

  const muted = notificationsMuted(prefs);
  const mutedHint = muted ? (
    <Card style={styles.hint}>
      <Ionicons name="notifications-off-outline" size={18} color={colors.textSecondary} />
      <T variant="small" color={colors.textSecondary} style={{ flex: 1 }}>
        Tienes los avisos desactivados.
      </T>
      <PillButton label="Ajustes" onPress={openProfile} />
    </Card>
  ) : null;

  let body: React.ReactNode;
  if (!isAuthenticated) {
    body = (
      <EmptyState
        icon="person-circle-outline"
        title="Inicia sesión para ver tus avisos"
        message="Te contaremos novedades de los lugares que sigues y cambios en tus rutas."
        actionLabel="Iniciar sesión"
        onAction={() => openAuthModal('login')}
      />
    );
  } else if (loading && items.length === 0) {
    body = (
      <Card style={{ alignItems: 'center', paddingVertical: 40 }}>
        <ActivityIndicator color={colors.text} />
      </Card>
    );
  } else if (error && items.length === 0) {
    body = (
      <EmptyState
        icon="cloud-offline-outline"
        title="Sin conexión"
        message={error}
        actionLabel="Reintentar"
        onAction={refresh}
      />
    );
  } else if (items.length === 0) {
    body = (
      <EmptyState
        icon="notifications-outline"
        title="Todo al día"
        message="No tienes avisos por ahora. Te avisaremos cuando haya novedades."
      />
    );
  } else {
    body = (
      <Card style={styles.list}>
        {items.map((n, i) => (
          <NotificationRow
            key={n.id}
            item={n}
            last={i === items.length - 1}
            onPress={() => !n.isRead && markAsRead(n.id)}
          />
        ))}
      </Card>
    );
  }

  return (
    <Screen header={header} onRefresh={isAuthenticated ? refresh : undefined} refreshing={loading}>
      {mutedHint}
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  list: { paddingVertical: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
  },
  typeIcon: {
    width: 36,
    height: 36,
    borderRadius: MobileRadii.button - 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
});
