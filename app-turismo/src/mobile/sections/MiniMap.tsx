import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Coordinate, PlaceWithDistance } from '../hooks/usePlacesData';
import { useColors } from '../components/ui';
import { MobileRadii } from '../theme';

/**
 * Vista previa esquemática (sin tiles) de los lugares cercanos alrededor del usuario.
 * Evita montar un segundo motor de mapa dentro del scroll del Inicio.
 */
export function MiniMap({
  origin,
  places,
  onPress,
  height = 130,
}: {
  origin: Coordinate;
  places: PlaceWithDistance[];
  onPress: () => void;
  height?: number;
}) {
  const colors = useColors();

  const dots = useMemo(() => {
    const span =
      Math.max(
        0.002,
        ...places.map((p) =>
          Math.max(
            Math.abs(p.latitude - origin.latitude),
            Math.abs(p.longitude - origin.longitude),
          ),
        ),
      ) * 1.25;
    return places.map((p) => ({
      id: p.id,
      x: 50 + ((p.longitude - origin.longitude) / span) * 45,
      y: 50 - ((p.latitude - origin.latitude) / span) * 40,
    }));
  }, [places, origin.latitude, origin.longitude]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Abrir mapa"
      style={[styles.box, { height, backgroundColor: colors.mapLand }]}
    >
      <View
        style={[
          styles.road,
          { backgroundColor: colors.mapRoad, transform: [{ rotate: '-18deg' }] },
        ]}
      />
      <View
        style={[
          styles.road,
          {
            backgroundColor: colors.mapRoad,
            top: '20%',
            width: '40%',
            transform: [{ rotate: '62deg' }],
          },
        ]}
      />
      {dots.map((d) => (
        <View
          key={d.id}
          style={[
            styles.dot,
            {
              left: `${d.x}%`,
              top: `${d.y}%`,
              backgroundColor: colors.text,
              borderColor: colors.surface,
            },
          ]}
        />
      ))}
      <View style={[styles.me, { backgroundColor: colors.text, borderColor: colors.surface }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: MobileRadii.inner, overflow: 'hidden' },
  road: { position: 'absolute', left: '-10%', top: '55%', width: '120%', height: 16, opacity: 0.8 },
  dot: {
    position: 'absolute',
    width: 12,
    height: 12,
    marginLeft: -6,
    marginTop: -6,
    borderRadius: 6,
    borderWidth: 2,
  },
  me: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 18,
    height: 18,
    marginLeft: -9,
    marginTop: -9,
    borderRadius: 9,
    borderWidth: 3,
  },
});
