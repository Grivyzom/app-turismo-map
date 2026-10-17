import React, { useEffect, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLayoutMode } from '../hooks/useLayoutMode';
import { DIALOG_MAX_WIDTH } from '../layout';
import { MobileMotion, MobileRadii, MobileSpacing } from '../theme';

import { T, useColors } from './ui';

/**
 * Oscurecimiento de pantalla completa. Su opacidad la maneja `progress` (0 → 1),
 * así aparece con un fundido en lugar de un recuadro que se desliza junto al contenido.
 */
export function Scrim({
  progress,
  onPress,
}: {
  progress: Animated.Value | Animated.AnimatedInterpolation<number>;
  onPress?: () => void;
}) {
  const colors = useColors();
  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim, opacity: progress }]}
    >
      {onPress ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
        />
      ) : null}
    </Animated.View>
  );
}

/**
 * Anima 0 → 1 al abrir y 1 → 0 al cerrar, y mantiene el contenido montado
 * hasta que termina la salida (para que cerrar también se vea).
 */
export function usePresence(visible: boolean) {
  const [progress] = useState(() => new Animated.Value(0));
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    const anim = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? MobileMotion.enter : MobileMotion.exit,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
    return () => anim.stop();
  }, [visible, progress]);

  return { progress, mounted };
}

/**
 * Hoja inferior reutilizable: el fondo se oscurece con un fundido sobre toda la
 * pantalla (incluida la barra de estado) y, por separado, la hoja sube desde abajo.
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { progress, mounted } = usePresence(visible);
  const [height, setHeight] = useState(600);
  const wide = useLayoutMode() === 'wide';

  // Teléfono: sube desde abajo. Escritorio: diálogo centrado que aparece con un leve desplazamiento
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: wide ? [16, 0] : [height, 0],
  });

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={wide ? styles.rootWide : styles.root}>
        <Scrim progress={progress} onPress={onClose} />
        <Animated.View
          testID="sheet"
          onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
          style={[
            wide ? styles.dialog : styles.sheet,
            {
              backgroundColor: colors.surface,
              paddingBottom: wide ? 16 : insets.bottom + 16,
              transform: [{ translateY }],
            },
            wide && { opacity: progress },
          ]}
        >
          {wide ? null : (
            <View style={[styles.grabber, { backgroundColor: colors.borderStrong }]} />
          )}
          {title ? (
            <T variant="title" weight="700" style={styles.title} accessibilityRole="header">
              {title}
            </T>
          ) : null}
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  rootWide: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  dialog: {
    width: '100%',
    maxWidth: DIALOG_MAX_WIDTH,
    borderRadius: MobileRadii.card,
    paddingHorizontal: MobileSpacing.screen,
    paddingTop: 16,
  },
  sheet: {
    borderTopLeftRadius: MobileRadii.card,
    borderTopRightRadius: MobileRadii.card,
    paddingHorizontal: MobileSpacing.screen,
    paddingTop: 10,
  },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: 12 },
  title: { marginBottom: 10, paddingHorizontal: 4 },
});
