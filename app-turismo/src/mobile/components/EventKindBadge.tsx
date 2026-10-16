import React from 'react';
import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import type { IoniconName } from '../data/categories';
import type { EventHook, EventKind } from '../data/eventInfo';
import { MobileRadii } from '../theme';

import { T, useColors } from './ui';

const KIND_ICON: Record<EventKind, IoniconName> = {
  diario: 'repeat',
  dias: 'calendar-number-outline',
  publicitario: 'megaphone-outline',
};

/** Etiqueta del tipo de evento: "Todos los días", "Sáb y dom" o "Anuncio". */
export function EventKindBadge({ kind, label }: { kind: EventKind; label: string }) {
  const colors = useColors();
  return (
    <View style={[styles.badge, { borderColor: colors.borderStrong }]}>
      <Ionicons name={KIND_ICON[kind]} size={13} color={colors.text} />
      <T variant="caption" weight="600" numberOfLines={1}>
        {label}
      </T>
    </View>
  );
}

/** Frase gancho ("Hoy nuevamente, desde las 10:00"); un punto rojo marca lo que ocurre hoy. */
export function EventHookLine({
  hook,
  variant = 'small',
}: {
  hook: EventHook;
  variant?: 'small' | 'body';
}) {
  const colors = useColors();
  return (
    <View style={styles.hook}>
      {hook.today ? <View style={[styles.dot, { backgroundColor: colors.badge }]} /> : null}
      <T variant={variant} weight="700" numberOfLines={1} style={{ flexShrink: 1 }}>
        {hook.headline}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: MobileRadii.pill,
    borderWidth: 1,
  },
  hook: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
