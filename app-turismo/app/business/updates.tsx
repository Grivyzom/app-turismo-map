import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { API_URL } from '../../src/config/api';
import { getCachedToken } from '../../src/utils/tokenCache';

const GREEN = '#1a4335';
const GREEN_LIGHT = '#e8f5e9';
const NAVY = '#002d20';

export default function BusinessUpdatesScreen() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      setErrorMsg('El título y la descripción son obligatorios.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      const token = await getCachedToken();
      if (!token) throw new Error('No token found');

      const body = {
        branchId: 1, // Placeholder: Debería obtenerse del selector de sucursales si tiene varias
        title: title.trim(),
        description: description.trim(),
        type: 'general',
      };

      const res = await fetch(`${API_URL}/api/v1/business/updates`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error('Error al publicar la novedad');
      }

      setSuccessMsg('Novedad publicada exitosamente. ¡Tus seguidores han sido notificados!');
      setTitle('');
      setDescription('');
    } catch (err) {
      console.error(err);
      setErrorMsg('No se pudo publicar la novedad. Inténtalo de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#f9fafa' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={NAVY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Publicar Novedad</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.infoBox}>
          <MaterialIcons name="info-outline" size={20} color={GREEN} />
          <Text style={styles.infoText}>
            Las novedades aparecen en el mapa como alertas en tu sucursal y se envían como
            notificaciones a todos los usuarios que siguen tu negocio.
          </Text>
        </View>

        {errorMsg ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        {successMsg ? (
          <View style={styles.successBox}>
            <Text style={styles.successText}>{successMsg}</Text>
          </View>
        ) : null}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Título (Ej. "¡Llegó pan caliente!")</Text>
          <TextInput
            style={styles.input}
            placeholder="Título de la novedad"
            placeholderTextColor="#9CA3AF"
            value={title}
            onChangeText={setTitle}
            maxLength={50}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Descripción</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Detalles sobre la novedad..."
            placeholderTextColor="#9CA3AF"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            maxLength={200}
          />
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Publicar Ahora</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: NAVY,
  },
  content: {
    padding: 24,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: GREEN_LIGHT,
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
    gap: 12,
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    color: GREEN,
    fontSize: 14,
    lineHeight: 20,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 14,
  },
  successBox: {
    backgroundColor: '#D1FAE5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  successText: {
    color: '#047857',
    fontSize: 14,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: NAVY,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: GREEN,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
