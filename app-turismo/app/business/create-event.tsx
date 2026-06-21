import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { useAuth } from '../../src/context/AuthContext';
import { MapContainer } from '../../src/components/Map/MapContainer';
import { MapCoordinate, TurismoEvent } from '../../src/components/Map/types';
import { useUserLocation } from '../../src/hooks/useUserLocation';
import { reverseGeocode } from '../../src/utils/mapPincho';

// ─── Colores del portal empresarial ──────────────────────────────────────────
const GREEN = '#1a4335';
const GREEN_LIGHT = '#e8f5e9';
const NAVY = '#002d20';

const CATEGORY_OPTIONS = [
  { id: 'gastronomia', label: 'Gastronomía', icon: 'restaurant', color: '#dc2626' },
  { id: 'cultura', label: 'Cultura', icon: 'theater-comedy', color: '#d97706' },
  { id: 'naturaleza', label: 'Naturaleza', icon: 'forest', color: '#059669' },
  { id: 'musica', label: 'Música', icon: 'music-note', color: '#7c3aed' },
  { id: 'deportes', label: 'Deporte', icon: 'sports-soccer', color: '#2563eb' },
];

const getBackendUrl = () => {
  const url = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (!url || url === 'undefined') {
    return 'http://localhost:8081';
  }
  return url;
};

const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    alert(`${title}: ${message}`);
  } else {
    Alert.alert(title, message);
  }
};

const formatDate = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
};

export default function BusinessCreateEventScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const { userLocation } = useUserLocation();

  const [isLoadingCompanyLocation, setIsLoadingCompanyLocation] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('gastronomia');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [mapPincho, setMapPincho] = useState<MapCoordinate | null>(null);
  const [address, setAddress] = useState('');
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);

  // Cargar valores por defecto de fecha/hora
  useEffect(() => {
    const now = new Date();
    // Redondear a la siguiente hora
    now.setHours(now.getHours() + 1, 0, 0, 0);
    setStartTime(formatDate(now));

    const future = new Date(now);
    future.setHours(future.getHours() + 3);
    setEndTime(formatDate(future));
  }, []);

  // Cargar ubicación de la empresa por defecto
  useEffect(() => {
    async function loadCompanyLocation() {
      try {
        const res = await fetch(`${getBackendUrl()}/api/v1/business/location`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();

        if (res.ok && data.success && data.hasLocation) {
          setMapPincho({
            latitude: data.latitude,
            longitude: data.longitude,
          });
          setAddress(data.address || '');
        } else if (userLocation) {
          // Si no tiene ubicación de empresa configurada, usar GPS como fallback
          setMapPincho({
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
          });
        }
      } catch (error) {
        console.warn('Error loading company location:', error);
        if (userLocation) {
          setMapPincho({
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
          });
        }
      } finally {
        setIsLoadingCompanyLocation(false);
      }
    }

    if (token) {
      void loadCompanyLocation();
    } else {
      setIsLoadingCompanyLocation(false);
    }
  }, [token, userLocation]);

  // Resolver dirección al mover el pin
  const handleMapPinchoChange = async (coord: MapCoordinate) => {
    setMapPincho(coord);
    setIsResolvingAddress(true);
    try {
      const addr = await reverseGeocode(coord.latitude, coord.longitude);
      if (addr) {
        setAddress(addr);
      } else {
        setAddress(`${coord.latitude.toFixed(5)}, ${coord.longitude.toFixed(5)}`);
      }
    } catch (error) {
      console.warn('Error in reverse geocoding:', error);
      setAddress(`${coord.latitude.toFixed(5)}, ${coord.longitude.toFixed(5)}`);
    } finally {
      setIsResolvingAddress(false);
    }
  };

  // Posicionar pin en la ubicación GPS actual
  const handleUseGps = () => {
    if (userLocation) {
      void handleMapPinchoChange({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
      });
      showAlert('Ubicación GPS', 'Pin del evento colocado en tu ubicación actual.');
    } else {
      showAlert('Ubicación GPS', 'No se pudo obtener la ubicación GPS actual.');
    }
  };

  // Atajos rápidos de fecha
  const setTimeShortcut = (type: 'later' | 'tomorrow' | 'weekend') => {
    const now = new Date();
    if (type === 'later') {
      now.setHours(now.getHours() + 1, 0, 0, 0);
      setStartTime(formatDate(now));
      const end = new Date(now);
      end.setHours(end.getHours() + 3);
      setEndTime(formatDate(end));
    } else if (type === 'tomorrow') {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(12, 0, 0, 0);
      setStartTime(formatDate(tomorrow));
      const end = new Date(tomorrow);
      end.setHours(18, 0, 0, 0);
      setEndTime(formatDate(end));
    } else if (type === 'weekend') {
      const sat = new Date(now);
      sat.setDate(sat.getDate() + (6 - sat.getDay()));
      sat.setHours(10, 0, 0, 0);
      setStartTime(formatDate(sat));
      const sun = new Date(sat);
      sun.setDate(sun.getDate() + 1);
      sun.setHours(22, 0, 0, 0);
      setEndTime(formatDate(sun));
    }
  };

  // Publicar el evento
  const handlePublish = async () => {
    if (!title.trim()) {
      showAlert('Falta información', 'Por favor ingresa un título para el evento.');
      return;
    }
    if (!mapPincho) {
      showAlert('Falta información', 'Por favor selecciona la ubicación del evento en el mapa.');
      return;
    }

    // Convertir fechas ingresadas a formato ISO legible
    let startIso: string;
    let endIso: string;
    try {
      const cleanedStart = startTime.replace(' ', 'T') + ':00Z'; // formateado como RFC3339 simple
      const cleanedEnd = endTime.replace(' ', 'T') + ':00Z';
      startIso = new Date(cleanedStart).toISOString();
      endIso = new Date(cleanedEnd).toISOString();
    } catch {
      startIso = new Date().toISOString();
      endIso = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    }

    setIsSaving(true);
    try {
      const res = await fetch(`${getBackendUrl()}/api/v1/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          startTime: startIso,
          endTime: endIso,
          category,
          latitude: mapPincho.latitude,
          longitude: mapPincho.longitude,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        showAlert('Publicado', 'Tu evento ha sido registrado exitosamente en el mapa turístico.');
        router.back();
      } else {
        showAlert('Error', data.message || 'No se pudo registrar el evento.');
      }
    } catch (error) {
      console.error('Error creating event:', error);
      showAlert('Error', 'Ocurrió un problema de red al intentar registrar el evento.');
    } finally {
      setIsSaving(false);
    }
  };

  // Crear evento ficticio para mostrar e interactuar en el mapa
  const fakeEvent: TurismoEvent | null = mapPincho
    ? {
        id: 'event-temp-id',
        title: title || 'Título del Evento',
        description: description || 'Ubicación seleccionada',
        latitude: mapPincho.latitude,
        longitude: mapPincho.longitude,
        category: category as any,
        organizer: 'Empresa',
        time: 'Ahora',
      }
    : null;

  if (isLoadingCompanyLocation) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={GREEN} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Crear Evento</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Info Card */}
        <View style={styles.infoCard}>
          <MaterialIcons name="event-available" size={22} color={GREEN} style={styles.infoIcon} />
          <Text style={styles.infoText}>
            Publica eventos, talleres o promociones especiales. Los turistas verán el pin en el mapa
            de Valdivia en tiempo real.
          </Text>
        </View>

        {/* Form Fields */}
        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Título del Evento</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Ej. Tarde de Jazz en Vivo"
              placeholderTextColor="#9ca3af"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Descripción</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={description}
              onChangeText={setDescription}
              placeholder="Detalla qué harás, horarios específicos, reservas..."
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={4}
            />
          </View>

          {/* Categorías */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Categoría del Evento</Text>
            <View style={styles.chipsContainer}>
              {CATEGORY_OPTIONS.map((cat) => {
                const isSelected = category === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => setCategory(cat.id)}
                    style={[
                      styles.chip,
                      isSelected && { backgroundColor: cat.color + '18', borderColor: cat.color },
                    ]}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons
                      name={cat.icon as any}
                      size={16}
                      color={isSelected ? cat.color : '#6b7280'}
                    />
                    <Text
                      style={[
                        styles.chipText,
                        isSelected && { color: cat.color, fontWeight: '700' },
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Fecha y hora */}
          <View style={styles.timeSection}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Inicio (YYYY-MM-DD HH:MM)</Text>
              <TextInput
                style={styles.input}
                value={startTime}
                onChangeText={setStartTime}
                placeholder="2026-06-08 18:00"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Término (YYYY-MM-DD HH:MM)</Text>
              <TextInput
                style={styles.input}
                value={endTime}
                onChangeText={setEndTime}
                placeholder="2026-06-08 21:00"
                placeholderTextColor="#9ca3af"
              />
            </View>
          </View>

          {/* Atajos de tiempo */}
          <View style={styles.shortcutsContainer}>
            <TouchableOpacity onPress={() => setTimeShortcut('later')} style={styles.shortcutBtn}>
              <Text style={styles.shortcutText}>Hoy más tarde</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setTimeShortcut('tomorrow')}
              style={styles.shortcutBtn}
            >
              <Text style={styles.shortcutText}>Mañana</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setTimeShortcut('weekend')} style={styles.shortcutBtn}>
              <Text style={styles.shortcutText}>Fin de semana</Text>
            </TouchableOpacity>
          </View>

          {/* Geolocalización */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Geolocalización del Evento</Text>
            <Text style={styles.sublabel}>
              Toca el mapa para establecer dónde ocurrirá el evento.
            </Text>
            <View style={styles.mapWrapper}>
              <MapContainer
                events={fakeEvent ? [fakeEvent] : []}
                selectedEvent={fakeEvent}
                onSelectEvent={() => {}}
                mapLayer="streets"
                mapPincho={mapPincho}
                onMapPincho={handleMapPinchoChange}
              />
            </View>
          </View>

          {/* GPS Button */}
          <TouchableOpacity onPress={handleUseGps} style={styles.gpsButton} activeOpacity={0.8}>
            <MaterialIcons name="my-location" size={20} color={GREEN} />
            <Text style={styles.gpsButtonText}>Usar ubicación GPS actual</Text>
          </TouchableOpacity>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Dirección del Evento</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.input, { paddingRight: 40 }]}
                value={address}
                onChangeText={setAddress}
                placeholder="Ubicación física resuelta"
                placeholderTextColor="#9ca3af"
              />
              {isResolvingAddress && (
                <ActivityIndicator size="small" color={GREEN} style={styles.inputLoader} />
              )}
            </View>
          </View>

          {/* Publicar */}
          <TouchableOpacity
            onPress={handlePublish}
            style={[styles.saveButton, isSaving && { opacity: 0.7 }]}
            disabled={isSaving}
            activeOpacity={0.8}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.saveButtonText}>Publicar Evento</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.cancelButton}
            activeOpacity={0.8}
          >
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: GREEN,
    paddingTop: Platform.OS === 'web' ? 32 : 56,
    paddingBottom: 20,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    ...Platform.select({
      web: { boxShadow: '0 4px 16px rgba(26,67,53,0.15)' },
      default: { elevation: 4 },
    }),
  } as any,
  backButton: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 24,
    gap: 20,
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    borderLeftWidth: 4,
    borderLeftColor: GREEN,
    ...Platform.select({
      web: { boxShadow: '0 4px 12px rgba(0,45,32,0.04)' },
      default: { elevation: 1 },
    }),
  } as any,
  infoIcon: {
    marginTop: 2,
  },
  infoText: {
    color: NAVY,
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  formContainer: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    color: NAVY,
    fontSize: 13,
    fontWeight: '600',
  },
  sublabel: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: -4,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: NAVY,
    fontSize: 14,
    ...(Platform.select({
      web: { outlineStyle: 'none' },
    }) as any),
  },
  multilineInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 12,
    color: '#4b5563',
  },
  timeSection: {
    flexDirection: 'row',
    gap: 12,
  },
  shortcutsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: -4,
  },
  shortcutBtn: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  shortcutText: {
    fontSize: 12,
    color: '#4b5563',
    fontWeight: '500',
  },
  mapWrapper: {
    height: 280,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    position: 'relative',
    ...Platform.select({
      web: { boxShadow: '0 4px 16px rgba(0,0,0,0.06)' },
    }),
  } as any,
  gpsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GREEN_LIGHT,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: `${GREEN}22`,
  },
  gpsButtonText: {
    color: GREEN,
    fontSize: 14,
    fontWeight: '600',
  },
  inputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  inputLoader: {
    position: 'absolute',
    right: 14,
  },
  saveButton: {
    backgroundColor: GREEN,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    ...Platform.select({
      web: { cursor: 'pointer', boxShadow: '0 4px 12px rgba(26,67,53,0.2)' },
    }),
  } as any,
  saveButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  } as any,
  cancelButtonText: {
    color: '#6b7280',
    fontSize: 15,
    fontWeight: '600',
  },
});
