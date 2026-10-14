import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Animated,
  Easing,
  Platform,
  Modal,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryFilter, MAP_LAYER_OPTIONS } from '../../data/mockEvents';
import { MapLayer } from '../Map/types';

export interface ToolsFilterPanelProps {
  visible: boolean;
  onClose: () => void;
  anchor: { top: number; left: number };
  isDesktop: boolean;
  selectedCategories?: CategoryFilter[];
  onSelectCategories?: (categories: CategoryFilter[]) => void;
  selectedCategory?: CategoryFilter;
  onSelectCategory?: (category: CategoryFilter) => void;
  showNearbyEvents: boolean;
  onToggleNearbyEvents: () => void;
  showTraffic: boolean;
  onToggleTraffic: () => void;
  showCycleways: boolean;
  onToggleCycleways: () => void;
  showSectors: boolean;
  onOpenSectors: () => void;
  cameraAnimationsEnabled: boolean;
  onToggleCameraAnimations: () => void;
  showSecurityCameras?: boolean;
  onToggleSecurityCameras?: () => void;
  isRoutingAvailable?: boolean;
  isPartner?: boolean;
  isRoutingActive?: boolean;
  onToggleRouting?: () => void;
  mapLayer: MapLayer;
  onSelectMapLayer: (layer: MapLayer) => void;
  mapLayerReady: boolean;
}

// ─── Design Tokens (Selva Glass HUD) ──────────────────────────────────────────
const C = {
  bgGlass: 'rgba(9, 15, 14, 0.95)',
  borderTop: 'rgba(255, 255, 255, 0.18)',
  borderBottom: 'rgba(255, 255, 255, 0.04)',
  borderSide: 'rgba(255, 255, 255, 0.08)',
  textPrimary: '#F8FAFC',
  textSecondary: '#CBD5E0',
  textMuted: '#94A3B8',
  divider: 'rgba(255, 255, 255, 0.06)',
  accent: '#34D399',
  accentSubtle: 'rgba(52, 211, 153, 0.18)',
  accentBorder: 'rgba(52, 211, 153, 0.45)',
  danger: '#EF4444',
  dangerSubtle: 'rgba(239, 68, 68, 0.18)',
  dangerBorder: 'rgba(239, 68, 68, 0.45)',
  pillowBg: 'rgba(255, 255, 255, 0.045)',
  pillowBorder: 'rgba(255, 255, 255, 0.075)',
  segmentedBg: 'rgba(0, 0, 0, 0.4)',
  segmentedBorder: 'rgba(255, 255, 255, 0.06)',
};

// ─── 9 Core Categories with Distinctive Colors and SVG Paths ─────────────────
interface CategoryConfig {
  id: CategoryFilter;
  label: string;
  color: string;
  svgPath: string;
}

const CORE_CATEGORIES: CategoryConfig[] = [
  {
    id: 'gastronomia',
    label: 'Gastro',
    color: '#F59E0B', // Ámbar cálido
    svgPath:
      'M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm4-3v7h3v10h2V2h-5c0 2.21 1.79 4 4 4z',
  },
  {
    id: 'cultura',
    label: 'Cultura',
    color: '#A78BFA', // Lavanda / Púrpura suave
    svgPath:
      'M4 10v7h3v-7H4zm6 0v7h3v-7h-3zM2 22h20v-3H2v3zm14-12v7h3v-7h-3zm-4-7L2 9v1h20V9L12 3z',
  },
  {
    id: 'naturaleza',
    label: 'Naturaleza',
    color: '#10B981', // Verde esmeralda
    svgPath: 'M17 12h2L12 2 5 12h2v7H5v2h14v-2h-2v-7zm-5-7.8L16.2 11H7.8L12 4.2zM9 14h6v5H9v-5z',
  },
  {
    id: 'musica',
    label: 'Música',
    color: '#F43F5E', // Rosa neón / Fucsia
    svgPath:
      'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z',
  },
  {
    id: 'deportes',
    label: 'Deportes',
    color: '#06B6D4', // Cian eléctrico
    svgPath:
      'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-13c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5z',
  },
  {
    id: 'publico',
    label: 'Público',
    color: '#FBBF24', // Dorado ámbar
    svgPath:
      'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
  },
  {
    id: 'emergencia',
    label: 'Emergencia',
    color: '#EF4444', // Rojo advertencia
    svgPath: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
  },
  {
    id: 'embarcacion',
    label: 'Náutica',
    color: '#38BDF8', // Azul celeste río
    svgPath:
      'M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.34-.42-.6-.47L20 11.06V7c0-.55-.45-1-1-1h-5V3c0-.55-.45-1-1-1h-2c-.55 0-1 .45-1 1v3H5c-.55 0-1 .45-1 1v4.06l-1.28.26c-.26.05-.48.23-.6.47s-.14.52-.06.78L3.95 19zM6 8h12v2.47l-6-1.2-6 1.2V8z',
  },
  {
    id: 'tienda',
    label: 'Comercio',
    color: '#C084FC', // Violeta brillante
    svgPath:
      'M20 4H4v2h16V4zm1 10v-2l-1-5H4l-1 5v2c0 .83.67 1.5 1.5 1.5h13c.83 0 1.5-.67 1.5-1.5zm-14 3h10v4H7v-4z',
  },
];

// ─── Sub-Component: Animated Category Pill Button ────────────────────────────
interface AnimatedCategoryPillProps {
  cat: CategoryConfig;
  isActive: boolean;
  onToggle: () => void;
}

const AnimatedCategoryPill: React.FC<AnimatedCategoryPillProps> = ({ cat, isActive, onToggle }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Subtle breathing pulse on the SVG icon when active
  useEffect(() => {
    if (isActive) {
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 850,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 850,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]),
      );
      pulseLoop.start();
      return () => pulseLoop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isActive, pulseAnim]);

  const handlePress = useCallback(() => {
    // Tactile SVG bounce & micro-tilt
    scaleAnim.setValue(0.85);
    rotateAnim.setValue(isActive ? -1 : 1);
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 3,
        tension: 40,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(rotateAnim, {
        toValue: 0,
        friction: 4,
        tension: 30,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();

    onToggle();
  }, [isActive, onToggle, scaleAnim, rotateAnim]);

  const rotate = rotateAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-12deg', '0deg', '12deg'],
  });

  return (
    <TouchableOpacity
      style={[
        styles.categoryPill,
        isActive && {
          backgroundColor: `${cat.color}22`,
          borderColor: cat.color,
          borderWidth: 1,
          ...Platform.select({
            web: {
              boxShadow: `0 2px 10px ${cat.color}35`,
            } as any,
          }),
        },
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isActive }}
      accessibilityLabel={`Categoría ${cat.label}`}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }, { rotate }] }}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <Svg viewBox="0 0 24 24" width={13} height={13}>
            <Path d={cat.svgPath} fill={isActive ? cat.color : `${cat.color}90`} />
          </Svg>
        </Animated.View>
      </Animated.View>
      <Text
        numberOfLines={1}
        style={[styles.categoryPillText, isActive && { color: '#FFFFFF', fontWeight: '700' }]}
      >
        {cat.label}
      </Text>
    </TouchableOpacity>
  );
};

export const ToolsFilterPanel: React.FC<ToolsFilterPanelProps> = ({
  visible,
  onClose,
  anchor,
  isDesktop,
  selectedCategories,
  onSelectCategories,
  selectedCategory,
  onSelectCategory,
  showNearbyEvents,
  onToggleNearbyEvents,
  showTraffic,
  onToggleTraffic,
  showCycleways,
  onToggleCycleways,
  showSectors,
  onOpenSectors,
  cameraAnimationsEnabled,
  onToggleCameraAnimations,
  showSecurityCameras = false,
  onToggleSecurityCameras,
  isRoutingAvailable = true,
  isPartner = false,
  isRoutingActive = false,
  onToggleRouting,
  mapLayer,
  onSelectMapLayer,
  mapLayerReady,
}) => {
  const insets = useSafeAreaInsets();
  const [isRendered, setIsRendered] = useState(visible);
  const animValue = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const isClosingRef = useRef(false);

  const runEnter = useCallback(() => {
    isClosingRef.current = false;
    setIsRendered(true);
    animValue.setValue(0);
    Animated.timing(animValue, {
      toValue: 1,
      duration: 220,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [animValue]);

  const runExit = useCallback(
    (onComplete?: () => void) => {
      if (isClosingRef.current) return;
      isClosingRef.current = true;
      Animated.timing(animValue, {
        toValue: 0,
        duration: 160,
        easing: Easing.bezier(0.4, 0, 1, 1),
        useNativeDriver: Platform.OS !== 'web',
      }).start(({ finished }) => {
        if (finished) {
          setIsRendered(false);
          isClosingRef.current = false;
          onComplete?.();
        }
      });
    },
    [animValue],
  );

  useEffect(() => {
    if (visible) {
      runEnter();
    } else if (isRendered) {
      runExit();
    }
  }, [visible, runEnter, runExit, isRendered]);

  const handleDismiss = useCallback(() => {
    runExit(() => {
      onClose();
    });
  }, [runExit, onClose]);

  // ── Multi-select categories state resolution ──
  const activeCategories = useMemo(() => {
    if (selectedCategories && selectedCategories.length > 0) {
      return selectedCategories;
    }
    if (selectedCategory) {
      return [selectedCategory];
    }
    return ['todos' as CategoryFilter];
  }, [selectedCategories, selectedCategory]);

  const isAllSelected = activeCategories.includes('todos') || activeCategories.length === 0;
  const isNoneSelected = activeCategories.includes('ninguno');

  const handleSelectAll = useCallback(() => {
    if (onSelectCategories) {
      onSelectCategories(['todos']);
    } else if (onSelectCategory) {
      onSelectCategory('todos');
    }
  }, [onSelectCategories, onSelectCategory]);

  const handleSelectNone = useCallback(() => {
    if (onSelectCategories) {
      onSelectCategories(['ninguno']);
    } else if (onSelectCategory) {
      onSelectCategory('ninguno');
    }
  }, [onSelectCategories, onSelectCategory]);

  const handleToggleCategory = useCallback(
    (catId: CategoryFilter) => {
      let nextCategories: CategoryFilter[];

      if (isAllSelected || isNoneSelected) {
        // From "Todos" or "Ninguno", clicking a category initiates single-focused multi-select
        nextCategories = [catId];
      } else if (activeCategories.includes(catId)) {
        // Toggle off category
        const filtered = activeCategories.filter((c) => c !== catId);
        // If all removed, reset to 'todos'
        nextCategories = filtered.length === 0 ? ['todos'] : filtered;
      } else {
        // Add category to selection
        nextCategories = [
          ...activeCategories.filter((c) => c !== 'todos' && c !== 'ninguno'),
          catId,
        ];
      }

      if (onSelectCategories) {
        onSelectCategories(nextCategories);
      } else if (onSelectCategory) {
        onSelectCategory(
          nextCategories.length === 1 ? nextCategories[0] : nextCategories[0] || 'todos',
        );
      }
    },
    [activeCategories, isAllSelected, isNoneSelected, onSelectCategories, onSelectCategory],
  );

  // Requirement 2: Actions that open other modals / panels close this tools dropdown
  const handleToggleNearbyEvents = useCallback(() => {
    const willOpen = !showNearbyEvents;
    onToggleNearbyEvents();
    if (willOpen) {
      handleDismiss();
    }
  }, [showNearbyEvents, onToggleNearbyEvents, handleDismiss]);

  const handleOpenSectors = useCallback(() => {
    handleDismiss();
    onOpenSectors();
  }, [handleDismiss, onOpenSectors]);

  const handleToggleRouting = useCallback(() => {
    handleDismiss();
    onToggleRouting?.();
  }, [handleDismiss, onToggleRouting]);

  // Compute active items count for quick glance badge
  const activeCount = useMemo(() => {
    let count = 0;
    if (!isAllSelected && !isNoneSelected) {
      count += activeCategories.length;
    } else if (isNoneSelected) {
      count += 1;
    }
    if (showNearbyEvents) count++;
    if (showTraffic) count++;
    if (showCycleways) count++;
    if (showSectors) count++;
    if (cameraAnimationsEnabled) count++;
    if (isRoutingActive) count++;
    return count;
  }, [
    isAllSelected,
    isNoneSelected,
    activeCategories,
    showNearbyEvents,
    showTraffic,
    showCycleways,
    showSectors,
    cameraAnimationsEnabled,
    isRoutingActive,
  ]);

  if (!isRendered && Platform.OS !== 'web') return null;

  return (
    <Modal visible={isRendered} transparent animationType="none" onRequestClose={handleDismiss}>
      <View style={styles.overlay}>
        {/* Backdrop Tap to dismiss */}
        <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss}>
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: animValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1],
                }),
              },
            ]}
          />
        </Pressable>

        {/* Panel Container */}
        <View
          style={[
            styles.containerAligner,
            isDesktop
              ? {
                  top: anchor.top,
                  left: anchor.left,
                }
              : {
                  left: 0,
                  right: 0,
                  bottom: 0,
                  width: '100%',
                },
          ]}
          pointerEvents="box-none"
        >
          <Animated.View
            style={[
              styles.panel,
              isDesktop
                ? styles.panelDesktop
                : [styles.panelMobile, { paddingBottom: Math.max(insets.bottom, 16) }],
              {
                opacity: animValue,
                transform: isDesktop
                  ? [
                      {
                        scale: animValue.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.94, 1],
                        }),
                      },
                      {
                        translateY: animValue.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-10, 0],
                        }),
                      },
                    ]
                  : [
                      {
                        translateY: animValue.interpolate({
                          inputRange: [0, 1],
                          outputRange: [180, 0],
                        }),
                      },
                    ],
              },
              isDesktop &&
                Platform.select({
                  web: {
                    transformOrigin: 'top left',
                  } as any,
                }),
            ]}
          >
            {/* Sheet Handle on Mobile */}
            {!isDesktop && (
              <View style={styles.handleContainer}>
                <View style={styles.handleBar} />
              </View>
            )}

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTitleGroup}>
                <View style={styles.headerIconBadge}>
                  <MaterialIcons name="tune" size={15} color={C.accent} />
                </View>
                <Text style={styles.headerTitle}>Herramientas</Text>
                {activeCount > 0 && (
                  <View style={styles.activeCounterBadge}>
                    <Text style={styles.activeCounterText}>{activeCount}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                onPress={handleDismiss}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Cerrar panel de herramientas"
              >
                <Ionicons name="close" size={16} color={C.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Scrollable Content */}
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {/* ─── 1. PRESETS SEGMENTED PILLOW ─── */}
              <View style={styles.segmentedContainer}>
                <TouchableOpacity
                  style={[styles.segmentButton, isAllSelected && styles.segmentButtonActiveAll]}
                  onPress={handleSelectAll}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="apps"
                    size={14}
                    color={isAllSelected ? C.accent : C.textSecondary}
                  />
                  <Text style={[styles.segmentText, isAllSelected && styles.segmentTextActiveAll]}>
                    Mostrar Todos
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.segmentButton, isNoneSelected && styles.segmentButtonActiveNone]}
                  onPress={handleSelectNone}
                  activeOpacity={0.7}
                >
                  <MaterialIcons
                    name="visibility-off"
                    size={15}
                    color={isNoneSelected ? C.danger : C.textSecondary}
                  />
                  <Text
                    style={[styles.segmentText, isNoneSelected && styles.segmentTextActiveNone]}
                  >
                    Ocultar Pines
                  </Text>
                </TouchableOpacity>
              </View>

              {/* ─── 2. CATEGORÍAS (MULTI-SELECT PILLOW GRID CON SVG ANIMADO) ─── */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  Categorías{' '}
                  {!isAllSelected && !isNoneSelected ? `(${activeCategories.length})` : ''}
                </Text>
                {!isAllSelected && (
                  <TouchableOpacity
                    onPress={handleSelectAll}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  >
                    <Text style={styles.resetLink}>Mostrar todos</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.pillGrid3}>
                {CORE_CATEGORIES.map((cat) => {
                  const isActive =
                    !isNoneSelected && !isAllSelected && activeCategories.includes(cat.id);

                  return (
                    <AnimatedCategoryPill
                      key={cat.id}
                      cat={cat}
                      isActive={isActive}
                      onToggle={() => handleToggleCategory(cat.id)}
                    />
                  );
                })}
              </View>

              {/* ─── 3. HERRAMIENTAS EN VIVO (2-COL TOGGLE PILLOWS) ─── */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Herramientas de Mapa</Text>
              </View>

              <View style={styles.pillGrid2}>
                {/* Eventos (Al abrir modal cierra dropdown) */}
                <TouchableOpacity
                  style={[styles.toolPill, showNearbyEvents && styles.toolPillActive]}
                  onPress={handleToggleNearbyEvents}
                  activeOpacity={0.7}
                >
                  <View style={styles.toolPillLeft}>
                    <MaterialIcons
                      name="calendar-today"
                      size={14}
                      color={showNearbyEvents ? C.accent : C.textMuted}
                    />
                    <Text
                      style={[styles.toolPillText, showNearbyEvents && styles.toolPillTextActive]}
                    >
                      Eventos
                    </Text>
                  </View>
                  <View style={[styles.ledDot, showNearbyEvents && styles.ledDotActive]} />
                </TouchableOpacity>

                {/* Tráfico */}
                <TouchableOpacity
                  style={[styles.toolPill, showTraffic && styles.toolPillActive]}
                  onPress={onToggleTraffic}
                  activeOpacity={0.7}
                >
                  <View style={styles.toolPillLeft}>
                    <MaterialIcons
                      name="traffic"
                      size={15}
                      color={showTraffic ? C.accent : C.textMuted}
                    />
                    <Text style={[styles.toolPillText, showTraffic && styles.toolPillTextActive]}>
                      Tráfico
                    </Text>
                  </View>
                  <View style={[styles.ledDot, showTraffic && styles.ledDotActive]} />
                </TouchableOpacity>

                {/* Ciclovías */}
                <TouchableOpacity
                  style={[styles.toolPill, showCycleways && styles.toolPillActive]}
                  onPress={onToggleCycleways}
                  activeOpacity={0.7}
                >
                  <View style={styles.toolPillLeft}>
                    <MaterialIcons
                      name="directions-bike"
                      size={15}
                      color={showCycleways ? C.accent : C.textMuted}
                    />
                    <Text style={[styles.toolPillText, showCycleways && styles.toolPillTextActive]}>
                      Ciclovías
                    </Text>
                  </View>
                  <View style={[styles.ledDot, showCycleways && styles.ledDotActive]} />
                </TouchableOpacity>

                {/* Sectores (Al abrir modal cierra dropdown) */}
                <TouchableOpacity
                  style={[styles.toolPill, showSectors && styles.toolPillActive]}
                  onPress={handleOpenSectors}
                  activeOpacity={0.7}
                >
                  <View style={styles.toolPillLeft}>
                    <MaterialIcons
                      name="layers"
                      size={15}
                      color={showSectors ? C.accent : C.textMuted}
                    />
                    <Text style={[styles.toolPillText, showSectors && styles.toolPillTextActive]}>
                      Sectores
                    </Text>
                  </View>
                  <View style={[styles.ledDot, showSectors && styles.ledDotActive]} />
                </TouchableOpacity>

                {/* Cámaras de seguridad (capa opcional) */}
                {onToggleSecurityCameras && (
                  <TouchableOpacity
                    style={[styles.toolPill, showSecurityCameras && styles.toolPillActive]}
                    onPress={onToggleSecurityCameras}
                    activeOpacity={0.7}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: showSecurityCameras }}
                    accessibilityLabel="Mostrar cámaras de seguridad"
                  >
                    <View style={styles.toolPillLeft}>
                      <MaterialIcons
                        name="videocam"
                        size={15}
                        color={showSecurityCameras ? C.accent : C.textMuted}
                      />
                      <Text
                        style={[
                          styles.toolPillText,
                          showSecurityCameras && styles.toolPillTextActive,
                        ]}
                      >
                        Cámaras
                      </Text>
                    </View>
                    <View style={[styles.ledDot, showSecurityCameras && styles.ledDotActive]} />
                  </TouchableOpacity>
                )}

                {/* Cámara GTA */}
                <TouchableOpacity
                  style={[styles.toolPill, cameraAnimationsEnabled && styles.toolPillActive]}
                  onPress={onToggleCameraAnimations}
                  activeOpacity={0.7}
                >
                  <View style={styles.toolPillLeft}>
                    <MaterialIcons
                      name="movie-filter"
                      size={15}
                      color={cameraAnimationsEnabled ? C.accent : C.textMuted}
                    />
                    <Text
                      style={[
                        styles.toolPillText,
                        cameraAnimationsEnabled && styles.toolPillTextActive,
                      ]}
                    >
                      Cámara GTA
                    </Text>
                  </View>
                  <View style={[styles.ledDot, cameraAnimationsEnabled && styles.ledDotActive]} />
                </TouchableOpacity>

                {/* Geo-Router (Partners) / Planificador Social (Ciudadanos) */}
                {isRoutingAvailable && (
                  <TouchableOpacity
                    style={[styles.toolPill, isRoutingActive && styles.toolPillActive]}
                    onPress={handleToggleRouting}
                    activeOpacity={0.7}
                  >
                    <View style={styles.toolPillLeft}>
                      <MaterialIcons
                        name="route"
                        size={15}
                        color={isRoutingActive ? C.accent : C.textMuted}
                      />
                      <Text
                        style={[styles.toolPillText, isRoutingActive && styles.toolPillTextActive]}
                      >
                        {isPartner ? 'Geo-Router' : 'Planificar Ruta'}
                      </Text>
                    </View>
                    <View style={[styles.ledDot, isRoutingActive && styles.ledDotActive]} />
                  </TouchableOpacity>
                )}
              </View>

              {/* ─── 4. ESTILO DE MAPA (3x2 SEGMENTED PILLOW GRID) ─── */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Estilo de Capa</Text>
              </View>

              <View style={styles.pillGrid3}>
                {MAP_LAYER_OPTIONS.map((layer) => {
                  const isActive = mapLayer === layer.key;
                  const IconComponent = layer.iconFamily === 'Ionicons' ? Ionicons : MaterialIcons;

                  return (
                    <TouchableOpacity
                      key={layer.key}
                      style={[styles.layerPill, isActive && styles.layerPillActive]}
                      onPress={() => onSelectMapLayer(layer.key)}
                      disabled={!mapLayerReady}
                      activeOpacity={0.7}
                    >
                      <IconComponent
                        name={layer.iconName}
                        size={12}
                        color={isActive ? C.accent : C.textMuted}
                      />
                      <Text
                        numberOfLines={1}
                        style={[styles.layerPillText, isActive && styles.layerPillTextActive]}
                      >
                        {layer.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 9999,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Platform.OS === 'web' ? 'rgba(0, 0, 0, 0.22)' : 'rgba(0, 0, 0, 0.45)',
  },
  containerAligner: {
    position: 'absolute',
    pointerEvents: 'box-none',
  },
  panel: {
    backgroundColor: C.bgGlass,
    borderWidth: 1,
    borderTopColor: C.borderTop,
    borderBottomColor: C.borderBottom,
    borderLeftColor: C.borderSide,
    borderRightColor: C.borderSide,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
      },
      android: { elevation: 18 },
      web: {
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: '0 24px 48px -8px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.05)',
      } as any,
    }),
  },
  panelDesktop: {
    width: 320,
    maxHeight: 560,
    borderRadius: 18,
  },
  panelMobile: {
    width: '100%',
    maxHeight: '78%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  handleContainer: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  handleBar: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: C.accentSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: C.accentBorder,
  },
  headerTitle: {
    color: C.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  activeCounterBadge: {
    backgroundColor: C.accentSubtle,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderWidth: 0.5,
    borderColor: C.accentBorder,
  },
  activeCounterText: {
    color: C.accent,
    fontSize: 10,
    fontWeight: '700',
  },
  closeBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      } as any,
    }),
  },
  scroll: {
    flexShrink: 1,
  },
  scrollContent: {
    padding: 12,
    gap: 10,
  },
  // ─── Presets Segmented Pill ───
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: C.segmentedBg,
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: C.segmentedBorder,
    gap: 4,
  },
  segmentButton: {
    flex: 1,
    height: 32,
    borderRadius: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      } as any,
    }),
  },
  segmentButtonActiveAll: {
    backgroundColor: C.accentSubtle,
    borderWidth: 1,
    borderColor: C.accentBorder,
  },
  segmentButtonActiveNone: {
    backgroundColor: C.dangerSubtle,
    borderWidth: 1,
    borderColor: C.dangerBorder,
  },
  segmentText: {
    color: C.textSecondary,
    fontSize: 11.5,
    fontWeight: '600',
  },
  segmentTextActiveAll: {
    color: C.accent,
    fontWeight: '700',
  },
  segmentTextActiveNone: {
    color: C.danger,
    fontWeight: '700',
  },
  // ─── Section Header ───
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    color: C.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  resetLink: {
    color: C.accent,
    fontSize: 10,
    fontWeight: '600',
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
    }),
  },
  // ─── Pillow Grids ───
  pillGrid3: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pillGrid2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  // ─── Category Pill ───
  categoryPill: {
    width: '31.8%',
    height: 33,
    borderRadius: 10,
    backgroundColor: C.pillowBg,
    borderWidth: 1,
    borderColor: C.pillowBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 4,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      } as any,
    }),
  },
  categoryPillText: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  // ─── Tool Pill ───
  toolPill: {
    width: '48.8%',
    height: 38,
    borderRadius: 11,
    backgroundColor: C.pillowBg,
    borderWidth: 1,
    borderColor: C.pillowBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      } as any,
    }),
  },
  toolPillActive: {
    backgroundColor: C.accentSubtle,
    borderColor: C.accentBorder,
    borderWidth: 1,
  },
  toolPillLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  toolPillText: {
    color: '#E2E8F0',
    fontSize: 11.5,
    fontWeight: '600',
  },
  toolPillTextActive: {
    color: C.accent,
    fontWeight: '700',
  },
  ledDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginLeft: 4,
  },
  ledDotActive: {
    backgroundColor: C.accent,
    ...Platform.select({
      web: {
        boxShadow: '0 0 6px rgba(52, 211, 153, 0.8)',
      } as any,
    }),
  },
  // ─── Layer Pill ───
  layerPill: {
    width: '31.8%',
    height: 31,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 4,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      } as any,
    }),
  },
  layerPillActive: {
    backgroundColor: C.accentSubtle,
    borderColor: C.accent,
    borderWidth: 1,
  },
  layerPillText: {
    color: C.textMuted,
    fontSize: 10.5,
    fontWeight: '600',
  },
  layerPillTextActive: {
    color: C.accent,
    fontWeight: '700',
  },
});
