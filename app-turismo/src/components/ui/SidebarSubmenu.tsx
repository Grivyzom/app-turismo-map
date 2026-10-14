import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Pressable,
  ScrollView,
  Modal,
  Animated,
  Easing,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

interface SidebarSubmenuProps {
  visible: boolean;
  onClose: () => void;
  position: { top?: number; bottom?: number; left?: number; right?: number };
  title?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  width?: number;
  pointerPosition?: 'top-left' | 'bottom-left' | 'top-right' | 'bottom-right' | 'none';
  maxHeight?: number;
}

// ─── Design Tokens (Selva Glass Deep) ────────────────────────────────────────
const C = {
  bgGlass: 'rgba(9, 15, 14, 0.94)',
  borderTop: 'rgba(255, 255, 255, 0.16)',
  borderBottom: 'rgba(255, 255, 255, 0.04)',
  borderSide: 'rgba(255, 255, 255, 0.08)',
  textPrimary: '#F8FAFC',
  textMuted: '#94A3B8',
  divider: 'rgba(255, 255, 255, 0.08)',
  accent: '#34D399',
};

export function SidebarSubmenu({
  visible,
  onClose,
  position,
  title,
  headerRight,
  children,
  width = 320,
  pointerPosition = 'none',
  maxHeight = 500,
}: SidebarSubmenuProps) {
  const [isRendered, setIsRendered] = useState(visible);
  const animValue = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const isClosingRef = useRef(false);

  const runEnter = useCallback(() => {
    isClosingRef.current = false;
    setIsRendered(true);
    animValue.setValue(0);
    Animated.timing(animValue, {
      toValue: 1,
      duration: 220,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [animValue]);

  const runExit = useCallback(
    (onComplete?: () => void) => {
      if (isClosingRef.current) return;
      isClosingRef.current = true;
      Animated.timing(animValue, {
        toValue: 0,
        duration: 160,
        easing: Easing.bezier(0.4, 0, 1, 1),
        useNativeDriver: Platform.OS !== 'web',
      }).start(({ finished }) => {
        if (finished) {
          setIsRendered(false);
          isClosingRef.current = false;
          onComplete?.();
        }
      });
    },
    [animValue],
  );

  useEffect(() => {
    if (visible) {
      runEnter();
    } else if (isRendered) {
      runExit();
    }
  }, [visible, runEnter, runExit, isRendered]);

  const handleBackdropPress = useCallback(() => {
    runExit(() => {
      onClose();
    });
  }, [runExit, onClose]);

  if (!isRendered && Platform.OS !== 'web') return null;

  const content = (
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdropPress}>
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: animValue.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1],
              }),
            },
          ]}
        />
      </Pressable>
      <View
        style={[
          styles.containerAligner,
          {
            top: position.top,
            bottom: position.bottom,
            left: position.left,
            right: position.right,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.container,
            { width, maxHeight },
            pointerPosition === 'top-left' && { borderTopLeftRadius: 6 },
            pointerPosition === 'bottom-left' && { borderBottomLeftRadius: 6 },
            pointerPosition === 'top-right' && { borderTopRightRadius: 6 },
            pointerPosition === 'bottom-right' && { borderBottomRightRadius: 6 },
            {
              opacity: animValue,
              transform: [
                {
                  scale: animValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.93, 1],
                  }),
                },
                {
                  translateY: animValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-10, 0],
                  }),
                },
              ],
            },
            Platform.select({
              web: {
                transformOrigin: position.right !== undefined ? 'top right' : 'top left',
              } as any,
            }),
          ]}
        >
          {title && (
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <View style={styles.headerRightGroup}>
                {headerRight}
                <Pressable
                  onPress={handleBackdropPress}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.closeBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Cerrar"
                >
                  <Ionicons name="close" size={15} color={C.textMuted} />
                </Pressable>
              </View>
            </View>
          )}
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} bounces={false}>
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </View>
  );

  return (
    <Modal
      visible={isRendered}
      transparent
      animationType="none"
      onRequestClose={handleBackdropPress}
    >
      {content}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 9999,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Platform.OS === 'web' ? 'rgba(0, 0, 0, 0.15)' : 'rgba(0, 0, 0, 0.28)',
  },
  containerAligner: {
    position: 'absolute',
    pointerEvents: 'box-none',
  },
  container: {
    backgroundColor: C.bgGlass,
    borderRadius: 18,
    borderWidth: 1,
    borderTopColor: C.borderTop,
    borderBottomColor: C.borderBottom,
    borderLeftColor: C.borderSide,
    borderRightColor: C.borderSide,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.45,
        shadowRadius: 18,
      },
      android: { elevation: 16 },
      web: {
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: '0 20px 48px -8px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.05)',
      } as any,
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
  },
  title: {
    color: C.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  closeBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'background-color 0.15s ease',
      } as any,
    }),
  },
  scroll: {
    flexGrow: 1,
  },
});
