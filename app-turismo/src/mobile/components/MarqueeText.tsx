import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { T } from './ui';

type TProps = React.ComponentProps<typeof T>;

/**
 * Texto de una línea que, si no cabe en `width`, se desliza de ida y vuelta
 * (efecto carrusel). Si cabe, se muestra quieto.
 */
export function MarqueeText({
  width,
  children,
  ...textProps
}: { width: number; children: React.ReactNode } & Omit<TProps, 'numberOfLines'>) {
  const [textW, setTextW] = useState(0);
  const [textH, setTextH] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const overflow = Math.max(0, textW - width);

  useEffect(() => {
    x.setValue(0);
    if (overflow <= 0) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(1200),
        Animated.timing(x, {
          toValue: -overflow,
          duration: Math.max(1500, overflow * 40),
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(1200),
        Animated.timing(x, {
          toValue: 0,
          duration: Math.max(1500, overflow * 40),
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [overflow, x]);

  return (
    <View style={[styles.clip, { width, height: textH || undefined }]}>
      <Animated.View
        style={[styles.track, { transform: [{ translateX: x }] }]}
        onLayout={(e) => {
          setTextW(Math.ceil(e.nativeEvent.layout.width));
          setTextH(Math.ceil(e.nativeEvent.layout.height));
        }}
      >
        <T {...textProps} numberOfLines={1}>
          {children}
        </T>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  track: { position: 'absolute', left: 0, top: 0, flexDirection: 'row' },
});
