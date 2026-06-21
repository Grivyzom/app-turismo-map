import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';

import { UserLocation } from '../../hooks/useUserLocation';

interface TelemetryWidgetProps {
  location: UserLocation | null;
}

export function TelemetryWidget({ location }: TelemetryWidgetProps) {
  if (!location) return null;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <MaterialIcons name="speed" size={16} color="#60A5FA" />
        <Text style={styles.text}>{location.speed ?? 0} km/h</Text>
      </View>
      <View style={styles.row}>
        <MaterialIcons name="my-location" size={16} color="#34D399" />
        <Text style={styles.text}>±{location.accuracy ?? '--'}m</Text>
      </View>
      {location.altitude !== null && (
        <View style={styles.row}>
          <MaterialIcons name="height" size={16} color="#FBBF24" />
          <Text style={styles.text}>{location.altitude}m</Text>
        </View>
      )}
      {location.headingDirection && (
        <View style={styles.row}>
          <Ionicons name="compass-outline" size={16} color="#A78BFA" />
          <Text style={styles.text}>{location.headingDirection}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    right: 16,
    backgroundColor: 'rgba(17, 24, 39, 0.85)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
    minWidth: 110,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  text: {
    color: '#F3F4F6',
    fontSize: 13,
    marginLeft: 8,
    fontWeight: '600',
  },
});
