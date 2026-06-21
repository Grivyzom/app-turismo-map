import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Pressable,
  Animated,
  Modal,
  Dimensions,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

export interface ActionDropdownItem {
  id: string;
  label: string;
  icon: string;
  onClick: () => void;
}

interface ActionDropdownProps {
  items: ActionDropdownItem[];
  children: React.ReactNode;
}

export function ActionDropdown({ items, children }: ActionDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const triggerRef = React.useRef<View>(null);
  const { width: windowWidth, height: windowHeight } = Dimensions.get('window');

  const openMenu = () => {
    if (!triggerRef.current) return;

    triggerRef.current.measureInWindow((x, y, width, height) => {
      const menuWidth = 220;
      const menuHeight = items.length * 52 + (items.length - 1);

      // Si el trigger está muy a la derecha, mostrar a la izquierda del trigger
      let nextLeft = x - menuWidth - 12;

      // Si se sale por la izquierda de la pantalla, ajustar
      if (nextLeft < 12) {
        nextLeft = x + width + 12;
      }

      // Ajustar top para que el menú esté alineado con el trigger (o ligeramente arriba)
      let nextTop = y - menuHeight + height;
      if (nextTop < 12) nextTop = 12;

      setMenuPosition({ top: nextTop, left: nextLeft });
      setIsOpen(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }).start();
    });
  };

  const closeMenu = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: false,
    }).start(() => setIsOpen(false));
  };

  const handleTriggerPress = () => {
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  };

  return (
    <View style={styles.container}>
      <Pressable ref={triggerRef} onPress={handleTriggerPress} style={styles.trigger}>
        {children}
      </Pressable>

      <Modal visible={isOpen} transparent animationType="none" onRequestClose={closeMenu}>
        <View style={styles.overlayContainer} pointerEvents="box-none">
          <Pressable style={styles.backdrop} onPress={closeMenu} />
          <Animated.View
            style={[
              styles.menu,
              {
                top: menuPosition.top,
                left: menuPosition.left,
                opacity: fadeAnim,
                transform: [
                  {
                    translateX: fadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [10, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {items.map((item, index) => (
              <React.Fragment key={item.id}>
                {index > 0 && <View style={styles.divider} />}
                <TouchableOpacity
                  style={styles.item}
                  onPress={() => {
                    item.onClick();
                    closeMenu();
                  }}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name={item.icon as any} size={18} color="#A0AEC0" />
                  <Text style={styles.itemText}>{item.label}</Text>
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  trigger: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayContainer: {
    ...StyleSheet.absoluteFill,
    zIndex: 2000,
    overflow: 'visible',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'transparent',
  },
  menu: {
    position: 'absolute',
    backgroundColor: 'rgba(26, 26, 26, 0.95)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 6,
    minWidth: 200,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
      },
      android: { elevation: 15 },
      web: {
        backdropFilter: 'blur(15px)',
        WebkitBackdropFilter: 'blur(15px)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
      } as any,
    }),
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  itemText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 12,
    letterSpacing: 0.3,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginHorizontal: 10,
  },
});
