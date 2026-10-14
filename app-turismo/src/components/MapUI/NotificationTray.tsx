import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { SidebarSubmenu } from '../ui/SidebarSubmenu';
import { AppNotification } from '../../hooks/useHomeScreenState';

interface NotificationTrayProps {
  notifications: AppNotification[];
  onClose: () => void;
  onClearAll: () => void;
  onMarkAsRead: (id: string) => void;
  // Posición medida del botón de notificaciones en el navbar, para anclar
  // el panel justo debajo de él.
  anchor?: { top: number; left: number };
}

export function NotificationTray({
  notifications,
  onClose,
  onClearAll,
  onMarkAsRead,
  anchor,
}: NotificationTrayProps) {
  const headerRight = (
    <TouchableOpacity onPress={onClearAll}>
      <Text style={styles.clearAll}>Limpiar</Text>
    </TouchableOpacity>
  );

  return (
    <SidebarSubmenu
      visible={true}
      onClose={onClose}
      position={anchor ?? { top: 60, left: 16 }}
      pointerPosition="top-left"
      title="Notificaciones"
      headerRight={headerRight}
      width={320}
      maxHeight={500}
    >
      <View style={styles.scrollContent}>
        {notifications.length > 0 ? (
          notifications.map((n) => (
            <TouchableOpacity
              key={n.id}
              style={[styles.item, !n.isRead && styles.itemUnread]}
              onPress={() => onMarkAsRead(n.id)}
            >
              <View style={[styles.typeIcon, { backgroundColor: getTypeColor(n.type) + '20' }]}>
                <Ionicons name={getTypeIcon(n.type)} size={16} color={getTypeColor(n.type)} />
              </View>
              <View style={styles.content}>
                <Text style={styles.message}>{n.message}</Text>
                <Text style={styles.time}>{formatTime(n.timestamp)}</Text>
              </View>
              {!n.isRead && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={40} color="rgba(255,255,255,0.1)" />
            <Text style={styles.emptyText}>No hay notificaciones</Text>
          </View>
        )}
      </View>
    </SidebarSubmenu>
  );
}

function getTypeColor(type: string) {
  switch (type) {
    case 'success':
      return '#34D399';
    case 'warning':
      return '#F59E0B';
    case 'error':
      return '#EF4444';
    default:
      return '#38BDF8'; // River mist blue
  }
}

function getTypeIcon(type: string): any {
  switch (type) {
    case 'success':
      return 'checkmark-circle-outline';
    case 'warning':
      return 'alert-circle-outline';
    case 'error':
      return 'close-circle-outline';
    default:
      return 'information-circle-outline';
  }
}

function formatTime(date: Date) {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

const styles = StyleSheet.create({
  clearAll: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  itemUnread: {
    backgroundColor: 'rgba(52, 211, 153, 0.08)',
    borderColor: 'rgba(52, 211, 153, 0.22)',
  },
  typeIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  content: {
    flex: 1,
  },
  message: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 16,
  },
  time: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 2,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34D399',
    marginLeft: 8,
  },
  emptyState: {
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
});
