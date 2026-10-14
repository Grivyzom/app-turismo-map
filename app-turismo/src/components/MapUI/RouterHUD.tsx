import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { RouteType, RoutePoint, RouteVisibility } from '../Map/types';
import { TransportMode, formatDistance, formatDuration, OsrmRoute } from '../../utils/osrmService';

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

  // Social Geo-Router Props
  isPartner?: boolean;
  transportMode?: TransportMode;
  setTransportMode?: (mode: TransportMode) => void;
  visibility?: RouteVisibility;
  setVisibility?: (v: RouteVisibility) => void;
  onUndoLastPoint?: () => void;
  onEditRoute?: () => void;
  osrmDistance?: number;
  osrmDuration?: number;
  isCalculatingOsrm?: boolean;
  shareUrl?: string | null;
  onOptimizeOrder?: () => void;
  isOptimizingOrder?: boolean;
  onRecalculate?: () => void;
  routeAlternatives?: OsrmRoute[];
  selectedAlternativeIndex?: number;
  onSelectAlternative?: (index: number) => void;
}

const ROUTE_TYPE_PILLS: Array<{
  id: RouteType;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}> = [
  { id: 'single_target', label: 'Punto a Punto', icon: 'gesture' },
  { id: 'multi_target', label: 'Con Paradas', icon: 'hub' },
  { id: 'ciclovia', label: 'Ciclovía', icon: 'pedal-bike' },
  { id: 'direct', label: 'Directa', icon: 'straighten' },
  { id: 'sector', label: 'Sector / Geovalla', icon: 'format-shapes' },
  { id: 'measure', label: 'Medir', icon: 'square-foot' },
];

const TRANSPORT_MODE_PILLS: Array<{
  id: TransportMode;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}> = [
  { id: 'foot', label: 'A pie', icon: 'directions-walk' },
  { id: 'bike', label: 'Bicicleta', icon: 'pedal-bike' },
  { id: 'car', label: 'En auto', icon: 'directions-car' },
];

const ROUTE_CATEGORIES: Array<{
  id: string;
  label: string;
  color: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}> = [
  { id: 'ciudad', label: 'Ciudad', color: '#F59E0B', icon: 'location-city' },
  { id: 'bosque', label: 'Bosque', color: '#10B981', icon: 'forest' },
  { id: 'turistica', label: 'Turística', color: '#3B82F6', icon: 'place' },
  { id: 'cervecera', label: 'Cervecera', color: '#EA580C', icon: 'sports-bar' },
  { id: 'reto', label: 'Reto', color: '#EF4444', icon: 'fitness-center' },
  { id: 'exploracion', label: 'Exploración', color: '#8B5CF6', icon: 'terrain' },
];

const SECTOR_CATEGORIES: Array<{
  id: string;
  label: string;
  color: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}> = [
  { id: 'ciudad', label: 'Sector Ciudad', color: '#F59E0B', icon: 'location-city' },
  { id: 'bosque', label: 'Reserva / Bosque', color: '#10B981', icon: 'forest' },
  { id: 'edificio', label: 'Edificio / Mall', color: '#6366F1', icon: 'business' },
  { id: 'subzona', label: 'Subzona', color: '#A855F7', icon: 'layers' },
];

const VISIBILITY_OPTIONS: Array<{
  id: RouteVisibility;
  label: string;
  sublabel: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}> = [
  { id: 'private', label: 'Privada', sublabel: 'Solo visible por ti', icon: 'lock' },
  { id: 'unlisted', label: 'Enlace 1 a 1', sublabel: 'Cualquiera con el link', icon: 'link' },
  { id: 'public', label: 'Pública', sublabel: 'Visible para la comunidad', icon: 'public' },
];

export const RouterHUD: React.FC<RouterHUDProps> = ({
  isRoutingActive,
  routingType,
  setRoutingType,
  routeCategory,
  setRouteCategory,
  draftRoutePoints,
  draftRouteName,
  setDraftRouteName,
  isRouteFinished,
  onFinishSingleTarget,
  onSave,
  onCancel,
  hideSaveBlock,
  isPartner = false,
  transportMode = 'foot',
  setTransportMode,
  visibility = 'public',
  setVisibility,
  onUndoLastPoint,
  onEditRoute,
  osrmDistance = 0,
  osrmDuration = 0,
  isCalculatingOsrm = false,
  onOptimizeOrder,
  isOptimizingOrder = false,
  onRecalculate,
  routeAlternatives = [],
  selectedAlternativeIndex = 0,
  onSelectAlternative,
}) => {
  const { width: screenWidth } = useWindowDimensions();
  const isDesktop = screenWidth >= 768;

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
    return R * c;
  };

  const calculateTotalDistance = () => {
    if (draftRoutePoints.length < 2) return 0;
    let dist = 0;
    for (let i = 0; i < draftRoutePoints.length - 1; i++) {
      dist += calculateDistance(
        draftRoutePoints[i].latitude,
        draftRoutePoints[i].longitude,
        draftRoutePoints[i + 1].latitude,
        draftRoutePoints[i + 1].longitude,
      );
    }
    return dist;
  };

  const totalDist = osrmDistance > 0 ? osrmDistance : calculateTotalDistance();
  const minRequiredPoints = routingType === 'sector' ? 3 : 2;
  const canFinish = draftRoutePoints.length >= minRequiredPoints;

  // Manejador para interceptar y detener la propagación de eventos en el modal web
  const handleModalEvent = (e: any) => {
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    if (e && e.nativeEvent) {
      (e.nativeEvent as any)._turismoHandled = true;
    }
  };

  return (
    <View
      style={[styles.container, isDesktop ? styles.containerDesktop : styles.containerMobile]}
      pointerEvents="box-none"
    >
      <View
        style={styles.glassContainer}
        pointerEvents="auto"
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        {...(Platform.OS === 'web'
          ? {
              className: 'router-hud-modal',
              'data-modal': 'true',
              onMouseDown: handleModalEvent,
              onPointerDown: handleModalEvent,
              onTouchStart: handleModalEvent,
              onClick: handleModalEvent,
            }
          : {})}
      >
        {/* Encabezado Principal */}
        <View style={styles.header}>
          <View style={styles.headerIconBox}>
            <MaterialIcons
              name={routingType === 'sector' ? 'format-shapes' : 'route'}
              size={18}
              color="#00E676"
            />
          </View>
          <View style={styles.headerTitleBox}>
            <Text style={styles.title}>
              {routingType === 'sector'
                ? 'TRAZAR GEOVALLA / SECTOR'
                : isPartner
                  ? 'GEO-ROUTER PROFESIONAL'
                  : 'PLANIFICADOR SOCIAL'}
            </Text>
            <Text style={styles.subTitle}>
              {isRouteFinished
                ? 'Paso final: Asignar nombre y guardar'
                : `${draftRoutePoints.length} ${
                    draftRoutePoints.length === 1 ? 'punto marcado' : 'puntos marcados'
                  }`}
            </Text>
          </View>

          <TouchableOpacity
            onPress={onCancel}
            style={styles.closeButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <MaterialIcons name="close" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Contenido Desplazable */}
        <ScrollView
          style={[styles.scrollArea, { maxHeight: isDesktop ? 540 : 420 }]}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {!isRouteFinished ? (
            <>
              {/* Selector de Tipo de Ruta en Button Pillows (Colapsados = solo icono; Activo = icono + texto) */}
              <View style={styles.pillControlGroup}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.pillContainer}
                >
                  {ROUTE_TYPE_PILLS.map((pill) => {
                    const isActive = routingType === pill.id;
                    return (
                      <TouchableOpacity
                        key={pill.id}
                        style={[
                          styles.pillowButton,
                          isActive ? styles.pillowButtonActive : styles.pillowButtonCollapsed,
                        ]}
                        onPress={() => setRoutingType(pill.id)}
                        activeOpacity={0.8}
                      >
                        <MaterialIcons
                          name={pill.icon}
                          size={16}
                          color={isActive ? '#0B0F19' : '#9CA3AF'}
                        />
                        {isActive && (
                          <Text style={styles.pillowTextActive} numberOfLines={1}>
                            {pill.label}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Selector de Modo de Transporte en Button Pillows si no es geovalla/medición */}
              {routingType !== 'sector' &&
                routingType !== 'measure' &&
                routingType !== 'direct' &&
                setTransportMode && (
                  <View style={styles.pillControlGroup}>
                    <View style={styles.transportPillRow}>
                      {TRANSPORT_MODE_PILLS.map((pill) => {
                        const isActive = transportMode === pill.id;
                        return (
                          <TouchableOpacity
                            key={pill.id}
                            style={[
                              styles.pillowButton,
                              isActive ? styles.pillowButtonActive : styles.pillowButtonCollapsed,
                            ]}
                            onPress={() => setTransportMode(pill.id)}
                            activeOpacity={0.8}
                          >
                            <MaterialIcons
                              name={pill.icon}
                              size={16}
                              color={isActive ? '#0B0F19' : '#9CA3AF'}
                            />
                            {isActive && (
                              <Text style={styles.pillowTextActive} numberOfLines={1}>
                                {pill.label}
                              </Text>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

              {/* Selector de Categorías en Button Pillows */}
              <View style={styles.pillControlGroup}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.pillContainer}
                >
                  {(routingType === 'sector' ? SECTOR_CATEGORIES : ROUTE_CATEGORIES).map((cat) => {
                    const isSelected = routeCategory === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[
                          styles.pillowButton,
                          isSelected
                            ? [
                                styles.pillowButtonActive,
                                { backgroundColor: cat.color, borderColor: cat.color },
                              ]
                            : styles.pillowButtonCollapsed,
                        ]}
                        onPress={() => setRouteCategory(cat.id)}
                        activeOpacity={0.8}
                      >
                        <MaterialIcons
                          name={cat.icon}
                          size={16}
                          color={isSelected ? '#0B0F19' : cat.color}
                        />
                        {isSelected && (
                          <Text style={styles.pillowTextActive} numberOfLines={1}>
                            {cat.label}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Métricas OSRM / Procedurales */}
              {totalDist > 0 && (
                <View style={styles.liveMetrics}>
                  <MaterialIcons name="alt-route" size={14} color="#00E676" />
                  <Text style={styles.liveMetricText}>
                    {formatDistance(totalDist)}
                    {osrmDuration > 0 ? ` · ~${formatDuration(osrmDuration)}` : ''}
                  </Text>
                  {isCalculatingOsrm ? (
                    <Text style={styles.osrmCalculatingText}>calculando vía...</Text>
                  ) : onRecalculate && draftRoutePoints.length >= 2 && routingType !== 'sector' && routingType !== 'measure' ? (
                    <TouchableOpacity
                      style={styles.metricRecalcBtn}
                      onPress={onRecalculate}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons name="refresh" size={13} color="#00E676" />
                      <Text style={styles.metricRecalcText}>Recalcular</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}

              {/* Selector de Alternativas Inteligentes de Ruta */}
              {routeAlternatives.length > 0 && onSelectAlternative && (
                <View style={styles.alternativesBox}>
                  <View style={styles.alternativesHeader}>
                    <MaterialIcons name="alt-route" size={12} color="#38BDF8" />
                    <Text style={styles.alternativesTitle}>Alternativas de ruta:</Text>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.alternativesList}
                  >
                    <TouchableOpacity
                      style={[
                        styles.altChip,
                        selectedAlternativeIndex === 0 && styles.altChipActive,
                      ]}
                      onPress={() => onSelectAlternative(0)}
                      activeOpacity={0.8}
                    >
                      <MaterialIcons
                        name="stars"
                        size={12}
                        color={selectedAlternativeIndex === 0 ? '#0B0F19' : '#00E676'}
                      />
                      <Text
                        style={[
                          styles.altChipText,
                          selectedAlternativeIndex === 0 && styles.altChipTextActive,
                        ]}
                      >
                        Recomendada
                      </Text>
                    </TouchableOpacity>

                    {routeAlternatives.map((alt, idx) => {
                      const isSelected = selectedAlternativeIndex === idx + 1;
                      return (
                        <TouchableOpacity
                          key={idx}
                          style={[styles.altChip, isSelected && styles.altChipActive]}
                          onPress={() => onSelectAlternative(idx + 1)}
                          activeOpacity={0.8}
                        >
                          <MaterialIcons
                            name="route"
                            size={12}
                            color={isSelected ? '#0B0F19' : '#9CA3AF'}
                          />
                          <Text
                            style={[
                              styles.altChipText,
                              isSelected && styles.altChipTextActive,
                            ]}
                          >
                            {alt.label || `Alt ${idx + 1}`} ({formatDistance(alt.distance)})
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* Instrucciones Claras de Guía */}
              <View style={styles.instructionsContainer}>
                <MaterialIcons
                  name="info-outline"
                  size={14}
                  color="#9CA3AF"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.instructions}>
                  {draftRoutePoints.length === 0 && 'Toca el mapa para colocar el Punto de Origen (A)'}
                  {draftRoutePoints.length === 1 &&
                    'Toca el siguiente punto en el mapa para trazar el camino'}
                  {draftRoutePoints.length >= 2 &&
                    'Sigue añadiendo paradas o presiona "Finalizar y Guardar"'}
                </Text>
              </View>

              {/* Barra de Acciones (Deshacer, Recalcular, Optimizar y Finalizar) */}
              <View style={styles.actionRow}>
                {draftRoutePoints.length > 0 && onUndoLastPoint && (
                  <TouchableOpacity
                    style={styles.undoBtn}
                    onPress={onUndoLastPoint}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="undo" size={16} color="#D1D5DB" />
                    <Text style={styles.undoBtnText}>Deshacer</Text>
                  </TouchableOpacity>
                )}

                {draftRoutePoints.length >= 2 &&
                  routingType !== 'sector' &&
                  routingType !== 'measure' &&
                  onRecalculate && (
                  <TouchableOpacity
                    style={[styles.recalcBtn, isCalculatingOsrm && { opacity: 0.6 }]}
                    onPress={onRecalculate}
                    disabled={isCalculatingOsrm}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons
                      name={isCalculatingOsrm ? 'sync' : 'refresh'}
                      size={15}
                      color="#00E676"
                    />
                    <Text style={styles.recalcBtnText}>
                      {isCalculatingOsrm ? 'Calculando...' : 'Recalcular'}
                    </Text>
                  </TouchableOpacity>
                )}

                {draftRoutePoints.length >= 3 &&
                  routingType === 'multi_target' &&
                  onOptimizeOrder && (
                    <TouchableOpacity
                      style={[styles.optimizeBtn, isOptimizingOrder && { opacity: 0.6 }]}
                      onPress={onOptimizeOrder}
                      disabled={isOptimizingOrder}
                      activeOpacity={0.8}
                    >
                      <MaterialIcons
                        name={isOptimizingOrder ? 'sync' : 'auto-fix-high'}
                        size={15}
                        color="#38BDF8"
                      />
                      <Text style={styles.optimizeBtnText}>
                        {isOptimizingOrder ? 'Optimizando...' : 'Optimizar'}
                      </Text>
                    </TouchableOpacity>
                  )}

                {canFinish && (
                  <TouchableOpacity
                    style={styles.finishButton}
                    onPress={onFinishSingleTarget}
                    activeOpacity={0.85}
                  >
                    <MaterialIcons name="check-circle" size={18} color="#0B0F19" />
                    <Text style={styles.finishButtonText}>Finalizar y Guardar</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          ) : !hideSaveBlock ? (
            /* Pantalla de Guardado y Configuración de Privacidad */
            <View style={styles.saveContainer}>
              <View style={styles.saveSummaryCard}>
                <MaterialIcons name="verified" size={20} color="#00E676" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.saveSummaryTitle}>
                    {routingType === 'sector' ? 'Sector Trazado' : 'Ruta Trazada Exitosamente'}
                  </Text>
                  <Text style={styles.saveSummarySub}>
                    {draftRoutePoints.length} paradas · {formatDistance(totalDist)}
                    {osrmDuration > 0 ? ` · ~${formatDuration(osrmDuration)}` : ''}
                  </Text>
                </View>
              </View>

              {/* Nombre de la Ruta */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  {routingType === 'sector' ? 'Nombre del sector:' : 'Nombre de tu ruta:'}
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    Platform.OS === 'web' && ({ outlineStyle: 'none' } as any),
                  ]}
                  placeholder={
                    routingType === 'sector'
                      ? 'Ej. Costanera Centro, Mall Plaza...'
                      : 'Ej. Paseo Fluvial con Amigos...'
                  }
                  placeholderTextColor="#9CA3AF"
                  value={draftRouteName}
                  onChangeText={setDraftRouteName}
                  selectionColor="#00E676"
                  autoFocus
                />
              </View>

              {/* Selector de Categorías en guardado */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Categoría:</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.pillContainer}
                >
                  {(routingType === 'sector' ? SECTOR_CATEGORIES : ROUTE_CATEGORIES).map((cat) => {
                    const isSelected = routeCategory === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[
                          styles.pillowButton,
                          isSelected
                            ? [
                                styles.pillowButtonActive,
                                { backgroundColor: cat.color, borderColor: cat.color },
                              ]
                            : styles.pillowButtonCollapsed,
                        ]}
                        onPress={() => setRouteCategory(cat.id)}
                        activeOpacity={0.8}
                      >
                        <MaterialIcons
                          name={cat.icon}
                          size={16}
                          color={isSelected ? '#0B0F19' : cat.color}
                        />
                        {isSelected && (
                          <Text style={styles.pillowTextActive} numberOfLines={1}>
                            {cat.label}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Selector de Privacidad Social */}
              {routingType !== 'sector' && setVisibility && (
                <View style={styles.visibilityBox}>
                  <Text style={styles.inputLabel}>¿Quién puede ver esta ruta?</Text>
                  <View style={styles.visibilityRow}>
                    {VISIBILITY_OPTIONS.map((opt) => {
                      const isSelected = visibility === opt.id;
                      return (
                        <TouchableOpacity
                          key={opt.id}
                          style={[
                            styles.visibilityCard,
                            isSelected && styles.visibilityCardActive,
                          ]}
                          onPress={() => setVisibility(opt.id)}
                          activeOpacity={0.8}
                        >
                          <MaterialIcons
                            name={opt.icon}
                            size={18}
                            color={isSelected ? '#00E676' : '#9CA3AF'}
                          />
                          <Text
                            style={[
                              styles.visibilityTitle,
                              isSelected && styles.visibilityTitleActive,
                            ]}
                          >
                            {opt.label}
                          </Text>
                          <Text style={styles.visibilitySub} numberOfLines={1}>
                            {opt.sublabel}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Botón Principal de Guardar */}
              <TouchableOpacity
                style={styles.saveButton}
                onPress={onSave}
                activeOpacity={0.85}
              >
                <MaterialIcons name="cloud-upload" size={18} color="#0B0F19" />
                <Text style={styles.saveButtonText}>
                  {routingType === 'sector' ? 'Guardar Sector' : 'Guardar y Publicar Ruta'}
                </Text>
              </TouchableOpacity>

              {/* Botón para volver a editar/agregar paradas */}
              {onEditRoute && (
                <TouchableOpacity
                  style={styles.backEditButton}
                  onPress={onEditRoute}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="arrow-back" size={15} color="#9CA3AF" />
                  <Text style={styles.backEditButtonText}>Seguir agregando paradas</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          {/* Lista de Paradas / Waypoints */}
          {draftRoutePoints.length > 0 && (
            <View style={styles.pointsListContainer}>
              <View style={styles.pointsListHeader}>
                <Text style={styles.pointsListTitle}>Hitos de la ruta</Text>
                <Text style={styles.pointsListCount}>{draftRoutePoints.length}</Text>
              </View>

              <ScrollView
                style={styles.pointsScroll}
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={true}
              >
                {draftRoutePoints.map((p, i) => {
                  const isFirst = i === 0;
                  const isLast = i === draftRoutePoints.length - 1 && draftRoutePoints.length > 1;
                  const badgeLabel = isFirst ? 'A' : isLast ? 'B' : `${i}`;
                  const badgeColor = isFirst ? '#00E676' : isLast ? '#EF4444' : '#F59E0B';

                  return (
                    <View key={i} style={styles.pointItem}>
                      <View style={[styles.pointBadge, { backgroundColor: badgeColor }]}>
                        <Text style={styles.pointBadgeText}>{badgeLabel}</Text>
                      </View>
                      <View style={styles.pointDetails}>
                        <View style={styles.pointNameRow}>
                          {p.name ? (
                            <MaterialIcons
                              name={
                                p.category === 'cervecera' || p.category?.toLowerCase().includes('cervez')
                                  ? 'sports-bar'
                                  : p.category === 'restaurant' || p.category === 'comida'
                                    ? 'restaurant'
                                    : p.category === 'cafeteria' || p.category?.toLowerCase().includes('cafe')
                                      ? 'local-cafe'
                                      : 'storefront'
                              }
                              size={14}
                              color="#00E676"
                              style={{ marginRight: 4 }}
                            />
                          ) : null}
                          <Text
                            style={[styles.pointName, p.name ? styles.pointNameStore : null]}
                            numberOfLines={1}
                          >
                            {p.name
                              ? p.name
                              : isFirst
                                ? 'Punto de Inicio'
                                : isLast
                                  ? 'Destino Final'
                                  : `Parada #${i}`}
                          </Text>
                        </View>
                        <Text style={styles.pointCoords}>
                          {p.category ? `${p.category.toUpperCase()} · ` : ''}
                          {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 4000,
  },
  containerDesktop: {
    top: 84,
    left: 24,
    width: 380,
    maxWidth: 380,
  },
  containerMobile: {
    top: 76,
    left: 16,
    right: 16,
    maxWidth: 420,
    alignSelf: 'center',
  },
  glassContainer: {
    backgroundColor: 'rgba(11, 15, 25, 0.94)',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    padding: 16,
    width: '100%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 18,
      },
      android: { elevation: 14 },
      web: {
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.65), 0 0 16px rgba(0, 230, 118, 0.15)',
      } as any,
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  headerIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 230, 118, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.25)',
  },
  headerTitleBox: {
    flex: 1,
  },
  title: {
    color: '#00E676',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  subTitle: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 1,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
    }),
  },
  scrollArea: {
    width: '100%',
  },
  scrollContent: {
    gap: 12,
    paddingBottom: 4,
  },
  pillControlGroup: {
    gap: 6,
  },
  pillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
    paddingHorizontal: 1,
  },
  transportPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pillowButton: {
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
      } as any,
    }),
  },
  pillowButtonCollapsed: {
    width: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  pillowButtonActive: {
    paddingHorizontal: 12,
    backgroundColor: '#00E676',
    flexDirection: 'row',
    gap: 6,
    borderWidth: 1,
    borderColor: '#00E676',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 10px rgba(0, 230, 118, 0.35)',
      } as any,
      ios: {
        shadowColor: '#00E676',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  pillowButtonDisabled: {
    opacity: 0.3,
  },
  pillowTextActive: {
    color: '#0B0F19',
    fontSize: 12,
    fontWeight: '800',
  },

  liveMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 230, 118, 0.1)',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.2)',
    gap: 6,
  },
  liveMetricText: {
    color: '#00E676',
    fontSize: 13,
    fontWeight: '800',
  },
  metricRecalcBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 230, 118, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.3)',
    gap: 4,
    marginLeft: 6,
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
    }),
  },
  metricRecalcText: {
    color: '#00E676',
    fontSize: 11,
    fontWeight: '700',
  },
  osrmCalculatingText: {
    color: '#9CA3AF',
    fontSize: 11,
    fontStyle: 'italic',
  },
  alternativesBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
    gap: 6,
  },
  alternativesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  alternativesTitle: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  alternativesList: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  altChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
    }),
  },
  altChipActive: {
    backgroundColor: '#00E676',
    borderColor: '#00E676',
  },
  altChipText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
  },
  altChipTextActive: {
    color: '#0B0F19',
    fontWeight: '800',
  },
  optimizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    gap: 5,
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
    }),
  },
  optimizeBtnText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
  },
  instructionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  instructions: {
    color: '#D1D5DB',
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
    lineHeight: 16,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  undoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    gap: 6,
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
    }),
  },
  undoBtnText: {
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '700',
  },
  recalcBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 230, 118, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.35)',
    gap: 5,
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
    }),
  },
  recalcBtnText: {
    color: '#00E676',
    fontSize: 12,
    fontWeight: '700',
  },
  finishButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#00E676',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        boxShadow: '0 4px 14px rgba(0, 230, 118, 0.35)',
      } as any,
    }),
  },
  finishButtonText: {
    color: '#0B0F19',
    fontSize: 13,
    fontWeight: '900',
  },
  saveContainer: {
    gap: 12,
  },
  saveSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 230, 118, 0.1)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.25)',
    gap: 10,
  },
  saveSummaryTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  saveSummarySub: {
    color: '#00E676',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  visibilityBox: {
    gap: 6,
  },
  visibilityRow: {
    flexDirection: 'row',
    gap: 6,
  },
  visibilityCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
    }),
  },
  visibilityCardActive: {
    backgroundColor: 'rgba(0, 230, 118, 0.14)',
    borderColor: '#00E676',
  },
  visibilityTitle: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 4,
    textAlign: 'center',
  },
  visibilityTitleActive: {
    color: '#00E676',
  },
  visibilitySub: {
    color: '#6B7280',
    fontSize: 8,
    marginTop: 1,
    textAlign: 'center',
  },
  saveButton: {
    flexDirection: 'row',
    backgroundColor: '#00E676',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        boxShadow: '0 4px 16px rgba(0, 230, 118, 0.4)',
      } as any,
    }),
  },
  saveButtonText: {
    color: '#0B0F19',
    fontSize: 13,
    fontWeight: '900',
  },
  backEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 6,
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
    }),
  },
  backEditButtonText: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '600',
  },
  pointsListContainer: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: 8,
  },
  pointsListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  pointsListTitle: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  pointsListCount: {
    color: '#00E676',
    fontSize: 10,
    fontWeight: '800',
    backgroundColor: 'rgba(0, 230, 118, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pointsScroll: {
    maxHeight: 110,
  },
  pointItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  pointBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointBadgeText: {
    color: '#0B0F19',
    fontSize: 10,
    fontWeight: '900',
  },
  pointDetails: {
    flex: 1,
  },
  pointName: {
    color: '#E5E7EB',
    fontSize: 11,
    fontWeight: '600',
  },
  pointCoords: {
    color: '#6B7280',
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  pointNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pointNameStore: {
    color: '#00E676',
    fontWeight: '700',
  },
});
