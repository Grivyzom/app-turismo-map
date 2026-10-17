import React, { useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { SIDE_PANEL_WIDTH } from '../layout';
import { dockShadow } from '../theme';

import { Scrim, usePresence } from './BottomSheet';
import { useColors } from './ui';

/**
 * Panel lateral derecho de escritorio (Clima, Avisos, Evento). Entra deslizando con un
 * fundido del fondo y conserva el último contenido mientras sale, para que cerrar se vea.
 */
export function SidePanel<T>({
  item,
  onClose,
  testID,
  children,
}: {
  item: T | null;
  onClose: () => void;
  testID?: string;
  children: (item: T) => React.ReactNode;
}) {
  const colors = useColors();
  const [last, setLast] = useState<T | null>(item);
  if (item !== null && item !== last) setLast(item);
  const { progress, mounted } = usePresence(item !== null);

  if (!mounted || last === null) return null;
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [SIDE_PANEL_WIDTH, 0],
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={item !== null ? 'auto' : 'none'}>
      <Scrim progress={progress} onPress={onClose} />
      <Animated.View
        testID={testID}
        style={[
          styles.panel,
          { backgroundColor: colors.background, transform: [{ translateX }] },
          dockShadow,
        ]}
      >
        {children(last)}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: SIDE_PANEL_WIDTH,
    maxWidth: '100%',
    overflow: 'hidden',
  },
});
