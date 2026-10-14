import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  OsrmRoute,
  TransportMode,
  formatDistance,
  formatDuration,
  getManeuverIcon,
} from '../../utils/osrmService';

interface NavigationHUDProps {
  route: OsrmRoute;
  destinationName: string;
  destinationColor: string;
  transportMode?: TransportMode;
  onChangeTransportMode?: (mode: TransportMode) => void;
  isLoadingMode?: boolean;
  onCancel: () => void;
}

const NAV_MODES: Array<{
  id: TransportMode;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}> = [
  { id: 'foot', label: 'A pie', icon: 'directions-walk' },
  { id: 'bike', label: 'Bicicleta', icon: 'pedal-bike' },
  { id: 'car', label: 'Auto', icon: 'directions-car' },
];

export const NavigationHUD: React.FC<NavigationHUDProps> = ({
  route,
  destinationName,
  destinationColor,
  transportMode = 'foot',
  onChangeTransportMode,
  isLoadingMode = false,
  onCancel,
}) => {
  const [expanded, setExpanded] = useState(false);

  const firstStep = route.steps.find((s) => s.maneuverType !== 'arrive');
  const arrivalStep = route.steps.find((s) => s.maneuverType === 'arrive');

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={[styles.card, { borderColor: destinationColor + '55' }]}>
        {/* Header con destino y badge de precisión */}
        <View style={styles.header}>
          <View style={[styles.dot, { backgroundColor: destinationColor }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.destName} numberOfLines={1}>
              {destinationName}
            </Text>
            <View style={styles.badgeRow}>
              <Text style={styles.badgeText}>
                {route.label ?? 'Mejor Ruta'}
                {route.confidence ? ` · ${route.confidence}% precisión` : ''}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={onCancel} style={styles.closeBtn} hitSlop={8}>
            <MaterialIcons name="close" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Selector de Modo de Transporte Activo */}
        {onChangeTransportMode && (
          <View style={styles.modeSelectorRow}>
            {NAV_MODES.map((m) => {
              const isSelected = transportMode === m.id;
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.modeChip, isSelected && styles.modeChipActive]}
                  onPress={() => onChangeTransportMode(m.id)}
                  disabled={isLoadingMode}
                  activeOpacity={0.8}
                >
                  <MaterialIcons
                    name={m.icon}
                    size={14}
                    color={isSelected ? '#0B0F19' : '#9CA3AF'}
                  />
                  <Text style={[styles.modeChipText, isSelected && styles.modeChipTextActive]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {isLoadingMode && (
              <ActivityIndicator size="small" color="#00E676" style={{ marginLeft: 4 }} />
            )}
          </View>
        )}

        {/* Métricas de tiempo y distancia */}
        <View style={styles.metrics}>
          <View style={styles.metricItem}>
            <MaterialIcons name="straighten" size={14} color="#34D399" />
            <Text style={styles.metricValue}>{formatDistance(route.distance)}</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.metricItem}>
            <MaterialIcons name="schedule" size={14} color="#60A5FA" />
            <Text style={styles.metricValue}>{formatDuration(route.duration)}</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.metricItem}>
            <MaterialIcons
              name={
                transportMode === 'car'
                  ? 'directions-car'
                  : transportMode === 'bike'
                    ? 'pedal-bike'
                    : 'directions-walk'
              }
              size={14}
              color="#A78BFA"
            />
            <Text style={styles.metricValue}>
              {transportMode === 'car'
                ? 'En auto'
                : transportMode === 'bike'
                  ? 'Ciclovía'
                  : 'A pie'}
            </Text>
          </View>
        </View>

        {/* Primer paso / Maniobra inmediata */}
        {firstStep && (
          <View style={styles.stepBox}>
            <MaterialIcons
              name={(firstStep.iconName as any) || 'navigation'}
              size={18}
              color="#F59E0B"
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.stepText} numberOfLines={2}>
                {firstStep.instruction}
              </Text>
              {firstStep.streetName ? (
                <Text style={styles.stepStreet} numberOfLines={1}>
                  vía {firstStep.streetName}
                </Text>
              ) : null}
            </View>
            <Text style={styles.stepDist}>{formatDistance(firstStep.distance)}</Text>
          </View>
        )}

        {/* Expandir pasos detallados */}
        <TouchableOpacity
          style={styles.expandBtn}
          onPress={() => setExpanded((v) => !v)}
        >
          <Text style={styles.expandBtnText}>
            {expanded ? 'Ocultar pasos' : `Ver recorrido paso a paso (${route.steps.length})`}
          </Text>
          <MaterialIcons
            name={expanded ? 'expand-less' : 'expand-more'}
            size={14}
            color="#9CA3AF"
          />
        </TouchableOpacity>

        {expanded && (
          <ScrollView style={styles.stepsList} showsVerticalScrollIndicator={false}>
            {route.steps.map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepIconBox}>
                  <MaterialIcons
                    name={(step.iconName as any) || 'straight'}
                    size={14}
                    color={step.maneuverType === 'arrive' ? '#EF4444' : '#34D399'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepRowText}>{step.instruction}</Text>
                  {step.distance > 0 && (
                    <Text style={styles.stepRowDist}>{formatDistance(step.distance)}</Text>
                  )}
                </View>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Llegada al destino */}
        {arrivalStep && !expanded && (
          <View style={styles.arrivalRow}>
            <MaterialIcons name="flag" size={13} color="#EF4444" />
            <Text style={styles.arrivalText}>{arrivalStep.instruction}</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 120 : 100,
    left: 16,
    right: 16,
    zIndex: 5000,
    alignItems: 'center',
  },
  card: {
    backgroundColor: 'rgba(11, 15, 25, 0.95)',
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    width: '100%',
    maxWidth: 360,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 12,
      },
      android: { elevation: 14 },
      web: {
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  destName: {
    color: '#F9FAFB',
    fontSize: 14,
    fontWeight: '700',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  badgeText: {
    color: '#00E676',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  closeBtn: {
    padding: 2,
  },
  modeSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
    }),
  },
  modeChipActive: {
    backgroundColor: '#00E676',
    borderColor: '#00E676',
  },
  modeChipText: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '600',
  },
  modeChipTextActive: {
    color: '#0B0F19',
    fontWeight: '800',
  },
  metrics: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 10,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    justifyContent: 'center',
  },
  metricValue: {
    color: '#E5E7EB',
    fontSize: 13,
    fontWeight: '700',
  },
  separator: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  stepBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: 10,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  stepText: {
    color: '#FDE68A',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  stepStreet: {
    color: '#9CA3AF',
    fontSize: 10,
    marginTop: 2,
  },
  stepDist: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '500',
    flexShrink: 0,
  },
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  expandBtnText: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '500',
  },
  stepsList: {
    maxHeight: 200,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    paddingTop: 8,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 10,
  },
  stepIconBox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  stepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34D399',
    marginTop: 4,
    flexShrink: 0,
  },
  stepDotArrival: {
    backgroundColor: '#EF4444',
  },
  stepRowText: {
    color: '#D1D5DB',
    fontSize: 11,
    fontWeight: '500',
  },
  stepRowDist: {
    color: '#6B7280',
    fontSize: 10,
    marginTop: 2,
  },
  arrivalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    paddingTop: 8,
  },
  arrivalText: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '600',
  },
});
