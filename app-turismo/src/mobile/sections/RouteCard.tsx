import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useMobileApp } from '../MobileAppContext';
import { categoryIcon, categoryLabel } from '../data/categories';
import { formatDurationShort, RecommendedRoute } from '../data/routes';
import { Card, OutlineButton, PrimaryButton, T, Tag, Thumb, useColors } from '../components/ui';

/** "Ruta recomendada para hoy": paradas numeradas con hora estimada y acciones. */
export function RouteCard({
  route,
  onAdjust,
  eyebrow = 'Ruta recomendada para hoy',
}: {
  route: RecommendedRoute | null;
  onAdjust: () => void;
  eyebrow?: string;
}) {
  const { startRoute } = useMobileApp();
  const colors = useColors();

  if (!route) {
    return (
      <Card>
        <T variant="small" color={colors.textSecondary}>
          {eyebrow}
        </T>
        <T weight="600" style={{ marginTop: 6 }}>
          Aún no hay lugares suficientes cerca para armar una ruta.
        </T>
        <OutlineButton label="Ajustar preferencias" onPress={onAdjust} style={{ marginTop: 14 }} />
      </Card>
    );
  }

  return (
    <Card>
      <View style={styles.head}>
        <T variant="small" color={colors.textSecondary} style={{ flex: 1 }}>
          {eyebrow}
        </T>
        <Tag label={`${formatDurationShort(route.totalMinutes)} · ${route.stops.length} paradas`} />
      </View>
      <T variant="title" weight="700" style={{ marginTop: 4, marginBottom: 10 }}>
        {route.title}
      </T>

      {route.stops.map((stop, i) => (
        <View key={stop.place.id} style={styles.stop}>
          <View style={[styles.index, { borderColor: colors.borderStrong }]}>
            <T variant="caption" weight="700">
              {i + 1}
            </T>
          </View>
          <Thumb uri={stop.place.imageUrl} size={44} icon={categoryIcon(stop.place.category)} />
          <View style={{ flex: 1 }}>
            <T weight="600" numberOfLines={1}>
              {stop.place.title}
            </T>
            <T variant="caption" color={colors.textSecondary} numberOfLines={1}>
              {stop.eta} · {stop.place.address || categoryLabel(stop.place.category)}
            </T>
          </View>
        </View>
      ))}

      <View style={styles.actions}>
        <PrimaryButton label="Iniciar ruta" onPress={() => startRoute(route)} style={{ flex: 1 }} />
        <OutlineButton label="Ajustar" onPress={onAdjust} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stop: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  index: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
});
