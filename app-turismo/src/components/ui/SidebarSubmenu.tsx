import React from 'react';
import { View, Text, StyleSheet, Platform, Pressable, ScrollView, Modal } from 'react-native';

interface SidebarSubmenuProps {
  visible: boolean;
  onClose: () => void;
  position: { top?: number; bottom?: number; left?: number; right?: number };
  title?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  width?: number;
  pointerPosition?: 'top-left' | 'bottom-left' | 'none';
  maxHeight?: number;
}

const C = {
  bgGlass: 'rgba(28, 28, 28, 0.95)',
  borderMid: '#3E3E3E',
  textPrimary: '#FFFFFF',
  divider: '#2E2E2E',
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
  if (!visible && Platform.OS !== 'web') return null;

  const content = (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} />
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
        <View
          style={[
            styles.container,
            { width, maxHeight },
            pointerPosition === 'top-left' && { borderTopLeftRadius: 4 },
            pointerPosition === 'bottom-left' && { borderBottomLeftRadius: 4 },
          ]}
        >
          {title && (
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              {headerRight}
            </View>
          )}
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} bounces={false}>
            {children}
          </ScrollView>
        </View>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
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
    backgroundColor: 'transparent',
  },
  containerAligner: {
    position: 'absolute',
    pointerEvents: 'box-none',
  },
  container: {
    backgroundColor: C.bgGlass,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.borderMid,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
      },
      android: { elevation: 20 },
      web: {
        backdropFilter: 'blur(25px)',
        WebkitBackdropFilter: 'blur(25px)',
        boxShadow: '0px 10px 40px rgba(0, 0, 0, 0.6)',
      } as any,
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
  },
  title: {
    color: C.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  scroll: {
    flexGrow: 1,
  },
});
