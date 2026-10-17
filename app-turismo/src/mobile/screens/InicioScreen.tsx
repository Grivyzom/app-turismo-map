import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { useMobileApp } from '../MobileAppContext';
import { AppHeader } from '../components/AppHeader';
import { MarqueeText } from '../components/MarqueeText';
import { Screen } from '../components/Screen';
import { Card, IconButton, PillButton, SectionHeader, T, Thumb, useColors } from '../components/ui';
import { IoniconName, QUICK_CATEGORIES } from '../data/categories';
import { EventsCarousel } from '../sections/EventsCarousel';
import { GreetingHeader } from '../sections/GreetingHeader';
import { GuestBanner } from '../sections/GuestBanner';
import { GuideCard } from '../sections/GuideCard';
import { LodgingCard } from '../sections/LodgingCard';
import { MiniMap } from '../sections/MiniMap';
import { PlaceRow } from '../sections/PlaceRow';
import { RouteCard } from '../sections/RouteCard';
import { openEmergencyMenu, searchNearbyInMaps } from '../utils/external';
import { MobileRadii } from '../theme';

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
    refresh,
    loadingPlaces,
  } = app;
  const colors = useColors();

  const nearby = places.slice(0, 3);
  const alert = weather?.alert ?? null;
  const showAlert =
    alert !== null && prefs.dismissedAlert !== alert && prefs.notifications.weatherAndCity;

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

  return (
    <Screen header={<AppHeader />} onRefresh={refresh} refreshing={loadingPlaces}>
      {/* Saludo + clima */}
      <GreetingHeader
        trailing={
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
        }
      />

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

      {/* Invitado: recordatorio para crear cuenta */}
      <GuestBanner />

      {/* Recomendación del día + Guía */}
      <GuideCard />

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
      <LodgingCard />

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
  categories: { flexDirection: 'row', justifyContent: 'space-between' },
  category: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  categoryIcon: {
    width: 52,
    height: 52,
    borderRadius: MobileRadii.inner,
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
