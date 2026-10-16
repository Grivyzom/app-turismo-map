import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { categoryIcon, categoryLabel } from '../data/categories';
import { formatMeters, PlaceWithDistance } from '../hooks/usePlacesData';
import { PillButton, T, Thumb, useColors } from '../components/ui';

/** Fila de lugar: miniatura, nombre, categoría · distancia · horario y botón "Ver". */
export function PlaceRow({
  place,
  onPress,
  divider = true,
}: {
  place: PlaceWithDistance;
  onPress: () => void;
  divider?: boolean;
}) {
  const colors = useColors();
  const meta = [
    categoryLabel(place.category),
    formatMeters(place.distanceMeters),
    place.openingHours,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[
        styles.row,
        divider && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <Thumb
        asset={place.imageAsset}
        uri={place.imageUrl}
        size={48}
        icon={categoryIcon(place.category)}
      />
      <View style={{ flex: 1 }}>
        <T weight="600" numberOfLines={1}>
          {place.title}
        </T>
        <T variant="caption" color={colors.textSecondary} numberOfLines={2}>
          {meta}
        </T>
      </View>
      <PillButton label="Ver" onPress={onPress} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
});
