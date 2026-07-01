import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { API_URL } from '../config/api';
import { getCachedToken } from '../utils/tokenCache';

interface Notification {
  id: number;
  user_id: number;
  type: string;
  reference_id: number;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const token = await getCachedToken();
      if (!token) return;

      const res = await fetch(`${API_URL}/api/v1/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      } else {
        console.warn('Error fetching notifications', res.status);
      }
    } catch (err) {
      console.error('Network error fetching notifications', err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: number) => {
    try {
      const token = await getCachedToken();
      if (!token) return;

      const res = await fetch(`${API_URL}/api/v1/notifications/${id}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
        );
      }
    } catch (err) {
      console.error('Error marking notification as read', err);
    }
  };

  const renderItem = ({ item }: { item: Notification }) => {
    const isUnread = !item.is_read;
    const dateStr = new Date(item.created_at).toLocaleString('es-CL', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <TouchableOpacity
        style={[styles.notificationCard, isUnread && styles.unreadCard]}
        onPress={() => {
          if (isUnread) markAsRead(item.id);
        }}
      >
        <View style={styles.iconContainer}>
          <MaterialIcons name="campaign" size={24} color={isUnread ? '#FF3B30' : '#9CA3AF'} />
        </View>
        <View style={styles.contentContainer}>
          <Text style={[styles.title, isUnread && styles.unreadTitle]}>{item.title}</Text>
          <Text style={styles.message}>{item.message}</Text>
          <Text style={styles.time}>{dateStr}</Text>
        </View>
        {isUnread && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6EE7B7" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {notifications.length === 0 ? (
        <View style={styles.centerContainer}>
          <MaterialIcons name="notifications-none" size={64} color="#374151" />
          <Text style={styles.emptyText}>No tienes notificaciones</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e14',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0e14',
  },
  emptyText: {
    color: '#9CA3AF',
    marginTop: 16,
    fontSize: 16,
  },
  listContainer: {
    padding: 16,
  },
  notificationCard: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#111827',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  unreadCard: {
    backgroundColor: '#1F2937',
    borderColor: 'rgba(255,59,48,0.3)',
  },
  iconContainer: {
    marginRight: 16,
    justifyContent: 'center',
  },
  contentContainer: {
    flex: 1,
  },
  title: {
    color: '#D1D5DB',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  unreadTitle: {
    color: '#F3F4F6',
  },
  message: {
    color: '#9CA3AF',
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  time: {
    color: '#6B7280',
    fontSize: 12,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
    alignSelf: 'center',
    marginLeft: 12,
  },
});
