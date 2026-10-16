import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { useMobileApp } from '../MobileAppContext';
import { AppHeader } from '../components/AppHeader';
import { MarqueeText } from '../components/MarqueeText';
import { QuestionInput } from '../components/QuestionInput';
import { Screen } from '../components/Screen';
import { Card, IconButton, PillButton, SectionHeader, T, Thumb, useColors } from '../components/ui';
import { IoniconName, QUICK_CATEGORIES } from '../data/categories';
import { EventsCarousel } from '../sections/EventsCarousel';
import { MiniMap } from '../sections/MiniMap';
import { PlaceRow } from '../sections/PlaceRow';
import { RouteCard } from '../sections/RouteCard';
import { openEmergencyMenu, openWalkingDirections, searchNearbyInMaps } from '../utils/external';
import { MobileRadii } from '../theme';

function greeting(date: Date): string {
  const h = date.getHours();
  if (h < 12) return 'Buenos días';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

function formatToday(date: Date): string {
  const s = date.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function InicioScreen() {
  const app = useMobileApp();
  const {
    prefs,
    updatePrefs,
    weather,
    events,
    places,
    origin,
    recommendedRoute,
    restrooms,
    setOverlay,
    setTab,
    openOnMap,
    askGuide,
    refresh,
    loadingPlaces,
  } = app;
  const colors = useColors();
  const [now] = useState(() => new Date());

  const nearby = places.slice(0, 3);
  const alert = weather?.alert ?? null;
  const showAlert =
    alert !== null && prefs.dismissedAlert !== alert && prefs.notifications.weatherAndCity;

  const recommendation = useMemo(() => {
    if (recommendedRoute) {
      const first = recommendedRoute.stops[0].place.title;
      return weather?.isRainy
        ? `Día de lluvia: parte por ${first} y sigue con planes bajo techo.`
        : `Parte por ${first}: está a pocos minutos y abre el recorrido de hoy.`;
    }
    return weather?.recommendation ?? 'Pregúntale a la guía qué hacer cerca de ti.';
  }, [recommendedRoute, weather]);

  const benefit = useMemo(
    () => places.find((p) => p.hasActiveUpdate && p.activeUpdates?.length),
    [places],
  );

  const services: { label: string; icon: IoniconName; onPress: () => void; strong?: boolean }[] = [
    {
      label: 'Farmacia de turno',
      icon: 'medkit-outline',
      onPress: () => searchNearbyInMaps('farmacia de turno', origin),
    },
    {
      label: 'Cajero',
      icon: 'cash-outline',
      onPress: () => searchNearbyInMaps('cajero automático', origin),
    },
    {
      label: 'Baños',
      icon: 'water-outline',
      onPress: () =>
        restrooms[0] ? openOnMap(restrooms[0]) : searchNearbyInMaps('baño público', origin),
    },
    {
      label: 'Emergencias',
      icon: 'alert-circle',
      strong: true,
      onPress: () => openEmergencyMenu(prefs.emergencyContact),
    },
  ];

  const hasLodging = prefs.lodging.latitude !== null && prefs.lodging.longitude !== null;

  return (
    <Screen header={<AppHeader />} onRefresh={refresh} refreshing={loadingPlaces}>
      {/* Saludo + clima */}
      <View style={styles.greetingRow}>
        <View style={{ flex: 1 }}>
          <T variant="caption" color={colors.textSecondary}>
            {formatToday(now)}
          </T>
          <T variant="headline" weight="700" numberOfLines={2}>
            {prefs.nick ? `Hola, ${prefs.nick}` : greeting(now)}
          </T>
        </View>
        <Pressable
          onPress={() => setOverlay('clima')}
          accessibilityRole="button"
          accessibilityLabel="Ver clima"
        >
          <Card style={styles.weatherChip}>
            <View style={styles.weatherCell}>
              <Ionicons
                name={(weather?.icon ?? 'cloud-outline') as IoniconName}
                size={18}
                color={colors.text}
              />
              <View>
                <T weight="700">{weather ? `${weather.temp}°` : '--°'}</T>
                <MarqueeText width={76} variant="caption" color={colors.textSecondary}>
                  {weather?.condition ?? 'Cargando'}
                </MarqueeText>
              </View>
            </View>
            <View style={[styles.weatherDivider, { backgroundColor: colors.border }]} />
            <View style={styles.weatherCell}>
              <MaterialCommunityIcons name="weather-windy" size={18} color={colors.text} />
              <View>
                <T weight="700">{weather ? weather.windSpeed : '--'}</T>
                <T variant="caption" color={colors.textSecondary}>
                  km/h {weather?.windDirLabel ?? ''}
                </T>
              </View>
            </View>
          </Card>
        </Pressable>
      </View>

      {/* Aviso de la ciudad */}
      {showAlert ? (
        <Card style={styles.alert}>
          <View style={[styles.alertIcon, { backgroundColor: colors.surfaceMuted }]}>
            <T weight="800">!</T>
          </View>
          <View style={{ flex: 1 }}>
            <T variant="caption" color={colors.textSecondary}>
              Aviso de la ciudad
            </T>
            <T variant="small" weight="600" numberOfLines={2}>
              {alert}
            </T>
          </View>
          <PillButton label="Ver" onPress={() => setOverlay('clima')} />
          <IconButton
            icon="close"
            size={36}
            onPress={() => updatePrefs({ dismissedAlert: alert })}
            accessibilityLabel="Descartar aviso"
          />
        </Card>
      ) : null}

      {/* Recomendación del día + Guía */}
      <Card>
        <View style={styles.recoRow}>
          <View style={[styles.spark, { backgroundColor: colors.accent }]}>
            <Ionicons name="sparkles" size={18} color={colors.onAccent} />
          </View>
          <View style={{ flex: 1 }}>
            <T weight="600">{recommendation}</T>
            <PillButton
              label="Ver ruta recomendada"
              onPress={() => setTab('rutas')}
              style={{ alignSelf: 'flex-start', marginTop: 10 }}
            />
          </View>
        </View>
        <View style={{ marginTop: 14 }}>
          <QuestionInput onSubmit={askGuide} />
        </View>
      </Card>

      {/* Eventos */}
      <SectionHeader
        title="Eventos cerca de ti"
        actionLabel="Ver todos"
        onAction={() => openOnMap()}
      />
      <EventsCarousel events={events} />

      {/* Accesos por categoría */}
      <Card style={styles.categories}>
        {QUICK_CATEGORIES.map((c) => (
          <Pressable
            key={c.key}
            onPress={() => openOnMap(null, c.key)}
            accessibilityRole="button"
            style={styles.category}
          >
            <View style={[styles.categoryIcon, { backgroundColor: colors.surfaceMuted }]}>
              <Ionicons name={c.icon} size={22} color={colors.text} />
            </View>
            <T variant="caption" weight="500" style={{ marginTop: 6 }}>
              {c.label}
            </T>
          </Pressable>
        ))}
      </Card>

      {/* Volver a mi alojamiento */}
      <Card style={styles.lodging}>
        <View style={[styles.lodgingIcon, { backgroundColor: colors.accent }]}>
          <Ionicons name="home-outline" size={20} color={colors.onAccent} />
        </View>
        <View style={{ flex: 1 }}>
          <T weight="600">Volver a mi alojamiento</T>
          <T variant="caption" color={colors.textSecondary} numberOfLines={2}>
            {hasLodging
              ? prefs.lodging.street
              : 'Agrega tu dirección en Perfil para usar esta opción'}
          </T>
        </View>
        {hasLodging ? (
          <PillButton
            label="Ir"
            onPress={() =>
              openWalkingDirections({
                latitude: prefs.lodging.latitude as number,
                longitude: prefs.lodging.longitude as number,
              })
            }
          />
        ) : (
          <PillButton label="Agregar" onPress={() => setTab('perfil')} />
        )}
      </Card>

      {/* Ruta recomendada */}
      <RouteCard route={recommendedRoute} onAdjust={() => setTab('perfil')} />

      {/* Cerca de ti */}
      <SectionHeader title="Cerca de ti" actionLabel="Abrir mapa" onAction={() => openOnMap()} />
      <Card>
        <MiniMap origin={origin} places={nearby} onPress={() => openOnMap()} />
        {nearby.map((p, i) => (
          <PlaceRow
            key={p.id}
            place={p}
            onPress={() => openOnMap(p)}
            divider={i < nearby.length - 1}
          />
        ))}
      </Card>

      {/* Servicios útiles */}
      <SectionHeader title="Servicios útiles" hint="Cerca de ti" />
      <Card style={styles.services}>
        {services.map((s) => (
          <Pressable
            key={s.label}
            onPress={s.onPress}
            accessibilityRole="button"
            accessibilityLabel={s.label}
            style={styles.service}
          >
            <View
              style={[
                styles.serviceIcon,
                { backgroundColor: s.strong ? colors.accent : colors.surfaceMuted },
              ]}
            >
              {s.strong ? (
                <T variant="small" weight="800" color={colors.onAccent}>
                  SOS
                </T>
              ) : (
                <Ionicons name={s.icon} size={20} color={colors.text} />
              )}
            </View>
            <T variant="caption" align="center" style={{ marginTop: 6 }}>
              {s.label}
            </T>
          </Pressable>
        ))}
      </Card>

      {/* Beneficio de comercio local */}
      {benefit && prefs.notifications.businessBenefits ? (
        <Card style={styles.benefit}>
          <Thumb asset={benefit.imageAsset} uri={benefit.imageUrl} size={64} />
          <View style={{ flex: 1 }}>
            <T variant="caption" color={colors.textSecondary}>
              Beneficio de comercio local
            </T>
            <T weight="600" numberOfLines={2}>
              {benefit.activeUpdates?.[0]?.title ?? 'Beneficio activo'} en {benefit.title}
            </T>
          </View>
          <PillButton label="Ver" onPress={() => openOnMap(benefit)} />
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  weatherChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
    borderRadius: 20,
  },
  weatherCell: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  weatherDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  alert: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  alertIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recoRow: { flexDirection: 'row', gap: 12 },
  spark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categories: { flexDirection: 'row', justifyContent: 'space-between' },
  category: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  categoryIcon: {
    width: 52,
    height: 52,
    borderRadius: MobileRadii.inner,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lodging: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lodgingIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  services: { flexDirection: 'row', justifyContent: 'space-between' },
  service: { flex: 1, alignItems: 'center' },
  serviceIcon: {
    width: 52,
    height: 52,
    borderRadius: MobileRadii.inner,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
