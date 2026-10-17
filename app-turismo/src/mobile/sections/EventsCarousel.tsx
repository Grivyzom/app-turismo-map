import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { useMobileApp } from '../MobileAppContext';
import { EventHookLine, EventKindBadge } from '../components/EventKindBadge';
import { Card, IconButton, PrimaryButton, T, Tag, Tap, Thumb, useColors } from '../components/ui';
import { categoryIcon, categoryLabel } from '../data/categories';
import { eventHook } from '../data/eventInfo';
import { formatMeters, PlaceWithDistance } from '../hooks/usePlacesData';
import { MobileRadii, MobileSpacing } from '../theme';

/** Tiempo que cada evento permanece en pantalla antes de pasar al siguiente. */
const AUTOPLAY_MS = 6000;
/** Separación entre tarjetas: con el doble del margen, cada página mide justo el ancho de pantalla. */
const CARD_GAP = MobileSpacing.screen * 2;
/** Proporción de las ilustraciones cuando el evento no informa sus dimensiones. */
const DEFAULT_ART_RATIO = 3 / 2;

/**
 * Carrusel "Eventos cerca de ti": una tarjeta a la vez que avanza sola.
 *
 * El avance automático se detiene mientras el usuario arrastra, si sale de Inicio, abre una ficha
 * u overlay, si la app pasa a segundo plano o si el sistema pide reducir el movimiento.
 * El botón de pausa permite detenerlo (o activarlo) a voluntad.
 */
export function EventsCarousel({ events }: { events: PlaceWithDistance[] }) {
  const { width } = useWindowDimensions();
  const { prefs, toggleSavedEvent, openOnMap, openEvent, tab, overlay, eventDetail } =
    useMobileApp();
  const colors = useColors();
  const listRef = useRef<FlatList<PlaceWithDistance>>(null);
  const [page, setPage] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [reduceMotion, setReduceMotion] = useState(false);
  /** null = sin elección del usuario (se sigue la preferencia de movimiento del sistema). */
  const [userPaused, setUserPaused] = useState<boolean | null>(null);
  const [progress] = useState(() => new Animated.Value(0));
  // Ancho real del carrusel: en escritorio la columna es más angosta que la ventana
  const [boxWidth, setBoxWidth] = useState<number | null>(null);

  const count = events.length;
  const current = Math.min(page, Math.max(0, count - 1));
  const cardWidth = boxWidth ?? width - MobileSpacing.screen * 2;
  const snap = cardWidth + CARD_GAP; // = ancho de la columna: nunca asoma la tarjeta vecina

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setAppActive(s === 'active'));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  const paused = userPaused ?? reduceMotion;
  const playing =
    count > 1 && !paused && !dragging && appActive && tab === 'inicio' && !overlay && !eventDetail;

  const goTo = useCallback(
    (idx: number) => {
      if (count === 0) return;
      const next = (idx + count) % count;
      listRef.current?.scrollToOffset({ offset: next * snap, animated: true });
      setPage(next);
    },
    [count, snap],
  );

  // Cada página reinicia la barra de progreso; al completarse, pasa a la siguiente
  useEffect(() => {
    progress.setValue(0);
    if (!playing) return;
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: AUTOPLAY_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    anim.start(({ finished }) => finished && goTo(current + 1));
    return () => anim.stop();
  }, [playing, current, goTo, progress]);

  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / snap);
    setPage(Math.max(0, Math.min(count - 1, idx)));
    setDragging(false);
  };

  if (count === 0) {
    return (
      <Card>
        <T color={colors.textSecondary}>No hay eventos publicados cerca por ahora.</T>
      </Card>
    );
  }

  return (
    <View testID="events-carousel" onLayout={(e) => setBoxWidth(e.nativeEvent.layout.width)}>
      <FlatList
        ref={listRef}
        data={events}
        horizontal
        keyExtractor={(e) => String(e.id)}
        showsHorizontalScrollIndicator={false}
        snapToInterval={snap}
        decelerationRate="fast"
        disableIntervalMomentum
        onScrollBeginDrag={() => setDragging(true)}
        onScrollEndDrag={settle}
        onMomentumScrollEnd={settle}
        getItemLayout={(_, index) => ({ length: snap, offset: snap * index, index })}
        style={{ marginHorizontal: -MobileSpacing.screen }}
        contentContainerStyle={{ paddingHorizontal: MobileSpacing.screen, gap: CARD_GAP }}
        renderItem={({ item, index }) => (
          <EventCard
            event={item}
            width={cardWidth}
            position={`${index + 1} de ${count}`}
            saved={prefs.savedEventIds.includes(String(item.id))}
            onOpen={() => openEvent(item)}
            onSave={() => toggleSavedEvent(String(item.id))}
            onDirections={() => openOnMap(item)}
          />
        )}
      />

      {count > 1 ? (
        <View style={styles.controls}>
          <View style={styles.segments}>
            {events.map((e, i) => (
              <Pressable
                key={e.id}
                onPress={() => goTo(i)}
                hitSlop={{ top: 12, bottom: 12 }}
                accessibilityRole="button"
                accessibilityLabel={`Ir al evento ${i + 1} de ${count}: ${e.title}`}
                accessibilityState={{ selected: i === current }}
                style={[styles.segment, { backgroundColor: colors.surfaceSunken }]}
              >
                {i < current ? (
                  <View style={[styles.fill, { backgroundColor: colors.accent }]} />
                ) : i === current ? (
                  <Animated.View
                    style={[
                      styles.fill,
                      {
                        backgroundColor: colors.accent,
                        transformOrigin: 'left',
                        transform: [{ scaleX: playing ? progress : 1 }],
                      },
                    ]}
                  />
                ) : null}
              </Pressable>
            ))}
          </View>
          <IconButton
            icon={paused ? 'play' : 'pause'}
            size={36}
            onPress={() => setUserPaused(!paused)}
            accessibilityLabel={paused ? 'Reanudar avance automático' : 'Pausar avance automático'}
          />
        </View>
      ) : null}
    </View>
  );
}

function EventCard({
  event,
  width,
  position,
  saved,
  onOpen,
  onSave,
  onDirections,
}: {
  event: PlaceWithDistance;
  width: number;
  position: string;
  saved: boolean;
  onOpen: () => void;
  onSave: () => void;
  onDirections: () => void;
}) {
  const colors = useColors();
  const hook = eventHook(event);
  const ratio =
    event.imageWidth && event.imageHeight
      ? event.imageWidth / event.imageHeight
      : DEFAULT_ART_RATIO;

  return (
    <Card style={{ width, padding: 10 }}>
      {/* Ilustración completa en su proporción: sin textos ni botones encima */}
      <Tap
        onPress={onOpen}
        pressedOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={`Evento ${position}. ${event.title}. ${hook?.headline ?? ''}. Ver detalles`}
      >
        <Thumb
          asset={event.imageAsset}
          uri={event.imageUrl}
          style={{ width: '100%', aspectRatio: ratio }}
          icon={categoryIcon(event.category)}
        />
      </Tap>

      <View style={styles.body}>
        <View style={styles.tags}>
          {hook && event.eventKind ? (
            <EventKindBadge kind={event.eventKind} label={hook.badge} />
          ) : null}
          <Tag label={categoryLabel(event.category)} />
        </View>
        {hook ? (
          <View style={{ marginTop: 10 }}>
            <EventHookLine hook={hook} />
          </View>
        ) : null}
        <T
          variant="title"
          weight="700"
          numberOfLines={1}
          onPress={onOpen}
          suppressHighlighting
          style={{ marginTop: 2 }}
        >
          {event.title}
        </T>
        <T variant="caption" color={colors.textSecondary} numberOfLines={1}>
          {[event.organizer, formatMeters(event.distanceMeters)].filter(Boolean).join(' · ')}
        </T>
        <View style={styles.footer}>
          <IconButton
            icon={saved ? 'bookmark' : 'bookmark-outline'}
            onPress={onSave}
            accessibilityLabel={saved ? 'Quitar de guardados' : 'Guardar evento'}
          />
          <Tap
            onPress={onOpen}
            accessibilityRole="button"
            style={[styles.secondary, { borderColor: colors.borderStrong }]}
          >
            <T weight="600" numberOfLines={1}>
              Ver evento
            </T>
          </Tap>
          <PrimaryButton
            label="Cómo llegar"
            onPress={onDirections}
            style={{ flex: 1, minHeight: 44 }}
          />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 6, paddingTop: 12, paddingBottom: 2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  secondary: {
    flex: 1,
    minHeight: 44,
    borderRadius: MobileRadii.button,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  segments: { flex: 1, flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
