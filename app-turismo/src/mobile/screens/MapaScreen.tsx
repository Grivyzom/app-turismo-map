import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MapContainer } from '../../components/Map/MapContainer';
import type { MapLayer, TurismoEvent } from '../../components/Map/types';
import { useUserLocationContext } from '../../context/UserLocationContext';
import { useWalkPreview } from '../../hooks/useWalkPreview';
import { useMobileApp } from '../MobileAppContext';
import { GpsButton } from '../components/GpsButton';
import { Card, Chip, IconButton, PrimaryButton, T, Tag, Thumb, useColors } from '../components/ui';
import {
  categoryIcon,
  categoryLabel,
  matchesQuickCategory,
  QUICK_CATEGORIES,
  QuickCategory,
} from '../data/categories';
import { formatDurationShort, RecommendedRoute } from '../data/routes';
import { formatMeters, PlaceWithDistance, walkMinutes } from '../hooks/usePlacesData';
import { useVoiceQuestion } from '../hooks/useVoiceQuestion';
import { sharePlace } from '../utils/external';
import { cardShadow, MobileFont, MobileRadii, MobileSpacing, TAB_BAR_HEIGHT } from '../theme';

const FILTERS: { key: QuickCategory; label: string }[] = [
  { key: 'todo', label: 'Todo' },
  ...QUICK_CATEGORIES.map((c) => ({ key: c.key as QuickCategory, label: c.label })),
];

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Ruta de una sola parada para reutilizar la navegación de "Rutas" desde el mapa. */
function singleStopRoute(place: PlaceWithDistance): RecommendedRoute {
  const minutes = walkMinutes(place.distanceMeters);
  const eta = new Date(Date.now() + minutes * 60_000);
  return {
    id: `go-${place.id}`,
    title: place.title,
    stops: [
      {
        place,
        eta: `${String(eta.getHours()).padStart(2, '0')}:${String(eta.getMinutes()).padStart(2, '0')}`,
      },
    ],
    totalMinutes: minutes,
    totalMeters: place.distanceMeters,
  };
}

export function MapaScreen() {
  const { places, mapFocus, prefs, toggleSavedEvent, startRoute, textScale, tab } = useMobileApp();
  const { userLocation } = useUserLocationContext();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [filter, setFilter] = useState<QuickCategory>('todo');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<PlaceWithDistance | null>(null);
  const [layer, setLayer] = useState<MapLayer>('light');
  const [centerTrigger, setCenterTrigger] = useState(0);
  const [zoom, setZoom] = useState(15);
  const [peekHeight, setPeekHeight] = useState(0);

  // Llegadas desde Inicio / Guía: aplicar filtro y lugar pedidos
  const [seenFocus, setSeenFocus] = useState(0);
  if (mapFocus.nonce !== seenFocus) {
    setSeenFocus(mapFocus.nonce);
    setFilter(mapFocus.category);
    setSelected(mapFocus.place);
    setQuery('');
  }

  const voice = useVoiceQuestion(setQuery);

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    return places.filter((p) => {
      if (!matchesQuickCategory(p, filter)) return false;
      if (!q) return true;
      return (
        normalize(p.title).includes(q) ||
        normalize(categoryLabel(p.category)).includes(q) ||
        normalize(p.address ?? '').includes(q)
      );
    });
  }, [places, filter, query]);

  // El lugar enfocado debe estar siempre en el mapa aunque no calce con el filtro
  const mapEvents = useMemo(
    () =>
      selected && !visible.some((p) => p.id === selected.id) ? [selected, ...visible] : visible,
    [visible, selected],
  );

  const onSelect = useCallback(
    (event: TurismoEvent | null) => {
      if (!event) return setSelected(null);
      setSelected(places.find((p) => p.id === event.id) ?? null);
    },
    [places],
  );

  const walk = useWalkPreview(userLocation, selected);
  const minutes = walk.route
    ? Math.max(1, Math.round(walk.route.duration / 60))
    : selected
      ? walkMinutes(selected.distanceMeters)
      : 0;
  const saved = selected ? prefs.savedEventIds.includes(String(selected.id)) : false;

  return (
    <View style={styles.root}>
      <MapContainer
        events={mapEvents}
        selectedEvent={selected}
        onSelectEvent={onSelect}
        mapLayer={layer}
        onSelectLayer={setLayer}
        centerTrigger={centerTrigger}
        zoom={zoom}
        onZoomChange={setZoom}
        userLocation={userLocation}
        walkPreviewGeojson={selected ? (walk.route?.geojson ?? null) : null}
        isFrozen={tab !== 'mapa'}
        mapDisplayMode="turismo"
      />

      {/* Búsqueda + filtros */}
      <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <View style={[styles.search, { backgroundColor: colors.surface }, cardShadow]}>
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={voice.state === 'recording' ? 'Escuchando…' : 'Buscar en el mapa'}
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            style={[
              styles.searchInput,
              { color: colors.text, fontSize: MobileFont.body * textScale },
            ]}
            accessibilityLabel="Buscar en el mapa"
          />
          {query ? (
            <IconButton
              icon="close"
              size={36}
              onPress={() => setQuery('')}
              accessibilityLabel="Borrar búsqueda"
            />
          ) : voice.state === 'processing' ? (
            <ActivityIndicator color={colors.text} style={{ width: 36 }} />
          ) : (
            <IconButton
              icon={voice.state === 'recording' ? 'stop' : 'mic-outline'}
              size={36}
              onPress={voice.toggle}
              accessibilityLabel="Buscar por voz"
            />
          )}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: MobileSpacing.screen }}
          style={{ marginTop: 10, marginHorizontal: -MobileSpacing.screen }}
        >
          {FILTERS.map((f) => (
            <Chip
              key={f.key}
              label={f.label}
              selected={filter === f.key}
              onPress={() => setFilter(f.key)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Controles laterales: capas arriba, GPS flotante abajo (justo sobre el sheet) */}
      <View
        style={[
          styles.side,
          {
            bottom:
              insets.bottom + TAB_BAR_HEIGHT + (selected && peekHeight ? 22 + peekHeight + 12 : 40),
          },
        ]}
        pointerEvents="box-none"
      >
        <IconButton
          icon="layers-outline"
          onPress={() => setLayer((l) => (l === 'satellite' ? 'light' : 'satellite'))}
          style={[{ backgroundColor: colors.surface }, cardShadow]}
          accessibilityLabel="Cambiar capa del mapa"
        />
        <GpsButton onPress={() => setCenterTrigger((n) => n + 1)} />
      </View>

      {/* Peek card del lugar */}
      {selected ? (
        <View
          style={[styles.peekWrap, { bottom: insets.bottom + TAB_BAR_HEIGHT + 22 }]}
          onLayout={(e) => setPeekHeight(e.nativeEvent.layout.height)}
        >
          <Card style={styles.peek}>
            <View style={[styles.grabber, { backgroundColor: colors.borderStrong }]} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Thumb uri={selected.imageUrl} size={88} icon={categoryIcon(selected.category)} />
              <View style={{ flex: 1 }}>
                <T variant="title" weight="700" numberOfLines={1}>
                  {selected.title}
                </T>
                <T variant="small" color={colors.textSecondary} numberOfLines={2}>
                  {categoryLabel(selected.category)} · {formatMeters(selected.distanceMeters)} ·{' '}
                  {formatDurationShort(minutes)} a pie
                </T>
                <View style={styles.tags}>
                  {selected.openingHours ? <Tag label={selected.openingHours} /> : null}
                  {selected.address ? <Tag label={selected.address} /> : null}
                </View>
              </View>
              <IconButton
                icon="close"
                size={32}
                onPress={() => setSelected(null)}
                accessibilityLabel="Cerrar"
              />
            </View>
            <View style={styles.peekActions}>
              <PrimaryButton
                label="Cómo llegar"
                onPress={() => startRoute(singleStopRoute(selected))}
                style={{ flex: 1 }}
              />
              <IconButton
                icon={saved ? 'heart' : 'heart-outline'}
                onPress={() => toggleSavedEvent(String(selected.id))}
                accessibilityLabel={saved ? 'Quitar de guardados' : 'Guardar'}
              />
              <IconButton
                icon="share-outline"
                onPress={() => sharePlace(selected.title, selected)}
                accessibilityLabel="Compartir"
              />
            </View>
          </Card>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: MobileSpacing.screen },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 16,
    paddingRight: 6,
    minHeight: 52,
    borderRadius: MobileRadii.pill,
  },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 10 },
  side: { position: 'absolute', right: MobileSpacing.screen, alignItems: 'center', gap: 12 },
  peekWrap: { position: 'absolute', left: MobileSpacing.screen, right: MobileSpacing.screen },
  peek: { paddingTop: 8 },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: 10 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  peekActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
});
