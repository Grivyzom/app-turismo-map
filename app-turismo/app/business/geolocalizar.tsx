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
  Image,
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

export default function BusinessGeolocalizarScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const { userLocation } = useUserLocation();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // States
  const [mapPincho, setMapPincho] = useState<MapCoordinate | null>(null);
  const [address, setAddress] = useState('');
  const [branchName, setBranchName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('gastronomia');
  const [phone, setPhone] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);

  // Cargar ubicación actual guardada
  useEffect(() => {
    async function loadSavedLocation() {
      try {
        const res = await fetch(`${getBackendUrl()}/api/v1/business/location`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();

        if (res.ok && data.success) {
          if (data.hasLocation) {
            setMapPincho({
              latitude: data.latitude,
              longitude: data.longitude,
            });
            setAddress(data.address || '');
            setBranchName(data.branchName || '');
            setDescription(data.description || '');
            setCategory(data.category || 'gastronomia');
            setPhone(data.phone || '');
            setImageUrl(data.imageUrl || '');
          }
        }
      } catch (error) {
        console.warn('Error loading company location:', error);
      } finally {
        setIsLoading(false);
      }
    }

    if (token) {
      void loadSavedLocation();
    } else {
      setIsLoading(false);
    }
  }, [token]);

  // Resolver dirección al colocar o mover el pin
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

  // Posicionar pin en la ubicación GPS del dispositivo
  const handleUseGps = () => {
    if (userLocation) {
      void handleMapPinchoChange({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
      });
      showAlert('Ubicación GPS', 'Pin colocado en las coordenadas del GPS.');
    } else {
      showAlert('Ubicación GPS', 'No se pudo obtener la ubicación GPS actual. Intente nuevamente.');
    }
  };

  // Guardar ubicación en el servidor
  const handleSave = async () => {
    if (!mapPincho) {
      showAlert('Falta información', 'Por favor selecciona la ubicación de tu empresa en el mapa.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`${getBackendUrl()}/api/v1/business/location/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          latitude: mapPincho.latitude,
          longitude: mapPincho.longitude,
          address: address.trim(),
          branchName: branchName.trim(),
          description: description.trim(),
          category,
          phone: phone.trim(),
          imageUrl: imageUrl.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        showAlert('Guardado', 'La ubicación de la empresa se ha geolocalizado correctamente.');
        router.back();
      } else {
        showAlert('Error', data.message || 'No se pudo guardar la ubicación.');
      }
    } catch (error) {
      console.error('Error saving company location:', error);
      showAlert('Error', 'Ocurrió un problema de red al intentar guardar la ubicación.');
    } finally {
      setIsSaving(false);
    }
  };

  // Crear un evento ficticio para centrar y animar el pin en el MapContainer
  const fakeCompanyEvent: TurismoEvent | null = mapPincho
    ? {
        id: 'company-temp-id',
        title: branchName || 'Mi Empresa',
        description: description || address || 'Ubicación seleccionada',
        latitude: mapPincho.latitude,
        longitude: mapPincho.longitude,
        category: category as any,
        organizer: 'Empresa',
        time: 'Ahora',
        imageUrl: imageUrl || undefined,
      }
    : null;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={GREEN} />
      </View>
    );
  }

  const activeCategoryColor = CATEGORY_OPTIONS.find((c) => c.id === category)?.color || GREEN;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Geolocalizar Empresa</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Info Card */}
        <View style={styles.infoCard}>
          <MaterialIcons name="info" size={22} color={GREEN} style={styles.infoIcon} />
          <Text style={styles.infoText}>
            Configura los datos y la ubicación de tu empresa. El marcador y la imagen serán visibles
            para los visitantes que exploren la zona.
          </Text>
        </View>

        {/* Map Container Wrapper */}
        <View style={styles.mapWrapper}>
          <MapContainer
            events={fakeCompanyEvent ? [fakeCompanyEvent] : []}
            selectedEvent={fakeCompanyEvent}
            onSelectEvent={() => {}}
            mapLayer="streets"
            mapPincho={mapPincho}
            onMapPincho={handleMapPinchoChange}
          />
        </View>

        {/* GPS Button */}
        <TouchableOpacity onPress={handleUseGps} style={styles.gpsButton} activeOpacity={0.8}>
          <MaterialIcons name="my-location" size={20} color={GREEN} />
          <Text style={styles.gpsButtonText}>Usar ubicación GPS actual</Text>
        </TouchableOpacity>

        {/* Form Fields */}
        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nombre Comercial de la Empresa</Text>
            <TextInput
              style={styles.input}
              value={branchName}
              onChangeText={setBranchName}
              placeholder="Ej. Cervecería Kunstmann"
              placeholderTextColor="#9ca3af"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Descripción de Actividad</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={description}
              onChangeText={setDescription}
              placeholder="Ej. Ofrecemos cervezas artesanales y gastronomía alemana con vista al río."
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Categoría */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Categoría Principal</Text>
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

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Teléfono de Contacto</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="Ej. +56 9 1234 5678"
              placeholderTextColor="#9ca3af"
              keyboardType="phone-pad"
            />
          </View>

          {/* Imagen de Pin / Imagen de portada */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>URL de la Imagen de Portada (Pin)</Text>
            <TextInput
              style={styles.input}
              value={imageUrl}
              onChangeText={setImageUrl}
              placeholder="Ej. https://domain.com/imagen.jpg"
              placeholderTextColor="#9ca3af"
              keyboardType="url"
              autoCapitalize="none"
            />
            {imageUrl.trim().startsWith('http') && (
              <View style={styles.imagePreviewContainer}>
                <Text style={styles.previewLabel}>Vista Previa de Imagen:</Text>
                <Image
                  source={{ uri: imageUrl.trim() }}
                  style={styles.imagePreview}
                  resizeMode="cover"
                />
              </View>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Dirección Física</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.input, { paddingRight: 40 }]}
                value={address}
                onChangeText={setAddress}
                placeholder="Dirección o coordenadas de la empresa"
                placeholderTextColor="#9ca3af"
              />
              {isResolvingAddress && (
                <ActivityIndicator size="small" color={GREEN} style={styles.inputLoader} />
              )}
            </View>
          </View>

          {mapPincho && (
            <View style={styles.coordsCard}>
              <MaterialIcons name="explore" size={18} color="#6b7280" />
              <Text style={styles.coordsText}>
                Coordenadas: {mapPincho.latitude.toFixed(6)}, {mapPincho.longitude.toFixed(6)}
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <TouchableOpacity
            onPress={handleSave}
            style={[styles.saveButton, isSaving && { opacity: 0.7 }]}
            disabled={isSaving}
            activeOpacity={0.8}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.saveButtonText}>Guardar Ubicación</Text>
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
  mapWrapper: {
    height: 300,
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
  inputWrapper: {
    position: 'relative',
    justifyContent: 'center',
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
    height: 80,
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
  imagePreviewContainer: {
    marginTop: 4,
    gap: 6,
  },
  previewLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
  },
  imagePreview: {
    width: '100%',
    height: 150,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  inputLoader: {
    position: 'absolute',
    right: 14,
  },
  coordsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  coordsText: {
    fontSize: 12,
    color: '#4b5563',
    fontWeight: '500',
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
