import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { TurismoEvent } from '../Map/types';
import { MIN_TOUCH_TARGET_DP } from '../../utils/contextualRanking';

export const PEEK_CARD_HEIGHT = 176;

interface PeekCardProps {
  event: TurismoEvent;
  walkLabel: string | null;
  walkLoading: boolean;
  onClose: () => void;
  onDirections: () => void;
  onExpand: () => void;
}

/** Etapa 2 de la divulgación progresiva: decisión en <8 s, altura fija. */
export const PeekCard: React.FC<PeekCardProps> = ({
  event,
  walkLabel,
  walkLoading,
  onClose,
  onDirections,
  onExpand,
}) => {
  const shareWhatsApp = () => {
    const text = `${event.title}${walkLabel ? ` — ${walkLabel}` : ''}`;
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
  };

  return (
    <View style={styles.card} accessibilityRole="summary">
      <View style={styles.row}>
        <Pressable style={styles.titleWrap} onPress={onExpand} accessibilityLabel="Ver detalles">
          <Text style={styles.title} numberOfLines={1}>
            {event.title}
          </Text>
        </Pressable>
        <Pressable style={styles.iconBtn} onPress={onClose} accessibilityLabel="Cerrar">
          <Text style={styles.iconTxt}>✕</Text>
        </Pressable>
      </View>

      <View style={styles.row}>
        <Text style={styles.meta} numberOfLines={1}>
          {walkLabel ?? (walkLoading ? '🚶 Calculando ruta…' : '🚶 Ruta no disponible')}
          {event.openingHours ? `  ·  🕒 ${event.openingHours}` : ''}
        </Text>
      </View>

      <View style={[styles.row, styles.actions]}>
        <Pressable style={[styles.btn, styles.primary]} onPress={onDirections}>
          <Text style={styles.primaryTxt}>📍 Cómo llegar</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.secondary]} onPress={shareWhatsApp}>
          <Text style={styles.secondaryTxt}>💬 Compartir</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    height: PEEK_CARD_HEIGHT,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 12,
    justifyContent: 'space-between',
    paddingBottom: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  titleWrap: { flex: 1, minHeight: MIN_TOUCH_TARGET_DP, justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  iconBtn: { width: MIN_TOUCH_TARGET_DP, height: MIN_TOUCH_TARGET_DP, alignItems: 'center', justifyContent: 'center' },
  iconTxt: { fontSize: 18, color: '#475569' },
  meta: { fontSize: 14, fontWeight: '600', color: '#334155', flex: 1 },
  actions: { gap: 8 },
  btn: { flex: 1, height: MIN_TOUCH_TARGET_DP, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: '#1D4ED8' },
  primaryTxt: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  secondary: { backgroundColor: '#E2E8F0' },
  secondaryTxt: { color: '#0F172A', fontWeight: '700', fontSize: 15 },
});
