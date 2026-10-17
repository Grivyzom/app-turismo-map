import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { T, useColors } from '../components/ui';
import { formatToday, greeting } from '../data/greeting';
import { useCurrentUser } from '../hooks/useCurrentUser';

/** Fecha y saludo del Inicio: "Hola, {nombre}" con sesión, saludo por hora para el invitado. */
export function GreetingHeader({ trailing }: { trailing?: React.ReactNode }) {
  const { greetingName } = useCurrentUser();
  const colors = useColors();
  const [now] = useState(() => new Date());

  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <T variant="caption" color={colors.textSecondary}>
          {formatToday(now)}
        </T>
        <T variant="headline" weight="700" numberOfLines={2}>
          {greetingName ? `Hola, ${greetingName}` : greeting(now)}
        </T>
      </View>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
});
