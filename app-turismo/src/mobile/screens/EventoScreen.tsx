import React, { useEffect, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMobileApp } from '../MobileAppContext';
import { EventBanner } from '../components/EventBanner';
import { EventHookLine, EventKindBadge } from '../components/EventKindBadge';
import {
  Avatar,
  Card,
  IconButton,
  OutlineButton,
  PillButton,
  PrimaryButton,
  T,
  Tag,
  Tap,
  useColors,
} from '../components/ui';
import { categoryIcon, categoryLabel, IoniconName } from '../data/categories';
import {
  eventDuration,
  eventPrice,
  eventStatus,
  eventHook,
  eventWhen,
  LiveStatus,
  socialUrl,
  weekdaysLabel,
  webUrl,
} from '../data/eventInfo';
import { singleStopRoute } from '../data/routes';
import { formatMeters, PlaceWithDistance, walkMinutes } from '../hooks/usePlacesData';
import { openLink, openWalkingDirections, sharePlace } from '../utils/external';
import { cardShadow, MobileMotion, MobileRadii, MobileSpacing } from '../theme';

const OUTDOOR = new Set([
  'naturaleza',
  'parque',
  'humedal',
  'bosque',
  'sendero',
  'agua',
  'fauna',
  'deportes',
]);

/** Descripción colapsada: líneas visibles y largo a partir del cual se ofrece "Leer más". */
const DESC_LINES = 5;
const DESC_COLLAPSE_CHARS = 220;

/**
 * Capa de la ficha de evento: entra deslizándose desde la derecha y sale igual,
 * cualquiera sea el origen del cierre (botón volver, "atrás" de Android, iniciar ruta…).
 */
export function EventOverlay() {
  const { eventDetail } = useMobileApp();
  const { width } = useWindowDimensions();
  const [shown, setShown] = useState<PlaceWithDistance | null>(eventDetail);
  const [x] = useState(() => new Animated.Value(width));

  if (eventDetail && eventDetail !== shown) setShown(eventDetail);

  useEffect(() => {
    if (eventDetail) {
      Animated.timing(x, {
        toValue: 0,
        duration: MobileMotion.enter,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(x, {
        toValue: width,
        duration: MobileMotion.exit,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => finished && setShown(null));
    }
  }, [eventDetail, width, x]);

  if (!shown) return null;
  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { transform: [{ translateX: x }] }]}
      pointerEvents={eventDetail ? 'auto' : 'none'}
    >
      <EventoScreen key={shown.id} event={shown} />
    </Animated.View>
  );
}

/** "Acerca del evento": ilustración, datos prácticos, organizador y acciones. */
export function EventoScreen({ event: snapshot }: { event: PlaceWithDistance }) {
  const {
    places,
    prefs,
    weather,
    closeEvent,
    openOnMap,
    startRoute,
    toggleSavedEvent,
    toggleLikedEvent,
  } = useMobileApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState(false);

  // La distancia se recalcula con el GPS: se usa la versión viva del lugar si sigue en la lista
  const event = places.find((p) => p.id === snapshot.id) ?? snapshot;
  const id = String(event.id);

  const saved = prefs.savedEventIds.includes(id);
  const liked = prefs.likedEventIds.includes(id);
  const likes = (event.likesCount ?? 0) + (liked ? 1 : 0);

  const when = eventWhen(event);
  const status = eventStatus(event);
  const hook = eventHook(event);
  // Con gancho ("Vuelve mañana…", "¡Ahora mismo!") el estado sería redundante
  const showStatus = !!status && !hook;
  const isAd = event.eventKind === 'publicitario';
  const price = eventPrice(event);
  const duration = eventDuration(event);
  const minutes = walkMinutes(event.distanceMeters);
  const ended = status?.key === 'finalizado';
  const rainy = !!weather?.isRainy && OUTDOOR.has(event.category);
  const longDescription = (event.description?.length ?? 0) > DESC_COLLAPSE_CHARS;

  const share = () =>
    sharePlace(
      event.title,
      event,
      [[when.primary, when.secondary].filter(Boolean).join(' · '), event.address]
        .filter(Boolean)
        .join('\n'),
    );

  const facts: { icon: IoniconName; label: string; value: string; hint?: string }[] = [
    { icon: 'calendar-outline', label: 'Cuándo', value: when.primary, hint: when.secondary },
    {
      icon: 'pricetag-outline',
      label: 'Entrada',
      value: price.label,
      hint: price.free ? 'Sin costo' : price.known ? 'Por persona' : undefined,
    },
    {
      icon: 'walk-outline',
      label: 'Distancia',
      value: formatMeters(event.distanceMeters),
      hint: `${minutes} min a pie`,
    },
    event.attendeesCount
      ? {
          icon: 'people-outline',
          label: 'Asistentes',
          value: String(event.attendeesCount),
          hint: event.capacity ? `de ${event.capacity} cupos` : 'confirmados',
        }
      : {
          icon: 'time-outline',
          label: 'Duración',
          value: duration ?? 'Por confirmar',
          hint: when.start ? 'aprox.' : undefined,
        },
  ];

  const contacts: { icon: IoniconName; label: string; url: string }[] = [
    event.contactPhone && {
      icon: 'call-outline' as const,
      label: 'Llamar',
      url: `tel:${event.contactPhone.replace(/[^\d+]/g, '')}`,
    },
    event.contactEmail && {
      icon: 'mail-outline' as const,
      label: 'Correo',
      url: `mailto:${event.contactEmail}`,
    },
    event.website && {
      icon: 'globe-outline' as const,
      label: 'Sitio web',
      url: webUrl(event.website),
    },
    event.instagram && {
      icon: 'logo-instagram' as const,
      label: 'Instagram',
      url: socialUrl('instagram', event.instagram),
    },
    event.facebook && {
      icon: 'logo-facebook' as const,
      label: 'Facebook',
      url: socialUrl('facebook', event.facebook),
    },
  ].filter(Boolean) as { icon: IoniconName; label: string; url: string }[];

  const goodToKnow: { icon: IoniconName; text: string }[] = [
    ...(event.accessibility ?? []).map((text) => ({
      icon: 'accessibility-outline' as const,
      text,
    })),
    ...(event.tips ?? []).map((text) => ({ icon: 'information-circle-outline' as const, text })),
    event.ageRestriction ? { icon: 'id-card-outline' as const, text: event.ageRestriction } : null,
    event.capacity && !event.attendeesCount
      ? { icon: 'people-outline' as const, text: `Capacidad para ${event.capacity} personas` }
      : null,
    rainy
      ? {
          icon: 'umbrella-outline' as const,
          text: `Pronóstico de lluvia (${weather?.rainProb ?? 0}%): lleva paraguas o abrigo.`,
        }
      : null,
  ].filter(Boolean) as { icon: IoniconName; text: string }[];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Barra superior sólida: nada se dibuja sobre la ilustración */}
      <View
        style={[
          styles.topBar,
          {
            paddingTop: insets.top + 8,
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <IconButton icon="chevron-back" onPress={closeEvent} accessibilityLabel="Volver" />
        <T weight="700" numberOfLines={1} style={{ flex: 1 }} accessibilityRole="header">
          Acerca del evento
        </T>
        <IconButton icon="share-outline" onPress={share} accessibilityLabel="Compartir evento" />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
      >
        <EventBanner
          asset={event.imageAsset}
          uri={event.imageUrl}
          title={event.title}
          width={event.imageWidth}
          height={event.imageHeight}
          fallbackIcon={categoryIcon(event.category)}
        />

        <View style={styles.body}>
          {/* Encabezado */}
          <Card>
            <View style={styles.tagRow}>
              {hook && event.eventKind ? (
                <EventKindBadge kind={event.eventKind} label={hook.badge} />
              ) : null}
              {status && showStatus ? (
                <StatusBadge status={status.key} label={status.label} />
              ) : null}
              <Tag label={categoryLabel(event.category)} />
              {price.free ? <Tag label="Gratis" /> : null}
            </View>
            {hook ? (
              <View style={{ marginTop: 12 }}>
                <EventHookLine hook={hook} variant="body" />
              </View>
            ) : null}
            <T variant="headline" weight="800" style={{ marginTop: hook ? 4 : 10 }}>
              {event.title}
            </T>
            {event.organizer ? (
              <T variant="small" color={colors.textSecondary} style={{ marginTop: 4 }}>
                {isAd ? 'Anuncia' : 'Organiza'} {event.organizer}
              </T>
            ) : null}
            {likes > 0 ? (
              <View style={styles.inline}>
                <Ionicons name="heart" size={14} color={colors.badge} />
                <T variant="caption" color={colors.textSecondary}>
                  {likes === 1 ? 'A 1 persona le gusta' : `A ${likes} personas les gusta`}
                </T>
              </View>
            ) : null}
          </Card>

          {/* Datos rápidos */}
          <Card style={styles.facts}>
            {facts.map((f) => (
              <View key={f.label} style={styles.fact}>
                <View style={[styles.factIcon, { backgroundColor: colors.surfaceMuted }]}>
                  <Ionicons name={f.icon} size={18} color={colors.text} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T variant="caption" color={colors.textSecondary}>
                    {f.label}
                  </T>
                  <T weight="700" numberOfLines={2}>
                    {f.value}
                  </T>
                  {f.hint ? (
                    <T variant="caption" color={colors.textSecondary} numberOfLines={2}>
                      {f.hint}
                    </T>
                  ) : null}
                </View>
              </View>
            ))}
          </Card>

          {/* Descripción */}
          {event.description ? (
            <Card>
              <SectionTitle>Sobre el evento</SectionTitle>
              <T numberOfLines={expanded ? undefined : DESC_LINES}>{event.description}</T>
              {longDescription ? (
                <Tap onPress={() => setExpanded((v) => !v)} accessibilityRole="button">
                  <T weight="600" style={{ marginTop: 8, textDecorationLine: 'underline' }}>
                    {expanded ? 'Leer menos' : 'Leer más'}
                  </T>
                </Tap>
              ) : null}
              {event.tags?.length ? (
                <View style={[styles.tagRow, { marginTop: 12 }]}>
                  {event.tags.map((t) => (
                    <Tag key={t} label={`#${t}`} />
                  ))}
                </View>
              ) : null}
            </Card>
          ) : null}

          {/* Horarios */}
          <Card>
            <SectionTitle>Horarios</SectionTitle>
            {event.eventKind ? (
              <Row
                icon="repeat"
                title={weekdaysLabel(event.weekdays, true)}
                subtitle={
                  event.eventKind === 'diario'
                    ? 'Se repite todos los días'
                    : event.eventKind === 'dias'
                      ? 'Solo estos días de la semana'
                      : 'Horario habitual del local'
                }
              />
            ) : null}
            <Row icon="calendar-clear-outline" title={when.primary} subtitle={when.secondary} />
            {event.schedule?.map((s, i) => (
              <Row
                key={`${s.time}-${i}`}
                icon="ellipse-outline"
                title={s.label}
                trailing={s.time}
                compact
              />
            ))}
            {event.openingHours && when.start ? (
              <Row
                icon="storefront-outline"
                title="Atención del lugar"
                subtitle={event.openingHours}
              />
            ) : null}
            {duration ? (
              <Row icon="hourglass-outline" title="Duración" trailing={duration} compact />
            ) : null}
          </Card>

          {/* Entradas (un anuncio sin venta de entradas ya muestra el valor en los datos rápidos) */}
          {isAd && !event.ticketUrl ? null : (
            <Card>
              <SectionTitle>Entradas</SectionTitle>
              <View style={styles.priceRow}>
                <View style={{ flex: 1 }}>
                  <T variant="headline" weight="800">
                    {price.label}
                  </T>
                  <T variant="small" color={colors.textSecondary}>
                    {price.free
                      ? 'Sin costo de entrada. Llega con tiempo si hay cupos limitados.'
                      : price.known
                        ? 'Valor informado por el organizador.'
                        : 'El organizador aún no informa el valor.'}
                  </T>
                </View>
              </View>
              {event.ticketUrl && !ended ? (
                <PrimaryButton
                  label={price.free ? 'Reservar cupo' : 'Comprar entradas'}
                  onPress={() => openLink(webUrl(event.ticketUrl!))}
                  style={{ marginTop: 14 }}
                />
              ) : null}
            </Card>
          )}

          {/* Organizador */}
          {event.organizer ? (
            <Card>
              <SectionTitle>{isAd ? 'Anuncia' : 'Organiza'}</SectionTitle>
              <View style={styles.organizer}>
                <Avatar name={event.organizer} uri={event.organizerAvatarUrl} size={52} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.inlineTight}>
                    <T weight="700" numberOfLines={1} style={{ flexShrink: 1 }}>
                      {event.organizer}
                    </T>
                    {event.organizerVerified ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color={colors.text}
                        accessibilityLabel="Organizador verificado"
                      />
                    ) : null}
                  </View>
                  <T variant="caption" color={colors.textSecondary}>
                    {event.organizerType ??
                      (event.branchId ? 'Comercio local' : 'Publicado en la comunidad')}
                  </T>
                </View>
              </View>
              {contacts.length ? (
                <View style={[styles.tagRow, { marginTop: 14 }]}>
                  {contacts.map((c) => (
                    <PillButton
                      key={c.label}
                      label={c.label}
                      icon={c.icon}
                      onPress={() => openLink(c.url)}
                    />
                  ))}
                </View>
              ) : null}
            </Card>
          ) : null}

          {/* Ubicación */}
          <Card>
            <SectionTitle>Ubicación</SectionTitle>
            <Row
              icon="location-outline"
              title={event.address || 'Ver punto en el mapa'}
              subtitle={[
                event.sectorName || event.parkName,
                `${formatMeters(event.distanceMeters)} · ${minutes} min a pie`,
              ]
                .filter(Boolean)
                .join(' · ')}
            />
            <View style={styles.twoButtons}>
              <OutlineButton
                label="Ver en el mapa"
                onPress={() => openOnMap(event)}
                style={{ flex: 1 }}
              />
              <OutlineButton
                label="Abrir en Maps"
                onPress={() => openWalkingDirections(event)}
                style={{ flex: 1 }}
              />
            </View>
          </Card>

          {/* Bueno saber */}
          {goodToKnow.length ? (
            <Card>
              <SectionTitle>Bueno saber</SectionTitle>
              {goodToKnow.map((g, i) => (
                <Row key={`${g.text}-${i}`} icon={g.icon} title={g.text} compact />
              ))}
            </Card>
          ) : null}
        </View>
      </ScrollView>

      {/* Acciones fijas */}
      <View
        style={[
          styles.actionBar,
          {
            paddingBottom: insets.bottom + 12,
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
          },
          cardShadow,
        ]}
      >
        <Tap
          onPress={() => toggleLikedEvent(id)}
          accessibilityRole="button"
          accessibilityState={{ selected: liked }}
          accessibilityLabel={liked ? 'Quitar me gusta' : 'Me gusta'}
          style={[styles.squareAction, { backgroundColor: colors.surfaceMuted }]}
        >
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={22}
            color={liked ? colors.badge : colors.text}
          />
          {likes > 0 ? (
            <T variant="caption" weight="600">
              {likes}
            </T>
          ) : null}
        </Tap>
        <Tap
          onPress={() => toggleSavedEvent(id)}
          accessibilityRole="button"
          accessibilityState={{ selected: saved }}
          accessibilityLabel={saved ? 'Quitar de guardados' : 'Guardar evento'}
          style={[
            styles.squareAction,
            { backgroundColor: saved ? colors.accent : colors.surfaceMuted },
          ]}
        >
          <Ionicons
            name={saved ? 'bookmark' : 'bookmark-outline'}
            size={21}
            color={saved ? colors.onAccent : colors.text}
          />
        </Tap>
        <PrimaryButton
          label={ended ? 'Evento finalizado' : 'Cómo llegar'}
          disabled={ended}
          onPress={() => startRoute(singleStopRoute(event))}
          style={{ flex: 1, minHeight: 52 }}
        />
      </View>
    </View>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <T variant="title" weight="700" style={{ marginBottom: 8 }} accessibilityRole="header">
      {children}
    </T>
  );
}

function Row({
  icon,
  title,
  subtitle,
  trailing,
  compact = false,
}: {
  icon: IoniconName;
  title: string;
  subtitle?: string;
  trailing?: string;
  compact?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={[styles.row, { paddingVertical: compact ? 6 : 8 }]}>
      <Ionicons name={icon} size={18} color={colors.textSecondary} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <T weight={compact ? '400' : '600'}>{title}</T>
        {subtitle ? (
          <T variant="small" color={colors.textSecondary}>
            {subtitle}
          </T>
        ) : null}
      </View>
      {trailing ? <T weight="600">{trailing}</T> : null}
    </View>
  );
}

function StatusBadge({ status, label }: { status: LiveStatus; label: string }) {
  const colors = useColors();
  const strong = status === 'en_curso' || status === 'pronto';
  return (
    <View
      style={[styles.status, { backgroundColor: strong ? colors.accent : colors.surfaceMuted }]}
    >
      {status === 'en_curso' ? (
        <View style={[styles.liveDot, { backgroundColor: colors.badge }]} />
      ) : null}
      <T variant="caption" weight="700" color={strong ? colors.onAccent : colors.textSecondary}>
        {label}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: MobileSpacing.screen,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  body: { padding: MobileSpacing.screen, gap: MobileSpacing.gap },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  inlineTight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16, paddingVertical: 18 },
  fact: { width: '50%', flexDirection: 'row', gap: 10, paddingRight: 8 },
  factIcon: {
    width: 36,
    height: 36,
    borderRadius: MobileRadii.button - 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  priceRow: { flexDirection: 'row', alignItems: 'center' },
  organizer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  twoButtons: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 12,
    paddingHorizontal: MobileSpacing.screen,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  squareAction: {
    minWidth: 52,
    height: 52,
    paddingHorizontal: 12,
    borderRadius: MobileRadii.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: MobileRadii.pill,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
});
