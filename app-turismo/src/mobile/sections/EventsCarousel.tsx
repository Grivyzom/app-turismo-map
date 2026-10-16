import React, { useRef, useState } from 'react';
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { useMobileApp } from '../MobileAppContext';
import { categoryIcon, categoryLabel } from '../data/categories';
import { formatMeters, PlaceWithDistance } from '../hooks/usePlacesData';
import {
  Card,
  IconButton,
  PillButton,
  PrimaryButton,
  T,
  Tag,
  Tap,
  Thumb,
  useColors,
} from '../components/ui';
import { MobileSpacing } from '../theme';

const PEEK = 44; // cuánto asoma la tarjeta siguiente

/** Carrusel paginado "Eventos cerca de ti" con guardado y "Cómo llegar". */
export function EventsCarousel({ events }: { events: PlaceWithDistance[] }) {
  const { width } = useWindowDimensions();
  const { prefs, toggleSavedEvent, openOnMap, openEvent } = useMobileApp();
  const colors = useColors();
  const listRef = useRef<FlatList<PlaceWithDistance>>(null);
  const [page, setPage] = useState(0);

  const cardWidth = width - MobileSpacing.screen * 2 - PEEK;
  const snap = cardWidth + MobileSpacing.gap;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / snap);
    if (idx !== page) setPage(Math.max(0, Math.min(events.length - 1, idx)));
  };

  const goTo = (idx: number) => {
    const clamped = Math.max(0, Math.min(events.length - 1, idx));
    listRef.current?.scrollToOffset({ offset: clamped * snap, animated: true });
    setPage(clamped);
  };

  if (events.length === 0) {
    return (
      <Card>
        <T color={colors.textSecondary}>No hay eventos publicados cerca por ahora.</T>
      </Card>
    );
  }

  return (
    <View>
      <FlatList
        ref={listRef}
        data={events}
        horizontal
        keyExtractor={(e) => String(e.id)}
        showsHorizontalScrollIndicator={false}
        snapToInterval={snap}
        decelerationRate="fast"
        onMomentumScrollEnd={onScroll}
        style={{ marginHorizontal: -MobileSpacing.screen }}
        contentContainerStyle={{ paddingHorizontal: MobileSpacing.screen, gap: MobileSpacing.gap }}
        renderItem={({ item }) => {
          const saved = prefs.savedEventIds.includes(String(item.id));
          return (
            <Card style={{ width: cardWidth, padding: 10 }}>
              <Tap
                onPress={() => openEvent(item)}
                pressedOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`Ver detalles de ${item.title}`}
              >
                <Thumb
                  uri={item.imageUrl}
                  style={{ height: 130, width: '100%' }}
                  icon={categoryIcon(item.category)}
                />
                {item.time ? (
                  <View style={[styles.overlayLeft, { backgroundColor: colors.surface }]}>
                    <T variant="caption" weight="600">
                      {item.time}
                    </T>
                  </View>
                ) : null}
              </Tap>
              <PillButton
                label={saved ? 'Guardado' : 'Guardar'}
                icon={saved ? 'bookmark' : 'bookmark-outline'}
                onPress={() => toggleSavedEvent(String(item.id))}
                style={[styles.overlayRight, { backgroundColor: colors.surface }]}
              />
              <View style={{ paddingHorizontal: 6, paddingTop: 12 }}>
                <T
                  variant="title"
                  weight="700"
                  numberOfLines={1}
                  onPress={() => openEvent(item)}
                  suppressHighlighting
                >
                  {item.title}
                </T>
                <T variant="caption" color={colors.textSecondary} numberOfLines={1}>
                  {[item.address || item.organizer, formatMeters(item.distanceMeters)]
                    .filter(Boolean)
                    .join(' · ')}
                </T>
                <View style={styles.footer}>
                  <Tag label={categoryLabel(item.category)} />
                  <PrimaryButton
                    label="Cómo llegar"
                    onPress={() => openOnMap(item)}
                    style={{ minHeight: 40 }}
                  />
                </View>
              </View>
            </Card>
          );
        }}
      />
      {events.length > 1 ? (
        <View style={styles.pager}>
          <IconButton
            icon="chevron-back"
            size={40}
            onPress={() => goTo(page - 1)}
            accessibilityLabel="Evento anterior"
            style={{ opacity: page === 0 ? 0.4 : 1 }}
          />
          <T variant="small" weight="500">
            {page + 1} de {events.length}
          </T>
          <IconButton
            icon="chevron-forward"
            size={40}
            onPress={() => goTo(page + 1)}
            accessibilityLabel="Evento siguiente"
            style={{ opacity: page === events.length - 1 ? 0.4 : 1 }}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlayLeft: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  overlayRight: { position: 'absolute', top: 18, right: 18 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 8,
  },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginTop: 12,
  },
});
