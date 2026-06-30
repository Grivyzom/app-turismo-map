import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { API_URL } from '../../config/api';
import { getCachedToken } from '../../utils/tokenCache';

export interface SaveToCollectionModalProps {
  visible: boolean;
  onClose: () => void;
  locationData: {
    locationType: 'event' | 'custom_pin';
    refId?: string;
    latitude: number;
    longitude: number;
    title: string;
    notes?: string;
  } | null;
}

interface Collection {
  id: number;
  name: string;
  itemCount?: number;
}

export function SaveToCollectionModal({
  visible,
  onClose,
  locationData,
}: SaveToCollectionModalProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Create mode
  const [isCreating, setIsCreating] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');

  useEffect(() => {
    if (visible) {
      fetchCollections();
      setIsCreating(false);
      setNewCollectionName('');
    }
  }, [visible]);

  const fetchCollections = async () => {
    setLoading(true);
    try {
      const token = await getCachedToken();
      if (!token) throw new Error('No token');

      const response = await fetch(`${API_URL}/api/v1/collections`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCollections(data);
      } else {
        console.error('Error fetching collections');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const createCollection = async () => {
    if (!newCollectionName.trim()) return;
    setSaving(true);
    try {
      const token = await getCachedToken();
      if (!token) throw new Error('No token');

      const response = await fetch(`${API_URL}/api/v1/collections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newCollectionName.trim() }),
      });

      if (response.ok) {
        const newCol = await response.json();
        setCollections([newCol, ...collections]);
        setIsCreating(false);
        setNewCollectionName('');
      } else {
        Alert.alert('Error', 'No se pudo crear la colección');
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const saveToCollection = async (collectionId: number) => {
    if (!locationData) return;
    setSaving(true);
    try {
      const token = await getCachedToken();
      if (!token) throw new Error('No token');

      const payload = {
        collectionId,
        ...locationData,
      };

      const response = await fetch(`${API_URL}/api/v1/collections/locations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        Alert.alert('Guardado', 'Ubicación guardada exitosamente');
        onClose();
      } else {
        Alert.alert('Error', 'No se pudo guardar la ubicación');
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Guardar en Colección</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <MaterialIcons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {loading && !collections.length ? (
            <ActivityIndicator size="large" color="#10B981" style={{ marginVertical: 20 }} />
          ) : isCreating ? (
            <View style={styles.createContainer}>
              <TextInput
                style={styles.input}
                placeholder="Nombre de la colección..."
                placeholderTextColor="#9CA3AF"
                value={newCollectionName}
                onChangeText={setNewCollectionName}
                autoFocus
              />
              <View style={styles.createActions}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnCancel]}
                  onPress={() => setIsCreating(false)}
                  disabled={saving}
                >
                  <Text style={styles.btnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSave]}
                  onPress={createCollection}
                  disabled={saving || !newCollectionName.trim()}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.btnText}>Crear</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <TouchableOpacity style={styles.createRow} onPress={() => setIsCreating(true)}>
                <MaterialIcons name="add" size={24} color="#10B981" />
                <Text style={styles.createText}>Nueva Colección</Text>
              </TouchableOpacity>

              <FlatList
                data={collections}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.collectionRow}
                    onPress={() => saveToCollection(item.id)}
                    disabled={saving}
                  >
                    <MaterialIcons name="folder" size={24} color="#9CA3AF" />
                    <View style={styles.collectionInfo}>
                      <Text style={styles.collectionName}>{item.name}</Text>
                      <Text style={styles.collectionCount}>{item.itemCount || 0} elementos</Text>
                    </View>
                    {saving && <ActivityIndicator size="small" color="#10B981" />}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No tienes colecciones aún.</Text>
                }
              />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '80%',
    minHeight: '40%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeBtn: {
    padding: 4,
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
    marginBottom: 10,
  },
  createText: {
    color: '#10B981',
    fontSize: 16,
    marginLeft: 12,
    fontWeight: '500',
  },
  collectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  collectionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  collectionName: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  collectionCount: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
  emptyText: {
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 20,
  },
  createContainer: {
    marginTop: 10,
  },
  input: {
    backgroundColor: '#1F2937',
    color: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 16,
  },
  createActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginLeft: 10,
    minWidth: 100,
    alignItems: 'center',
  },
  btnCancel: {
    backgroundColor: '#374151',
  },
  btnSave: {
    backgroundColor: '#10B981',
  },
  btnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
