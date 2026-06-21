import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
  ScrollView,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { RouteType, RoutePoint } from '../Map/types';

interface RouterHUDProps {
  isRoutingActive: boolean;
  routingType: RouteType;
  setRoutingType: (type: RouteType) => void;
  routeCategory: string;
  setRouteCategory: (cat: string) => void;
  draftRoutePoints: RoutePoint[];
  setDraftRoutePoints: (points: RoutePoint[]) => void;
  draftRouteName: string;
  setDraftRouteName: (name: string) => void;
  isRouteFinished: boolean;
  onFinishSingleTarget: () => void;
  onSave: () => void;
  onCancel: () => void;
  hideSaveBlock?: boolean;
}

const ROUTE_CATEGORIES = [
  { id: 'cervecera', label: 'Cervecera', color: '#F59E0B' },
  { id: 'reto', label: 'Reto', color: '#EF4444' },
  { id: 'turistica', label: 'Turística', color: '#3B82F6' },
  { id: 'exploracion', label: 'Exploración', color: '#10B981' },
];

const SECTOR_CATEGORIES = [
  { id: 'edificio', label: 'Edificio / Mall', color: '#6366F1' },
  { id: 'reserva', label: 'Reserva / Parque', color: '#22C55E' },
  { id: 'ciudad', label: 'Sector de Ciudad', color: '#EAB308' },
  { id: 'subzona', label: 'Subzona', color: '#A855F7' },
];

export const RouterHUD: React.FC<RouterHUDProps> = ({
  isRoutingActive,
  routingType,
  setRoutingType,
  routeCategory,
  setRouteCategory,
  draftRoutePoints,
  setDraftRoutePoints,
  draftRouteName,
  setDraftRouteName,
  isRouteFinished,
  onFinishSingleTarget,
  onSave,
  onCancel,
  hideSaveBlock
}) => {
  if (!isRoutingActive) return null;
  if (routingType === 'sector' && isRouteFinished) return null;

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // metres
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // in metres
  };

  const calculateTotalDistance = () => {
    if (draftRoutePoints.length < 2) return 0;
    let dist = 0;
    for (let i = 0; i < draftRoutePoints.length - 1; i++) {
      dist += calculateDistance(
        draftRoutePoints[i].latitude, draftRoutePoints[i].longitude,
        draftRoutePoints[i+1].latitude, draftRoutePoints[i+1].longitude
      );
    }
    return dist;
  };

  const totalDist = calculateTotalDistance();
  const lastPoint = draftRoutePoints[draftRoutePoints.length - 1];
  const showPointNaming =
    routingType === 'multi_target' && lastPoint && lastPoint.type === 'target' && !lastPoint.name;

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.glassContainer}>
        <View style={styles.header}>
          <MaterialIcons name="route" size={18} color="#10B981" />
          <Text style={styles.title}>GEO-ROUTER</Text>
          <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
            <MaterialIcons name="close" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {!isRouteFinished ? (
          <>
            <View style={styles.typeSelector}>
              {(['direct', 'single_target', 'multi_target', 'ciclovia', 'sector', 'measure'] as RouteType[]).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeButton,
                    routingType === type && styles.typeButtonActive,
                    draftRoutePoints.length > 0 && routingType !== type && styles.typeButtonDisabled,
                  ]}
                  onPress={() => draftRoutePoints.length === 0 && setRoutingType(type)}
                  disabled={draftRoutePoints.length > 0}
                >
                  <MaterialIcons
                    name={
                      type === 'direct' ? 'straighten' : type === 'single_target' ? 'gesture' : type === 'multi_target' ? 'hub' : type === 'ciclovia' ? 'pedal-bike' : type === 'sector' ? 'format-shapes' : 'square-foot'
                    }
                    size={16}
                    color={routingType === type ? '#0B0F19' : '#D1D5DB'}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Categoría Selector */}
            <View style={styles.categorySelector}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
                {(routingType === 'sector' ? SECTOR_CATEGORIES : ROUTE_CATEGORIES).map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.catChip,
                      routeCategory === cat.id && { backgroundColor: cat.color },
                    ]}
                    onPress={() => setRouteCategory(cat.id)}
                  >
                    <Text style={[styles.catChipText, routeCategory === cat.id && { color: '#0B0F19' }]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {showPointNaming ? (
              <View style={styles.saveContainer}>
                <Text style={styles.instructions}>Nombre para el objetivo:</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej. Bodega Central..."
                  placeholderTextColor="#9CA3AF"
                  onBlur={() => {
                    // Force a re-render or handle "Done" if needed
                  }}
                  onChangeText={(text) => {
                    const newPoints = [...draftRoutePoints];
                    newPoints[newPoints.length - 1] = {
                      ...newPoints[newPoints.length - 1],
                      name: text,
                    };
                    setDraftRoutePoints(newPoints);
                  }}
                  onSubmitEditing={() => {
                    // Optional: handle enter to confirm name
                  }}
                  autoFocus
                />
              </View>
            ) : (
              <View style={styles.instructionsContainer}>
                <Text style={styles.instructions}>
                  {routingType === 'measure' && draftRoutePoints.length > 1 && (
                    <Text style={{color: '#34D399', fontWeight: 'bold', fontSize: 16, textAlign: 'center', marginBottom: 4}}>
                      {(totalDist / 1000).toFixed(2)} km
                    </Text>
                  )}
                  {routingType === 'direct' && draftRoutePoints.length === 0 && 'Toca el Origen'}
                  {routingType === 'direct' && draftRoutePoints.length === 1 && 'Toca el Destino'}
                  {routingType === 'single_target' && 'Traza el camino con clics'}
                  {routingType === 'ciclovia' && 'Dibuja la ciclovía conectando nodos'}
                  {routingType === 'sector' && 'Dibuja el polígono marcando sus vértices'}
                  {routingType === 'measure' && 'Haz clics para medir la distancia'}
                  {routingType === 'multi_target' && 'Toca para añadir objetivos'}
                </Text>
              </View>
            )}

            {(routingType === 'single_target' || routingType === 'ciclovia' || routingType === 'sector' || routingType === 'measure') && draftRoutePoints.length >= (routingType === 'sector' ? 3 : 2) && (
              <TouchableOpacity style={styles.finishButton} onPress={onFinishSingleTarget}>
                <Text style={styles.finishButtonText}>{routingType === 'sector' ? 'Cerrar Polígono' : routingType === 'measure' ? 'Limpiar Medición' : 'Finalizar Trazado'}</Text>
              </TouchableOpacity>
            )}
          </>
        ) : !hideSaveBlock ? (
          <View style={styles.saveContainer}>
            <TextInput
              style={styles.input}
              placeholder={routingType === 'sector' ? "Nombre del sector..." : "Nombre de la ruta..."}
              placeholderTextColor="#9CA3AF"
              value={draftRouteName}
              onChangeText={setDraftRouteName}
              autoFocus
            />
            <TouchableOpacity style={styles.saveButton} onPress={onSave}>
              <Text style={styles.saveButtonText}>{routingType === 'sector' ? "Guardar Sector" : "Guardar Ruta"}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {draftRoutePoints.length > 0 && (
          <ScrollView style={[styles.pointsList, { maxHeight: 120 }]}>
            {draftRoutePoints.map((p, i) => (
              <View key={i} style={styles.pointItem}>
                <View style={[styles.pointDot, { backgroundColor: getPointColor(p.type) }]} />
                <Text style={styles.pointText}>
                  {p.type.toUpperCase()}: {p.latitude.toFixed(4)}, {p.longitude.toFixed(4)}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
};

const getPointColor = (type: string) => {
  switch (type) {
    case 'origin': return '#34D399';
    case 'destination': return '#EF4444';
    case 'target': return '#F59E0B';
    default: return '#9CA3AF';
  }
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 80,
    left: 20,
    right: 20,
    zIndex: 4000,
    alignItems: 'center',
  },
  glassContainer: {
    backgroundColor: 'rgba(11, 15, 25, 0.9)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
    padding: 16,
    width: '100%',
    maxWidth: 320,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 15,
      },
      android: { elevation: 12 },
      web: {
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  title: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  typeSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
    justifyContent: 'space-between',
  },
  typeButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  typeButtonActive: {
    backgroundColor: '#34D399',
  },
  typeButtonDisabled: {
    opacity: 0.3,
  },
  categorySelector: {
    marginBottom: 12,
  },
  categoryScroll: {
    gap: 8,
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  catChipText: {
    color: '#D1D5DB',
    fontSize: 10,
    fontWeight: '700',
  },
  instructionsContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  instructions: {
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  finishButton: {
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    borderWidth: 1,
    borderColor: '#34D399',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  finishButtonText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '800',
  },
  saveContainer: {
    gap: 12,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  saveButton: {
    backgroundColor: '#34D399',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#0B0F19',
    fontSize: 14,
    fontWeight: '900',
  },
  pointsList: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 8,
  },
  pointItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  pointDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pointText: {
    color: '#9CA3AF',
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
