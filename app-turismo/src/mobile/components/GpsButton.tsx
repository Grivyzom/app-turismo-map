import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useMobileApp } from '../MobileAppContext';
import type { IoniconName } from '../data/categories';
import { cardShadow } from '../theme';

import { Tap, useColors } from './ui';

type PrecisionState = 'searching' | 'high' | 'medium' | 'low' | 'denied' | 'manual';

const STATE_COLOR: Record<PrecisionState, string | null> = {
  searching: null,
  high: '#2E9E5B',
  medium: '#E0A126',
  low: '#D9822B',
  denied: '#D64545',
  manual: null,
};

const STATE_ICON: Record<PrecisionState, IoniconName> = {
  searching: 'locate-outline',
  high: 'locate',
  medium: 'locate',
  low: 'locate-outline',
  denied: 'location-outline',
  manual: 'pin-outline',
};

const STATE_LABEL: Record<PrecisionState, string> = {
  searching: 'Buscando tu ubicación',
  high: 'Precisión alta',
  medium: 'Precisión media',
  low: 'Precisión baja',
  denied: 'Ubicación no disponible',
  manual: 'Sector elegido a mano',
};

const SIZE = 48;

/**
 * Botón flotante de GPS (48×48) para el lienzo del mapa. Calcula su propio estado de
 * precisión, así que su render no depende de la cabecera superior.
 */
export function GpsButton({
  onPress,
  style,
}: {
  /** Acción extra al tocar (p. ej. mover la cámara); siempre se reintenta el GPS. */
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { prefs, recenter, hasGps, gpsAccuracy, gpsLoading, gpsError, usingSectorOverride } =
    useMobileApp();
  const colors = useColors();

  let state: PrecisionState;
  if (usingSectorOverride) state = 'manual';
  else if (prefs.locationUse === 'nunca' || (gpsError && !hasGps)) state = 'denied';
  else if (!hasGps || (gpsLoading && gpsAccuracy === null)) state = 'searching';
  else if (gpsAccuracy === null || gpsAccuracy <= 30) state = 'high';
  else if (gpsAccuracy <= 100) state = 'medium';
  else state = 'low';

  const meters = state === 'high' || state === 'medium' || state === 'low' ? gpsAccuracy : null;
  const label = `${STATE_LABEL[state]}${meters !== null ? ` (±${Math.round(meters)} m)` : ''}. Toca para centrar en tu ubicación`;

  const [pulse] = useState(() => new Animated.Value(1));
  const pulsing = state === 'searching';
  useEffect(() => {
    if (!pulsing) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulsing, pulse]);

  const dotColor = STATE_COLOR[state];

  return (
    <Tap
      onPress={() => {
        recenter();
        onPress?.();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={style}
    >
      {/* El layout vive en un View interno: NativeWind puede descartar el style del Pressable */}
      <View style={[styles.fab, { backgroundColor: colors.surface }, cardShadow]}>
        <Animated.View style={{ opacity: pulse }}>
          <Ionicons
            name={STATE_ICON[state]}
            size={22}
            color={state === 'denied' ? colors.textSecondary : colors.text}
          />
        </Animated.View>
        {dotColor ? (
          <View style={[styles.dot, { backgroundColor: dotColor, borderColor: colors.surface }]} />
        ) : null}
      </View>
    </Tap>
  );
}

const styles = StyleSheet.create({
  fab: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
  },
});
