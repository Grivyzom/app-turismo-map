import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ScrollView, Platform } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { BlurView } from 'expo-blur';

interface DevToolbarProps {
  onSimulatorPress: () => void;
  onNewPointPress: () => void;
  onNewSectorPress: () => void;
  onConfigSectorsPress: () => void;
  onMagicWandPress: () => void;
  onNewRoutePress: () => void;
  onCoordsEditorPress: () => void;
  isMagicWandActive: boolean;
}

export const DevToolbar: React.FC<DevToolbarProps> = ({
  onSimulatorPress,
  onNewPointPress,
  onNewSectorPress,
  onConfigSectorsPress,
  onMagicWandPress,
  onNewRoutePress,
  onCoordsEditorPress,
  isMagicWandActive,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.shadowContainer}>
        <BlurView intensity={90} tint="dark" style={styles.blurContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            
            <TouchableOpacity style={styles.toolbarBtn} onPress={onSimulatorPress} activeOpacity={0.7}>
              <View style={styles.iconWrapper}>
                <MaterialIcons name="bug-report" size={22} color="#A78BFA" />
              </View>
              <Text style={styles.btnLabel}>Simulador</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolbarBtn} onPress={onCoordsEditorPress} activeOpacity={0.7}>
              <View style={[styles.iconWrapper, { backgroundColor: 'rgba(139, 92, 246, 0.2)' }]}>
                <MaterialIcons name="edit-location" size={22} color="#8B5CF6" />
              </View>
              <Text style={styles.btnLabel}>Editor Geo</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.toolbarBtn} onPress={onNewPointPress} activeOpacity={0.7}>
              <View style={styles.iconWrapper}>
                <MaterialIcons name="add-location-alt" size={22} color="#34D399" />
              </View>
              <Text style={styles.btnLabel}>Punto</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolbarBtn} onPress={onNewSectorPress} activeOpacity={0.7}>
              <View style={styles.iconWrapper}>
                <MaterialIcons name="dashboard-customize" size={22} color="#F472B6" />
              </View>
              <Text style={styles.btnLabel}>Crear</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolbarBtn} onPress={onConfigSectorsPress} activeOpacity={0.7}>
              <View style={styles.iconWrapper}>
                <MaterialIcons name="layers" size={22} color="#6EE7B7" />
              </View>
              <Text style={styles.btnLabel}>Capas</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolbarBtn} onPress={onMagicWandPress} activeOpacity={0.7}>
              <View style={[
                styles.iconWrapper, 
                isMagicWandActive && styles.activeIconWrapper
              ]}>
                <MaterialIcons name="auto-awesome" size={22} color={isMagicWandActive ? '#FFF' : '#38BDF8'} />
              </View>
              <Text style={[styles.btnLabel, isMagicWandActive && styles.activeLabel]}>Varita</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.toolbarBtn} onPress={onNewRoutePress} activeOpacity={0.7}>
              <View style={styles.iconWrapper}>
                <MaterialIcons name="alt-route" size={22} color="#FBBF24" />
              </View>
              <Text style={styles.btnLabel}>Ruta</Text>
            </TouchableOpacity>

          </ScrollView>
        </BlurView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 35,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  shadowContainer: {
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
    backgroundColor: Platform.OS === 'android' ? 'rgba(15, 23, 42, 0.8)' : 'transparent',
  },
  blurContainer: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: Platform.OS === 'ios' ? 'rgba(15, 23, 42, 0.4)' : 'transparent',
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toolbarBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
    gap: 6,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  activeIconWrapper: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 5,
  },
  btnLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  activeLabel: {
    color: '#E0F2FE',
    fontWeight: '700',
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginHorizontal: 4,
    borderRadius: 1,
  }
});
