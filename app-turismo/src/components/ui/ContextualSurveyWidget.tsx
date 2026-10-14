import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, DeviceEventEmitter } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '../../context/AuthContext';
import { saveUserProfile, loadUserProfile } from '../../utils/userProfileStorage';

const PERSONALIZATION_KEY = 'app-turismo.personalization-completed';

const STAY_OPTIONS = [
  { id: 'day', label: '1 día', value: 0 },
  { id: 'weekend', label: 'Finde', value: 1 },
  { id: 'live', label: 'Vivo aquí', value: 2 },
];

export interface VibeOption {
  id: string;
  label: string;
  emoji: string;
  categories: string[];
}

function getContextualVibes(): { title: string; subtitle: string; vibes: VibeOption[] } {
  const hour = new Date().getHours();
  const isNight = hour >= 19 || hour < 5;
  const isMorning = hour >= 6 && hour < 12;

  let title = 'Tarde en Valdivia';
  let subtitle = '¿Qué vibra buscas para esta tarde?';

  if (isNight) {
    title = 'Noche en Valdivia';
    subtitle = '¿Qué plan buscas para esta noche?';
  } else if (isMorning) {
    title = 'Mañana en Valdivia';
    subtitle = '¿Cómo arrancas tu día en la ciudad?';
  }

  const vibes: VibeOption[] = [
    { id: 'beer', label: 'Birra artesanal', emoji: '🍺', categories: ['beer', 'cerveza', 'gastronomia', 'bar'] },
    { id: 'coffee', label: 'Café & Dulces', emoji: '☕', categories: ['gastronomia', 'cafe', 'food'] },
    { id: 'food', label: 'Gastronomía', emoji: '🍴', categories: ['gastronomia', 'restaurante', 'food'] },
    { id: 'river', label: 'Paseo fluvial', emoji: '⛵', categories: ['river', 'embarcacion', 'agua', 'puerto'] },
    { id: 'nature', label: 'Humedales', emoji: '🌲', categories: ['nature', 'naturaleza', 'parque', 'humedal'] },
    { id: 'indoor', label: 'Bajo techo', emoji: '🌧️', categories: ['indoor', 'museo', 'cultura', 'gastronomia'] },
  ];

  return { title, subtitle, vibes };
}

/** Estado liviano de personalización, independiente del dropdown: permite
 * mostrar el badge del ícono de navbar sin tener que abrir el menú. */
export function useIsMapPersonalized(): boolean {
  const [isPersonalized, setIsPersonalized] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(PERSONALIZATION_KEY).then((v) => {
      if (mounted && v === 'true') setIsPersonalized(true);
    });
    const sub = DeviceEventEmitter.addListener('MAP_PREFERENCES_UPDATED', () => {
      setIsPersonalized(true);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return isPersonalized;
}

// ─── Design Tokens (alineados al Selva Glass Design System del navbar) ───────
const C = {
  textPrimary: '#F8FAFC',
  textMuted: '#94A3B8',
  accent: '#34D399',
  accentBg: 'rgba(52, 211, 153, 0.18)',
  accentBorder: 'rgba(52, 211, 153, 0.4)',
  ctaText: '#06281E',
  border: 'rgba(255, 255, 255, 0.08)',
  bgControl: 'rgba(255, 255, 255, 0.04)',
};

interface ContextualSurveyWidgetProps {
  /** Se dispara al terminar de guardar, para que el contenedor (SidebarSubmenu) se cierre. */
  onSaved?: () => void;
}

/** Contenido del menú "Personaliza tu mapa" — se renderiza dentro de un
 * SidebarSubmenu anclado al ícono de la navbar, igual que Ajustes. */
export function ContextualSurveyWidget({ onSaved }: ContextualSurveyWidgetProps) {
  const { token } = useAuth();
  const [surveyStep, setSurveyStep] = useState<1 | 2>(1);
  const [stayValue, setStayValue] = useState(1); // Default a "Finde"
  const [selectedVibes, setSelectedVibes] = useState<string[]>(['beer']);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const contextualData = getContextualVibes();
  const router = useRouter();

  // Cargar estado guardado; si ya personalizó antes, saltar directo a "cambiar vibe"
  useEffect(() => {
    async function loadSavedState() {
      try {
        const completed = await AsyncStorage.getItem(PERSONALIZATION_KEY);
        const savedStay = await AsyncStorage.getItem('app-turismo.stay-duration');
        const savedVibesRaw = await AsyncStorage.getItem('app-turismo.vibe-categories');

        if (completed === 'true') setSurveyStep(2);
        if (savedStay) {
          const idx = STAY_OPTIONS.findIndex((s) => s.id === savedStay);
          if (idx !== -1) setStayValue(idx);
        }
        if (savedVibesRaw) {
          try {
            const parsed = JSON.parse(savedVibesRaw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const matched = contextualData.vibes
                .filter((v) => v.categories.some((c) => parsed.includes(c)))
                .map((v) => v.id);
              if (matched.length > 0) setSelectedVibes(matched.slice(0, 2));
            }
          } catch {
            // Ignorar error de parsing
          }
        }
      } catch (e) {
        console.warn('Error cargando estado inicial del widget contextual', e);
      }
    }
    loadSavedState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectStay = (id: string, index: number) => {
    setStayValue(index);
    AsyncStorage.setItem('app-turismo.stay-duration', id).catch(() => {});
    setSurveyStep(2);
  };

  const toggleVibe = (id: string) => {
    setSelectedVibes((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev; // Mantener al menos 1
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= 2) return [prev[1], id]; // Desplaza la más antigua
      return [...prev, id];
    });
  };

  const handleConfirmPreferences = useCallback(async () => {
    setIsSaving(true);
    const stayObj = STAY_OPTIONS[stayValue] || STAY_OPTIONS[1];

    const allCategories: string[] = [];
    const labels: string[] = [];
    selectedVibes.forEach((id) => {
      const v = contextualData.vibes.find((item) => item.id === id);
      if (v) {
        allCategories.push(...v.categories);
        labels.push(v.label);
      }
    });
    const uniqueCategories = Array.from(new Set(allCategories));
    const activeLabel = labels.join(' • ') || 'Personalizado';

    setIsSaved(true);
    const payload = { stayDuration: stayObj.id, categories: uniqueCategories };

    try {
      await AsyncStorage.setItem('app-turismo.stay-duration', stayObj.id);
      await AsyncStorage.setItem('app-turismo.vibe-categories', JSON.stringify(uniqueCategories));
      await AsyncStorage.setItem('app-turismo.active-vibe-label', activeLabel);
      await AsyncStorage.setItem(PERSONALIZATION_KEY, 'true');

      const storedProfile = await loadUserProfile();
      if (storedProfile) {
        await saveUserProfile({
          ...storedProfile,
          preferences: {
            categories: uniqueCategories,
            stayDuration: stayObj.id,
            travelStyle: storedProfile.preferences?.travelStyle || 'solo',
          },
        });
      }

      if (token) {
        const getBackendUrl = () => {
          if (Platform.OS === 'android') return 'http://10.0.2.2:8080';
          return process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8080';
        };
        await fetch(`${getBackendUrl()}/api/v1/profile/preferences`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
      }

      DeviceEventEmitter.emit('MAP_PREFERENCES_UPDATED', payload);
    } catch (e) {
      console.warn('Error guardando preferencias contextuales', e);
    } finally {
      setIsSaving(false);
      setTimeout(() => {
        setIsSaved(false);
        onSaved?.();
      }, 700);
    }
  }, [stayValue, selectedVibes, contextualData, token, onSaved]);

  return (
    <View style={styles.body}>
      <Text style={styles.stepBadge}>
        {surveyStep === 1 ? 'Paso 1 de 2 • Estadía' : 'Paso 2 de 2 • Vibe contextual'}
      </Text>
      <Text style={styles.stepTitle} numberOfLines={1}>
        {surveyStep === 1 ? '¿Cuánto tiempo te quedas?' : contextualData.subtitle}
      </Text>

      {surveyStep === 1 ? (
        <View style={styles.stepContainer}>
          <View style={styles.selectorGroup}>
            {STAY_OPTIONS.map((opt, idx) => {
              const isActive = stayValue === idx;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.selectorBtn, isActive && styles.selectorBtnActive]}
                  onPress={() => handleSelectStay(opt.id, idx)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.selectorBtnText, isActive && styles.selectorBtnTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={styles.onboardingLink} onPress={() => router.push('/onboarding')}>
            <Text style={styles.onboardingLinkText}>Personalización completa →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.stepContainer}>
          <View style={styles.vibeGrid}>
            {contextualData.vibes.map((vibe) => {
              const isSelected = selectedVibes.includes(vibe.id);
              return (
                <TouchableOpacity
                  key={vibe.id}
                  style={[styles.vibePill, isSelected && styles.vibePillSelected]}
                  onPress={() => toggleVibe(vibe.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.vibeEmoji}>{vibe.emoji}</Text>
                  <Text
                    style={[styles.vibeLabel, isSelected && styles.vibeLabelSelected]}
                    numberOfLines={1}
                  >
                    {vibe.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setSurveyStep(1)}>
              <Text style={styles.backBtnText}>← Estadía</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmBtn,
                isSaved && styles.confirmBtnSuccess,
                isSaving && { opacity: 0.7 },
              ]}
              onPress={() => void handleConfirmPreferences()}
              disabled={isSaving}
              activeOpacity={0.8}
            >
              <Text style={[styles.confirmBtnText, isSaved && styles.confirmBtnTextSuccess]}>
                {isSaved ? '¡Aplicado! ✓' : 'Aplicar vibe'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 14, gap: 10 },
  stepBadge: {
    color: C.accent,
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  stepTitle: {
    color: C.textPrimary,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  stepContainer: { gap: 10, marginTop: 4 },

  // ── Selector de estadía (Paso 1) ──
  selectorGroup: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 12,
    padding: 3,
    gap: 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  selectorBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  selectorBtnActive: {
    backgroundColor: C.accentBg,
    borderWidth: 1,
    borderColor: C.accentBorder,
  },
  selectorBtnText: { color: C.textMuted, fontSize: 11, fontWeight: '600' },
  selectorBtnTextActive: { color: C.accent, fontWeight: '800' },
  onboardingLink: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  onboardingLinkText: {
    color: C.accent,
    fontSize: 10.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  // ── Grid de vibes (Paso 2) ──
  vibeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  vibePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bgControl,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 9,
    minWidth: '47%',
    flex: 1,
  },
  vibePillSelected: { backgroundColor: C.accentBg, borderColor: C.accentBorder },
  vibeEmoji: { fontSize: 13, marginRight: 6 },
  vibeLabel: { color: C.textMuted, fontSize: 10.5, fontWeight: '600', flex: 1 },
  vibeLabelSelected: { color: C.accent, fontWeight: '800' },

  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 9,
    backgroundColor: C.bgControl,
    borderWidth: 1,
    borderColor: C.border,
  },
  backBtnText: { color: C.textMuted, fontSize: 10.5, fontWeight: '600' },
  confirmBtn: {
    flex: 1,
    paddingVertical: 8.5,
    paddingHorizontal: 12,
    borderRadius: 9,
    backgroundColor: C.accentBg,
    borderWidth: 1,
    borderColor: C.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnSuccess: { backgroundColor: C.accent, borderColor: C.accent },
  confirmBtnText: { color: C.accent, fontSize: 11, fontWeight: '800' },
  confirmBtnTextSuccess: { color: C.ctaText },
});
