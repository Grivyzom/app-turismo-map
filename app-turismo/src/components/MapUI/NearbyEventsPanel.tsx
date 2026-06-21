import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Image,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';

import { TurismoEvent } from '../Map/types';
import { calculateDistance } from '../../utils/locationUtils';
import { getCategoryColor, getCategoryIcon } from '../../utils/mapUtils';
import { useUserLocationContext } from '../../context/UserLocationContext';

interface EventWithDistance extends TurismoEvent {
  distance?: number;
}

interface NearbyEventsPanelProps {
  events: TurismoEvent[];
  onSelectEvent: (event: TurismoEvent) => void;
  onClose: () => void;
  isDesktop?: boolean;
  containerStyle?: any;
}

export const NearbyEventsPanel: React.FC<NearbyEventsPanelProps> = ({
  events,
  onSelectEvent,
  onClose,
  isDesktop = false,
  containerStyle,
}) => {
  const { userLocation } = useUserLocationContext();
  const sortedEvents = useMemo(() => {
    if (!userLocation) return events as EventWithDistance[];

    return [...events]
      .map(
        (event): EventWithDistance => ({
          ...event,
          distance: calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            event.latitude,
            event.longitude,
          ),
        }),
      )
      .sort((a, b) => (a.distance || 0) - (b.distance || 0));
  }, [events, userLocation]);

  return (
    <View style={[styles.container, isDesktop && styles.containerDesktop, containerStyle]}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <MaterialIcons name="event-available" size={18} color="#34D399" />
          <Text style={styles.title}>Eventos Cercanos</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.7}>
          <Ionicons name="close" size={20} color="#A0AEC0" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        bounces={true}
      >
        {sortedEvents.length > 0 ? (
          sortedEvents.map((event) => {
            const distanceStr =
              event.distance !== undefined
                ? event.distance < 1000
                  ? `${Math.round(event.distance)}m`
                  : `${(event.distance / 1000).toFixed(1)}km`
                : '--';

            const categoryColor = getCategoryColor(event.category, event.musicStyle);

            return (
              <TouchableOpacity
                key={event.id}
                style={styles.eventItem}
                onPress={() => {
                  onSelectEvent(event);
                  onClose();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.eventCard}>
                  {event.imageUrl ? (
                    <Image source={{ uri: event.imageUrl }} style={styles.eventImage} />
                  ) : (
                    <View
                      style={[styles.iconPlaceholder, { backgroundColor: categoryColor + '15' }]}
                    >
                      <MaterialIcons
                        name={getCategoryIcon(event.category, event.musicStyle)}
                        size={22}
                        color={categoryColor}
                      />
                    </View>
                  )}

                  <View style={styles.eventInfo}>
                    <View style={styles.eventHeaderRow}>
                      <Text style={styles.eventTitle} numberOfLines={1}>
                        {event.title}
                      </Text>
                      <View style={styles.distanceBadge}>
                        <Text style={styles.distanceText}>{distanceStr}</Text>
                      </View>
                    </View>

                    <Text style={styles.eventSubtitle} numberOfLines={1}>
                      {event.organizer}
                    </Text>

                    <View style={styles.eventMetaRow}>
                      <View style={styles.timeTag}>
                        <Ionicons name="time-outline" size={10} color="#718096" />
                        <Text style={styles.timeText}>{event.time}</Text>
                      </View>
                      <View style={[styles.categoryTag, { backgroundColor: categoryColor + '20' }]}>
                        <Text style={[styles.categoryTagText, { color: categoryColor }]}>
                          {event.category.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <MaterialIcons name="event-busy" size={48} color="rgba(255,255,255,0.1)" />
            <Text style={styles.emptyStateText}>No hay eventos disponibles</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(18, 22, 30, 0.92)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
    width: Platform.OS === 'web' ? 320 : '85%',
    maxHeight: 500,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
      },
      android: { elevation: 12 },
      web: {
        backdropFilter: 'blur(25px)',
        WebkitBackdropFilter: 'blur(25px)',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
      },
    }),
  },
  containerDesktop: {
    width: 360,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 12,
  },
  eventItem: {
    marginBottom: 10,
  },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 18,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    gap: 12,
  },
  eventImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#1F2937',
  },
  iconPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventInfo: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  eventHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  eventTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  distanceBadge: {
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  distanceText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '800',
  },
  eventSubtitle: {
    color: '#718096',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  eventMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    color: '#A0AEC0',
    fontSize: 10,
    fontWeight: '600',
  },
  categoryTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  categoryTagText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  emptyState: {
    paddingVertical: 40,
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
