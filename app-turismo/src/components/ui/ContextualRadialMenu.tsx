import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableWithoutFeedback,
  TouchableOpacity,
  Animated,
  LayoutChangeEvent,
  Platform,
} from 'react-native';

import { radialMenuRegistry } from '../../utils/radialMenuRegistry';

import { ContextualRadialMenuProps } from './ContextualRadialMenu.types';

export function ContextualRadialMenu({
  children,
  items,
  buttonSize = 24,
  offset = 8,
  startAngle: propStartAngle,
  endAngle: propEndAngle,
  isSelected: propIsSelected,
  onSelectionChange,
  menuId: propMenuId,
}: ContextualRadialMenuProps) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [internalSelected, setInternalSelected] = useState(false);
  const animProgress = useRef(new Animated.Value(0)).current;

  // Stable unique ID for the registry
  const menuId = useRef(propMenuId ?? `rml-${Math.random().toString(36).slice(2)}`).current;

  const isControlled = propIsSelected !== undefined;
  const isSelected = isControlled ? propIsSelected : internalSelected;

  const setIsSelected = (val: boolean) => {
    if (!isControlled) setInternalSelected(val);
    if (onSelectionChange) onSelectionChange(val);
  };

  // ---------------------------------------------------------------------------
  // Registry: close when another menu opens
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const unsub = radialMenuRegistry.subscribe((openId) => {
      if (openId !== menuId && openId !== null) {
        if (!isControlled) setInternalSelected(false);
        if (onSelectionChange) onSelectionChange(false);
      }
    });
    return unsub;
  }, [menuId, isControlled, onSelectionChange]);

  // ---------------------------------------------------------------------------
  // Spring animation
  // ---------------------------------------------------------------------------
  useEffect(() => {
    Animated.spring(animProgress, {
      toValue: isSelected ? 1 : 0,
      friction: isSelected ? 6 : 8,
      tension: isSelected ? 40 : 45,
      useNativeDriver: false,
    }).start();
  }, [isSelected, animProgress]);

  // ---------------------------------------------------------------------------
  // Layout measurement
  // ---------------------------------------------------------------------------
  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setDimensions({ width, height });
  };

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  const openMenu = () => {
    setIsSelected(true);
    radialMenuRegistry.open(menuId);
  };

  const closeMenu = () => {
    setIsSelected(false);
    radialMenuRegistry.close(menuId);
  };

  // ---------------------------------------------------------------------------
  // Geometry
  // ---------------------------------------------------------------------------
  const { width: W, height: H } = dimensions;
  const cx = W / 2;
  const cy = H / 2;
  const N = items.length;

  // Use manual overrides if provided, otherwise default to upper semicircle
  const startAngle = propStartAngle ?? 190;
  const endAngle = propEndAngle ?? 350;
  const angleRange = Math.abs(endAngle - startAngle);
  const isFullCircle = angleRange >= 360;

  // Orbit radius: half pin + gap + half button
  const r = Math.max(W, H) / 2 + buttonSize / 2 + offset;
  const btnHalf = buttonSize / 2;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <View style={[styles.wrapper, { zIndex: isSelected ? 100 : 1 }]}>
      {/* Backdrop to capture outside taps */}
      {isSelected && (
        <TouchableWithoutFeedback onPress={closeMenu}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>
      )}

      {/* Target content */}
      <TouchableWithoutFeedback onPress={openMenu}>
        <View onLayout={handleLayout} style={styles.targetContainer}>
          {children}
        </View>
      </TouchableWithoutFeedback>

      {/* Orbit action islands */}
      {W > 0 &&
        items.map((item, index) => {
          let angleDeg = startAngle;
          if (N > 1) {
            angleDeg = isFullCircle
              ? startAngle + index * (360 / N)
              : startAngle + index * ((endAngle - startAngle) / (N - 1));
          } else if (N === 1) {
            angleDeg = (startAngle + endAngle) / 2;
          }

          const rad = (angleDeg * Math.PI) / 180;
          const targetX = cx + r * Math.cos(rad);
          const targetY = cy + r * Math.sin(rad);

          const dx = targetX - cx;
          const dy = targetY - cy;

          const translateX = animProgress.interpolate({ inputRange: [0, 1], outputRange: [0, dx] });
          const translateY = animProgress.interpolate({ inputRange: [0, 1], outputRange: [0, dy] });
          const scale = animProgress;
          const opacity = animProgress;

          return (
            <Animated.View
              key={item.id}
              pointerEvents={isSelected ? 'auto' : 'none'}
              style={[
                styles.islandWrapper,
                {
                  width: buttonSize,
                  height: buttonSize,
                  left: cx - btnHalf,
                  top: cy - btnHalf,
                  transform: [{ translateX }, { translateY }, { scale }],
                  opacity,
                },
              ]}
            >
              <TouchableOpacity
                onPress={() => {
                  item.onClick();
                  closeMenu();
                }}
                activeOpacity={0.8}
                style={[
                  styles.islandButton,
                  { width: buttonSize, height: buttonSize, borderRadius: buttonSize / 2 },
                ]}
              >
                {item.icon}
              </TouchableOpacity>
            </Animated.View>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  targetContainer: {
    zIndex: 10,
  },
  backdrop: {
    position: 'absolute',
    top: -4000,
    bottom: -4000,
    left: -4000,
    right: -4000,
    backgroundColor: 'transparent',
    zIndex: 5,
  },
  islandWrapper: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
  },
  islandButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
      web: { boxShadow: '0 4px 12px rgba(0,0,0,0.18)' } as any,
    }),
  },
});
