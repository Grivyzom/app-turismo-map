import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';

import { SearchableSelect } from '../ui/SearchableSelect';

interface CreateSectorModalProps {
  visible: boolean;
  onClose: () => void;
  extractedGeometry?: any;
  draftRoutePoints?: any[];
  showNotification: (msg: string) => void;
  onSuccess?: () => void;
  hidden?: boolean;
  onStartDrawing?: () => void;
}

export const CreateSectorModal: React.FC<CreateSectorModalProps> = ({
  visible,
  onClose,
  extractedGeometry,
  draftRoutePoints,
  showNotification,
  onSuccess,
  hidden,
  onStartDrawing,
}) => {
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('edificio');
  const [formRating, setFormRating] = useState('');
  const [formOpeningHours, setFormOpeningHours] = useState('');
  const [formParkType, setFormParkType] = useState('');
  const [formImages, setFormImages] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categoryOptions = [
    { label: 'Edificio / Mall', value: 'edificio' },
    { label: 'Reserva / Parque', value: 'reserva' },
    { label: 'Sector de Ciudad', value: 'ciudad' },
    { label: 'Pabellón / Zona Interna', value: 'subzona' },
  ];

  const handleCreateSector = async () => {
    if (!formName.trim()) {
      showNotification('Por favor ingresa un nombre para el sector');
      return;
    }
    if (!extractedGeometry && (!draftRoutePoints || draftRoutePoints.length === 0)) {
      showNotification('Error: No se ha capturado la geometría del sector');
      return;
    }

    setIsSubmitting(true);
    try {
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8080';
      const payload: any = {
        name: formName,
        description: formDescription,
        category: formCategory,
        color:
          formCategory === 'edificio'
            ? '#6366F1'
            : formCategory === 'reserva'
              ? '#22C55E'
              : '#EAB308',
      };

      if (formCategory === 'reserva') {
        if (formRating.trim()) payload.rating = parseFloat(formRating);
        if (formOpeningHours.trim()) payload.openingHours = formOpeningHours.trim();
        if (formParkType.trim()) payload.parkType = formParkType.trim();
        const imagesList = formImages
          .split('\n')
          .map((url) => url.trim())
          .filter(Boolean);
        if (imagesList.length > 0) payload.images = imagesList;
      }

      if (extractedGeometry) {
        payload.geojson = extractedGeometry;
      } else if (draftRoutePoints) {
        payload.points = draftRoutePoints.map((p, i) => ({
          latitude: p.latitude,
          longitude: p.longitude,
          orderIndex: i,
          pointType: p.type || 'waypoint',
        }));
      }

      const response = await fetch(`${baseUrl}/api/v1/admin/zones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        showNotification(
          extractedGeometry
            ? 'Sector creado exitosamente con Varita Mágica'
            : 'Sector creado exitosamente manual',
        );
        if (onSuccess) onSuccess();
        onClose();
      } else {
        const errData = await response.text();
        showNotification(`Error al crear el sector: ${errData}`);
      }
    } catch (e) {
      console.error(e);
      showNotification('Error de red al crear el sector');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!visible) return null;
  if (hidden) return <View style={{ display: 'none' }} />;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.modalContainer}>
        <View style={styles.header}>
          <Text style={styles.titleText}>🪄 CREAR SECTOR (MÁGICO)</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.badgeContainer}>
            <MaterialIcons
              name={extractedGeometry ? 'auto-awesome' : 'format-shapes'}
              size={16}
              color="#38BDF8"
            />
            <Text style={styles.badgeText}>
              {extractedGeometry
                ? 'Geometría capturada automáticamente.'
                : 'Geometría trazada manualmente.'}
            </Text>
          </View>

          <Text style={styles.label}>Nombre del Sector</Text>
          <TextInput
            style={styles.input}
            value={formName}
            onChangeText={setFormName}
            placeholder="Ej. Costanera Center"
            placeholderTextColor="#475569"
          />

          <Text style={styles.label}>Categoría</Text>
          <SearchableSelect
            options={categoryOptions}
            value={formCategory}
            onChange={(val: string) => setFormCategory(val)}
            placeholder="Selecciona categoría..."
          />

          <Text style={styles.label}>Descripción</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            value={formDescription}
            onChangeText={setFormDescription}
            placeholder="Describe este sector..."
            placeholderTextColor="#475569"
            multiline
          />

          {formCategory === 'reserva' && (
            <>
              <Text style={styles.label}>Calificación (0 a 5)</Text>
              <TextInput
                style={styles.input}
                value={formRating}
                onChangeText={setFormRating}
                placeholder="Ej. 4.5"
                placeholderTextColor="#475569"
                keyboardType="decimal-pad"
              />

              <Text style={styles.label}>Horario de Apertura</Text>
              <TextInput
                style={styles.input}
                value={formOpeningHours}
                onChangeText={setFormOpeningHours}
                placeholder="Ej. Lu-Do 08:00-20:00"
                placeholderTextColor="#475569"
              />

              <Text style={styles.label}>Tipo de Parque</Text>
              <TextInput
                style={styles.input}
                value={formParkType}
                onChangeText={setFormParkType}
                placeholder="Ej. Parque Urbano, Reserva Natural, Humedal Protegido"
                placeholderTextColor="#475569"
              />

              <Text style={styles.label}>Imágenes (una URL por línea)</Text>
              <TextInput
                style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
                value={formImages}
                onChangeText={setFormImages}
                placeholder={'https://...\nhttps://...'}
                placeholderTextColor="#475569"
                multiline
              />
            </>
          )}

          {!extractedGeometry && (!draftRoutePoints || draftRoutePoints.length === 0) ? (
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: '#F59E0B', marginTop: 10 }]}
              onPress={() => {
                if (onStartDrawing) onStartDrawing();
              }}
            >
              <Text style={styles.saveBtnText}>Dibujar en Mapa</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.saveBtn, isSubmitting && { opacity: 0.7 }]}
              onPress={handleCreateSector}
              disabled={isSubmitting}
            >
              <Text style={styles.saveBtnText}>
                {isSubmitting ? 'Guardando...' : 'Crear Sector'}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    position: 'absolute',
    bottom: 20,
    left: '50%',
    transform: [{ translateX: -190 }],
    width: 380,
    backgroundColor: '#0F172A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
    padding: 24,
    zIndex: 9999,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  titleText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  closeButton: {
    padding: 8,
    backgroundColor: '#1E293B',
    borderRadius: 20,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
  },
  badgeText: {
    color: '#38BDF8',
    fontSize: 13,
    marginLeft: 8,
    fontWeight: '500',
  },
  label: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#1E293B',
    color: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  saveBtn: {
    backgroundColor: '#38BDF8',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.5,
  },
});
