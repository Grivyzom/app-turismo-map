import React from 'react';
import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useAuth, AuthModalMode } from '../../context/AuthContext';
import { GATED_FEATURE_COPY, useMobileApp } from '../MobileAppContext';

import { BottomSheet } from './BottomSheet';
import { OutlineButton, PrimaryButton, T, Tap, useColors } from './ui';

/** Hoja "Necesitas una cuenta" que aparece cuando un invitado toca una función bloqueada. */
export function AccountGateSheet() {
  const { accountGate, closeAccountGate } = useMobileApp();
  const { openAuthModal } = useAuth();
  const colors = useColors();
  const copy = accountGate ? GATED_FEATURE_COPY[accountGate] : null;

  const open = (mode: AuthModalMode) => {
    closeAccountGate();
    openAuthModal(mode);
  };

  return (
    <BottomSheet visible={accountGate !== null} onClose={closeAccountGate}>
      <View style={styles.body}>
        <View style={[styles.icon, { backgroundColor: colors.surfaceMuted }]}>
          <Ionicons name={copy?.icon ?? 'lock-closed-outline'} size={26} color={colors.text} />
        </View>
        <T variant="title" weight="700" align="center" accessibilityRole="header">
          Necesitas una cuenta
        </T>
        <T variant="small" color={colors.textSecondary} align="center">
          {copy?.message}
        </T>
      </View>
      <View style={styles.actions}>
        <PrimaryButton label="Iniciar sesión" onPress={() => open('login')} />
        <OutlineButton label="Crear cuenta" onPress={() => open('register')} />
        <Tap onPress={closeAccountGate} accessibilityRole="button" style={styles.later}>
          <T weight="600" align="center" color={colors.textSecondary}>
            Ahora no
          </T>
        </Tap>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingBottom: 18 },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  actions: { gap: 10 },
  later: { paddingVertical: 12 },
});
