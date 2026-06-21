import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';

export interface FloorSelectorProps {
  floors: { level: number; label: string }[];
  activeFloor: number;
  onSelectFloor: (level: number) => void;
  isDesktop?: boolean;
}

export const FloorSelector: React.FC<FloorSelectorProps> = ({
  floors,
  activeFloor,
  onSelectFloor,
  isDesktop = false,
}) => {
  if (!floors || floors.length === 0) return null;

  // Render from highest floor to lowest to simulate a real building vertically
  const sortedFloors = [...floors].sort((a, b) => b.level - a.level);

  return (
    <View style={[styles.container, isDesktop && styles.containerDesktop]}>
      <View style={styles.glassEffect}>
        {sortedFloors.map((floor) => {
          const isActive = floor.level === activeFloor;
          return (
            <TouchableOpacity
              key={floor.level}
              style={[
                styles.floorButton,
                isActive && styles.floorButtonActive,
              ]}
              onPress={() => onSelectFloor(floor.level)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.floorText,
                  isActive && styles.floorTextActive,
                ]}
              >
                {floor.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 16,
    top: '40%',
    zIndex: 50,
  },
  containerDesktop: {
    right: 24,
  },
  glassEffect: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 12,
    padding: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    ...(Platform.OS === 'web'
      ? { backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }
      : {}),
  },
  floorButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginBottom: 4,
  },
  floorButtonActive: {
    backgroundColor: '#3B82F6', // Blue primary
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  floorText: {
    color: '#94A3B8', // Slate 400
    fontSize: 15,
    fontWeight: '600',
    fontFamily: Platform.OS === 'web' ? 'Inter, sans-serif' : undefined,
  },
  floorTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
