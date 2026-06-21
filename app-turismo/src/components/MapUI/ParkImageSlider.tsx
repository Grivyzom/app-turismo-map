import React, { useState, useCallback } from 'react';
import { View, Image, ScrollView, StyleSheet, NativeSyntheticEvent, NativeScrollEvent, LayoutChangeEvent } from 'react-native';

interface ParkImageSliderProps {
  images: string[];
  height?: number;
}

export const ParkImageSlider: React.FC<ParkImageSliderProps> = ({ images, height = 160 }) => {
  const [width, setWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  }, []);

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!width) return;
      const index = Math.round(e.nativeEvent.contentOffset.x / width);
      setActiveIndex(index);
    },
    [width],
  );

  if (!images || images.length === 0) return null;

  return (
    <View style={styles.container} onLayout={onLayout}>
      {width > 0 && (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumScrollEnd}
          decelerationRate="fast"
        >
          {images.map((uri, index) => (
            <Image
              key={`${uri}-${index}`}
              source={{ uri }}
              style={{ width, height }}
              resizeMode="cover"
            />
          ))}
        </ScrollView>
      )}

      {images.length > 1 && (
        <View style={styles.dotsRow}>
          {images.map((_, index) => (
            <View
              key={index}
              style={[styles.dot, index === activeIndex && styles.dotActive]}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  dotsRow: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
    width: 16,
  },
});
