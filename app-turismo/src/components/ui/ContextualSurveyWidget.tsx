import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Animated, Easing, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SparklesIcon, MapIcon, ClockIcon, CheckIcon } from './Icons';
import { useAuth } from '../../context/AuthContext';

interface ContextualSurveyWidgetProps {
  isSearchActive?: boolean;
}

const STAY_OPTIONS = [
  { id: 'day', label: '1 día', value: 0 },
  { id: 'weekend', label: 'Finde', value: 1 },
  { id: 'live', label: 'Vivo aquí', value: 2 },
];

export function ContextualSurveyWidget({ isSearchActive }: ContextualSurveyWidgetProps) {
  const { isAuthenticated, token } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [checking, setChecking] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [stayValue, setStayValue] = useState(1); // Default to weekend
  const [isSaved, setIsSaved] = useState(false);
  
  const slideAnim = React.useRef(new Animated.Value(0)).current;
  const router = useRouter();

  useEffect(() => {
    async function checkPersonalization() {
      try {
        const completed = await AsyncStorage.getItem('app-turismo.personalization-completed');
        if (completed !== 'true') {
          setIsVisible(true);
        }
      } catch (e) {
        setIsVisible(true);
      } finally {
        setChecking(false);
      }
    }
    checkPersonalization();
  }, []);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isExpanded ? 1 : 0,
      duration: 300,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: false,
    }).start();
  }, [isExpanded, slideAnim]);

  const handleSaveStay = useCallback(async (id: string, index: number) => {
    setStayValue(index);
    setIsSaved(true);
    
    try {
      // Feed the view mode / algorithm
      await AsyncStorage.setItem('app-turismo.stay-duration', id);
      
      if (token) {
        const getBackendUrl = () => {
          if (Platform.OS === 'android') {
            return 'http://10.0.2.2:8080';
          }
          return process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8080';
        };

        await fetch(`${getBackendUrl()}/api/v1/profile/preferences`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ stayDuration: id }),
        });
      }
    } catch (e) {
      console.warn('Error saving stay duration', e);
    }

    setTimeout(() => {
      setIsExpanded(false);
      setIsSaved(false);
    }, 1500);
  }, [token]);

  if (!isAuthenticated || checking || !isVisible) return null;
  if (isSearchActive && !isExpanded) return null;

  return (
    <View style={styles.islandContainer}>
      <Animated.View 
        style={[
          styles.islandContent,
          {
            height: slideAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [60, 165],
            }),
            width: slideAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [260, 340],
            }),
          }
        ]}
      >
        <View style={styles.glowBorderTop} />
        {!isExpanded ? (
          <TouchableOpacity 
            style={styles.collapsedRow} 
            onPress={() => setIsExpanded(true)}
            activeOpacity={0.7}
          >
            <View style={styles.iconCircle}>
              <SparklesIcon size={16} color="#6EE7B7" />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.islandTitle}>Entrena tu mapa</Text>
              <Text style={styles.islandSubtitle}>Dinos qué te gusta y armaremos un mapa solo para ti</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.expandedContent}>
            <View style={styles.expandedHeader}>
              <Text style={styles.expandedTitle}>¿Cuánto tiempo te quedas?</Text>
              <TouchableOpacity onPress={() => setIsExpanded(false)} style={styles.closeBtn}>
                <SparklesIcon size={14} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <View style={styles.sliderContainer}>
              {STAY_OPTIONS.map((opt, idx) => {
                const isActive = stayValue === idx;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.sliderOption, isActive && styles.sliderOptionActive]}
                    onPress={() => handleSaveStay(opt.id, idx)}
                  >
                    <Text style={[styles.sliderLabel, isActive && styles.sliderLabelActive]}>
                      {opt.label}
                    </Text>
                    {isActive && isSaved && (
                      <Animated.View style={styles.checkIcon}>
                        <CheckIcon size={12} color="#6EE7B7" />
                      </Animated.View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            
            <TouchableOpacity 
              style={styles.fullOnboardingBtn}
              onPress={() => router.push('/onboarding')}
            >
              <MapIcon size={12} color="#6EE7B7" style={{ marginRight: 6 }} />
              <Text style={styles.fullOnboardingText}>Personalización Completa</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  islandContainer: {
    position: 'absolute',
    top: 0,
    left: Platform.OS === 'web' ? 72 : 56,
    zIndex: 2500,
  },
  islandContent: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
    ...Platform.select({
      web: {
        backgroundColor: 'rgba(15, 20, 28, 0.88)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      } as any,
      default: {
        backgroundColor: '#0f141c',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
    }),
  },
  glowBorderTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    ...Platform.select({
      web: {
        background: 'linear-gradient(90deg, transparent, rgba(110, 231, 183, 0.3), transparent)',
      } as any,
    }),
  },
  collapsedRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(110, 231, 183, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(110, 231, 183, 0.25)',
  },
  textContainer: {
    flex: 1,
  },
  islandTitle: {
    color: '#F9FAFB',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  islandSubtitle: {
    color: '#9CA3AF',
    fontSize: 9,
    lineHeight: 12,
    marginTop: 1,
  },
  expandedContent: {
    padding: 14,
    flex: 1,
    justifyContent: 'space-between',
  },
  expandedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  expandedTitle: {
    color: '#F9FAFB',
    fontSize: 14,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  sliderContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  sliderOption: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  sliderOptionActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  sliderLabel: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '600',
  },
  sliderLabelActive: {
    color: '#6EE7B7',
    fontWeight: '800',
  },
  checkIcon: {
    marginLeft: 4,
  },
  fullOnboardingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  fullOnboardingText: {
    color: '#6EE7B7',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

