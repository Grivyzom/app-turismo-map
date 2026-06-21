import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SidebarSubmenu } from '../ui/SidebarSubmenu';

import { AppNotification } from '../../../app/(home)/useHomeScreenState';

interface NotificationTrayProps {
  notifications: AppNotification[];
  onClose: () => void;
  onClearAll: () => void;
  onMarkAsRead: (id: string) => void;
}

export function NotificationTray({
  notifications,
  onClose,
  onClearAll,
  onMarkAsRead,
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
      position={{ left: 76, bottom: 44 }}
      pointerPosition="bottom-left"
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
            <Ionicons
              name="notifications-off-outline"
              size={40}
              color="rgba(255,255,255,0.1)"
            />
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
      return '#FBBF24';
    case 'error':
      return '#F87171';
    default:
      return '#7F6DF2'; // Obsidian purple instead of generic blue
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
    color: '#7F6DF2', // Obsidian purple highlight
    fontSize: 12,
    fontWeight: '600',
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
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  itemUnread: {
    backgroundColor: 'rgba(127, 109, 242, 0.06)',
    borderColor: 'rgba(127, 109, 242, 0.15)',
  },
  typeIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  content: {
    flex: 1,
  },
  message: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 16,
  },
  time: {
    color: '#718096',
    fontSize: 10,
    marginTop: 2,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#7F6DF2', // Obsidian purple unread dot
    marginLeft: 8,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyText: {
    color: '#4A5568',
    fontSize: 13,
    fontWeight: '600',
  },
});
