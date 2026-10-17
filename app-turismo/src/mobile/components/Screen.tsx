import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLayoutMode } from '../hooks/useLayoutMode';
import { WIDE_CONTENT_MAX } from '../layout';
import { MobileSpacing, TAB_BAR_HEIGHT } from '../theme';

import { useColors } from './ui';

/** Contenedor scrolleable estándar: respeta notch/status bar y deja aire para el dock. */
export function Screen({
  header,
  children,
  onRefresh,
  refreshing = false,
}: {
  header?: React.ReactNode;
  children: React.ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const wide = useLayoutMode() === 'wide';
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        testID="screen-scroll"
        contentContainerStyle={[
          {
            paddingTop: insets.top + 8,
            paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 40,
            paddingHorizontal: MobileSpacing.screen,
            gap: MobileSpacing.gap,
          },
          // Escritorio: columna centrada y sin el hueco del dock (la navegación va en el rail)
          wide && styles.wide,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined
        }
      >
        {header}
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  wide: {
    width: '100%',
    maxWidth: WIDE_CONTENT_MAX,
    alignSelf: 'center',
    paddingTop: 24,
    paddingBottom: 40,
  },
});
