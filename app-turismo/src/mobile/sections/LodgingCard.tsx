import React from 'react';
import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useMobileApp } from '../MobileAppContext';
import { Card, PillButton, T, useColors } from '../components/ui';
import { openWalkingDirections } from '../utils/external';

/**
 * "Volver a mi alojamiento". El alojamiento se configura en el Perfil, que requiere cuenta:
 * el invitado no usa uno guardado (puede ser de una sesión anterior) y "Agregar" abre el acceso.
 */
export function LodgingCard() {
  const { prefs, setTab, isGuest, requireAccount } = useMobileApp();
  const colors = useColors();
  const { lodging } = prefs;
  const hasLodging = !isGuest && lodging.latitude !== null && lodging.longitude !== null;

  const subtitle = hasLodging
    ? lodging.street
    : isGuest
      ? 'Inicia sesión para guardar tu alojamiento'
      : 'Agrega tu dirección en Perfil para usar esta opción';

  return (
    <Card style={styles.card}>
      <View style={[styles.icon, { backgroundColor: colors.accent }]}>
        <Ionicons name="home-outline" size={20} color={colors.onAccent} />
      </View>
      <View style={{ flex: 1 }}>
        <T weight="600">Volver a mi alojamiento</T>
        <T variant="caption" color={colors.textSecondary} numberOfLines={2}>
          {subtitle}
        </T>
      </View>
      {hasLodging ? (
        <PillButton
          label="Ir"
          onPress={() =>
            openWalkingDirections({
              latitude: lodging.latitude as number,
              longitude: lodging.longitude as number,
            })
          }
        />
      ) : (
        <PillButton
          label="Agregar"
          onPress={() => (isGuest ? requireAccount('perfil') : setTab('perfil'))}
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
