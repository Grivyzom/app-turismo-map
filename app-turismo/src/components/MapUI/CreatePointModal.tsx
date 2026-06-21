import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Pressable } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SearchableSelect } from '../ui/SearchableSelect';
import { TurismoEvent } from '../Map/types';

interface CreatePointModalProps {
  visible: boolean;
  onClose: () => void;
  tacticalLocation: any;
  formAddress: string;
  setFormAddress: (val: string) => void;
  handleCreateNewEvent: (
    title: string,
    description: string,
    category: any,
    targetAudience: string,
    time: string,
    address: string,
    imageUrl: string
  ) => void;
  showNotification: (msg: string) => void;
}

export const CreatePointModal: React.FC<CreatePointModalProps> = ({
  visible,
  onClose,
  tacticalLocation,
  formAddress,
  setFormAddress,
  handleCreateNewEvent,
  showNotification
}) => {
  const [formPointType, setFormPointType] = React.useState('Fauna');
  const [formCategory, setFormCategory] = React.useState('naturaleza');
  const [formTargetAudience, setFormTargetAudience] = React.useState('Todo Público');
  const [formTitle, setFormTitle] = React.useState('');
  const [formDescription, setFormDescription] = React.useState('');
  const [formSvgIcon, setFormSvgIcon] = React.useState('');
  const [formStartDate, setFormStartDate] = React.useState('');
  const [formEndDate, setFormEndDate] = React.useState('');
  const [faunaTypes, setFaunaTypes] = React.useState<{label: string, value: string}[]>([]);

  React.useEffect(() => {
    if (visible && formPointType?.toLowerCase() === 'fauna') {
      fetchFaunaTypes();
    }
  }, [visible, formPointType]);

  const fetchFaunaTypes = async () => {
    try {
      const url = (process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8081') + '/api/v1/fauna-types';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setFaunaTypes(data.map((f: any) => ({ label: f.name, value: f.name })));
      }
    } catch (e) {
      console.warn("Error fetching fauna types:", e);
    }
  };

  const handleCategoryChange = (val: string) => {
    if (val === 'nuevo +') {
      const newFauna = prompt("Ingrese el nombre de la nueva fauna:");
      if (newFauna) {
        const url = (process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8081') + '/api/v1/fauna-types';
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newFauna })
        }).then(() => {
          fetchFaunaTypes();
          setFormCategory(newFauna);
        }).catch(() => showNotification("Error al crear fauna"));
      }
      return;
    }
    setFormCategory(val);
  };

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
      />
      <View style={styles.modalContainer}>
        <View style={styles.header}>
          <Text style={styles.titleText}>NUEVO PUNTO / EVENTO</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          <SearchableSelect
            label="TIPO DE PUNTO"
            value={formPointType}
            onChange={(val) => {
              setFormPointType(val);
              // Reset category when type changes
              if (val?.toLowerCase() === 'fauna') {
                setFormCategory('');
              } else {
                setFormCategory('naturaleza');
              }
            }}
            options={[
              { label: 'Fauna', value: 'Fauna' },
              { label: 'Comercio', value: 'Comercio' },
              { label: 'Evento', value: 'Evento' },
              { label: 'Infraestructura', value: 'Infraestructura' },
              { label: 'Punto de Interés', value: 'Punto de Interés' }
            ]}
            placeholder="Selecciona un tipo"
          />

          <SearchableSelect
            label="CATEGORÍA"
            value={formCategory}
            onChange={handleCategoryChange}
            options={formPointType?.toLowerCase() === 'fauna' ? [...faunaTypes, { label: 'nuevo +', value: 'nuevo +' }] : [
              { label: 'Cultura', value: 'cultura' },
              { label: 'Naturaleza', value: 'naturaleza' },
              { label: 'Gastronomía', value: 'gastronomia' },
              { label: 'Deportes', value: 'deportes' },
              { label: 'Música', value: 'musica' },
              { label: 'Choque/Incidente', value: 'choque' },
              { label: 'Público', value: 'publico' }
            ]}
            placeholder="Selecciona una categoría"
          />

          <Text style={styles.label}>PÚBLICO OBJETIVO</Text>
          <TextInput style={styles.input} placeholder="Ej. Todo Público" placeholderTextColor="#4A5568" value={formTargetAudience} onChangeText={setFormTargetAudience} />

          <Text style={styles.label}>TÍTULO DEL PUNTO</Text>
          <TextInput style={styles.input} placeholder="Ej. Avistamiento de Lobos Marinos" placeholderTextColor="#4A5568" value={formTitle} onChangeText={setFormTitle} />

          <Text style={styles.label}>DESCRIPCIÓN</Text>
          <TextInput style={[styles.input, { height: 70, textAlignVertical: 'top' }]} placeholder="Escribe detalles del punto..." placeholderTextColor="#4A5568" multiline numberOfLines={3} value={formDescription} onChangeText={setFormDescription} />

          <Text style={styles.label}>
            {formPointType?.toLowerCase() === 'fauna' ? 'IMAGEN / BANNER DE FAUNA (URL)' : 'ICONO SVG | IMAGEN (Ruta o URL)'}
          </Text>
          <TextInput
            style={styles.input}
            placeholder={formPointType?.toLowerCase() === 'fauna' ? 'Ej. https://images.unsplash.com/... (Opcional)' : 'Ej. /assets/icon.svg o https://...'}
            placeholderTextColor="#4A5568"
            value={formSvgIcon}
            onChangeText={setFormSvgIcon}
          />

          {formPointType?.toLowerCase() !== 'fauna' && (
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>FECHA INICIO</Text>
                <TextInput style={styles.input} placeholder="Ej. 10/06 10:00" placeholderTextColor="#4A5568" value={formStartDate} onChangeText={setFormStartDate} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>FECHA FIN</Text>
                <TextInput style={styles.input} placeholder="Ej. 10/06 18:00" placeholderTextColor="#4A5568" value={formEndDate} onChangeText={setFormEndDate} />
              </View>
            </View>
          )}

          <Text style={styles.label}>DIRECCIÓN FÍSICA REAL</Text>
          <TextInput style={styles.input} placeholder="Ej. Calle Yungay 800, Isla Teja" placeholderTextColor="#4A5568" value={formAddress} onChangeText={setFormAddress} />

          <TouchableOpacity
            onPress={() => {
              if (!formTitle || (!tacticalLocation && !formAddress)) {
                showNotification('El título y la dirección son requeridos.');
                return;
              }

              // Si es Fauna, forzamos la categoría 'fauna' para que el mapa reconozca el MiniModal
              // pero guardamos el tipo específico en la descripción si es necesario.
              const isFaunaType = formPointType?.toLowerCase() === 'fauna';
              const finalCategory = isFaunaType ? 'fauna' : formCategory;
              const finalDescription = isFaunaType 
                ? `[${formCategory}] ${formDescription || 'Sin descripción adicional.'}`
                : formDescription || 'Sin descripción adicional.';

              handleCreateNewEvent(
                formTitle,
                finalDescription,
                finalCategory as any,
                formTargetAudience || 'Ciudadano Reporta',
                isFaunaType ? 'Avistamiento' : (formStartDate + (formEndDate ? ' - ' + formEndDate : '')),
                formAddress,
                formSvgIcon || (isFaunaType ? 'https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&q=80&w=800' : '')
              );
              setFormTitle('');
              setFormDescription('');
              setFormTargetAudience('Todo Público');
              setFormStartDate('');
              setFormEndDate('');
              setFormSvgIcon('');
              setFormCategory('naturaleza'); // Reset a una categoría por defecto segura
            }}
            style={styles.submitButton}
            activeOpacity={0.8}
          >
            <Text style={styles.submitButtonText}>CREAR PUNTO EN EL MAPA</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    position: 'absolute',
    top: 60,
    bottom: 60,
    right: 16,
    width: 380,
    backgroundColor: 'rgba(11, 15, 25, 0.95)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  titleText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  closeButton: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
  },
  label: {
    color: '#A0AEC0',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderRadius: 12,
    color: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: '#34D399',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    marginTop: 10,
  },
  submitButtonText: {
    color: '#0B0F19',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  }
});
