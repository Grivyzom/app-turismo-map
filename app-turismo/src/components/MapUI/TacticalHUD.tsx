import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  StyleSheet,
  Dimensions,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { useUserLocationContext } from '../../context/UserLocationContext';

interface TacticalHUDProps {
  tacticalLocation: {
    latitude: number;
    longitude: number;
    x?: number;
    y?: number;
    surface?: 'land' | 'water';
  };
  isResolvingAddress: boolean;
  resolvedAddress: string;
  screenWidth: number;
  isLightMode?: boolean;
  setShowCreateEventModal?: (show: boolean) => void;
}

export const TacticalHUD: React.FC<TacticalHUDProps> = ({
  tacticalLocation,
  isResolvingAddress,
  resolvedAddress,
  screenWidth,
  isLightMode,
  setShowCreateEventModal,
}) => {
  const { userLocation } = useUserLocationContext();

  const theme = {
    glassBg: isLightMode ? 'rgba(255, 255, 255, 0.85)' : 'rgba(30, 30, 30, 0.6)',
    glassBorder: isLightMode ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.1)',
    textPrimary: isLightMode ? '#1F2937' : '#FFFFFF',
    textSecondary: isLightMode ? '#4B5563' : '#718096',
    textTitle: isLightMode ? '#374151' : '#A0AEC0',
    separator: isLightMode ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.1)',
    shadowColor: isLightMode ? 'rgba(0, 0, 0, 0.15)' : '#000',
    surfaceWater: isLightMode ? '#2563EB' : '#60A5FA',
    surfaceLand: isLightMode ? '#059669' : '#34D399',
  };

  return (
    <View
      style={[
        styles.tacticalHudContainer,
        tacticalLocation.x !== undefined && tacticalLocation.y !== undefined
          ? {
              left: tacticalLocation.x + 20,
              top: tacticalLocation.y + 20,
              transform: [
                { translateX: tacticalLocation.x > screenWidth - 250 ? -260 : 0 },
                {
                  translateY: tacticalLocation.y > Dimensions.get('window').height - 150 ? -150 : 0,
                },
              ],
            }
          : {
              top: Platform.OS === 'ios' ? 120 : 90,
              alignSelf: 'center',
            },
      ]}
      pointerEvents="box-none"
    >
      <View style={[styles.tacticalHudGlass, { backgroundColor: theme.glassBg, borderColor: theme.glassBorder, shadowColor: theme.shadowColor as any }]}>
        <View style={styles.hudHeader}>
          <View style={styles.hudDot} />
          <Text style={[styles.hudTitle, { color: theme.textTitle }]}>COORDENADAS</Text>
        </View>
        <View style={styles.hudDataRow}>
          <Text style={[styles.hudLabel, { color: theme.textSecondary }]}>LAT</Text>
          <Text style={[styles.hudValue, { color: theme.textPrimary }]}>{tacticalLocation.latitude.toFixed(6)}°</Text>
        </View>
        <View style={styles.hudDataRow}>
          <Text style={[styles.hudLabel, { color: theme.textSecondary }]}>LNG</Text>
          <Text style={[styles.hudValue, { color: theme.textPrimary }]}>{tacticalLocation.longitude.toFixed(6)}°</Text>
        </View>
        <View style={styles.hudDataRow}>
          <Text style={[styles.hudLabel, { color: theme.textSecondary }]}>ALT</Text>
          <Text style={[styles.hudValue, { color: theme.textPrimary }]}>
            {userLocation?.altitude !== null && userLocation?.altitude !== undefined
              ? `${userLocation.altitude} msnm`
              : '-- msnm'}
          </Text>
        </View>
        <View style={styles.hudDataRow}>
          <Text style={[styles.hudLabel, { color: theme.textSecondary }]}>SUPERFICIE</Text>
          <Text
            style={[
              styles.hudValue,
              {
                color: tacticalLocation.surface === 'water' ? theme.surfaceWater : theme.surfaceLand,
                fontWeight: '800',
              },
            ]}
          >
            {tacticalLocation.surface === 'water' ? 'AGUA (FLOTANTE)' : 'TIERRA (PINCHADO)'}
          </Text>
        </View>

        <View
          style={{ height: 1, backgroundColor: theme.separator, marginVertical: 8 }}
        />

        {isResolvingAddress ? (
          <View style={styles.hudDataRow}>
            <Text style={[styles.hudLabel, { color: theme.textSecondary }]}>DIRECCIÓN</Text>
            <ActivityIndicator size="small" color={theme.surfaceLand} style={{ marginRight: 4 }} />
          </View>
        ) : resolvedAddress ? (
          <View
            style={[
              styles.hudDataRow,
              { flexDirection: 'column', alignItems: 'flex-start', gap: 2, marginBottom: 8 },
            ]}
          >
            <Text style={[styles.hudLabel, { color: theme.textSecondary }]}>DIRECCIÓN DE EVENTO</Text>
            <Text style={[styles.hudValue, { color: theme.textPrimary, fontSize: 10, lineHeight: 14 }]} numberOfLines={2}>
              {resolvedAddress}
            </Text>
          </View>
        ) : null}

        {setShowCreateEventModal && (
          <TouchableOpacity
            style={[styles.hudCreateButton, { backgroundColor: theme.surfaceLand }]}
            onPress={() => setShowCreateEventModal(true)}
            activeOpacity={0.8}
          >
            <MaterialIcons name="add-location-alt" size={16} color="#0B0F19" />
            <Text style={styles.hudCreateButtonText}>Crear Punto Aquí</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  tacticalHudContainer: {
    position: 'absolute',
    zIndex: 3000,
  },
  tacticalHudGlass: {
    backgroundColor: 'rgba(30, 30, 30, 0.6)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
    width: 220,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
      web: {
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.2)',
      },
    }),
  },
  hudHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  hudDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#34D399',
    marginRight: 6,
  },
  hudTitle: {
    color: '#A0AEC0',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  hudDataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  hudLabel: {
    color: '#718096',
    fontSize: 9,
    fontWeight: '700',
  },
  hudValue: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  hudCreateButton: {
    borderRadius: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  hudCreateButtonText: {
    color: '#0B0F19',
    fontSize: 11,
    fontWeight: '800',
  },
});
