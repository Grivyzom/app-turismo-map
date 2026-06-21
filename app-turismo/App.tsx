import React, { useState, useEffect, useRef } from 'react';
import { useFonts } from 'expo-font';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  SafeAreaView,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Dimensions,
  Platform,
  Animated,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { TopAppBar } from './src/components/MapUI';
import { toast } from './src/components/ui/ToastNotification';
import { Sidebar } from './src/components/ui/Sidebar';
import './global.css';
import './src/styles/custom.css';
import { MapContainer } from './src/components/Map/MapContainer';
import { MapLayer, TurismoEvent } from './src/components/Map/types';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import {
  DEFAULT_MAP_LAYER,
  loadPersistedMapLayer,
  savePersistedMapLayer,
} from './src/utils/mapPreferences';
import { INITIAL_EVENTS, WS_SIMULATION_POOL, CategoryFilter } from './src/data/mockEvents';

const MAP_LAYER_OPTIONS: { key: MapLayer; label: string; icon: string }[] = [
  { key: 'dark', label: 'Noche', icon: '🌙' },
  { key: 'streets', label: 'Calles', icon: '🛣️' },
  { key: 'satellite', label: 'Satélite', icon: '🛰️' },
  { key: 'terrain', label: 'Relieve', icon: '⛰️' },
];

const getCategoryColor = (category: string, musicStyle?: string) => {
  if (category === 'musica' && musicStyle) {
    switch (musicStyle) {
      case 'jazz':
        return '#D97706'; // Gold/Amber
      case 'rock':
        return '#7C3AED'; // Purple/Indigo
      case 'electronica':
        return '#06B6D4'; // Neon Cyan
      case 'acustico':
        return '#EC4899'; // Hot Pink
      case 'pop':
      default:
        return '#F43F5E'; // Rose/Neon
    }
  }
  switch (category) {
    case 'gastronomia':
      return '#F59E0B'; // Ámbar
    case 'cultura':
      return '#A78BFA'; // Morado
    case 'naturaleza':
    case 'parque':
      return '#10B981'; // Emerald
    case 'humedal':
      return '#059669'; // Teal/Dark green
    case 'agua':
      return '#3B82F6'; // Blue
    case 'universidad':
      return '#8B5CF6'; // Purple
    case 'musica':
      return '#F43F5E'; // Rosa/Neon
    case 'deportes':
      return '#06B6D4'; // Cian
    case 'publico':
      return '#FBBF24'; // Amarillo/Ámbar
    case 'choque':
      return '#EF4444'; // Rojo choque
    case 'incendio':
      return '#F97316'; // Naranja incendio
    case 'accidente':
      return '#DC2626'; // Rojo oscuro accidente
    case 'calle_cortada':
      return '#78716C'; // Gris calle cortada
    default:
      return '#3B82F6';
  }
};

export default function App() {
  const [fontsLoaded] = useFonts({
    ...MaterialIcons.font,
    ...Ionicons.font,
  });

  const [screen, setScreen] = useState<'login' | 'register' | 'home'>('login');
  const [events, setEvents] = useState<TurismoEvent[]>(INITIAL_EVENTS);
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('todos');
  const [selectedEvent, setSelectedEvent] = useState<TurismoEvent | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [simulationIndex, setSimulationIndex] = useState(0);
  const [mapLayer, setMapLayer] = useState<MapLayer>(DEFAULT_MAP_LAYER);
  const [mapLayerReady, setMapLayerReady] = useState(false);
  const [showTraffic, setShowTraffic] = useState(false);
  const [showSectors, setShowSectors] = useState(true);

  // Estados de animación
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastY = useRef(new Animated.Value(-150)).current;
  const cardHeight = useRef(new Animated.Value(0)).current;

  // Submenú
  const [isTopBarHovered, setIsTopBarHovered] = useState(false);
  const submenuHeight = useRef(new Animated.Value(0)).current;

  // Sidebar
  const [sidebarNotifications, setSidebarNotifications] = useState(false);

  // Animación del Toast flotante (para WebSockets en tiempo real)
  const showNotification = (message: string) => {
    setToastMessage(message);
    Animated.sequence([
      Animated.timing(toastY, {
        toValue: Platform.OS === 'web' ? 20 : 50,
        duration: 400,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.delay(3500),
      Animated.timing(toastY, {
        toValue: -150,
        duration: 400,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => setToastMessage(null));
  };

  // Simular la llegada de un evento a través de un WebSocket en Go
  const triggerWebSocketEvent = () => {
    if (simulationIndex >= WS_SIMULATION_POOL.length) {
      showNotification('ℹ️ Todos los eventos de simulación ya están en el mapa.');
      return;
    }

    const baseEvent = WS_SIMULATION_POOL[simulationIndex];
    const newEvent: TurismoEvent = {
      ...baseEvent,
      id: `ws-${Date.now()}`,
      isRealTime: true,
      attendeesCount: (baseEvent.attendeesCount ?? 0) + Math.floor(Math.random() * 20),
    };

    setEvents((prev) => [newEvent, ...prev]);
    setSelectedEvent(newEvent); // Enfocar automáticamente el nuevo evento
    setSimulationIndex((prev) => prev + 1);

    const isEmergencyEvent = ['choque', 'incendio', 'accidente', 'calle_cortada'].includes(
      newEvent.category,
    );
    if (isEmergencyEvent) {
      showNotification(`🚨 ALERTA: ¡Emergencia reportada! "${newEvent.title}"`);
    } else {
      showNotification(`Nuevo evento en Valdivia! "${newEvent.title}"`);
    }
  };

  // Simulador automático de WebSocket (cada 30 segundos)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (simulationIndex < WS_SIMULATION_POOL.length) {
        triggerWebSocketEvent();
      }
    }, 15000); // Primer trigger automático a los 15s para asombrar al usuario
    return () => clearTimeout(timer);
  }, [simulationIndex]);

  useEffect(() => {
    let isMounted = true;

    void loadPersistedMapLayer().then((storedMapLayer) => {
      if (!isMounted) {
        return;
      }

      if (storedMapLayer) {
        setMapLayer(storedMapLayer);
      }

      setMapLayerReady(true);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!mapLayerReady) {
      return;
    }

    void savePersistedMapLayer(mapLayer);
  }, [mapLayer, mapLayerReady]);

  // Manejar animación al seleccionar un evento
  useEffect(() => {
    if (selectedEvent) {
      Animated.spring(cardHeight, {
        toValue: 1,
        tension: 40,
        friction: 9,
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(cardHeight, {
        toValue: 0,
        duration: 250,
        useNativeDriver: false,
      }).start();
    }
  }, [selectedEvent, cardHeight]);

  // Manejar animación del submenú
  useEffect(() => {
    Animated.spring(submenuHeight, {
      toValue: isTopBarHovered ? 1 : 0,
      tension: 50,
      friction: 8,
      useNativeDriver: false, // height/opacity no soportan native driver en RN web para transformaciones complejas, pero opacity sí.
    }).start();
  }, [isTopBarHovered]);

  // Filtrar eventos por categoría y búsqueda
  const filteredEvents = events.filter((event) => {
    const isEmergencyEvent = ['choque', 'incendio', 'accidente', 'calle_cortada'].includes(
      event.category,
    );
    const matchesCategory =
      selectedCategory === 'todos' ||
      (selectedCategory === 'emergencia' && isEmergencyEvent) ||
      event.category === selectedCategory;
    const matchesSearch =
      (event.title?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (event.description?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (event.organizer?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (!fontsLoaded) {
    return null;
  }

  if (screen === 'login') {
    return (
      <LoginScreen onLogin={() => setScreen('home')} onGoToRegister={() => setScreen('register')} />
    );
  }

  if (screen === 'register') {
    return (
      <RegisterScreen onRegister={() => setScreen('home')} onGoToLogin={() => setScreen('login')} />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.mainLayout}>
        {/* SIDEBAR */}
        <Sidebar
          onNavigate={(section) => console.log('Navigate to:', section)}
          onNotificationsClick={() => setSidebarNotifications(!sidebarNotifications)}
          onSuggestionsClick={() => console.log('Sugerencias clicked')}
          onProfileClick={() => console.log('Profile clicked')}
        />

        {/* CONTENIDO PRINCIPAL */}
        <View style={styles.contentContainer}>
          {/* Contenedor del Mapa */}
          <View style={styles.mapContainer}>
            <MapContainer
              events={filteredEvents}
              selectedEvent={selectedEvent}
              onSelectEvent={setSelectedEvent}
              mapLayer={mapLayer}
              showTraffic={showTraffic}
              showSectors={showSectors}
            />
          </View>

          {/* TOAST FLOTANTE */}
          {toastMessage && (
            <Animated.View style={[styles.toast, { transform: [{ translateY: toastY }] }]}>
              <Text style={styles.toastText}>{toastMessage}</Text>
            </Animated.View>
          )}

          {/* BARRA SUPERIOR Y SUBMENÚ */}
          <View
            style={styles.topBarWrapper}
            //@ts-ignore
            onMouseEnter={() => setIsTopBarHovered(true)}
            onMouseLeave={() => setIsTopBarHovered(false)}
          >
            <TopAppBar
              currentTab="map"
              onSearchClick={() => console.log('Search clicked')}
              onAccountClick={() => console.log('Account clicked')}
            />

            {/* SUBMENÚ DESPLEGABLE */}
            <Animated.View
              style={[
                styles.submenuContainer,
                {
                  opacity: submenuHeight,
                  transform: [
                    {
                      translateY: submenuHeight.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-20, 0],
                      }),
                    },
                  ],
                },
                !isTopBarHovered && { pointerEvents: 'none' }, // Desactiva clics cuando está oculto
              ]}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoriesScroll}
                contentContainerStyle={styles.categoriesContent}
              >
                <TouchableOpacity
                  style={[
                    styles.categoryChip,
                    selectedCategory === 'todos' && styles.activeCategoryChip,
                  ]}
                  onPress={() => setSelectedCategory('todos')}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      selectedCategory === 'todos' && styles.activeCategoryText,
                    ]}
                  >
                    Todos
                  </Text>
                </TouchableOpacity>
                {[
                  'gastronomia',
                  'cultura',
                  'naturaleza',
                  'parque',
                  'agua',
                  'humedal',
                  'universidad',
                  'musica',
                  'deportes',
                  'publico',
                  'emergencia',
                ].map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryChip,
                      selectedCategory === cat && styles.activeCategoryChip,
                    ]}
                    onPress={() => setSelectedCategory(cat as CategoryFilter)}
                  >
                    <Text
                      style={[
                        styles.categoryText,
                        selectedCategory === cat && styles.activeCategoryText,
                      ]}
                    >
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.layersScroll}
                contentContainerStyle={styles.layersContent}
              >
                <Text style={styles.layersLabel}>CAPAS:</Text>
                {MAP_LAYER_OPTIONS.map((layer) => (
                  <TouchableOpacity
                    key={layer.key}
                    style={[styles.layerChip, mapLayer === layer.key && styles.activeLayerChip]}
                    onPress={() => setMapLayer(layer.key)}
                  >
                    <Text
                      style={[
                        styles.layerChipText,
                        mapLayer === layer.key && styles.activeLayerChipText,
                      ]}
                    >
                      {layer.icon} {layer.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Animated.View>
          </View>

          {/* PANEL DE CONTROL DE SIMULACIÓN Y WEBSOCKET (Esquina Derecha / Inferior) */}
          <View style={styles.controlPanel}>
            <View style={styles.controlPanelGroup}>
              <TouchableOpacity style={styles.simButton} onPress={triggerWebSocketEvent}>
                <Text style={styles.simButtonText}>⚡ Simular WebSocket Go</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleButton, showSectors && styles.toggleButtonActive]}
                onPress={() => {
                  setShowSectors(!showSectors);
                  toast.success({
                    title: showSectors ? 'Sectores ocultos' : 'Sectores visibles',
                  });
                }}
              >
                <MaterialIcons
                  name={showSectors ? 'visibility' : 'visibility-off'}
                  size={16}
                  color={showSectors ? '#FFFFFF' : '#9CA3AF'}
                />
                <Text style={styles.toggleButtonText}>Sectores</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* TARJETA DETALLADA FLOTANTE (Efecto Emerger) */}
          {selectedEvent &&
            selectedEvent.category?.toLowerCase() !== 'tienda' &&
            selectedEvent.category?.toLowerCase() !== 'fauna' && (
              <Animated.View
                style={[
                  styles.detailsCard,
                  {
                    transform: [
                      {
                        translateY: cardHeight.interpolate({
                          inputRange: [0, 1],
                          outputRange: [300, 0],
                        }),
                      },
                    ],
                    opacity: cardHeight,
                  },
                ]}
              >
                <View style={styles.cardHeader}>
                  <View
                    style={[
                      styles.cardBadge,
                      {
                        backgroundColor: getCategoryColor(
                          selectedEvent.category,
                          selectedEvent.musicStyle,
                        ),
                      },
                    ]}
                  >
                    <Text style={styles.cardBadgeText}>
                      {['choque', 'incendio', 'accidente', 'calle_cortada'].includes(
                        selectedEvent.category,
                      )
                        ? `🚨 ${selectedEvent.category.toUpperCase().replace('_', ' ')}`
                        : selectedEvent.category.toUpperCase()}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setSelectedEvent(null)}
                    style={styles.closeButton}
                  >
                    <Text style={styles.closeButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.cardTitle}>{selectedEvent.title}</Text>
                <Text style={styles.cardOrganizer}>
                  {['choque', 'incendio', 'accidente', 'calle_cortada'].includes(
                    selectedEvent.category,
                  )
                    ? 'Fuente / Reporte'
                    : 'Organizado por'}
                  : {selectedEvent.organizer}
                </Text>
                <Text style={styles.cardDesc}>{selectedEvent.description}</Text>

                <View style={styles.cardDivider} />

                <View style={styles.cardMetaRow}>
                  <View style={styles.cardMetaItem}>
                    <Text style={styles.metaLabel}>HORA</Text>
                    <Text style={styles.metaValue}>🕒 {selectedEvent.time}</Text>
                  </View>
                  <View style={styles.cardMetaItem}>
                    <Text style={styles.metaLabel}>ASISTENTES</Text>
                    <Text style={styles.metaValue}>👥 {selectedEvent.attendeesCount} en vivo</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    {
                      backgroundColor: getCategoryColor(
                        selectedEvent.category,
                        selectedEvent.musicStyle,
                      ),
                    },
                  ]}
                >
                  <Text style={styles.actionButtonText}>Asistir / Ver Detalles</Text>
                </TouchableOpacity>
              </Animated.View>
            )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  mainLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  contentContainer: {
    flex: 1,
    position: 'relative',
  },
  topBarWrapper: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 16,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  mapContainer: {
    ...StyleSheet.absoluteFill,
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
    zIndex: 100,
    // Sombra suave en móviles
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
      },
      android: {
        elevation: 5,
      },
      web: {
        boxShadow: '0px 4px 5px rgba(0, 0, 0, 0.3)',
      },
    }),
  },
  submenuContainer: {
    marginTop: 8,
    paddingVertical: 8,
    backgroundColor: 'rgba(17, 24, 39, 0.75)',
    borderRadius: 20,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(12px)',
        maxWidth: 600,
        alignSelf: 'center',
        width: '100%',
      },
    }),
  },
  header: {
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    ...Platform.select({
      ios: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 10,
      },
      android: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 10,
      },
      web: {
        textShadow: '-1px 1px 10px rgba(0, 0, 0, 0.75)',
      },
    }),
  },
  brandSubtitle: {
    fontSize: 12,
    color: '#34D399',
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  searchBarContainer: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(17, 24, 39, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(12px)',
        maxWidth: 500,
        alignSelf: 'center',
        width: '100%',
      },
    }),
  },
  searchInput: {
    height: 46,
    paddingHorizontal: 16,
    color: '#FFFFFF',
    fontSize: 14,
  },
  categoriesScroll: {
    width: '100%',
  },
  categoriesContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({
      web: {
        justifyContent: 'center',
        maxWidth: 800,
        alignSelf: 'center',
      },
    }),
  },
  layersScroll: {
    width: '100%',
    marginTop: 2,
  },
  layersContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({
      web: {
        justifyContent: 'center',
        maxWidth: 800,
        alignSelf: 'center',
      },
    }),
  },
  layersLabel: {
    color: '#BAE6FD',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginRight: 4,
    textTransform: 'uppercase',
  },
  layerChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: 'rgba(8, 47, 73, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(125, 211, 252, 0.25)',
    marginRight: 6,
  },
  activeLayerChip: {
    backgroundColor: '#0EA5E9',
    borderColor: '#38BDF8',
  },
  layerChipText: {
    color: '#E0F2FE',
    fontSize: 12,
    fontWeight: '700',
  },
  activeLayerChipText: {
    color: '#082F49',
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(17, 24, 39, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginRight: 6,
  },
  activeCategoryChip: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  categoryText: {
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '600',
  },
  activeCategoryText: {
    color: '#FFFFFF',
  },
  controlPanel: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 20 : 60,
    right: 20,
    zIndex: 100,
  },
  controlPanelGroup: {
    gap: 10,
  },
  simButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
      },
      web: {
        boxShadow: '0px 4px 5px rgba(0, 0, 0, 0.3)',
      },
    }),
    elevation: 6,
  },
  simButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(107, 114, 128, 0.5)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
      },
      web: {
        boxShadow: '0px 4px 5px rgba(0, 0, 0, 0.3)',
      },
    }),
    elevation: 6,
  },
  toggleButtonActive: {
    backgroundColor: '#3B82F6',
    borderColor: 'rgba(59, 130, 246, 0.5)',
  },
  toggleButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  toast: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignSelf: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    zIndex: 1000,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 6,
      },
      web: {
        boxShadow: '0px 6px 6px rgba(0, 0, 0, 0.4)',
      },
    }),
    elevation: 8,
    ...Platform.select({
      web: {
        maxWidth: 450,
        backdropFilter: 'blur(8px)',
      },
    }),
  },
  toastText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
    textAlign: 'center',
  },
  detailsCard: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(17, 24, 39, 0.90)',
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
      },
      web: {
        boxShadow: '0px 16px 30px rgba(0, 0, 0, 0.3)',
      },
    }),
    elevation: 10,
    zIndex: 200,
    ...Platform.select({
      web: {
        maxWidth: 500,
        alignSelf: 'center',
        left: 'auto',
        right: 'auto',
        width: '100%',
        backdropFilter: 'blur(16px)',
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  cardBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  cardOrganizer: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 10,
  },
  cardDesc: {
    fontSize: 13,
    color: '#D1D5DB',
    lineHeight: 18,
    marginBottom: 16,
  },
  cardDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 14,
  },
  cardMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  cardMetaItem: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#9CA3AF',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  actionButton: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
