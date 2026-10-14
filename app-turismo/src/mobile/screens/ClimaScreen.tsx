import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { useMobileApp } from '../MobileAppContext';
import { Screen } from '../components/Screen';
import { Card, IconButton, PillButton, SectionHeader, T, useColors } from '../components/ui';
import type { IoniconName } from '../data/categories';
import { MobileRadii } from '../theme';

/** "Clima en Sector": detalle actual, próximas horas, próximos días, sol y UV. */
export function ClimaScreen() {
  const {
    weather,
    weatherError,
    sectorName,
    setOverlay,
    setSectorPickerOpen,
    openOnMap,
    refreshWeather,
  } = useMobileApp();
  const colors = useColors();

  const header = (
    <Card style={styles.header}>
      <IconButton
        icon="chevron-back"
        onPress={() => setOverlay(null)}
        accessibilityLabel="Volver"
      />
      <View style={{ flex: 1 }}>
        <T variant="caption" color={colors.textSecondary}>
          Clima en Sector
        </T>
        <T weight="700" numberOfLines={1}>
          {sectorName}
        </T>
      </View>
      <PillButton label="Cambiar" onPress={() => setSectorPickerOpen(true)} />
    </Card>
  );

  if (!weather) {
    return (
      <Screen header={header}>
        <Card style={{ alignItems: 'center', paddingVertical: 40, gap: 12 }}>
          {weatherError ? (
            <>
              <T color={colors.textSecondary}>{weatherError}</T>
              <PillButton label="Reintentar" onPress={refreshWeather} />
            </>
          ) : (
            <ActivityIndicator color={colors.text} />
          )}
        </Card>
      </Screen>
    );
  }

  const tempRange = {
    min: Math.min(...weather.daily.map((d) => d.min)),
    max: Math.max(...weather.daily.map((d) => d.max)),
  };
  const span = Math.max(1, tempRange.max - tempRange.min);
  const uvLevel = Math.min(5, Math.ceil(weather.uvIndex / 2.2));
  const uvLabel =
    weather.uvIndex <= 2
      ? 'Bajo'
      : weather.uvIndex <= 5
        ? 'Moderado'
        : weather.uvIndex <= 7
          ? 'Alto'
          : 'Muy alto';

  return (
    <Screen header={header} onRefresh={refreshWeather}>
      {/* Actual */}
      <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
        <View style={[styles.bigIcon, { backgroundColor: colors.surfaceMuted }]}>
          <Ionicons name={weather.icon as IoniconName} size={30} color={colors.text} />
        </View>
        <T variant="display" weight="800" style={{ lineHeight: undefined, marginTop: 8 }}>
          {weather.temp}°
        </T>
        <T variant="title" weight="700">
          {weather.condition}
        </T>
        <T variant="small" color={colors.textSecondary} align="center" style={{ marginTop: 6 }}>
          Sensación {weather.apparent}° · Máx {weather.max}° · Mín {weather.min}°
        </T>
        <T variant="caption" color={colors.textSecondary} style={{ marginTop: 8 }}>
          Actualizado {weather.updatedAt}
        </T>
      </Card>

      {/* Métricas */}
      <View style={styles.metrics}>
        <Metric
          icon="wind"
          title="Viento"
          value={`${weather.windSpeed}`}
          sub={`km/h · ${weather.windDirLabel}`}
        />
        <Metric
          icon="water-outline"
          title="Lluvia"
          value={`${weather.rainProb}%`}
          sub={`${weather.rainMm} mm`}
        />
        <Metric
          icon="thermometer-outline"
          title="Humedad"
          value={`${weather.humidity}%`}
          sub="Relativa"
        />
      </View>

      {weather.alert ? (
        <Card style={styles.alert}>
          <View style={[styles.alertIcon, { backgroundColor: colors.surfaceMuted }]}>
            <T weight="800">!</T>
          </View>
          <View style={{ flex: 1 }}>
            <T variant="caption" color={colors.textSecondary}>
              Alerta meteorológica
            </T>
            <T variant="small" weight="600">
              {weather.alert}
            </T>
          </View>
        </Card>
      ) : null}

      <Card>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={[styles.spark, { backgroundColor: colors.accent }]}>
            <Ionicons name="sparkles" size={18} color={colors.onAccent} />
          </View>
          <View style={{ flex: 1 }}>
            <T variant="caption" color={colors.textSecondary}>
              Recomendación según el clima
            </T>
            <T weight="600">{weather.recommendation}</T>
            <PillButton
              label={weather.isRainy ? 'Ver planes bajo techo' : 'Ver planes al aire libre'}
              onPress={() => openOnMap(null, weather.isRainy ? 'cultura' : 'naturaleza')}
              style={{ alignSelf: 'flex-start', marginTop: 10 }}
            />
          </View>
        </View>
      </Card>

      {/* Próximas horas */}
      <SectionHeader title="Próximas horas" hint="24 h" />
      <Card style={{ paddingHorizontal: 8 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {weather.hourly.map((h, i) => (
            <View
              key={`${h.label}-${i}`}
              style={[styles.hour, i === 0 && { backgroundColor: colors.surfaceMuted }]}
            >
              <T variant="caption" color={colors.textSecondary}>
                {h.label}
              </T>
              <Ionicons
                name={h.icon as IoniconName}
                size={18}
                color={colors.text}
                style={{ marginVertical: 6 }}
              />
              <T weight="700">{h.temp}°</T>
              <T variant="caption" color={colors.textSecondary}>
                {h.rainProb}%
              </T>
            </View>
          ))}
        </ScrollView>
      </Card>

      {/* Próximos días */}
      <SectionHeader title="Próximos días" />
      <Card style={{ paddingVertical: 4 }}>
        {weather.daily.map((d, i) => {
          const left = ((d.min - tempRange.min) / span) * 100;
          const width = Math.max(8, ((d.max - d.min) / span) * 100);
          return (
            <View
              key={`${d.label}-${i}`}
              style={[
                styles.day,
                i < weather.daily.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.border,
                },
              ]}
            >
              <T weight="500" style={{ width: 44 }}>
                {d.label}
              </T>
              <Ionicons
                name={d.icon as IoniconName}
                size={18}
                color={colors.text}
                style={{ width: 28 }}
              />
              <View style={[styles.rangeTrack, { backgroundColor: colors.surfaceMuted }]}>
                <View
                  style={[
                    styles.rangeFill,
                    {
                      backgroundColor: colors.textSecondary,
                      left: `${left}%`,
                      width: `${width}%`,
                    } as object,
                  ]}
                />
              </View>
              <T variant="small" style={{ width: 76, textAlign: 'right' }}>
                {d.min}° / {d.max}°
              </T>
            </View>
          );
        })}
      </Card>

      {/* Sol y UV */}
      <View style={styles.metrics}>
        <Card style={{ flex: 1 }}>
          <T variant="caption" color={colors.textSecondary}>
            Amanecer · Atardecer
          </T>
          <T variant="title" weight="700" style={{ marginTop: 6 }}>
            {weather.sunrise} · {weather.sunset}
          </T>
        </Card>
        <Card style={{ flex: 1 }}>
          <T variant="caption" color={colors.textSecondary}>
            Índice UV
          </T>
          <T variant="title" weight="700" style={{ marginTop: 6 }}>
            {weather.uvIndex} · {uvLabel}
          </T>
          <View style={styles.uvBar}>
            {[0, 1, 2, 3, 4].map((i) => (
              <View
                key={i}
                style={[
                  styles.uvSeg,
                  { backgroundColor: i < uvLevel ? colors.text : colors.surfaceSunken },
                ]}
              />
            ))}
          </View>
        </Card>
      </View>
    </Screen>
  );
}

function Metric({
  icon,
  title,
  value,
  sub,
}: {
  icon: IoniconName | 'wind';
  title: string;
  value: string;
  sub: string;
}) {
  const colors = useColors();
  return (
    <Card style={{ flex: 1, paddingHorizontal: 12 }}>
      {icon === 'wind' ? (
        <MaterialCommunityIcons name="weather-windy" size={20} color={colors.text} />
      ) : (
        <Ionicons name={icon} size={18} color={colors.text} />
      )}
      <T variant="caption" color={colors.textSecondary} style={{ marginTop: 8 }}>
        {title}
      </T>
      <T variant="title" weight="700">
        {value}
      </T>
      <T variant="caption" color={colors.textSecondary}>
        {sub}
      </T>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: MobileRadii.pill,
  },
  bigIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metrics: { flexDirection: 'row', gap: 10 },
  alert: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  alertIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hour: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    minWidth: 58,
  },
  day: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 6 },
  rangeTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  rangeFill: { position: 'absolute', top: 0, bottom: 0, borderRadius: 3 },
  uvBar: { flexDirection: 'row', gap: 4, marginTop: 10 },
  uvSeg: { flex: 1, height: 6, borderRadius: 3 },
});
