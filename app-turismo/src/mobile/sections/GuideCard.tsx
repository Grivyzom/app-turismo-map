import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useMobileApp } from '../MobileAppContext';
import { QuestionInput } from '../components/QuestionInput';
import { Card, PillButton, T, useColors } from '../components/ui';
import { MobileRadii } from '../theme';

/**
 * Recomendación del día y caja para preguntarle a la guía. El invitado ve la caja
 * bloqueada con un acceso al login, en vez de escribir y recién al enviar enterarse.
 */
export function GuideCard() {
  const { recommendedRoute, weather, setTab, askGuide, isGuest, requireAccount } = useMobileApp();
  const colors = useColors();

  const recommendation = useMemo(() => {
    if (recommendedRoute) {
      const first = recommendedRoute.stops[0].place.title;
      return weather?.isRainy
        ? `Día de lluvia: parte por ${first} y sigue con planes bajo techo.`
        : `Parte por ${first}: está a pocos minutos y abre el recorrido de hoy.`;
    }
    return weather?.recommendation ?? 'Pregúntale a la guía qué hacer cerca de ti.';
  }, [recommendedRoute, weather]);

  return (
    <Card>
      <View style={styles.recoRow}>
        <View style={[styles.spark, { backgroundColor: colors.accent }]}>
          <Ionicons name="sparkles" size={18} color={colors.onAccent} />
        </View>
        <View style={{ flex: 1 }}>
          <T weight="600">{recommendation}</T>
          <PillButton
            label="Ver ruta recomendada"
            onPress={() => setTab('rutas')}
            style={{ alignSelf: 'flex-start', marginTop: 10 }}
          />
        </View>
      </View>
      <View style={{ marginTop: 14 }}>
        {isGuest ? (
          <View style={[styles.locked, { backgroundColor: colors.surfaceMuted }]}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} />
            <T variant="small" color={colors.textSecondary} style={{ flex: 1 }}>
              Inicia sesión para preguntarle a la guía
            </T>
            <PillButton label="Entrar" onPress={() => requireAccount('guia')} />
          </View>
        ) : (
          <QuestionInput onSubmit={askGuide} />
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  recoRow: { flexDirection: 'row', gap: 12 },
  spark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 50,
    paddingLeft: 16,
    paddingRight: 5,
    borderRadius: MobileRadii.pill,
  },
});
