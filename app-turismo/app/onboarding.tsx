import React, { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '../src/context/AuthContext';
import { saveUserProfile, loadUserProfile } from '../src/utils/userProfileStorage';

type CategoryOption = {
  id: string;
  name: string;
  icon: any;
  color: string;
};

const CATEGORIES: CategoryOption[] = [
  { id: 'nature', name: 'Naturaleza y Humedales', icon: 'forest' as any, color: '#34D399' },
  { id: 'beer', name: 'Cerveza Artesanal', icon: 'sports-bar' as any, color: '#FBBF24' },
  { id: 'food', name: 'Chocolates y Gastronomía', icon: 'restaurant' as any, color: '#F87171' },
  { id: 'history', name: 'Historia y Fuertes', icon: 'castle' as any, color: '#60A5FA' },
  {
    id: 'river',
    name: 'Paseos Fluviales y Ríos',
    icon: 'directions-boat' as any,
    color: '#38BDF8',
  },
  { id: 'culture', name: 'Arte y Cultura', icon: 'palette' as any, color: '#C084FC' },
];

type TravelStyleOption = {
  id: string;
  name: string;
  description: string;
  icon: any;
};

const TRAVEL_STYLES: TravelStyleOption[] = [
  {
    id: 'solo',
    name: 'Mochilero / Solo',
    description: 'Aventurero, independiente y flexible.',
    icon: 'backpack' as any,
  },
  {
    id: 'couple',
    name: 'En Pareja',
    description: 'Escapada romántica, relax y paseos.',
    icon: 'favorite' as any,
  },
  {
    id: 'family',
    name: 'Familiar',
    description: 'Actividades para niños y comodidad.',
    icon: 'groups' as any,
  },
  {
    id: 'business',
    name: 'Negocios / Trabajo',
    description: 'Visita corta con foco en conectividad.',
    icon: 'business-center' as any,
  },
];

type StayDurationOption = {
  id: string;
  name: string;
  description: string;
  icon: any;
};

const STAY_DURATIONS: StayDurationOption[] = [
  {
    id: 'day',
    name: 'Solo por el día',
    description: 'Visita rápida o escapada exprés.',
    icon: 'wb-sunny' as any,
  },
  {
    id: 'weekend',
    name: 'Fin de semana',
    description: '2 a 3 días para desconectar.',
    icon: 'directions-car' as any,
  },
  {
    id: 'week',
    name: 'Una semana',
    description: 'Tiempo ideal para recorrer todo.',
    icon: 'calendar-today' as any,
  },
  {
    id: 'long',
    name: 'Estadía prolongada',
    description: 'Más de una semana explorando.',
    icon: 'explore' as any,
  },
];

type BudgetOption = {
  id: string;
  name: string;
  description: string;
  icon: any;
};

const BUDGETS: BudgetOption[] = [
  {
    id: 'low',
    name: 'Económico',
    description: 'Hostales, picadas y opciones de bajo costo.',
    icon: 'attach-money' as any,
  },
  {
    id: 'medium',
    name: 'Moderado',
    description: 'Hoteles 3*, restaurantes estándar y paseos guiados.',
    icon: 'local-atm' as any,
  },
  {
    id: 'high',
    name: 'Premium',
    description: 'Alta gastronomía, hoteles boutique y excursiones privadas.',
    icon: 'credit-card' as any,
  },
];

type TransportOption = {
  id: string;
  name: string;
  description: string;
  icon: any;
};

const TRANSPORTS: TransportOption[] = [
  {
    id: 'walking',
    name: 'Caminando / A pie',
    description: 'Disfruto pasear por la costanera y calles céntricas.',
    icon: 'directions-walk' as any,
  },
  {
    id: 'bike',
    name: 'Bicicleta',
    description: 'Prefiero moverme en dos ruedas por las ciclovías.',
    icon: 'directions-bike' as any,
  },
  {
    id: 'car',
    name: 'Auto propio / Alquilado',
    description: 'Movilidad total para recorrer humedales y alrededores lejanos.',
    icon: 'directions-car' as any,
  },
  {
    id: 'public',
    name: 'Transporte público / Fluvial',
    description: 'Micras, colectivos y lanchas tradicionales del río.',
    icon: 'directions-boat' as any,
  },
];

export default function Onboarding() {
  const { token } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTravelStyle, setSelectedTravelStyle] = useState<string>('');
  const [selectedStayDuration, setSelectedStayDuration] = useState<string>('');
  const [selectedBudget, setSelectedBudget] = useState<string>('');
  const [selectedTransport, setSelectedTransport] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const insets = useSafeAreaInsets();

  const getBackendUrl = () => {
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2:8080';
    }
    return process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8080';
  };

  const toggleCategory = (id: string) => {
    if (selectedCategories.includes(id)) {
      setSelectedCategories(selectedCategories.filter((c) => c !== id));
    } else {
      setSelectedCategories([...selectedCategories, id]);
    }
  };

  const handleNext = () => {
    if (step === 1 && selectedCategories.length === 0) {
      Alert.alert(
        '¡Selecciona tus gustos!',
        'Por favor elige al menos una categoría que te interese.',
      );
      return;
    }
    if (step === 2 && !selectedTravelStyle) {
      Alert.alert('¿Con quién viajas?', 'Por favor selecciona una opción de estilo de viaje.');
      return;
    }
    if (step === 3 && !selectedStayDuration) {
      Alert.alert('¿Cuánto tiempo te quedas?', 'Por favor selecciona la duración de tu estadía.');
      return;
    }
    if (step === 4 && !selectedBudget) {
      Alert.alert('Presupuesto de viaje', 'Por favor selecciona una opción de presupuesto.');
      return;
    }
    if (step < 5) {
      setStep(step + 1);
    } else {
      void handleSubmit();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    if (!selectedTransport) {
      Alert.alert('Transporte preferido', 'Por favor selecciona cómo te moverás por la ciudad.');
      return;
    }

    setIsLoading(true);
    const preferencesPayload = {
      categories: selectedCategories,
      travelStyle: selectedTravelStyle,
      stayDuration: selectedStayDuration,
      budget: selectedBudget,
      transport: selectedTransport,
    };

    try {
      // 1. Guardar localmente en el perfil del usuario
      const storedProfile = await loadUserProfile();
      if (storedProfile) {
        await saveUserProfile({
          ...storedProfile,
          preferences: preferencesPayload,
        });
      }

      // 2. Marcar como completado localmente para el widget
      await AsyncStorage.setItem('app-turismo.personalization-completed', 'true');

      // 3. Recolectar datos de manera ligera y escalable (Analíticas globales en Redis)
      try {
        fetch(`${getBackendUrl()}/api/v1/survey`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(preferencesPayload),
        }).catch(() => {
          // Ignoramos errores de analíticas para no bloquear al usuario
        });
      } catch (e) {
        // Ignoramos errores sincrónicos de fetch
      }

      // 4. Sincronizar con el perfil del usuario si está autenticado
      if (token) {
        const response = await fetch(
          `${getBackendUrl()}/api/v1/profile/preferences`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(preferencesPayload),
          },
        );

        if (!response.ok) {
          console.warn('Backend sync failed, saving only locally');
        }
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
    } finally {
      setIsLoading(false);
      // Siempre redirige a la home para no trabar el flujo del usuario
      router.replace('/(home)');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={StyleSheet.absoluteFill} className="bg-[#0b0f19]" />

      {/* Glow Effects in Background */}
      <View style={StyleSheet.absoluteFill} className="pointer-events-none">
        <View style={styles.glowLeft} />
        <View style={styles.glowRight} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent, 
          { paddingTop: Math.max(insets.top, 20) + 40, paddingBottom: Math.max(insets.bottom, 20) + 80 }
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={styles.card}
          className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl px-6 py-8 sm:px-10 sm:py-10"
        >
          {/* Progress Header */}
          <View className="flex-row items-center justify-between mb-8">
            <Text className="text-xs font-bold text-[#34d399] tracking-widest uppercase">
              Paso {step} de 5
            </Text>
            <View className="flex-row gap-1.5">
              <View style={[styles.dot, step >= 1 && styles.dotActive]} />
              <View style={[styles.dot, step >= 2 && styles.dotActive]} />
              <View style={[styles.dot, step >= 3 && styles.dotActive]} />
              <View style={[styles.dot, step >= 4 && styles.dotActive]} />
              <View style={[styles.dot, step >= 5 && styles.dotActive]} />
            </View>
          </View>

          {/* Step Contents */}
          {step === 1 && (
            <View style={styles.stepContainer}>
              <Text style={styles.title}>¿Qué te apasiona de Valdivia?</Text>
              <Text style={styles.subtitle}>
                Selecciona las categorías que más te interese explorar en la perla del sur.
              </Text>

              <View className="flex-row flex-wrap justify-between gap-3 mt-6">
                {CATEGORIES.map((cat) => {
                  const isSelected = selectedCategories.includes(cat.id);
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      activeOpacity={0.8}
                      onPress={() => toggleCategory(cat.id)}
                      style={[
                        styles.chip,
                        isSelected && { borderColor: cat.color, backgroundColor: `${cat.color}15` },
                      ]}
                      className="w-[48%] py-4 px-3 rounded-2xl items-center border border-white/10"
                    >
                      <View
                        style={[styles.iconContainer, isSelected && { backgroundColor: cat.color }]}
                        className="mb-2 w-10 h-10 items-center justify-center rounded-xl bg-white/5"
                      >
                        <MaterialIcons
                          name={cat.icon as any}
                          size={22}
                          color={isSelected ? '#0b0f19' : '#d1d5db'}
                        />
                      </View>
                      <Text
                        style={[
                          styles.chipText,
                          isSelected && { color: '#ffffff', fontWeight: '700' },
                        ]}
                        className="text-center text-xs text-[#a0a5b5]"
                      >
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {step === 2 && (
            <View style={styles.stepContainer}>
              <Text style={styles.title}>¿Con quién vienes a explorar?</Text>
              <Text style={styles.subtitle}>
                Dinos cuál es tu estilo de viaje para afinar nuestras recomendaciones.
              </Text>

              <View className="gap-3 mt-6">
                {TRAVEL_STYLES.map((style) => {
                  const isSelected = selectedTravelStyle === style.id;
                  return (
                    <TouchableOpacity
                      key={style.id}
                      activeOpacity={0.8}
                      onPress={() => setSelectedTravelStyle(style.id)}
                      style={[styles.optionCard, isSelected && styles.optionCardActive]}
                      className="w-full flex-row items-center p-4 rounded-2xl border border-white/10 bg-white/0"
                    >
                      <View
                        style={[styles.optionIconContainer, isSelected && styles.optionIconActive]}
                        className="w-12 h-12 items-center justify-center rounded-xl bg-white/5"
                      >
                        <MaterialIcons
                          name={style.icon as any}
                          size={24}
                          color={isSelected ? '#0b0f19' : '#38bdf8'}
                        />
                      </View>
                      <View className="flex-1 ml-4 gap-0.5">
                        <Text style={[styles.optionTitle, isSelected && { color: '#ffffff' }]}>
                          {style.name}
                        </Text>
                        <Text style={styles.optionDescription}>{style.description}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {step === 3 && (
            <View style={styles.stepContainer}>
              <Text style={styles.title}>¿Cuánto tiempo te quedarás?</Text>
              <Text style={styles.subtitle}>
                Tu tiempo es valioso. Organizaremos los mejores itinerarios para tu estadía.
              </Text>

              <View className="gap-3 mt-6">
                {STAY_DURATIONS.map((dur) => {
                  const isSelected = selectedStayDuration === dur.id;
                  return (
                    <TouchableOpacity
                      key={dur.id}
                      activeOpacity={0.8}
                      onPress={() => setSelectedStayDuration(dur.id)}
                      style={[styles.optionCard, isSelected && styles.optionCardActive]}
                      className="w-full flex-row items-center p-4 rounded-2xl border border-white/10 bg-white/0"
                    >
                      <View
                        style={[styles.optionIconContainer, isSelected && styles.optionIconActive]}
                        className="w-12 h-12 items-center justify-center rounded-xl bg-white/5"
                      >
                        <MaterialIcons
                          name={dur.icon as any}
                          size={24}
                          color={isSelected ? '#0b0f19' : '#34d399'}
                        />
                      </View>
                      <View className="flex-1 ml-4 gap-0.5">
                        <Text style={[styles.optionTitle, isSelected && { color: '#ffffff' }]}>
                          {dur.name}
                        </Text>
                        <Text style={styles.optionDescription}>{dur.description}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {step === 4 && (
            <View style={styles.stepContainer}>
              <Text style={styles.title}>¿Cuál es tu presupuesto estimado?</Text>
              <Text style={styles.subtitle}>
                Adaptaremos los locales, restaurantes y actividades a tu presupuesto preferido.
              </Text>

              <View className="gap-3 mt-6">
                {BUDGETS.map((bud) => {
                  const isSelected = selectedBudget === bud.id;
                  return (
                    <TouchableOpacity
                      key={bud.id}
                      activeOpacity={0.8}
                      onPress={() => setSelectedBudget(bud.id)}
                      style={[styles.optionCard, isSelected && styles.optionCardActive]}
                      className="w-full flex-row items-center p-4 rounded-2xl border border-white/10 bg-white/0"
                    >
                      <View
                        style={[styles.optionIconContainer, isSelected && styles.optionIconActive]}
                        className="w-12 h-12 items-center justify-center rounded-xl bg-white/5"
                      >
                        <MaterialIcons
                          name={bud.icon as any}
                          size={24}
                          color={isSelected ? '#0b0f19' : '#fbbf24'}
                        />
                      </View>
                      <View className="flex-1 ml-4 gap-0.5">
                        <Text style={[styles.optionTitle, isSelected && { color: '#ffffff' }]}>
                          {bud.name}
                        </Text>
                        <Text style={styles.optionDescription}>{bud.description}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {step === 5 && (
            <View style={styles.stepContainer}>
              <Text style={styles.title}>¿Cómo prefieres transportarte?</Text>
              <Text style={styles.subtitle}>
                Valdivia cuenta con hermosas ciclovías y rutas fluviales. Dinos cómo te moverás.
              </Text>

              <View className="gap-3 mt-6">
                {TRANSPORTS.map((trans) => {
                  const isSelected = selectedTransport === trans.id;
                  return (
                    <TouchableOpacity
                      key={trans.id}
                      activeOpacity={0.8}
                      onPress={() => setSelectedTransport(trans.id)}
                      style={[styles.optionCard, isSelected && styles.optionCardActive]}
                      className="w-full flex-row items-center p-4 rounded-2xl border border-white/10 bg-white/0"
                    >
                      <View
                        style={[styles.optionIconContainer, isSelected && styles.optionIconActive]}
                        className="w-12 h-12 items-center justify-center rounded-xl bg-white/5"
                      >
                        <MaterialIcons
                          name={trans.icon as any}
                          size={24}
                          color={isSelected ? '#0b0f19' : '#60a5fa'}
                        />
                      </View>
                      <View className="flex-1 ml-4 gap-0.5">
                        <Text style={[styles.optionTitle, isSelected && { color: '#ffffff' }]}>
                          {trans.name}
                        </Text>
                        <Text style={styles.optionDescription}>{trans.description}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Navigation Buttons */}
          <View className="flex-row gap-4 mt-10 w-full justify-between">
            {step > 1 ? (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleBack}
                style={styles.backButton}
                className="flex-1 h-12 rounded-xl flex-row items-center justify-center border border-white/15 bg-transparent"
              >
                <MaterialIcons name="arrow-back" size={18} color="#d1d5db" className="mr-2" />
                <Text className="text-sm font-bold text-[#d1d5db]">Atrás</Text>
              </TouchableOpacity>
            ) : (
              <View className="flex-1" />
            )}

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleNext}
              style={[styles.primaryButton, step === 5 && styles.finishButton]}
              className="flex-1 h-12 rounded-xl flex-row items-center justify-center"
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#0b0f19" />
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>
                    {step === 5 ? 'Finalizar' : 'Continuar'}
                  </Text>
                  {step < 5 && (
                    <MaterialIcons
                      name="arrow-forward"
                      size={18}
                      color="#0b0f19"
                      className="ml-2"
                    />
                  )}
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const glassShadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  android: {
    elevation: 8,
  },
  web: {
    boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f19',
  },
  glowLeft: {
    position: 'absolute',
    top: -60,
    left: -40,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
  },
  glowRight: {
    position: 'absolute',
    bottom: -60,
    right: -40,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 32,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    ...glassShadow,
  },
  dot: {
    width: 14,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  dotActive: {
    backgroundColor: '#34d399',
    width: 20,
  },
  stepContainer: {
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#ffffff',
    lineHeight: 30,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#9ca3af',
    lineHeight: 20,
    marginTop: 4,
  },
  chip: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  iconContainer: {
    // @ts-expect-error transition only exists on web
    transition: 'all 0.2s ease',
  },
  chipText: {
    // @ts-expect-error transition only exists on web
    transition: 'all 0.2s ease',
  },
  optionCard: {
    // @ts-expect-error transition only exists on web
    transition: 'all 0.2s ease',
  },
  optionCardActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  optionIconContainer: {
    // @ts-expect-error transition only exists on web
    transition: 'all 0.2s ease',
  },
  optionIconActive: {
    backgroundColor: '#ffffff',
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#e5e7eb',
  },
  optionDescription: {
    fontSize: 12,
    color: '#9ca3af',
    lineHeight: 16,
  },
  backButton: {
    minWidth: 100,
  },
  primaryButton: {
    backgroundColor: '#38bdf8',
    minWidth: 120,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(56, 189, 248, 0.25)',
      },
    }),
  },
  finishButton: {
    backgroundColor: '#34d399',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(52, 211, 153, 0.25)',
      },
    }),
  },
  primaryButtonText: {
    color: '#0b0f19',
    fontSize: 14,
    fontWeight: '900',
  },
});
