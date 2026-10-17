import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { MobileTab, useMobileApp } from '../MobileAppContext';
import { SIDE_RAIL_WIDTH } from '../layout';
import { dockShadow, MobileRadii } from '../theme';

import { NAV_ITEMS } from './navItems';
import { T, useColors } from './ui';

/** Rail lateral de escritorio: mismo menú que el dock, con la Guía destacada en negro. */
export function SideRail() {
  const { tab, setTab, setOverlay } = useMobileApp();
  const colors = useColors();

  const go = (key: MobileTab) => {
    setOverlay(null);
    setTab(key);
  };

  return (
    <View
      testID="side-rail"
      style={[
        styles.rail,
        { backgroundColor: colors.surface, borderRightColor: colors.border },
        dockShadow,
      ]}
    >
      <Image
        source={require('../../../assets/favicon.png')}
        style={styles.logo}
        accessibilityLabel="ValdiTurismo"
      />
      <View style={styles.items}>
        {NAV_ITEMS.map((t) => {
          const active = tab === t.key;
          const color = active ? colors.text : colors.textSecondary;
          const guide = t.key === 'guia';
          return (
            <Pressable
              key={t.key}
              onPress={() => go(t.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t.label}
            >
              <View
                style={[styles.item, active && !guide && { backgroundColor: colors.surfaceMuted }]}
              >
                {guide ? (
                  <View style={[styles.guide, { backgroundColor: colors.accent }]}>
                    <Ionicons name="sparkles" size={20} color={colors.onAccent} />
                  </View>
                ) : (
                  t.render(color)
                )}
                <T
                  variant="caption"
                  weight={active || guide ? '700' : '400'}
                  color={guide ? colors.text : color}
                  style={{ marginTop: 4 }}
                >
                  {t.label}
                </T>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    width: SIDE_RAIL_WIDTH,
    height: '100%',
    alignItems: 'center',
    paddingTop: 20,
    borderRightWidth: StyleSheet.hairlineWidth,
    zIndex: 10,
  },
  logo: { width: 36, height: 36, borderRadius: 10, marginBottom: 28 },
  items: { gap: 8, alignItems: 'center' },
  item: {
    width: 72,
    minHeight: 64,
    borderRadius: MobileRadii.inner,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  guide: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
