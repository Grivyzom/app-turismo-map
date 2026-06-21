import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';

import { TurismoEvent } from '../components/Map/types';
import { INITIAL_EVENTS } from '../data/mockEvents';
import { getCategoryColor, getCategoryIcon } from '../utils/mapUtils';

export default function EventsScreen() {
  const [events, setEvents] = useState<TurismoEvent[]>(INITIAL_EVENTS);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    try {
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8080';
      const response = await fetch(`${baseUrl}/api/v1/places/search?viewMode=local`);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.results) && data.results.length > 0) {
          setEvents(data.results);
        }
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.headerTitle}>Eventos en Valdivia</Text>
      <Text style={styles.headerSubtitle}>Lo que está ocurriendo ahora en la ciudad</Text>

      {isLoading ? (
        <ActivityIndicator color="#34D399" style={{ marginTop: 40 }} />
      ) : events.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="event-busy" size={48} color="rgba(255,255,255,0.1)" />
          <Text style={styles.emptyStateText}>No hay eventos disponibles</Text>
        </View>
      ) : (
        events.map((event) => {
          const categoryColor = getCategoryColor(event.category, event.musicStyle);
          return (
            <TouchableOpacity key={event.id} style={styles.eventCard} activeOpacity={0.8}>
              {event.imageUrl ? (
                <Image source={{ uri: event.imageUrl }} style={styles.eventImage} />
              ) : (
                <View style={[styles.iconPlaceholder, { backgroundColor: categoryColor + '15' }]}>
                  <MaterialIcons
                    name={getCategoryIcon(event.category, event.musicStyle)}
                    size={26}
                    color={categoryColor}
                  />
                </View>
              )}

              <View style={styles.eventInfo}>
                <Text style={styles.eventTitle} numberOfLines={1}>
                  {event.title}
                </Text>
                <Text style={styles.eventOrganizer} numberOfLines={1}>
                  {event.organizer}
                </Text>
                <View style={styles.eventMetaRow}>
                  <View style={styles.timeTag}>
                    <Ionicons name="time-outline" size={11} color="#718096" />
                    <Text style={styles.timeText}>{event.time}</Text>
                  </View>
                  <View style={[styles.categoryTag, { backgroundColor: categoryColor + '20' }]}>
                    <Text style={[styles.categoryTagText, { color: categoryColor }]}>
                      {event.category.toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 60,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#9CA3AF',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 20,
  },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    gap: 14,
    marginBottom: 12,
  },
  eventImage: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: '#1F2937',
  },
  iconPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  eventTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  eventOrganizer: {
    color: '#718096',
    fontSize: 12,
    fontWeight: '500',
  },
  eventMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    color: '#A0AEC0',
    fontSize: 11,
    fontWeight: '600',
  },
  categoryTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryTagText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyStateText: {
    color: '#4A5568',
    fontSize: 13,
    fontWeight: '600',
  },
});
