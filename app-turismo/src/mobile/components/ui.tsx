import React from 'react';
import {
  Image,
  Pressable,
  StyleProp,
  StyleSheet,
  Switch,
  Text,
  TextProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useMobileApp } from '../MobileAppContext';
import type { IoniconName } from '../data/categories';
import { cardShadow, MobileColors, MobileFont, MobileRadii, MobileSpacing } from '../theme';

/** Paleta efectiva: con "Alto contraste" los grises secundarios se oscurecen y los bordes se marcan. */
export function useColors() {
  const { prefs } = useMobileApp();
  if (!prefs.highContrast) return MobileColors;
  return {
    ...MobileColors,
    textSecondary: '#2E2E2E',
    textMuted: '#4A4A4A',
    border: '#8A8A8A',
    borderStrong: '#141414',
    surfaceMuted: '#E4E4E4',
  };
}

type Variant = keyof typeof MobileFont;

interface TProps extends TextProps {
  variant?: Variant;
  weight?: '400' | '500' | '600' | '700' | '800';
  color?: string;
  align?: TextStyle['textAlign'];
}

/** Texto que respeta la preferencia "Tamaño del texto". */
export function T({ variant = 'body', weight = '400', color, align, style, ...rest }: TProps) {
  const { textScale } = useMobileApp();
  const colors = useColors();
  const size = MobileFont[variant] * textScale;
  return (
    <Text
      {...rest}
      style={[
        {
          fontSize: size,
          lineHeight: Math.round(size * 1.3),
          fontWeight: weight,
          color: color ?? colors.text,
          textAlign: align,
        },
        style,
      ]}
    />
  );
}

export function Card({
  style,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        cardShadow,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Tarjeta-encabezado de sección: título a la izquierda y acción opcional a la derecha. */
export function SectionHeader({
  title,
  actionLabel,
  onAction,
  hint,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  hint?: string;
}) {
  const colors = useColors();
  return (
    <Card style={styles.sectionHeader}>
      <T variant="title" weight="600" style={{ flex: 1 }}>
        {title}
      </T>
      {actionLabel && onAction ? <PillButton label={actionLabel} onPress={onAction} /> : null}
      {hint ? (
        <T variant="small" color={colors.textSecondary}>
          {hint}
        </T>
      ) : null}
    </Card>
  );
}

export function IconButton({
  icon,
  onPress,
  size = 44,
  filled = false,
  badge = false,
  accessibilityLabel,
  style,
}: {
  icon: IoniconName;
  onPress?: () => void;
  size?: number;
  filled?: boolean;
  badge?: boolean;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: filled ? colors.accent : colors.surfaceMuted,
          opacity: pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      <Ionicons name={icon} size={size * 0.45} color={filled ? colors.onAccent : colors.text} />
      {badge ? <View style={[styles.badgeDot, { backgroundColor: colors.text }]} /> : null}
    </Pressable>
  );
}

/** Botón secundario gris tipo cápsula ("Ver", "Cambiar", "Ver todos"). */
export function PillButton({
  label,
  onPress,
  icon,
  active = false,
  style,
}: {
  label: string;
  onPress?: () => void;
  icon?: IoniconName;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const fg = active ? colors.onAccent : colors.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: active ? colors.accent : colors.surfaceMuted,
          opacity: pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={15} color={fg} style={{ marginRight: 6 }} /> : null}
      <T variant="small" weight="500" color={fg} numberOfLines={1}>
        {label}
      </T>
    </Pressable>
  );
}

export function PrimaryButton({
  label,
  onPress,
  style,
  disabled,
}: {
  label: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.primary,
        { backgroundColor: colors.accent, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      <T weight="600" color={colors.onAccent} numberOfLines={1}>
        {label}
      </T>
    </Pressable>
  );
}

export function OutlineButton({
  label,
  onPress,
  style,
}: {
  label: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.primary,
        {
          backgroundColor: colors.surface,
          borderWidth: 1.5,
          borderColor: colors.borderStrong,
          opacity: pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      <T weight="600" numberOfLines={1}>
        {label}
      </T>
    </Pressable>
  );
}

/** Etiqueta pequeña con borde (categoría, "Accesible", "Abierto hasta…"). */
export function Tag({ label }: { label: string }) {
  const colors = useColors();
  return (
    <View style={[styles.tag, { backgroundColor: colors.surfaceMuted }]}>
      <T variant="caption" weight="500" numberOfLines={1}>
        {label}
      </T>
    </View>
  );
}

/** Imagen del lugar o, si no hay, el recuadro tachado del wireframe. */
export function Thumb({
  uri,
  size,
  style,
  icon,
}: {
  uri?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
  icon?: IoniconName;
}) {
  const colors = useColors();
  const box: ViewStyle = size ? { width: size, height: size } : {};
  if (uri && /^https?:\/\//.test(uri)) {
    return (
      <View style={[styles.thumb, box, { backgroundColor: colors.placeholder }, style]}>
        <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      </View>
    );
  }
  return (
    <View
      style={[
        styles.thumb,
        box,
        { backgroundColor: colors.placeholder, alignItems: 'center', justifyContent: 'center' },
        style,
      ]}
    >
      <Ionicons name={icon ?? 'image-outline'} size={22} color={colors.textMuted} />
    </View>
  );
}

export function Avatar({
  name,
  size = 44,
  uri,
}: {
  name: string;
  size?: number;
  uri?: string | null;
}) {
  const colors = useColors();
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.surfaceSunken,
        }}
      />
    );
  }
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '?';
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.surfaceSunken,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <T variant={size > 60 ? 'headline' : 'small'} weight="600">
        {initials}
      </T>
    </View>
  );
}

/** Control segmentado (Ritmo del día, Presupuesto, Tamaño del texto). */
export function Segmented<K extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: K; label: string; labelStyle?: TextStyle }[];
  value: K;
  onChange: (key: K) => void;
}) {
  const colors = useColors();
  return (
    <View style={[styles.segmented, { backgroundColor: colors.surfaceMuted }]}>
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={[
              styles.segment,
              active && { backgroundColor: colors.surface, ...(cardShadow as object) },
            ]}
          >
            <T variant="small" weight={active ? '600' : '400'} style={opt.labelStyle}>
              {opt.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Chip seleccionable ("Cómo me muevo", filtros del mapa). */
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      style={[
        styles.chip,
        selected
          ? { backgroundColor: colors.accent, borderColor: colors.accent }
          : { backgroundColor: colors.surface, borderColor: colors.borderStrong },
      ]}
    >
      {selected ? (
        <Ionicons name="checkmark" size={14} color={colors.onAccent} style={{ marginRight: 4 }} />
      ) : null}
      <T variant="small" weight="500" color={selected ? colors.onAccent : colors.text}>
        {label}
      </T>
    </Pressable>
  );
}

export function ToggleRow({
  title,
  subtitle,
  value,
  onChange,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const colors = useColors();
  return (
    <View style={[styles.toggleRow, { borderBottomColor: colors.border }]}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <T weight="500">{title}</T>
        {subtitle ? (
          <T variant="caption" color={colors.textSecondary}>
            {subtitle}
          </T>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.surfaceSunken, true: colors.accent }}
        thumbColor={colors.surface}
        ios_backgroundColor={colors.surfaceSunken}
        accessibilityLabel={title}
      />
    </View>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <T variant="small" weight="600" style={{ marginTop: 14, marginBottom: 6 }}>
      {children}
    </T>
  );
}

export function Hint({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <T variant="caption" color={colors.textSecondary} style={{ marginTop: 4 }}>
      {children}
    </T>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: MobileRadii.card,
    padding: MobileSpacing.cardPadding,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  badgeDot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    minHeight: 36,
    borderRadius: MobileRadii.pill,
  },
  primary: {
    minHeight: 48,
    paddingHorizontal: 20,
    borderRadius: MobileRadii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: MobileRadii.pill,
    alignSelf: 'flex-start',
  },
  thumb: {
    borderRadius: MobileRadii.inner,
    overflow: 'hidden',
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: MobileRadii.button,
    padding: 4,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    minHeight: 38,
    borderRadius: MobileRadii.pill,
    borderWidth: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
