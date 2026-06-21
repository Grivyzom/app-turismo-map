import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform, TextInput } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

interface CoordsEditorHUDProps {
  onClose: () => void;
  crosshairLocation: { latitude: number; longitude: number } | null;
  onRefreshMapData: () => void;
}

export const CoordsEditorHUD: React.FC<CoordsEditorHUDProps> = ({
  onClose,
  crosshairLocation,
  onRefreshMapData,
}) => {
  const [files, setFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [geojsonData, setGeojsonData] = useState<any>(null);
  const [selectedFeatureIndex, setSelectedFeatureIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [newFeatureType, setNewFeatureType] = useState<string>('bench');

  const BASE_URL = 'http://localhost:3005/api/coords';

  useEffect(() => {
    fetch(`${BASE_URL}/files`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setFiles(data);
      })
      .catch(err => console.error('Error fetching coords files:', err));
  }, []);

  const loadFile = (filename: string) => {
    setSelectedFile(filename);
    setSelectedFeatureIndex(null);
    fetch(`${BASE_URL}/${filename}`)
      .then(res => res.json())
      .then(data => setGeojsonData(data))
      .catch(err => console.error('Error reading file:', err));
  };

  const handleMove = (dir: 'up' | 'down' | 'left' | 'right') => {
    if (selectedFeatureIndex === null || !geojsonData) return;
    
    const step = 0.00005; // Finer precision than simulator
    const newData = { ...geojsonData };
    const feature = newData.features[selectedFeatureIndex];
    
    if (feature.geometry.type === 'Point') {
      let [lng, lat] = feature.geometry.coordinates;
      if (dir === 'up') lat += step;
      if (dir === 'down') lat -= step;
      if (dir === 'left') lng -= step;
      if (dir === 'right') lng += step;
      feature.geometry.coordinates = [lng, lat];
      setGeojsonData(newData);
    }
  };

  const addPointAtCrosshair = () => {
    if (!geojsonData || !crosshairLocation) return;
    
    const newFeature = {
      type: 'Feature',
      id: `dev-added-${Date.now()}`,
      properties: {
        amenity: newFeatureType,
        name: `New ${newFeatureType}`,
      },
      geometry: {
        type: 'Point',
        coordinates: [crosshairLocation.longitude, crosshairLocation.latitude]
      }
    };
    
    const newData = { ...geojsonData };
    if (!newData.features) newData.features = [];
    newData.features.push(newFeature);
    
    setGeojsonData(newData);
    setSelectedFeatureIndex(newData.features.length - 1);
  };

  const handleSave = () => {
    if (!selectedFile || !geojsonData) return;
    setIsSaving(true);
    
    fetch(`${BASE_URL}/${selectedFile}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geojsonData),
    })
      .then(res => res.json())
      .then(() => {
        setIsSaving(false);
        onRefreshMapData(); // Force app to reload coords if necessary
        alert('Archivo guardado correctamente en el disco.');
      })
      .catch(err => {
        console.error('Error saving:', err);
        setIsSaving(false);
        alert('Error al guardar. Asegúrate de que coords-dev-server esté corriendo.');
      });
  };

  const pointFeatures = geojsonData?.features?.map((f: any, idx: number) => ({ ...f, _idx: idx })).filter((f: any) => f.geometry?.type === 'Point') || [];

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.glassContainer}>
        <View style={styles.header}>
          <MaterialIcons name="edit-location" size={18} color="#8B5CF6" />
          <Text style={styles.title}>COORDS EDITOR DEV</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialIcons name="close" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {!selectedFile ? (
          <View>
            <Text style={styles.sectionTitle}>Selecciona Archivo (Solo lectura local)</Text>
            <ScrollView style={{ maxHeight: 150 }}>
              {files.map(f => (
                <TouchableOpacity key={f} style={styles.fileButton} onPress={() => loadFile(f)}>
                  <MaterialIcons name="description" size={14} color="#9CA3AF" />
                  <Text style={styles.fileText}>{f}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <TouchableOpacity onPress={() => setSelectedFile(null)}>
                <Text style={{ color: '#8B5CF6', fontSize: 12 }}>← Volver</Text>
              </TouchableOpacity>
              <Text style={{ color: '#FFF', fontSize: 12, fontWeight: 'bold' }}>{selectedFile}</Text>
            </View>

            {crosshairLocation && (
              <View style={styles.addSection}>
                <TextInput 
                  style={styles.input} 
                  value={newFeatureType} 
                  onChangeText={setNewFeatureType} 
                  placeholder="Ej: bench, waste_basket"
                  placeholderTextColor="#6B7280"
                />
                <TouchableOpacity style={styles.addButton} onPress={addPointAtCrosshair}>
                  <Text style={styles.addButtonText}>+ Insertar en Mira</Text>
                </TouchableOpacity>
              </View>
            )}

            <ScrollView style={styles.eventsList}>
              {pointFeatures.map((feature: any) => {
                const isSelected = selectedFeatureIndex === feature._idx;
                return (
                  <View key={feature._idx} style={[styles.eventCard, isSelected && { borderColor: '#8B5CF6', backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
                    <TouchableOpacity 
                      style={styles.eventInfo}
                      onPress={() => setSelectedFeatureIndex(isSelected ? null : feature._idx)}
                    >
                      <Text style={styles.eventName}>{feature.properties?.amenity || feature.properties?.name || 'Punto Sin Nombre'}</Text>
                      <Text style={styles.eventCoords}>{feature.geometry.coordinates[1].toFixed(5)}, {feature.geometry.coordinates[0].toFixed(5)}</Text>
                    </TouchableOpacity>
                    
                    {isSelected && (
                      <View style={styles.dpad}>
                        <TouchableOpacity style={styles.dpadBtn} onPress={() => handleMove('up')}>
                          <MaterialIcons name="arrow-upward" size={16} color="#FFF" />
                        </TouchableOpacity>
                        <View style={styles.dpadMiddle}>
                          <TouchableOpacity style={styles.dpadBtn} onPress={() => handleMove('left')}>
                            <MaterialIcons name="arrow-back" size={16} color="#FFF" />
                          </TouchableOpacity>
                          <View style={styles.dpadCenter} />
                          <TouchableOpacity style={styles.dpadBtn} onPress={() => handleMove('right')}>
                            <MaterialIcons name="arrow-forward" size={16} color="#FFF" />
                          </TouchableOpacity>
                        </View>
                        <TouchableOpacity style={styles.dpadBtn} onPress={() => handleMove('down')}>
                          <MaterialIcons name="arrow-downward" size={16} color="#FFF" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            <TouchableOpacity 
              style={[styles.saveButton, isSaving && { opacity: 0.5 }]} 
              onPress={handleSave}
              disabled={isSaving}
            >
              <Text style={styles.saveButtonText}>{isSaving ? 'Guardando...' : 'GUARDAR ARCHIVO (POST)'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 80,
    left: 20,
    zIndex: 4000,
    width: 280,
    maxHeight: 500,
  },
  glassContainer: {
    backgroundColor: 'rgba(11, 15, 25, 0.95)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.5)',
    padding: 16,
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  title: {
    color: '#8B5CF6',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    flex: 1,
  },
  closeButton: { padding: 4 },
  sectionTitle: { color: '#9CA3AF', fontSize: 11, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase' },
  fileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    marginBottom: 6,
  },
  fileText: { color: '#FFF', fontSize: 12, marginLeft: 8 },
  eventsList: { marginTop: 12, flex: 1 },
  eventCard: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 8,
    overflow: 'hidden',
  },
  eventInfo: { padding: 12 },
  eventName: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  eventCoords: { color: '#9CA3AF', fontSize: 11, marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  dpad: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 8,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  dpadMiddle: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  dpadCenter: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 8 },
  dpadBtn: {
    backgroundColor: 'rgba(139, 92, 246, 0.4)',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  saveButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  addSection: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    color: '#FFF',
    borderRadius: 6,
    paddingHorizontal: 8,
    fontSize: 12,
    height: 32,
  },
  addButton: {
    backgroundColor: '#10B981',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  addButtonText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' }
});
