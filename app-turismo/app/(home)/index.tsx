import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  Pressable,
  Image,
} from 'react-native';
import { TelemetryWidget } from '../../src/components/MapUI/TelemetryWidget';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

import { TopAppBar, type TabType } from '../../src/components/MapUI';
import { MapContainer } from '../../src/components/Map/MapContainer';
import { MapLayer, TurismoEvent, MAX_ZOOM_PER_LAYER } from '../../src/components/Map/types';
import { getCategoryColor } from '../../src/utils/mapUtils';
import {
  DEFAULT_MAP_LAYER,
  loadPersistedMapLayer,
  savePersistedMapLayer,
} from '../../src/utils/mapPreferences';
import UserProfileScreen from '../../src/screens/UserProfileScreen';
import FeedScreen from '../../src/screens/FeedScreen';
import PassportScreen from '../../src/screens/PassportScreen';
import ForumScreen from '../../src/screens/ForumScreen';
import { useUserLocation } from '../../src/hooks/useUserLocation';
import { ParsedSearch } from '../../src/utils/aiSearchParser';

const INITIAL_EVENTS: TurismoEvent[] = [
  {
    id: '1',
    title: 'Muestra Gastronómica Kunstmann',
    description:
      'Disfruta de la mejor cerveza artesanal de Valdivia y platos típicos alemanes en el corazón de Torobayo.',
    latitude: -39.8252,
    longitude: -73.2845,
    category: 'gastronomia',
    organizer: 'Cervecería Kunstmann',
    time: '12:00 - 23:00',
    attendeesCount: 342,
    imageUrl:
      'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&q=80&w=800',
    radius: 400,
  },
  {
    id: '2',
    title: 'Exposición Histórica Maurice van de Maele',
    description:
      'Un recorrido por el pasado colonial de Valdivia, su arqueología y la cultura mapuche-huilliche.',
    latitude: -39.8172,
    longitude: -73.2508,
    category: 'cultura',
    organizer: 'Museos UACh',
    time: '10:00 - 18:00',
    attendeesCount: 88,
    imageUrl:
      'https://images.unsplash.com/photo-1565552643952-443e20e88b8d?auto=format&fit=crop&q=80&w=800',
  },
  {
    id: '3',
    title: 'Sendero de Lotos en Parque Saval',
    description:
      'Visita guiada por la laguna de los lotos gigantes y el bosque valdiviano en Isla Teja.',
    latitude: -39.808,
    longitude: -73.2482,
    category: 'naturaleza',
    organizer: 'Municipalidad de Valdivia',
    time: '09:00 - 17:00',
    attendeesCount: 154,
    imageUrl:
      'https://images.unsplash.com/photo-1440342359743-84fcb8c21f21?auto=format&fit=crop&q=80&w=800',
    polygon: [
      { latitude: -39.806, longitude: -73.250 },
      { latitude: -39.806, longitude: -73.246 },
      { latitude: -39.810, longitude: -73.246 },
      { latitude: -39.810, longitude: -73.250 },
    ],
  },
  {
    id: '4',
    title: 'Concierto de Jazz en Esmeralda',
    description:
      'Noche de jazz en vivo en la calle más bohemia e histórica de Valdivia con músicos locales e invitados.',
    latitude: -39.813,
    longitude: -73.245,
    category: 'musica',
    organizer: 'Club de Jazz Valdivia',
    time: '21:00 - 01:00',
    attendeesCount: 120,
    imageUrl:
      'https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&q=80&w=800',
  },
  {
    id: '5',
    title: 'Regata Universitaria de Remo',
    description:
      'Competencia tradicional de remo olímpico sobre las aguas del Río Calle-Calle con universidades del sur de Chile.',
    latitude: -39.8115,
    longitude: -73.2415,
    category: 'deportes',
    organizer: 'Club Deportivo Phoenix',
    time: '08:30 - 13:00',
    attendeesCount: 450,
    imageUrl:
      'https://images.unsplash.com/photo-1555025062-811c7fb3bf56?auto=format&fit=crop&q=80&w=800',
  },
];

const WS_SIMULATION_POOL: Omit<TurismoEvent, 'id' | 'isRealTime'>[] = [
  {
    title: 'Feria Fluvial del Libro',
    description:
      '¡NUEVO! Venta e intercambio de libros y charlas literarias junto al mercado fluvial frente al Río Valdivia.',
    latitude: -39.8138,
    longitude: -73.2435,
    category: 'cultura',
    organizer: 'Corporación Cultural Valdivia',
    time: '11:00 - 20:00',
    attendeesCount: 65,
    imageUrl:
      'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=800',
  },
  {
    title: 'Feria del Chocolate Artesanal',
    description:
      '¡NUEVO! Degustación y talleres de chocolatería fina de autor en la glorieta de la Plaza de la República.',
    latitude: -39.8148,
    longitude: -73.2465,
    category: 'gastronomia',
    organizer: 'Agrupación Chocolateros del Sur',
    time: '10:00 - 21:00',
    attendeesCount: 210,
    imageUrl:
      'https://images.unsplash.com/photo-1600021617454-e67c87c4613b?auto=format&fit=crop&q=80&w=800',
  },
  {
    title: 'Festival Internacional de Cine Valdivia (Charla)',
    description:
      '¡NUEVO! Conferencia magistral al aire libre sobre cine independiente iberoamericano en el Aula Magna UACh.',
    latitude: -39.819,
    longitude: -73.253,
    category: 'musica',
    organizer: 'CPC UACh',
    time: '18:00 - 19:30',
    attendeesCount: 310,
    imageUrl:
      'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&q=80&w=800',
  },
];

type CategoryFilter = 'todos' | 'gastronomia' | 'cultura' | 'naturaleza' | 'musica' | 'deportes';

const CATEGORY_ICONS: Record<CategoryFilter, { name: any; family: 'Ionicons' | 'MaterialIcons' }> = {
  todos: { name: 'apps', family: 'Ionicons' },
  gastronomia: { name: 'restaurant', family: 'MaterialIcons' },
  cultura: { name: 'museum', family: 'MaterialIcons' },
  naturaleza: { name: 'park', family: 'MaterialIcons' },
  musica: { name: 'music-note', family: 'MaterialIcons' },
  deportes: { name: 'sports-soccer', family: 'MaterialIcons' },
};

const MAP_LAYER_OPTIONS: { key: MapLayer; label: string; iconName: any; iconFamily: 'Ionicons' | 'MaterialIcons' }[] = [
  { key: 'dark', label: 'Noche', iconName: 'moon', iconFamily: 'Ionicons' },
  { key: 'streets', label: 'Calles', iconName: 'add-road', iconFamily: 'MaterialIcons' },
  { key: 'light', label: 'Claro', iconName: 'sunny', iconFamily: 'Ionicons' },
  { key: 'satellite', label: 'Satélite', iconName: 'satellite', iconFamily: 'MaterialIcons' },
  { key: 'terrain', label: 'Relieve', iconName: 'terrain', iconFamily: 'MaterialIcons' },
];

export default function HomeScreen() {
  const [events, setEvents] = useState<TurismoEvent[]>(INITIAL_EVENTS);
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('todos');
  const [selectedEvent, setSelectedEvent] = useState<TurismoEvent | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [simulationIndex, setSimulationIndex] = useState(0);
  const [mapLayer, setMapLayer] = useState<MapLayer>(DEFAULT_MAP_LAYER);
  const [mapLayerReady, setMapLayerReady] = useState(false);
  const [showTraffic, setShowTraffic] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('map');
  const [showFilters, setShowFilters] = useState(false);
  const [isTacticalModeActive, setIsTacticalModeActive] = useState(false);
  const [tacticalLocation, setTacticalLocation] = useState<{
    latitude: number;
    longitude: number;
    x?: number;
    y?: number;
  } | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastY] = useState(() => new Animated.Value(-150));
  const [panelSlide] = useState(() => new Animated.Value(0));

  const { userLocation, locationError, isLoadingLocation, retryLocation } = useUserLocation();
  const [centerTrigger, setCenterTrigger] = useState(0);
  const [zoom, setZoom] = useState(13);

  /** Zoom máximo dinámico según la capa activa */
  const currentMaxZoom = MAX_ZOOM_PER_LAYER[mapLayer] || 18;

  const showNotification = useCallback(
    (message: string) => {
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
    },
    [toastY],
  );

  const handleVoiceSearch = useCallback((result: ParsedSearch) => {
    setSelectedCategory(result.category as CategoryFilter);
    setSearchQuery(result.query);
    showNotification(`Búsqueda: "${result.originalText}"`);
  }, [showNotification]);

  const triggerWebSocketEvent = useCallback(() => {
    if (simulationIndex >= WS_SIMULATION_POOL.length) {
      showNotification('ℹ️ Todos los eventos de simulación ya están en el mapa.');
      return;
    }

    const baseEvent = WS_SIMULATION_POOL[simulationIndex];
    const newEvent: TurismoEvent = {
      ...baseEvent,
      id: `ws-${Date.now()}`,
      isRealTime: true,
      attendeesCount: baseEvent.attendeesCount + Math.floor(Math.random() * 20),
    };

    setEvents((prev) => [newEvent, ...prev]);
    setSelectedEvent(newEvent);
    setSimulationIndex((prev) => prev + 1);
    showNotification(`⚡ Live WS: Nuevo evento en Valdivia! "${newEvent.title}"`);
  }, [simulationIndex, showNotification]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (simulationIndex < WS_SIMULATION_POOL.length) {
        triggerWebSocketEvent();
      }
    }, 15000);
    return () => clearTimeout(timer);
  }, [simulationIndex, triggerWebSocketEvent]);

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

  useEffect(() => {
    if (locationError) {
      const timer = setTimeout(() => {
        showNotification(`📍 ${locationError}`);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [locationError, showNotification]);

  const screenWidth = Dimensions.get('window').width;
  const isDesktop = Platform.OS === 'web' && screenWidth > 768;
  const panelWidth = isDesktop ? 380 : screenWidth - 32;

  useEffect(() => {
    if (selectedEvent) {
      Animated.spring(panelSlide, {
        toValue: 1,
        tension: 65,
        friction: 11,
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(panelSlide, {
        toValue: 0,
        duration: 280,
        useNativeDriver: false,
      }).start();
    }
  }, [selectedEvent, panelSlide]);

  const filteredEvents = useMemo(
    () =>
      events.filter((event) => {
        const matchesCategory = selectedCategory === 'todos' || event.category === selectedCategory;
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          event.title.toLowerCase().includes(query) ||
          event.description.toLowerCase().includes(query) ||
          event.organizer.toLowerCase().includes(query);
        return matchesCategory && matchesSearch;
      }),
    [events, selectedCategory, searchQuery],
  );

  // Callback estable para que MapContainer (React.memo) no se re-renderice innecesariamente
  const handleSelectEvent = useCallback((event: TurismoEvent | null) => {
    setSelectedEvent(event);
  }, []);

  if (activeTab === 'profile') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />

        <View style={styles.topBarWrapper}>
          <TopAppBar currentTab={activeTab} onTabChange={setActiveTab} />
        </View>

        <View style={styles.profileContainer}>
          <UserProfileScreen />
        </View>
      </SafeAreaView>
    );
  }

  if (activeTab === 'feed') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />

        <View style={styles.topBarWrapper}>
          <TopAppBar 
            currentTab={activeTab} 
            onTabChange={setActiveTab} 
            onVoiceSearch={handleVoiceSearch} 
          />
        </View>

        <View style={styles.profileContainer}>
          <FeedScreen />
        </View>
      </SafeAreaView>
    );
  }

  if (activeTab === 'saved') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />

        <View style={styles.topBarWrapper}>
          <TopAppBar 
            currentTab={activeTab} 
            onTabChange={setActiveTab} 
            onVoiceSearch={handleVoiceSearch} 
          />
        </View>

        <View style={styles.profileContainer}>
          <PassportScreen />
        </View>
      </SafeAreaView>
    );
  }

  if (activeTab === 'forum') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />

        <View style={styles.topBarWrapper}>
          <TopAppBar 
            currentTab={activeTab} 
            onTabChange={setActiveTab} 
            onVoiceSearch={handleVoiceSearch} 
          />
        </View>

        <View style={styles.profileContainer}>
          <ForumScreen />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.mapContainer}>
        <MapContainer
          events={filteredEvents}
          selectedEvent={selectedEvent}
          onSelectEvent={handleSelectEvent}
          mapLayer={mapLayer}
          userLocation={userLocation}
          centerTrigger={centerTrigger}
          tacticalMode={isTacticalModeActive}
          onTacticalLocationChange={setTacticalLocation}
          zoom={zoom}
          onZoomChange={setZoom}
          showTraffic={showTraffic}
        />
      </View>

      <View style={styles.topBarWrapper}>
        <TopAppBar 
          currentTab={activeTab} 
          onTabChange={setActiveTab} 
          onVoiceSearch={handleVoiceSearch} 
        />
      </View>

      {toastMessage && (
        <Animated.View style={[styles.toast, { transform: [{ translateY: toastY }] }]}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}

      {/* PANEL DE CONTROL UNIFICADO DE NAVEGACIÓN (Diseño Obsidian Glassmorphism) */}
      <View style={styles.unifiedControlsContainer}>
        {/* Zoom In */}
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => setZoom((z) => Math.min(z + 1, currentMaxZoom))}
          activeOpacity={0.7}
        >
          <MaterialIcons name="add" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        <View style={styles.controlDivider} />

        {/* Zoom Out */}
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => setZoom((z) => Math.max(z - 1, 1))}
          activeOpacity={0.7}
        >
          <MaterialIcons name="remove" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        <View style={styles.controlDivider} />

        {/* Ubicarme (Location) */}
        <TouchableOpacity
          style={[styles.controlButton, userLocation && styles.controlButtonActive]}
          onPress={() => {
            if (userLocation) {
              setCenterTrigger((prev) => prev + 1);
            } else {
              retryLocation();
              showNotification('📍 Obteniendo tu ubicación...');
            }
          }}
          activeOpacity={0.7}
        >
          <MaterialIcons
            name="my-location"
            size={18}
            color={userLocation ? '#34D399' : isLoadingLocation ? '#A0AEC0' : '#EF4444'}
          />
        </TouchableOpacity>

        <View style={styles.controlDivider} />

        {/* Modo Precisión (Modo Táctico) */}
        <TouchableOpacity
          style={[styles.controlButton, isTacticalModeActive && styles.controlButtonActive]}
          onPress={() => {
            setIsTacticalModeActive(!isTacticalModeActive);
            if (!isTacticalModeActive) {
              showNotification('🎯 Modo Táctico activado');
            }
          }}
          activeOpacity={0.7}
        >
          <MaterialIcons
            name="center-focus-strong"
            size={18}
            color={isTacticalModeActive ? '#34D399' : '#9CA3AF'}
          />
        </TouchableOpacity>

        <View style={styles.controlDivider} />

        {/* Tráfico (Real-time) */}
        <TouchableOpacity
          style={[styles.controlButton, showTraffic && styles.controlButtonActive]}
          onPress={() => {
            setShowTraffic(!showTraffic);
            if (!showTraffic) {
              showNotification('🚗 Tráfico en vivo activado');
            }
          }}
          activeOpacity={0.7}
        >
          <MaterialIcons name="traffic" size={18} color={showTraffic ? '#34D399' : '#9CA3AF'} />
        </TouchableOpacity>

        <View style={styles.controlDivider} />

        {/* Filtros de Mapa */}
        <TouchableOpacity
          style={[styles.controlButton, showFilters && styles.controlButtonActive]}
          onPress={() => setShowFilters(!showFilters)}
          activeOpacity={0.7}
        >
          <MaterialIcons name="tune" size={18} color={showFilters ? '#34D399' : '#9CA3AF'} />
        </TouchableOpacity>
      </View>

      {/* HUD Táctico */}
      {isTacticalModeActive && tacticalLocation && (
        <View
          style={[
            styles.tacticalHudContainer,
            tacticalLocation.x !== undefined && tacticalLocation.y !== undefined
              ? {
                  left: tacticalLocation.x + 20,
                  top: tacticalLocation.y + 20,
                  // Prevent tooltip from going off-screen (basic handling)
                  transform: [
                    { translateX: tacticalLocation.x > screenWidth - 250 ? -260 : 0 },
                    {
                      translateY:
                        tacticalLocation.y > Dimensions.get('window').height - 150 ? -150 : 0,
                    },
                  ],
                }
              : {
                  top: Platform.OS === 'ios' ? 120 : 90,
                  alignSelf: 'center',
                },
          ]}
          pointerEvents="none"
        >
          <View style={styles.tacticalHudGlass}>
            <View style={styles.hudHeader}>
              <View style={styles.hudDot} />
              <Text style={styles.hudTitle}>COORDENADAS</Text>
            </View>
            <View style={styles.hudDataRow}>
              <Text style={styles.hudLabel}>LAT</Text>
              <Text style={styles.hudValue}>{tacticalLocation.latitude.toFixed(6)}°</Text>
            </View>
            <View style={styles.hudDataRow}>
              <Text style={styles.hudLabel}>LNG</Text>
              <Text style={styles.hudValue}>{tacticalLocation.longitude.toFixed(6)}°</Text>
            </View>
            <View style={styles.hudDataRow}>
              <Text style={styles.hudLabel}>ALT</Text>
              <Text style={styles.hudValue}>
                {userLocation?.altitude !== null && userLocation?.altitude !== undefined
                  ? `${userLocation.altitude} msnm`
                  : '-- msnm'}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Dashboard de Telemetría (Live Telemetry HUD) */}
      {Platform.OS !== 'web' && userLocation && (
        <View style={styles.telemetryHudContainer} pointerEvents="box-none">
          <View style={styles.telemetryHudGlass}>
            {/* Cabecera / Status */}
            <View style={styles.telemetryHeader}>
              <View style={styles.telemetryDot} />
              <Text style={styles.telemetryTitle}>TELEMETRÍA EN VIVO</Text>
            </View>

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
          </View>
        </View>
      )}

      {showFilters && (
        <View
          style={[
            styles.filterOverlay,
            isDesktop ? { right: 56, width: 300 } : { left: 12, right: 68, width: 'auto' }, // Deja espacio libre para la barra de control en pantallas móviles
          ]}
        >
          <Text style={styles.filterSectionTitle}>Categorías</Text>
          <View style={styles.categoriesWrapper}>
            {(
              [
                'todos',
                'gastronomia',
                'cultura',
                'naturaleza',
                'musica',
                'deportes',
              ] as CategoryFilter[]
            ).map((cat) => {
              const iconData = CATEGORY_ICONS[cat];
              const IconComponent = iconData.family === 'Ionicons' ? Ionicons : MaterialIcons;
              const isActive = selectedCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryChip, isActive && styles.activeCategoryChip]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <IconComponent 
                    name={iconData.name} 
                    size={14} 
                    color={isActive ? '#FFFFFF' : '#CBD5E0'} 
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.categoryText,
                      isActive && styles.activeCategoryText,
                    ]}
                  >
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.filterSectionTitle}>Capa del Mapa</Text>
          <View style={styles.layersWrapper}>
            {MAP_LAYER_OPTIONS.map((layer) => {
              const IconComponent = layer.iconFamily === 'Ionicons' ? Ionicons : MaterialIcons;
              const isActive = mapLayer === layer.key;
              return (
                <TouchableOpacity
                  key={layer.key}
                  style={[styles.layerChip, isActive && styles.activeLayerChip]}
                  onPress={() => setMapLayer(layer.key)}
                >
                  <IconComponent 
                    name={layer.iconName} 
                    size={14} 
                    color={isActive ? '#34D399' : '#CBD5E0'} 
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.layerChipText,
                      isActive && styles.activeLayerChipText,
                    ]}
                  >
                    {layer.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {selectedEvent && (
        <View style={styles.sidePanelOverlay}>
          {/* Tap-to-dismiss backdrop (transparent, covers full area behind) */}
          <Pressable style={styles.sidePanelBackdrop} onPress={() => setSelectedEvent(null)} />

          <Animated.View
            style={[
              styles.sidePanel,
              {
                width: panelWidth,
                transform: [
                  {
                    translateX: panelSlide.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-panelWidth - 16, 0],
                    }),
                  },
                ],
                opacity: panelSlide,
              },
            ]}
          >
            <ScrollView
              style={styles.panelScroll}
              contentContainerStyle={
                selectedEvent.imageUrl
                  ? styles.panelScrollContentWithBanner
                  : styles.panelScrollContent
              }
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {selectedEvent.imageUrl ? (
                <View style={styles.bannerContainer}>
                  <Image source={{ uri: selectedEvent.imageUrl }} style={styles.bannerImage} />
                  <View style={styles.bannerOverlay} />

                  <View style={styles.bannerHeader}>
                    <View
                      style={[
                        styles.cardBadge,
                        { backgroundColor: getCategoryColor(selectedEvent.category) },
                      ]}
                    >
                      <Text style={styles.cardBadgeText}>
                        {selectedEvent.category.toUpperCase()}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setSelectedEvent(null)}
                      style={styles.closeButtonLight}
                    >
                      <Text style={styles.closeButtonText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.cardHeader}>
                  <View
                    style={[
                      styles.cardBadge,
                      { backgroundColor: getCategoryColor(selectedEvent.category) },
                    ]}
                  >
                    <Text style={styles.cardBadgeText}>{selectedEvent.category.toUpperCase()}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setSelectedEvent(null)}
                    style={styles.closeButton}
                  >
                    <Text style={styles.closeButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View
                style={
                  selectedEvent.imageUrl
                    ? styles.panelContentWrapperWithPadding
                    : styles.panelContentWrapper
                }
              >
                {selectedEvent.isRealTime && (
                  <View style={styles.liveIndicator}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>EN VIVO</Text>
                  </View>
                )}

                <Text style={styles.cardTitle}>{selectedEvent.title}</Text>
                <Text style={styles.cardOrganizer}>Organizado por: {selectedEvent.organizer}</Text>
                <Text style={styles.cardDesc}>{selectedEvent.description}</Text>

                {/* Status Bar */}
                <View style={styles.statusBarContainer}>
                  {['agendado', 'en_proceso', 'finalizado'].map((status, index) => {
                    const eventStatus =
                      selectedEvent.status ||
                      (selectedEvent.isRealTime ? 'en_proceso' : 'agendado');
                    const isActive = eventStatus === status;
                    const isPast =
                      ['agendado', 'en_proceso', 'finalizado'].indexOf(eventStatus) > index;
                    const isCompleted = isActive || isPast;

                    const getLabel = (s: string) => {
                      if (s === 'agendado') return 'Agendado';
                      if (s === 'en_proceso') return 'En proceso';
                      return 'Finalizado';
                    };

                    return (
                      <React.Fragment key={status}>
                        <View style={styles.statusNodeWrapper}>
                          <View style={[styles.statusNode, isCompleted && styles.statusNodeActive]}>
                            {isCompleted && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                          </View>
                          <Text
                            style={[styles.statusLabel, isCompleted && styles.statusLabelActive]}
                          >
                            {getLabel(status)}
                          </Text>
                        </View>
                        {index < 2 && (
                          <View style={[styles.statusLine, isPast && styles.statusLineActive]} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </View>

                <View style={styles.actionBarContainer}>
                  <View style={styles.actionInfoContainer}>
                    <View style={styles.actionInfoItem}>
                      <Ionicons name="time-outline" size={14} color="#A0AEC0" />
                      <Text style={styles.actionInfoText}>{selectedEvent.time}</Text>
                    </View>
                    <View style={styles.actionInfoItem}>
                      <Ionicons name="pricetag-outline" size={14} color="#A0AEC0" />
                      <Text style={styles.actionInfoText}>
                        {selectedEvent.category.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.actionButtonsContainer}>
                    <TouchableOpacity
                      style={[
                        styles.actionBtn,
                        { backgroundColor: getCategoryColor(selectedEvent.category) },
                      ]}
                    >
                      <Ionicons name="calendar-outline" size={20} color="#FFFFFF" />
                      <Text style={styles.actionBtnText}>Asistir</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn}>
                      <Ionicons name="share-social-outline" size={22} color="#FFFFFF" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn}>
                      <Ionicons name="bookmark-outline" size={22} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  profileContainer: {
    flex: 1,
    backgroundColor: '#0B0F19',
    paddingTop: 72,
  },
  topBarWrapper: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 45 : 0, // Ajuste para SafeArea si es absolute
    left: 0,
    right: 0,
    zIndex: 100,
  },
  mapContainer: {
    ...StyleSheet.absoluteFill,
  },
  topOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 65 : 70,
    left: 0,
    right: 0,
    paddingTop: 10,
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
    marginTop: 4,
  },
  searchBarContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  categoriesWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  activeCategoryChip: {
    backgroundColor: '#FF6B6B',
    borderColor: '#FF6B6B',
  },
  categoryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  activeCategoryText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  layersWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  layersLabel: {
    color: '#A0AEC0',
    fontSize: 11,
    fontWeight: '600',
    marginRight: 8,
    marginLeft: 4,
  },
  layerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  activeLayerChip: {
    backgroundColor: 'rgba(52, 211, 153, 0.3)',
    borderColor: '#34D399',
  },
  layerChipText: {
    color: '#CBD5E0',
    fontSize: 11,
    fontWeight: '500',
  },
  activeLayerChipText: {
    color: '#34D399',
    fontWeight: '600',
  },
  toast: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    alignSelf: 'center',
    zIndex: 200,
    backgroundColor: 'rgba(15, 20, 28, 0.95)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: { elevation: 8 },
      web: {
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.5)',
      },
    }),
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  sidePanelOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 150,
  },
  sidePanelBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'transparent',
  },
  sidePanel: {
    position: 'absolute',
    top: 16,
    left: 16,
    bottom: 16,
    zIndex: 151,
    // ─── High Contrast Obsidian Glassmorphism ───
    backgroundColor: 'rgba(15, 20, 28, 0.88)', // Más oscuro y premium para excelente legibilidad sobre el mapa
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
      },
      android: {
        elevation: 10,
      },
      web: {
        backdropFilter: 'blur(20px)', // Blur más fuerte para difuminar las calles del mapa detrás del texto
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.5)',
        transition: 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
      },
    }),
  },
  panelScroll: {
    flex: 1,
  },
  panelScrollContent: {
    paddingHorizontal: 24, // Espacio interno más amplio y premium
    paddingTop: 24,
    paddingBottom: 32,
  },
  panelScrollContentWithBanner: {
    paddingBottom: 32,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginRight: 6,
  },
  liveText: {
    color: '#EF4444',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  bannerContainer: {
    width: '100%',
    height: 180,
    position: 'relative',
    marginBottom: 16,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    resizeMode: 'cover',
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  bannerHeader: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  closeButtonLight: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  cardBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  closeButtonText: {
    color: '#A0AEC0',
    fontSize: 14,
    fontWeight: 'bold',
  },
  panelContentWrapper: {},
  panelContentWrapperWithPadding: {
    paddingHorizontal: 24,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
    lineHeight: 24,
  },
  cardOrganizer: {
    color: '#A0AEC0',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
  },
  cardDesc: {
    color: '#CBD5E0',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  cardDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 12,
  },
  actionBarContainer: {
    marginTop: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  actionInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionInfoText: {
    color: '#CBD5E0',
    fontSize: 12,
    fontWeight: '600',
  },
  statusBarContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 8,
    marginBottom: 16,
    marginTop: 8,
  },
  statusNodeWrapper: {
    alignItems: 'center',
    width: 75,
  },
  statusNode: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    zIndex: 2,
  },
  statusNodeActive: {
    backgroundColor: '#34D399',
    borderColor: '#34D399',
    ...Platform.select({
      ios: {
        shadowColor: '#34D399',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 6,
      },
      android: { elevation: 6 },
      web: { boxShadow: '0px 0px 10px rgba(52, 211, 153, 0.5)' },
    }),
  },
  statusLabel: {
    color: '#A0AEC0',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  statusLabelActive: {
    color: '#34D399',
    fontWeight: '700',
  },
  statusLine: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginTop: 10,
    marginHorizontal: -10,
    zIndex: 1,
  },
  statusLineActive: {
    backgroundColor: '#34D399',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    flex: 1,
    marginRight: 8,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  unifiedControlsContainer: {
    position: 'absolute',
    bottom: 20,
    right: 12,
    zIndex: 110,
    backgroundColor: 'rgba(30, 30, 30, 0.6)', // Glassmorphism premium
    borderRadius: 24, // Mismo radio de borde que los paneles principales
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 3,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
      web: {
        backdropFilter: 'blur(12px)', // Efecto cristal más pronunciado
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.2)',
      },
    }),
  },
  controlButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 1,
  },
  controlButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)', // Coincide con active NavLink
  },
  controlDivider: {
    width: 20,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 2,
  },
  filterOverlay: {
    position: 'absolute',
    bottom: 20,
    right: 76, // Separación clara de los controles de zoom (right: 12 + width ~44 + margen 20)
    width: 300,
    zIndex: 110,
    backgroundColor: 'rgba(30, 30, 30, 0.6)', // Glassmorphism premium unificado
    borderRadius: 24, // Mismo radio de borde
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
      },
      android: { elevation: 12 },
      web: {
        backdropFilter: 'blur(12px)', // Efecto cristal más pronunciado
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
      },
    }),
  },
  filterSectionTitle: {
    color: '#A0AEC0',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 4,
    paddingHorizontal: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tacticalHudContainer: {
    position: 'absolute',
    zIndex: 140,
  },
  tacticalHudGlass: {
    backgroundColor: 'rgba(34, 34, 34, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: 180,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: { elevation: 8 },
      web: {
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.3)',
      },
    }),
  },
  hudHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  hudDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 8,
  },
  hudTitle: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  hudDataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  hudLabel: {
    color: '#A0AEC0',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginRight: 16,
  },
  hudValue: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  telemetryHudContainer: {
    position: 'absolute',
    bottom: 20,
    left: 12,
    zIndex: 110,
  },
  telemetryHudGlass: {
    backgroundColor: 'rgba(34, 34, 34, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: 250,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: { elevation: 8 },
      web: {
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.3)',
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
    backgroundColor: '#3B82F6',
    marginRight: 8,
  },
  telemetryTitle: {
    color: '#60A5FA',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  telemetryMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  compassWrapper: {
    position: 'relative',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  compassRing: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compassText: {
    position: 'absolute',
    color: '#A0AEC0',
    fontSize: 10,
    fontWeight: '700',
  },
  compassTextN: {
    top: 2,
    color: '#EF4444',
  },
  compassTextS: {
    bottom: 2,
  },
  compassTextE: {
    right: 3,
  },
  compassTextO: {
    left: 3,
  },
  compassNeedle: {
    position: 'absolute',
    top: 14,
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderBottomWidth: 18,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#EF4444',
  },
  compassCenterDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    position: 'absolute',
  },
  telemetryDataColumn: {
    flex: 1,
    gap: 3,
  },
  telemetryDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 4,
  },
  telemetryDetailLabel: {
    color: '#A0AEC0',
    fontSize: 8,
    fontWeight: '700',
    width: 60,
  },
  telemetryDetailValue: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
