import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import type { IoniconName } from '../data/categories';
import { MobileRadii } from '../theme';

import { BottomSheet } from './BottomSheet';
import { T, useColors } from './ui';

export interface Option<K extends string> {
  key: K;
  label: string;
  hint?: string;
  icon?: IoniconName;
}

/**
 * Hoja inferior con una lista de opciones (reemplaza a los <select> del wireframe).
 * La opción vigente queda sombreada, en negrita y con check relleno, y la lista
 * se desplaza hasta ella al abrir.
 */
export function OptionSheet<K extends string>({
  visible,
  title,
  options,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: Option<K>[];
  value: K | null;
  onSelect: (key: K) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const scrollRef = useRef<ScrollView>(null);
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <ScrollView ref={scrollRef} style={{ maxHeight: 420 }} contentContainerStyle={styles.list}>
        {options.map((o) => {
          const active = o.key === value;
          return (
            <Pressable
              key={o.key}
              onPress={() => {
                onSelect(o.key);
                onClose();
              }}
              onLayout={
                active
                  ? (e) =>
                      scrollRef.current?.scrollTo({
                        y: Math.max(0, e.nativeEvent.layout.y - 120),
                        animated: false,
                      })
                  : undefined
              }
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
            >
              <View
                style={[
                  styles.option,
                  active && { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                ]}
              >
                {o.icon ? (
                  <Ionicons
                    name={o.icon}
                    size={18}
                    color={active ? colors.text : colors.textSecondary}
                    style={{ marginRight: 10 }}
                  />
                ) : null}
                <View style={{ flex: 1 }}>
                  <T weight={active ? '700' : '400'}>{o.label}</T>
                  {o.hint ? (
                    <T variant="caption" color={colors.textSecondary}>
                      {o.hint}
                    </T>
                  ) : null}
                </View>
                <Ionicons
                  name={active ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                  color={active ? colors.accent : colors.borderStrong}
                />
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
}

/** Campo tipo select: muestra el valor actual y abre un OptionSheet. */
export function SelectField<K extends string>({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: Option<K>[];
  value: K;
  onChange: (key: K) => void;
}) {
  const [open, setOpen] = useState(false);
  const colors = useColors();
  const current = options.find((o) => o.key === value);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${current?.label ?? ''}`}
        style={[
          styles.field,
          { borderColor: colors.borderStrong, backgroundColor: colors.surface },
        ]}
      >
        <T style={{ flex: 1 }} numberOfLines={1}>
          {current?.label ?? 'Elegir'}
        </T>
        <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
      </Pressable>
      <OptionSheet
        visible={open}
        title={title}
        options={options}
        value={value}
        onSelect={onChange}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: { gap: 2 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: MobileRadii.inner,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: MobileRadii.button,
    borderWidth: 1,
  },
});
