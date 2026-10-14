import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MobileRadii, MobileSpacing } from '../theme';

import { T, useColors } from './ui';

export interface Option<K extends string> {
  key: K;
  label: string;
  hint?: string;
}

/** Hoja inferior con una lista de opciones (reemplaza a los <select> del wireframe). */
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
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar" />
      <View
        style={[
          styles.sheet,
          { backgroundColor: colors.surface, paddingBottom: insets.bottom + 16 },
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: colors.borderStrong }]} />
        <T variant="title" weight="700" style={{ marginBottom: 8 }}>
          {title}
        </T>
        <ScrollView style={{ maxHeight: 420 }}>
          {options.map((o) => {
            const active = o.key === value;
            return (
              <Pressable
                key={o.key}
                onPress={() => {
                  onSelect(o.key);
                  onClose();
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={[styles.option, { borderBottomColor: colors.border }]}
              >
                <View style={{ flex: 1 }}>
                  <T weight={active ? '700' : '400'}>{o.label}</T>
                  {o.hint ? (
                    <T variant="caption" color={colors.textSecondary}>
                      {o.hint}
                    </T>
                  ) : null}
                </View>
                {active ? <Ionicons name="checkmark" size={20} color={colors.text} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
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
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    borderTopLeftRadius: MobileRadii.card,
    borderTopRightRadius: MobileRadii.card,
    paddingHorizontal: MobileSpacing.screen + 4,
    paddingTop: 10,
  },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: 12 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
