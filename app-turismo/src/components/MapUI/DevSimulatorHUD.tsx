import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { TurismoEvent } from '../Map/types';

interface DevSimulatorHUDProps {
  activeEvents: TurismoEvent[];
  onInjectEvent: (type: 'embarcacion' | 'accidente' | 'incendio') => void;
  onMoveEvent: (id: string, deltaLat: number, deltaLng: number) => void;
  onClose: () => void;
}

export const DevSimulatorHUD: React.FC<DevSimulatorHUDProps> = ({
  activeEvents,
  onInjectEvent,
  onMoveEvent,
  onClose,
}) => {
  const dynamicEvents = activeEvents.filter((e) => e.id.startsWith('sim-'));

  const handleMove = (id: string, dir: 'up' | 'down' | 'left' | 'right') => {
    const step = 0.0002; // Aprox 22 metros
    let dLat = 0,
      dLng = 0;
    if (dir === 'up') dLat = step;
    if (dir === 'down') dLat = -step;
    if (dir === 'left') dLng = -step;
    if (dir === 'right') dLng = step;
    onMoveEvent(id, dLat, dLng);
  };

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.glassContainer}>
        <View style={styles.header}>
          <MaterialIcons name="gamepad" size={18} color="#F59E0B" />
          <Text style={styles.title}>SIMULADOR DE EVENTOS</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialIcons name="close" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Inyectar Entidad</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.injectButton, { borderColor: '#3B82F6' }]}
            onPress={() => onInjectEvent('embarcacion')}
          >
            <MaterialIcons name="directions-boat" size={16} color="#3B82F6" />
            <Text style={[styles.injectText, { color: '#3B82F6' }]}>Lancha</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.injectButton, { borderColor: '#EF4444' }]}
            onPress={() => onInjectEvent('accidente')}
          >
            <MaterialIcons name="car-crash" size={16} color="#EF4444" />
            <Text style={[styles.injectText, { color: '#EF4444' }]}>Accidente</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.injectButton, { borderColor: '#F59E0B' }]}
            onPress={() => onInjectEvent('incendio')}
          >
            <MaterialIcons name="local-fire-department" size={16} color="#F59E0B" />
            <Text style={[styles.injectText, { color: '#F59E0B' }]}>Incendio</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
          Control de Entidades ({dynamicEvents.length})
        </Text>
        <ScrollView style={styles.eventsList}>
          {dynamicEvents.length === 0 ? (
            <Text style={styles.emptyText}>No hay entidades simuladas activas</Text>
          ) : (
            dynamicEvents.map((event) => (
              <View key={event.id} style={styles.eventCard}>
                <View style={styles.eventInfo}>
                  <Text style={styles.eventName}>{event.title}</Text>
                  <Text style={styles.eventCoords}>
                    {event.latitude.toFixed(4)}, {event.longitude.toFixed(4)}
                  </Text>
                </View>
                <View style={styles.dpad}>
                  <TouchableOpacity
                    style={styles.dpadBtn}
                    onPress={() => handleMove(event.id, 'up')}
                  >
                    <MaterialIcons name="arrow-upward" size={16} color="#FFF" />
                  </TouchableOpacity>
                  <View style={styles.dpadMiddle}>
                    <TouchableOpacity
                      style={styles.dpadBtn}
                      onPress={() => handleMove(event.id, 'left')}
                    >
                      <MaterialIcons name="arrow-back" size={16} color="#FFF" />
                    </TouchableOpacity>
                    <View style={styles.dpadCenter} />
                    <TouchableOpacity
                      style={styles.dpadBtn}
                      onPress={() => handleMove(event.id, 'right')}
                    >
                      <MaterialIcons name="arrow-forward" size={16} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={styles.dpadBtn}
                    onPress={() => handleMove(event.id, 'down')}
                  >
                    <MaterialIcons name="arrow-downward" size={16} color="#FFF" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 80,
    left: 20,
    zIndex: 4000,
    width: 280,
  },
  glassContainer: {
    backgroundColor: 'rgba(11, 15, 25, 0.95)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 15,
      },
      android: { elevation: 12 },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  title: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  sectionTitle: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  injectButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  injectText: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 4,
  },
  eventsList: {
    maxHeight: 200,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    alignItems: 'center',
  },
  eventInfo: {
    flex: 1,
  },
  eventName: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  eventCoords: {
    color: '#9CA3AF',
    fontSize: 10,
    marginTop: 2,
  },
  dpad: {
    alignItems: 'center',
  },
  dpadMiddle: {
    flexDirection: 'row',
    marginVertical: 2,
  },
  dpadBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
  },
  dpadCenter: {
    width: 28,
  },
});
