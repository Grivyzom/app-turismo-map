import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MobileTab, useMobileApp } from '../MobileAppContext';
import { dockShadow, MobileRadii, MobileSpacing, TAB_BAR_HEIGHT } from '../theme';

import { T, useColors } from './ui';

type TabDef = { key: MobileTab; label: string; render: (color: string) => React.ReactNode };

const TABS: TabDef[] = [
  {
    key: 'inicio',
    label: 'Inicio',
    render: (c) => <Ionicons name="home-outline" size={22} color={c} />,
  },
  {
    key: 'mapa',
    label: 'Mapa',
    render: (c) => <Ionicons name="map-outline" size={22} color={c} />,
  },
  { key: 'guia', label: 'Guía', render: () => null },
  {
    key: 'rutas',
    label: 'Rutas',
    render: (c) => <MaterialIcons name="route" size={22} color={c} />,
  },
  {
    key: 'perfil',
    label: 'Perfil',
    render: (c) => <Ionicons name="person-outline" size={22} color={c} />,
  },
];

/** Dock inferior flotante con la Guía como botón central elevado. */
export function TabBar() {
  const { tab, setTab, setOverlay } = useMobileApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const go = (key: MobileTab) => {
    setOverlay(null);
    setTab(key);
  };

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 10) }]}
    >
      <View style={[styles.dock, { backgroundColor: colors.surface }, dockShadow]}>
        {TABS.map((t) => {
          const active = tab === t.key;
          const color = active ? colors.text : colors.textSecondary;
          if (t.key === 'guia') {
            return (
              <Pressable
                key={t.key}
                onPress={() => go('guia')}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel="Guía"
                style={styles.item}
              >
                <View style={[styles.guide, { backgroundColor: colors.accent }, dockShadow]}>
                  <Ionicons name="sparkles" size={24} color={colors.onAccent} />
                </View>
                <T variant="caption" weight="700" style={{ marginTop: 26 }}>
                  {t.label}
                </T>
              </Pressable>
            );
          }
          return (
            <Pressable
              key={t.key}
              onPress={() => go(t.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t.label}
              style={styles.item}
            >
              {t.render(color)}
              <T
                variant="caption"
                weight={active ? '700' : '400'}
                color={color}
                style={{ marginTop: 2 }}
              >
                {t.label}
              </T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: MobileSpacing.screen,
  },
  dock: {
    height: TAB_BAR_HEIGHT,
    borderRadius: MobileRadii.card,
    flexDirection: 'row',
    alignItems: 'center',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  guide: {
    position: 'absolute',
    top: -22,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
