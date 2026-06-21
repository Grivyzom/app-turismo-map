import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform, TouchableOpacity } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';

import { CheckInRecord } from '../../utils/checkInStorage';

// ─── Props ────────────────────────────────────────────────────────────────────

interface CheckInModalProps {
  /** El registro del check-in exitoso a mostrar */
  record: CheckInRecord | null;
  /** Callback para cerrar el modal */
  onClose: () => void;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function CheckInModal({ record, onClose }: CheckInModalProps) {
  // Animaciones
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.7)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(0.5)).current;
  const xpTranslateY = useRef(new Animated.Value(20)).current;
  const xpOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!record) return;

    // Secuencia de entrada
    Animated.sequence([
      // 1. Fondo
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: false,
      }),
      // 2. Card entra con spring
      Animated.parallel([
        Animated.spring(cardScale, {
          toValue: 1,
          tension: 60,
          friction: 9,
          useNativeDriver: false,
        }),
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: false,
        }),
      ]),
      // 3. Check glow + icono
      Animated.parallel([
        Animated.spring(checkScale, {
          toValue: 1,
          tension: 80,
          friction: 7,
          useNativeDriver: false,
        }),
        Animated.timing(checkOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.spring(glowScale, {
          toValue: 1.2,
          tension: 30,
          friction: 8,
          useNativeDriver: false,
        }),
      ]),
      // 4. XP badge sube desde abajo
      Animated.parallel([
        Animated.spring(xpTranslateY, {
          toValue: 0,
          tension: 60,
          friction: 8,
          useNativeDriver: false,
        }),
        Animated.timing(xpOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: false,
        }),
      ]),
    ]).start();
  }, [
    record,
    backdropOpacity,
    cardScale,
    cardOpacity,
    checkScale,
    checkOpacity,
    glowScale,
    xpTranslateY,
    xpOpacity,
  ]);

  const handleClose = () => {
    // Salida rápida
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: false,
      }),
      Animated.timing(cardScale, {
        toValue: 0.85,
        duration: 180,
        useNativeDriver: false,
      }),
      Animated.timing(cardOpacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: false,
      }),
    ]).start(() => onClose());
  };

  if (!record) return null;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('es-CL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
      <Animated.View
        style={[
          styles.card,
          {
            transform: [{ scale: cardScale }],
            opacity: cardOpacity,
          },
        ]}
      >
        {/* ── Glow de fondo ── */}
        <Animated.View style={[styles.glowCircle, { transform: [{ scale: glowScale }] }]} />

        {/* ── Ícono de check animado ── */}
        <Animated.View
          style={[
            styles.checkCircleWrapper,
            {
              transform: [{ scale: checkScale }],
              opacity: checkOpacity,
            },
          ]}
        >
          <View style={styles.checkCircleOuter}>
            <View style={styles.checkCircleInner}>
              <Ionicons name="checkmark-sharp" size={36} color="#FFFFFF" />
            </View>
          </View>
        </Animated.View>

        {/* ── Título ── */}
        <Text style={styles.successTitle}>¡Check-in Exitoso!</Text>
        <Text style={styles.successSubtitle} numberOfLines={2}>
          {record.eventTitle}
        </Text>

        {/* ── Sello desbloqueado ── */}
        <View style={styles.stampRow}>
          <View style={styles.stampIconBg}>
            <MaterialIcons name={record.icon as any} size={22} color="#34D399" />
          </View>
          <View style={styles.stampInfo}>
            <Text style={styles.stampLabel}>SELLO DESBLOQUEADO</Text>
            <Text style={styles.stampCategory}>
              {record.category.charAt(0).toUpperCase() + record.category.slice(1)}
            </Text>
          </View>
        </View>

        {/* ── XP Badge ── */}
        <Animated.View
          style={[
            styles.xpBadge,
            {
              transform: [{ translateY: xpTranslateY }],
              opacity: xpOpacity,
            },
          ]}
        >
          <Text style={styles.xpText}>+{record.pointsEarned} XP</Text>
          <Text style={styles.xpLabel}>PRESTIADO GANADO</Text>
        </Animated.View>

        {/* ── Fecha ── */}
        <Text style={styles.dateText}>Verificado el {formatDate(record.checkedInAt)}</Text>

        {/* ── Botón cerrar ── */}
        <TouchableOpacity style={styles.closeBtn} onPress={handleClose} activeOpacity={0.85}>
          <Text style={styles.closeBtnText}>Ver mi Pasaporte</Text>
          <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
        </TouchableOpacity>

        {/* ── Cerrar con X ── */}
        <TouchableOpacity style={styles.dismissBtn} onPress={handleClose} activeOpacity={0.7}>
          <Ionicons name="close" size={18} color="#6B7280" />
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      } as any,
    }),
  },
  card: {
    width: 320,
    maxWidth: '90%',
    backgroundColor: 'rgba(14, 20, 32, 0.98)',
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.25)',
    overflow: 'hidden',
    position: 'relative',
    ...Platform.select({
      web: {
        boxShadow: '0px 24px 64px rgba(0, 0, 0, 0.8), 0px 0px 80px rgba(52, 211, 153, 0.12)',
      } as any,
      ios: {
        shadowColor: '#34D399',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 24,
      },
      android: {
        elevation: 20,
      },
    }),
  },
  glowCircle: {
    position: 'absolute',
    top: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(52, 211, 153, 0.08)',
  },
  checkCircleWrapper: {
    marginBottom: 20,
    marginTop: 8,
  },
  checkCircleOuter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    borderWidth: 2,
    borderColor: 'rgba(52, 211, 153, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0px 0px 30px rgba(52, 211, 153, 0.5)',
      } as any,
    }),
  },
  checkCircleInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#34D399',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0px 0px 20px rgba(52, 211, 153, 0.7)',
      } as any,
    }),
  },
  successTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  successSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  stampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 211, 153, 0.07)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.15)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: '100%',
    marginBottom: 16,
    gap: 12,
  },
  stampIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.2)',
  },
  stampInfo: {
    flex: 1,
  },
  stampLabel: {
    color: '#34D399',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  stampCategory: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  xpBadge: {
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.2)',
    marginBottom: 14,
  },
  xpText: {
    color: '#34D399',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  xpLabel: {
    color: '#4ADE80',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  dateText: {
    color: '#4B5563',
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 20,
  },
  closeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#34D399',
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 24,
    width: '100%',
    gap: 6,
    ...Platform.select({
      web: {
        boxShadow: '0px 4px 16px rgba(52, 211, 153, 0.4)',
      } as any,
      ios: {
        shadowColor: '#34D399',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
    }),
  },
  closeBtnText: {
    color: '#022C22',
    fontSize: 15,
    fontWeight: '800',
  },
  dismissBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
