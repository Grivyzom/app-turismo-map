import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useUserLocationContext } from '../../context/UserLocationContext';

interface TelemetryHUDProps {
  isDesktop?: boolean;
}

export const TelemetryHUD: React.FC<TelemetryHUDProps> = ({ isDesktop }) => {
  const { userLocation } = useUserLocationContext();
  const [isTelemetryExpanded, setIsTelemetryExpanded] = useState(true);
  const insets = useSafeAreaInsets();

  if (Platform.OS === 'web' || !userLocation) {
    return null;
  }

  return (
    <View
      style={[
        styles.telemetryHudContainer,
        { bottom: isDesktop ? 20 : Math.max(insets.bottom, 20) },
      ]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        onPress={() => setIsTelemetryExpanded(!isTelemetryExpanded)}
        activeOpacity={0.9}
        style={[
          styles.telemetryHudGlass,
          !isTelemetryExpanded && { width: 48, paddingHorizontal: 0, alignItems: 'center' },
        ]}
      >
        {/* Cabecera / Status */}
        <View style={styles.telemetryHeader}>
          <View
            style={[
              styles.telemetryDot,
              { backgroundColor: isTelemetryExpanded ? '#3B82F6' : '#34D399' },
            ]}
          />
          {isTelemetryExpanded && <Text style={styles.telemetryTitle}>TELEMETRÍA EN VIVO</Text>}
          <Ionicons
            name={isTelemetryExpanded ? 'chevron-down' : 'chevron-up'}
            size={14}
            color="#A0AEC0"
            style={isTelemetryExpanded ? { marginLeft: 'auto' } : {}}
          />
        </View>

        {isTelemetryExpanded && (
          <View style={styles.telemetryMainRow}>
            {/* Brújula Analógica */}
            <View style={styles.compassWrapper}>
              <View
                style={[
                  styles.compassRing,
                  {
                    transform: [
                      {
                        rotate:
                          userLocation.heading !== null ? `${-userLocation.heading}deg` : '0deg',
                      },
                    ],
                  },
                ]}
              >
                <Text style={[styles.compassText, styles.compassTextN]}>N</Text>
                <Text style={[styles.compassText, styles.compassTextE]}>E</Text>
                <Text style={[styles.compassText, styles.compassTextS]}>S</Text>
                <Text style={[styles.compassText, styles.compassTextO]}>O</Text>
              </View>
              <View style={styles.compassNeedle} />
              <View style={styles.compassCenterDot} />
            </View>

            {/* Datos de Telemetría */}
            <View style={styles.telemetryDataColumn}>
              <View style={styles.telemetryDetailRow}>
                <MaterialIcons name="explore" size={10} color="#A0AEC0" />
                <Text style={styles.telemetryDetailLabel}>RUMBO</Text>
                <Text style={styles.telemetryDetailValue}>
                  {userLocation.heading !== null
                    ? `${Math.round(userLocation.heading)}° ${userLocation.headingDirection || ''}`
                    : '--'}
                </Text>
              </View>
              <View style={styles.telemetryDetailRow}>
                <MaterialIcons name="speed" size={10} color="#A0AEC0" />
                <Text style={styles.telemetryDetailLabel}>VELOCIDAD</Text>
                <Text style={styles.telemetryDetailValue}>
                  {userLocation.speed !== null ? `${userLocation.speed} km/h` : '0 km/h'}
                </Text>
              </View>
              <View style={styles.telemetryDetailRow}>
                <MaterialIcons name="filter-hdr" size={10} color="#A0AEC0" />
                <Text style={styles.telemetryDetailLabel}>ALTITUD</Text>
                <Text style={styles.telemetryDetailValue}>
                  {userLocation.altitude !== null ? `${userLocation.altitude} m` : '-- m'}
                </Text>
              </View>
              <View style={styles.telemetryDetailRow}>
                <MaterialIcons name="gps-fixed" size={10} color="#A0AEC0" />
                <Text style={styles.telemetryDetailLabel}>EXACTITUD</Text>
                <Text style={styles.telemetryDetailValue}>
                  {userLocation.accuracy !== null ? `±${userLocation.accuracy}m` : '--'}
                </Text>
              </View>
            </View>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  telemetryHudContainer: {
    position: 'absolute',
    left: 16,
    zIndex: 3000,
  },
  telemetryHudGlass: {
    backgroundColor: 'rgba(11, 15, 25, 0.85)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
    padding: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
      },
      android: { elevation: 10 },
      web: {
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      },
    }),
  },
  telemetryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  telemetryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  telemetryTitle: {
    color: '#A0AEC0',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  telemetryMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  compassWrapper: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compassRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    position: 'relative',
  },
  compassText: {
    position: 'absolute',
    fontSize: 8,
    fontWeight: '900',
    color: '#A0AEC0',
  },
  compassTextN: { top: 2, alignSelf: 'center', color: '#EF4444' },
  compassTextS: { bottom: 2, alignSelf: 'center' },
  compassTextE: { right: 4, top: '45%' },
  compassTextO: { left: 4, top: '45%' },
  compassNeedle: {
    position: 'absolute',
    width: 2,
    height: 30,
    backgroundColor: '#3B82F6',
    top: 17,
    borderRadius: 1,
  },
  compassCenterDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  telemetryDataColumn: {
    flex: 1,
    gap: 4,
  },
  telemetryDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  telemetryDetailLabel: {
    color: '#718096',
    fontSize: 8,
    fontWeight: '700',
    width: 60,
  },
  telemetryDetailValue: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
