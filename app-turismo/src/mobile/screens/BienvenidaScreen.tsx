import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../context/AuthContext';
import { useMobileApp } from '../MobileAppContext';
import { Card, OutlineButton, PrimaryButton, T, Tap, useColors } from '../components/ui';
import type { IoniconName } from '../data/categories';
import { MobileSpacing } from '../theme';

const BENEFITS: { icon: IoniconName; text: string }[] = [
  { icon: 'sparkles-outline', text: 'Pregúntale a la guía y planea tu día' },
  { icon: 'walk-outline', text: 'Sigue rutas guiadas paso a paso' },
  { icon: 'bookmark-outline', text: 'Guarda eventos y lugares favoritos' },
  { icon: 'notifications-outline', text: 'Recibe avisos de lo que sigues' },
  { icon: 'person-outline', text: 'Perfil, alojamiento y mapas sin conexión' },
];

/** Bienvenida al abrir la app sin sesión: crear cuenta, iniciar sesión o seguir como invitado. */
export function BienvenidaScreen() {
  const { openAuthModal } = useAuth();
  const { continueAsGuest } = useMobileApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <View style={styles.hero}>
          <View style={[styles.logo, { backgroundColor: colors.accent }]}>
            <Ionicons name="compass" size={40} color={colors.onAccent} />
          </View>
          <T variant="headline" weight="800" align="center" accessibilityRole="header">
            Descubre Valdivia
          </T>
          <T color={colors.textSecondary} align="center">
            Crea una cuenta o inicia sesión para aprovechar la app al máximo.
          </T>
        </View>

        <Card style={{ gap: 14 }}>
          {BENEFITS.map((b) => (
            <View key={b.text} style={styles.benefit}>
              <View style={[styles.benefitIcon, { backgroundColor: colors.surfaceMuted }]}>
                <Ionicons name={b.icon} size={18} color={colors.text} />
              </View>
              <T style={{ flex: 1 }}>{b.text}</T>
            </View>
          ))}
        </Card>

        <View style={styles.actions}>
          <PrimaryButton label="Crear cuenta" onPress={() => openAuthModal('register')} />
          <OutlineButton label="Iniciar sesión" onPress={() => openAuthModal('login')} />
          <Tap onPress={continueAsGuest} accessibilityRole="button" style={styles.guest}>
            <T weight="600" align="center" style={{ textDecorationLine: 'underline' }}>
              Continuar como invitado
            </T>
            <T variant="caption" color={colors.textSecondary} align="center">
              Podrás explorar el mapa, los eventos y el clima.
            </T>
          </Tap>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    justifyContent: 'center',
    paddingHorizontal: MobileSpacing.screen,
    gap: 24,
  },
  hero: { alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  benefitIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { gap: 10 },
  guest: { paddingVertical: 12, gap: 2 },
});
