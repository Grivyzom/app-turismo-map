import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Text,
  Switch,
  LayoutAnimation,
  useWindowDimensions,
  Image,
  Animated,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useUser as useClerkUser } from '@clerk/react';

import { TopAppBarProps, TabType, MapDisplayMode } from '../types';
import { NAVBAR_TOP } from '../../../utils/layout';
import { SmartVoiceSearch } from '../../ui/SmartVoiceSearch';
import { ParsedSearch } from '../../../utils/aiSearchParser';
import { useAuth } from '../../../context/AuthContext';
import { loadUserProfile, NormalUserProfile } from '../../../utils/userProfileStorage';
import { ContextualSurveyWidget, useIsMapPersonalized } from '../../ui/ContextualSurveyWidget';
import { SidebarSubmenu } from '../../ui/SidebarSubmenu';
import { getRecentSearches, removeRecentSearch, RecentSearch } from '../../../utils/recentSearches';
import { INITIAL_EVENTS } from '../../../data/mockEvents';
import { SelvaTokens } from '../../../theme/tokens';

// ─── Design Tokens (Selva Glass Design System - Floating HUD) ─────────────────
const C = {
  // Cristal Selva de alto contraste (inmune a fondos de mapa claros u oscuros)
  bg: 'rgba(9, 15, 14, 0.85)',
  bgGlass: 'rgba(9, 15, 14, 0.85)',
  bgControl: 'rgba(255, 255, 255, 0.05)',
  bgControlActive: 'rgba(52, 211, 153, 0.18)',
  bgDeep: SelvaTokens.colors?.surface?.glassDeep ?? 'rgba(9, 14, 13, 0.95)',
  bgDark: SelvaTokens.colors?.surface?.glassDeep ?? 'rgba(9, 14, 13, 0.95)',

  border: 'rgba(255, 255, 255, 0.08)',
  borderTop: 'rgba(255, 255, 255, 0.14)',
  borderBottom: 'rgba(255, 255, 255, 0.04)',
  borderActive: 'rgba(52, 211, 153, 0.40)',
  borderMid: SelvaTokens.colors?.border?.medium ?? 'rgba(255, 255, 255, 0.16)',
  borderHover: SelvaTokens.colors?.border?.hover ?? 'rgba(255, 255, 255, 0.25)',

  textPrimary: '#F8FAFC',
  textMuted: '#94A3B8',
  textInactive: '#A3A3A3',
  accent: '#34D399',
  accentBg: 'rgba(52, 211, 153, 0.18)',
  destructive: '#EF4444',
  destructiveBg: SelvaTokens.colors?.brand?.badgeBg ?? 'rgba(239, 68, 68, 0.14)',
  divider: 'rgba(255, 255, 255, 0.08)',
  tourist: SelvaTokens.colors?.brand?.alerceGold ?? SelvaTokens.brand?.alerceGold ?? '#F59E0B',
  touristBg: 'rgba(245, 158, 11, 0.15)',
  local: SelvaTokens.colors?.brand?.emerald ?? SelvaTokens.brand?.emerald ?? '#10B981',
  localBg: 'rgba(16, 185, 129, 0.15)',
};

const ISLAND_SHADOW = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  android: { elevation: 8 },
  web: {
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    boxShadow: '0 12px 32px -4px rgba(0, 0, 0, 0.45)',
  },
}) as any;

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  navWrapper: {
    flex: 1,
    flexDirection: 'row',
    pointerEvents: 'box-none',
    ...Platform.select({ web: { pointerEvents: 'none' } as any }),
  },
  navIsland: {
    flex: 1,
    height: 52,
    marginHorizontal: 12,
    marginTop: NAVBAR_TOP,
    borderRadius: 18,
    backgroundColor: C.bgGlass,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderTopColor: C.borderTop,
    borderBottomColor: C.borderBottom,
    borderLeftColor: 'rgba(255, 255, 255, 0.07)',
    borderRightColor: 'rgba(255, 255, 255, 0.07)',
    overflow: 'visible',
    ...ISLAND_SHADOW,
    ...Platform.select({
      web: {
        backgroundColor: C.bgGlass,
        pointerEvents: 'auto',
      } as any,
    }),
  },

  // ── Logo / brand ──────────────────────────────────────────────────────────
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 4,
    flexShrink: 0,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoTextBlock: { justifyContent: 'center' },
  logoTitle: { color: C.textPrimary, fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },
  logoSubtitle: {
    color: C.accent,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  divider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },

  // ── OPCIONES (Mapa / Turismo / Comercial) ─────────────────────────────────
  modeGroup: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: 11,
    padding: 2,
    gap: 2,
    flexShrink: 0,
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  pillIndicator: {
    position: 'absolute',
    borderRadius: 9,
    borderWidth: 1,
    zIndex: 0,
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9,
    gap: 5,
    zIndex: 1,
    backgroundColor: 'transparent',
    ...Platform.select({ web: { cursor: 'pointer', userSelect: 'none' } as any }),
  },
  modeButtonActive: {
    backgroundColor: C.bgControlActive,
    borderWidth: 1,
    borderColor: C.borderActive,
  },
  modeButtonText: { color: C.textMuted, fontSize: 12, fontWeight: '600' },
  modeButtonTextActive: { color: C.textPrimary, fontWeight: '700' },

  flexSpacer: { flex: 1 },

  // ── Search box (inline, collapsible) ──────────────────────────────────────
  searchAnchor: { position: 'relative' },
  searchBox: {
    height: 34,
    borderRadius: 10,
    backgroundColor: C.bgControl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    overflow: 'hidden',
    ...Platform.select({ web: { backgroundColor: C.bgControl, transition: 'all 0.25s ease' } }),
  },
  searchBoxFocused: {
    borderColor: C.accent,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  searchBoxHovered: { borderColor: C.borderMid },
  searchCollapsedBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchExpandedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
    paddingHorizontal: 6,
    width: Platform.OS === 'web' ? 280 : 220,
    gap: 4,
  },
  searchBackBtn: { padding: 6, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  recentSearchesDropdown: {
    position: 'absolute',
    top: 42,
    right: 0,
    width: Platform.OS === 'web' ? 320 : 260,
    backgroundColor: C.bgDeep,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 8,
    zIndex: 150,
    ...ISLAND_SHADOW,
    ...Platform.select({
      web: {
        backgroundColor: C.bgDeep,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      } as any,
    }),
  },
  recentSearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  recentSearchItemHovered: { backgroundColor: 'rgba(255, 255, 255, 0.06)' },
  recentSearchText: { flex: 1, color: C.textPrimary, fontSize: 13 },
  recentSearchDeleteBtn: { padding: 4, marginLeft: 8 },
  recentSearchHeader: { paddingHorizontal: 16, paddingVertical: 4, marginBottom: 4 },
  recentSearchHeaderText: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Generic square icon button ────────────────────────────────────────────
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.bgControl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    flexShrink: 0,
    position: 'relative',
    ...Platform.select({ web: { cursor: 'pointer', transition: 'all 0.15s ease' } }),
  },
  iconBtnActive: { backgroundColor: C.bgControlActive, borderColor: C.borderActive },
  iconBtnPressed: { backgroundColor: 'rgba(255, 255, 255, 0.10)' },
  iconBtnFocused: Platform.select({
    web: {
      outlineWidth: 2,
      outlineColor: C.accent,
      outlineOffset: 2,
      outlineStyle: 'solid',
    } as any,
    default: {},
  }),
  notificationBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.destructive,
  },
  notificationBadgePulse: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 4,
    backgroundColor: C.destructive,
  },

  // ── Estado (Turista / Local) ─────────────────────────────────────────────
  estadoGroup: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 11,
    padding: 3,
    gap: 3,
    flexShrink: 0,
  },
  estadoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 5,
    ...Platform.select({ web: { cursor: 'pointer', transition: 'all 0.15s ease' } }),
  },
  estadoButtonText: { fontSize: 12, fontWeight: '700' },

  // ── Avatar button ─────────────────────────────────────────────────────────
  avatarButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: C.bgControl,
    flexShrink: 0,
    ...Platform.select({ web: { cursor: 'pointer', transition: 'all 0.15s ease' } }),
  },
  avatarButtonActive: { backgroundColor: C.bgControlActive, borderColor: C.borderActive },
  avatarCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.borderMid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircleActive: { backgroundColor: C.accentBg },
  clerkAvatarImage: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  navAuthButton: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: C.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
    ...Platform.select({ web: { cursor: 'pointer', transition: 'all 0.15s ease' } }),
  },
  navAuthButtonText: {
    color: '#06281E', // Contraste oscuro sobre verde esmeralda sólido para máxima jerarquía
    fontSize: 12,
    fontWeight: '800',
  },
  dropdownUserCard: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  dropdownUserName: {
    color: C.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  dropdownUserEmail: {
    color: C.textMuted,
    fontSize: 11,
    marginTop: 2,
  },

  // ── Dropdown menu ─────────────────────────────────────────────────────────
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: 4,
    borderRadius: 10,
    gap: 10,
    ...Platform.select({ web: { cursor: 'pointer', transition: 'all 0.15s ease' } }),
  },
  dropdownItemIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  dropdownItemText: { flex: 1, fontSize: 13, fontWeight: '600' },
  dropdownItemBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 9999,
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    marginLeft: 'auto',
  },
  dropdownItemBadgeText: {
    color: '#F87171',
    fontSize: 10,
    fontWeight: '700',
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 4,
    marginHorizontal: 10,
  },

  // ── Settings dropdown ─────────────────────────────────────────────────────
  settingsBody: { gap: 14, padding: 14 },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  settingInfo: { flex: 1, paddingRight: 12 },
  settingLabel: { color: C.textPrimary, fontSize: 13, fontWeight: '600' },
  settingDesc: { color: C.textMuted, fontSize: 11, marginTop: 2, lineHeight: 15 },
  settingsDivider: { height: 1, backgroundColor: 'rgba(255, 255, 255, 0.06)', marginVertical: 2 },
  selectorGroup: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: 9,
    padding: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  selectorBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 7,
    ...Platform.select({ web: { cursor: 'pointer', transition: 'all 0.15s ease' } }),
  },
  selectorBtnActive: {
    backgroundColor: C.bgControlActive,
    borderWidth: 1,
    borderColor: C.borderActive,
  },
  selectorBtnText: { color: C.textMuted, fontSize: 11, fontWeight: '600' },
  selectorBtnTextActive: { color: C.textPrimary, fontWeight: '700' },

  // ── Tooltip ───────────────────────────────────────────────────────────────
  tooltip: {
    position: 'absolute',
    top: 42,
    backgroundColor: 'rgba(9, 15, 14, 0.95)',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    zIndex: 9999,
    ...Platform.select({
      web: {
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        boxShadow: '0 6px 18px rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      } as any,
    }),
  },
  tooltipText: { color: C.textPrimary, fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
});

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Punto de notificación con pulso continuo: sustituye la señal de "hover"
 * (retirada de la navbar) como indicador de que hay algo pendiente. */
const NotificationBadge = React.memo(function NotificationBadge() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.notificationBadge} pointerEvents="none">
      <Animated.View
        style={[
          styles.notificationBadgePulse,
          {
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }) }],
          },
        ]}
      />
    </View>
  );
});

/** Botón con tooltip hover (web) usado para los iconos sueltos de la navbar.
 * Reenvía el ref al TouchableOpacity para poder medir su posición y anclar
 * el menú contextual correspondiente justo debajo de él. */
const NavIconButton = React.memo(
  React.forwardRef<
    View,
    {
      icon: string;
      iconSet?: 'Ionicons' | 'MaterialIcons';
      label: string;
      active?: boolean;
      badge?: boolean;
      onClick?: () => void;
    }
  >(function NavIconButton({ icon, iconSet = 'Ionicons', label, active, badge, onClick }, ref) {
    const [isHovered, setIsHovered] = useState(false);
    const [isPressed, setIsPressed] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const IconComp = iconSet === 'Ionicons' ? Ionicons : MaterialIcons;

    return (
      <TouchableOpacity
        ref={ref}
        onPress={onClick}
        activeOpacity={0.75}
        hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
        onPressIn={() => setIsPressed(true)}
        onPressOut={() => setIsPressed(false)}
        //@ts-ignore
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={[
          styles.iconBtn,
          active && styles.iconBtnActive,
          isPressed && !active && styles.iconBtnPressed,
          isFocused && styles.iconBtnFocused,
          Platform.select({
            web: {
              ...(active ? { boxShadow: '0 0 14px rgba(52, 211, 153, 0.35)' } : {}),
            } as any,
          }),
        ]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <IconComp
          name={icon as any}
          size={17}
          color={active ? C.accent : C.textPrimary}
          style={
            Platform.OS === 'web'
              ? ({
                  filter: active ? 'drop-shadow(0 0 4px rgba(52, 211, 153, 0.45))' : undefined,
                  transition: 'color 0.15s ease, filter 0.15s ease',
                } as any)
              : undefined
          }
        />
        {badge && <NotificationBadge />}
        {Platform.OS === 'web' && isHovered && (
          <View style={styles.tooltip} pointerEvents="none">
            <Text style={styles.tooltipText}>{label}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }),
);

const DropdownItem = React.memo(function DropdownItem({
  icon,
  label,
  onPress,
  isDestructive = false,
  badge,
  isActive = false,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  isDestructive?: boolean;
  badge?: string | number;
  isActive?: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      //@ts-ignore
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={[
        styles.dropdownItem,
        isActive && {
          backgroundColor: 'rgba(52, 211, 153, 0.12)',
        },
        isHovered && {
          backgroundColor: isDestructive
            ? C.destructiveBg
            : isActive
              ? 'rgba(52, 211, 153, 0.18)'
              : 'rgba(255, 255, 255, 0.07)',
        },
        Platform.select({
          web: {
            transition: 'background-color 0.15s ease, transform 0.15s ease',
            transform: isHovered ? 'translateX(2px)' : 'translateX(0)',
          } as any,
        }),
      ]}
    >
      <View
        style={[
          styles.dropdownItemIconBadge,
          isDestructive
            ? { backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: 'rgba(239, 68, 68, 0.25)' }
            : isActive
              ? {
                  backgroundColor: 'rgba(52, 211, 153, 0.18)',
                  borderColor: 'rgba(52, 211, 153, 0.35)',
                }
              : isHovered
                ? {
                    backgroundColor: 'rgba(52, 211, 153, 0.12)',
                    borderColor: 'rgba(52, 211, 153, 0.25)',
                  }
                : {
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    borderColor: 'rgba(255, 255, 255, 0.06)',
                  },
        ]}
      >
        <MaterialIcons
          name={icon as any}
          size={16}
          color={isDestructive ? C.destructive : isActive || isHovered ? C.accent : C.textMuted}
        />
      </View>
      <Text
        style={[
          styles.dropdownItemText,
          isDestructive
            ? { color: C.destructive }
            : isActive
              ? { color: C.accent, fontWeight: '700' }
              : isHovered
                ? { color: C.textPrimary }
                : { color: '#E2E8F0' },
        ]}
      >
        {label}
      </Text>
      {badge !== undefined ? (
        <View style={styles.dropdownItemBadge}>
          <Text style={styles.dropdownItemBadgeText}>{badge}</Text>
        </View>
      ) : (
        <MaterialIcons
          name="chevron-right"
          size={16}
          color={isHovered ? 'rgba(255, 255, 255, 0.35)' : 'transparent'}
          style={Platform.select({
            web: { marginLeft: 'auto', transition: 'color 0.15s ease' } as any,
          })}
        />
      )}
    </TouchableOpacity>
  );
});

const RecentSearchRow = React.memo(function RecentSearchRow({
  item,
  onSelect,
  onDelete,
}: {
  item: RecentSearch;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  return (
    <View
      //@ts-ignore
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={[styles.recentSearchItem, isHovered && styles.recentSearchItemHovered]}
    >
      <TouchableOpacity
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}
        onPress={onSelect}
        activeOpacity={0.7}
      >
        <Ionicons name="time-outline" size={16} color={C.textMuted} />
        <Text style={styles.recentSearchText} numberOfLines={1}>
          {item.query}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.recentSearchDeleteBtn} onPress={onDelete}>
        <Ionicons name="close" size={16} color={C.textMuted} />
      </TouchableOpacity>
    </View>
  );
});

// ─── Responsive breakpoints (px de ancho de ventana) ─────────────────────────
const BP_OVERFLOW = 680; // < : acciones secundarias colapsan en menú "⋮"
const BP_MODE_LABELS = 820; // ≥ : etiquetas de Mapa/Turismo/Comercial
const BP_LOGO_TEXT = 940; // ≥ : "Valdivia / PORTAL TURÍSTICO" junto al logo

// ─── Mode/estado definitions ─────────────────────────────────────────────────
const MODE_OPTIONS: {
  id: MapDisplayMode;
  label: string;
  icon: string;
  color: string;
  bgColor: string;
}[] = [
  { id: 'mapa', label: 'Mapa', icon: 'map', color: '#60A5FA', bgColor: 'rgba(96, 165, 250, 0.15)' },
  {
    id: 'turismo',
    label: 'Turismo',
    icon: 'explore',
    color: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.15)',
  },
  {
    id: 'comercial',
    label: 'Comercial',
    icon: 'storefront',
    color: '#A78BFA',
    bgColor: 'rgba(167, 139, 250, 0.15)',
  },
];

interface ModePillButtonGroupProps {
  mapDisplayMode: MapDisplayMode;
  currentTab: TabType;
  showModeLabels: boolean;
  onModeSelect: (mode: MapDisplayMode) => void;
}

const ModePillButtonGroup: React.FC<ModePillButtonGroupProps> = React.memo(
  function ModePillButtonGroup({ mapDisplayMode, currentTab, showModeLabels, onModeSelect }) {
    const [hoveredMode, setHoveredMode] = useState<MapDisplayMode | null>(null);
    const [itemLayouts, setItemLayouts] = useState<
      Partial<Record<MapDisplayMode, { x: number; y: number; width: number; height: number }>>
    >({});
    const [isReady, setIsReady] = useState(false);
    const [lastLayout, setLastLayout] = useState<{
      x: number;
      y: number;
      width: number;
      height: number;
    } | null>(null);

    const activeMode = currentTab === 'map' ? mapDisplayMode : null;
    const targetMode = hoveredMode ?? activeMode;
    const targetLayout = targetMode ? itemLayouts[targetMode] : null;

    useEffect(() => {
      if (targetLayout) {
        setLastLayout(targetLayout);
        if (!isReady) {
          const timer = setTimeout(() => setIsReady(true), 30);
          return () => clearTimeout(timer);
        }
      }
    }, [targetLayout, isReady]);

    const displayLayout = targetLayout ?? lastLayout;
    const isVisible = targetLayout !== null;

    const targetOption = targetMode ? MODE_OPTIONS.find((m) => m.id === targetMode) : null;
    const isPreviewHover = hoveredMode !== null && hoveredMode !== activeMode;

    const handleItemLayout = useCallback(
      (id: MapDisplayMode, x: number, y: number, width: number, height: number) => {
        setItemLayouts((prev) => {
          const cur = prev[id];
          if (cur && cur.x === x && cur.y === y && cur.width === width && cur.height === height) {
            return prev;
          }
          return { ...prev, [id]: { x, y, width, height } };
        });
      },
      [],
    );

    return (
      <View
        style={styles.modeGroup}
        //@ts-ignore
        onMouseLeave={() => setHoveredMode(null)}
      >
        {/* ━━━ Sliding Pillow Indicator ━━━ */}
        {displayLayout && (
          <View
            pointerEvents="none"
            style={[
              styles.pillIndicator,
              {
                left: displayLayout.x,
                top: displayLayout.y,
                width: displayLayout.width,
                height: displayLayout.height,
                backgroundColor: targetOption
                  ? isPreviewHover
                    ? targetOption.bgColor.replace('0.15', '0.11')
                    : targetOption.bgColor
                  : 'rgba(255, 255, 255, 0.08)',
                borderColor: targetOption
                  ? isPreviewHover
                    ? targetOption.color + '40'
                    : targetOption.color + '66'
                  : 'rgba(255, 255, 255, 0.12)',
                opacity: isVisible ? 1 : 0,
              },
              Platform.select({
                web: {
                  transition: isReady
                    ? 'left 250ms cubic-bezier(0.16, 1, 0.3, 1), top 250ms cubic-bezier(0.16, 1, 0.3, 1), width 250ms cubic-bezier(0.16, 1, 0.3, 1), height 250ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms ease, background-color 220ms ease, border-color 220ms ease, box-shadow 220ms ease'
                    : 'opacity 150ms ease',
                  boxShadow: isPreviewHover
                    ? `0 2px 10px ${targetOption?.color ? targetOption.color + '22' : 'rgba(0,0,0,0.1)'}`
                    : `0 3px 14px ${targetOption?.color ? targetOption.color + '38' : 'rgba(0,0,0,0.2)'}`,
                  willChange: 'left, width, opacity, background-color',
                } as any,
              }),
            ]}
          />
        )}

        {/* ━━━ Botones de Modo ━━━ */}
        {MODE_OPTIONS.map((mode) => {
          const isSelected = activeMode === mode.id;
          const isHovered = hoveredMode === mode.id;
          const isHighlighted = isHovered || (isSelected && hoveredMode === null);

          return (
            <TouchableOpacity
              key={mode.id}
              style={styles.modeButton}
              onPress={() => onModeSelect(mode.id)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`Modo ${mode.label}`}
              onLayout={(e) => {
                const { x, y, width, height } = e.nativeEvent.layout;
                handleItemLayout(mode.id, x, y, width, height);
              }}
              //@ts-ignore
              onMouseEnter={() => setHoveredMode(mode.id)}
              onFocus={() => setHoveredMode(mode.id)}
              onBlur={() => setHoveredMode(null)}
            >
              <MaterialIcons
                name={mode.icon as any}
                size={15}
                color={isHighlighted ? mode.color : isSelected ? mode.color : C.textInactive}
                style={
                  Platform.OS === 'web'
                    ? ({
                        transition: 'color 0.18s ease',
                        opacity: !isHighlighted && isSelected ? 0.85 : 1,
                      } as any)
                    : undefined
                }
              />
              {showModeLabels && (
                <Text
                  style={[
                    styles.modeButtonText,
                    {
                      color: isHighlighted ? mode.color : isSelected ? mode.color : C.textInactive,
                      fontWeight: isHighlighted ? '700' : isSelected ? '600' : '600',
                    },
                    Platform.OS === 'web'
                      ? ({
                          transition: 'color 0.18s ease',
                          opacity: !isHighlighted && isSelected ? 0.85 : 1,
                        } as any)
                      : undefined,
                  ]}
                >
                  {mode.label}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  },
);

const PROFILE_LINKS: { tab: TabType; label: string; icon: string }[] = [
  { tab: 'profile', label: 'Mi Perfil', icon: 'person' },
  { tab: 'feed', label: 'Feed de Eventos', icon: 'dynamic-feed' },
  { tab: 'eventos', label: 'Eventos', icon: 'event' },
  { tab: 'saved', label: 'Mis Guardados', icon: 'collections' },
  { tab: 'historial', label: 'Recientes', icon: 'history' },
  { tab: 'forum', label: 'Foro', icon: 'forum' },
];

// ─── Main export ─────────────────────────────────────────────────────────────
export const TopAppBar: React.FC<
  TopAppBarProps & {
    onVoiceSearch?: (res: ParsedSearch) => void;
    onVoicePartialSearch?: (text: string) => void;
    onTabHover?: (tab: TabType) => void;
    onCollectionsClick?: () => void;
  }
> = (props) => {
  const {
    currentTab = 'map',
    onTabChange,
    onVoiceSearch,
    onVoicePartialSearch,
    notificationsCount = 0,
    onNotificationClick,
    isNotificationsOpen = false,
    onSearchFocus,
    onCollectionsClick,
    mapDisplayMode = 'mapa',
    onMapDisplayModeChange,
    viewMode = 'local',
    onToggleViewMode,
    showFilters = false,
    onFiltersClick,
    onFiltersAnchorChange,
    onNotificationsAnchorChange,
  } = props;

  const { signOut, isAuthenticated, openAuthModal } = useAuth();
  const router = useRouter();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();

  // ── Breakpoints responsive ────────────────────────────────────────────────
  // Bajo BP_OVERFLOW se colapsan las acciones secundarias en un menú "⋮".
  // Las etiquetas de texto aparecen progresivamente al haber más ancho.
  const isNarrow = windowWidth < BP_OVERFLOW;
  const showLogoText = windowWidth >= BP_LOGO_TEXT;
  const showModeLabels = windowWidth >= BP_MODE_LABELS;

  // ── Search state ──────────────────────────────────────────────────────────
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [isSearchHovered, setIsSearchHovered] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const suggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const lowerQuery = searchQuery.toLowerCase();
    return INITIAL_EVENTS.filter(
      (e) =>
        e.title.toLowerCase().includes(lowerQuery) ||
        (e.category && e.category.toLowerCase().includes(lowerQuery)),
    ).slice(0, 5); // Limit to 5 suggestions
  }, [searchQuery]);

  // ── Profile state ─────────────────────────────────────────────────────────
  const { user: clerkUser } = useClerkUser();
  const isUserLoggedIn = Boolean(isAuthenticated || clerkUser);
  const [profile, setProfile] = useState<NormalUserProfile | null>(null);

  // ── Dropdown state ────────────────────────────────────────────────────────
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const avatarRef = useRef<View>(null);
  const [isAvatarHovered, setIsAvatarHovered] = useState(false);
  const [isAvatarPressed, setIsAvatarPressed] = useState(false);
  const [isAvatarFocused, setIsAvatarFocused] = useState(false);

  // ── Anclaje de botones del navbar (para medir y posicionar sus menús) ─────
  const toolsBtnRef = useRef<View>(null);
  const notifBtnRef = useRef<View>(null);
  const settingsBtnRef = useRef<View>(null);
  const vibeBtnRef = useRef<View>(null);
  const overflowBtnRef = useRef<View>(null);

  const measureAnchor = useCallback(
    (
      ref: React.RefObject<View | null> | { current: any },
    ): Promise<{ top: number; left: number; right: number }> => {
      return new Promise((resolve) => {
        if (ref.current) {
          ref.current.measure(
            (_x: number, _y: number, w: number, h: number, px: number, py: number) => {
              resolve({ top: py + h + 8, left: px, right: Math.max(16, windowWidth - (px + w)) });
            },
          );
        } else {
          resolve({ top: 60, left: 16, right: 16 });
        }
      });
    },
    [windowWidth],
  );

  // ── Settings state ────────────────────────────────────────────────────────
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [settingsPosition, setSettingsPosition] = useState({ top: 0, right: 0 });

  // ── Personalizar mapa (vibe) state ──────────────────────────────────────────
  const [isVibeOpen, setIsVibeOpen] = useState(false);
  const [vibePosition, setVibePosition] = useState({ top: 0, right: 0 });
  const isMapPersonalized = useIsMapPersonalized();

  // ── Overflow "⋮" (acciones secundarias en pantallas angostas) ──────────────
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const [overflowPosition, setOverflowPosition] = useState({ top: 0, right: 0 });
  const [pushNotifications, setPushNotifications] = useState(true);
  const [soundEffects, setSoundEffects] = useState(true);
  const [language, setLanguage] = useState<'es' | 'en'>('es');
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');

  // ── Effects ───────────────────────────────────────────────────────────────
  const fetchProfile = useCallback(async () => {
    try {
      const stored = await loadUserProfile();
      setProfile(stored);
    } catch {
      /* ignore */
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const [n, s, l, t] = await Promise.all([
        AsyncStorage.getItem('app-turismo.settings.notifications'),
        AsyncStorage.getItem('app-turismo.settings.sound'),
        AsyncStorage.getItem('app-turismo.settings.language'),
        AsyncStorage.getItem('app-turismo.settings.theme'),
      ]);
      if (n !== null) setPushNotifications(n === 'true');
      if (s !== null) setSoundEffects(s === 'true');
      if (l !== null) setLanguage(l as 'es' | 'en');
      if (t !== null) setThemeMode(t as 'dark' | 'light');
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchProfile();
    loadSettings();
  }, [fetchProfile, loadSettings]);

  // Cada control de Ajustes persiste al instante (sin botón "Guardar"),
  // como se espera de un dropdown — no de un formulario modal.
  const persistSetting = useCallback(async (key: string, value: string) => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  }, []);

  const handlePushNotificationsChange = useCallback(
    (value: boolean) => {
      setPushNotifications(value);
      persistSetting('app-turismo.settings.notifications', String(value));
    },
    [persistSetting],
  );

  const handleSoundEffectsChange = useCallback(
    (value: boolean) => {
      setSoundEffects(value);
      persistSetting('app-turismo.settings.sound', String(value));
    },
    [persistSetting],
  );

  const handleLanguageChange = useCallback(
    (value: 'es' | 'en') => {
      setLanguage(value);
      persistSetting('app-turismo.settings.language', value);
    },
    [persistSetting],
  );

  const handleThemeChange = useCallback(
    (value: 'dark' | 'light') => {
      setThemeMode(value);
      persistSetting('app-turismo.settings.theme', value);
    },
    [persistSetting],
  );

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleTabChange = useCallback(
    (tab: TabType) => {
      if (tab === 'saved') {
        onCollectionsClick?.();
        return;
      }
      onTabChange?.(tab);
    },
    [onTabChange, onCollectionsClick],
  );

  const handleModeSelect = useCallback(
    (mode: MapDisplayMode) => {
      onMapDisplayModeChange?.(mode);
      if (currentTab !== 'map') {
        onTabChange?.('map');
      }
    },
    [onMapDisplayModeChange, onTabChange, currentTab],
  );

  const handleToggleSearch = useCallback(
    (active: boolean) => {
      LayoutAnimation.configureNext(
        LayoutAnimation.create(
          250,
          LayoutAnimation.Types.easeInEaseOut,
          LayoutAnimation.Properties.opacity,
        ),
      );
      if (active) {
        onSearchFocus?.();
        getRecentSearches().then(setRecentSearches);
      }
      setIsSearchActive(active);
    },
    [onSearchFocus],
  );

  const handleRecentSearchSelect = useCallback(
    (item: RecentSearch) => {
      onVoiceSearch?.({
        query: item.query,
        category: item.category,
        originalText: item.query,
        isFinal: true,
      });

      // Cambiar modo del mapa basado en la categoría
      if (item.category) {
        const turismoCats = [
          'cultura',
          'naturaleza',
          'museo',
          'parque',
          'teatro',
          'monumento',
          'turistica',
        ];
        const comercialCats = ['gastronomia', 'tienda', 'comercial', 'restaurant'];

        const catLower = item.category.toLowerCase();
        if (turismoCats.includes(catLower)) {
          onMapDisplayModeChange?.('turismo');
        } else if (comercialCats.includes(catLower)) {
          onMapDisplayModeChange?.('comercial');
        } else {
          onMapDisplayModeChange?.('mapa');
        }
      }
    },
    [onVoiceSearch, onMapDisplayModeChange],
  );

  const handleDeleteRecentSearch = useCallback(async (id: string) => {
    await removeRecentSearch(id);
    setRecentSearches((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleToggleDropdown = useCallback(async () => {
    if (isDropdownOpen) {
      setIsDropdownOpen(false);
      return;
    }
    void fetchProfile();
    const pos = await measureAnchor(avatarRef);
    setDropdownPosition({ top: pos.top, right: pos.right });
    setIsDropdownOpen(true);
  }, [isDropdownOpen, fetchProfile, measureAnchor]);

  const handleSignOut = useCallback(async () => {
    setIsDropdownOpen(false);
    await signOut();
  }, [signOut]);

  // En pantallas angostas las acciones viven en el menú "⋮": se ancla a ese
  // botón en vez de al icono individual (que no está montado).
  const handleFiltersPress = useCallback(async () => {
    setIsOverflowOpen(false);
    const pos = await measureAnchor(isNarrow ? overflowBtnRef : toolsBtnRef);
    onFiltersAnchorChange?.({ top: pos.top, left: pos.left });
    onFiltersClick?.();
  }, [isNarrow, measureAnchor, onFiltersAnchorChange, onFiltersClick]);

  const handleNotificationsPress = useCallback(async () => {
    setIsOverflowOpen(false);
    const pos = await measureAnchor(isNarrow ? overflowBtnRef : notifBtnRef);
    onNotificationsAnchorChange?.({ top: pos.top, left: pos.left });
    onNotificationClick?.();
  }, [isNarrow, measureAnchor, onNotificationsAnchorChange, onNotificationClick]);

  const handleToggleSettings = useCallback(async () => {
    if (isSettingsVisible) {
      setIsSettingsVisible(false);
      return;
    }
    setIsOverflowOpen(false);
    const pos = await measureAnchor(isNarrow ? overflowBtnRef : settingsBtnRef);
    setSettingsPosition({ top: pos.top, right: pos.right });
    setIsSettingsVisible(true);
  }, [isNarrow, isSettingsVisible, measureAnchor]);

  const handleToggleVibe = useCallback(async () => {
    if (isVibeOpen) {
      setIsVibeOpen(false);
      return;
    }
    setIsOverflowOpen(false);
    const pos = await measureAnchor(isNarrow ? overflowBtnRef : vibeBtnRef);
    setVibePosition({ top: pos.top, right: pos.right });
    setIsVibeOpen(true);
  }, [isNarrow, isVibeOpen, measureAnchor]);

  const handleToggleOverflow = useCallback(async () => {
    if (isOverflowOpen) {
      setIsOverflowOpen(false);
      return;
    }
    const pos = await measureAnchor(overflowBtnRef);
    setOverflowPosition({ top: pos.top, right: pos.right });
    setIsOverflowOpen(true);
  }, [isOverflowOpen, measureAnchor]);

  // ─── Derived values ───────────────────────────────────────────────────────
  const isAvatarActive = currentTab === 'profile' || isDropdownOpen;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <View style={styles.navWrapper} pointerEvents="box-none">
        <View style={styles.navIsland} pointerEvents="auto">
          {/* ━━━ Logo ━━━ */}
          <TouchableOpacity
            style={styles.logoSection}
            activeOpacity={0.8}
            onPress={() => handleModeSelect('mapa')}
            accessibilityRole="button"
            accessibilityLabel="Ir al mapa"
          >
            <View style={styles.logoBadge}>
              <MaterialIcons name="explore" size={18} color="#6EE7B7" />
            </View>
            {showLogoText && (
              <View style={styles.logoTextBlock}>
                <Text style={styles.logoTitle}>Valdivia</Text>
                <Text style={styles.logoSubtitle}>PORTAL TURÍSTICO</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* ━━━ OPCIONES: Mapa / Turismo / Comercial (Pillows Sliding Animation) ━━━ */}
          <ModePillButtonGroup
            mapDisplayMode={mapDisplayMode}
            currentTab={currentTab}
            showModeLabels={showModeLabels}
            onModeSelect={handleModeSelect}
          />

          <View style={styles.flexSpacer} />

          {/* ━━━ Searchbar ━━━ */}
          <View style={styles.searchAnchor}>
            <View
              style={[
                styles.searchBox,
                isSearchActive && styles.searchBoxFocused,
                isSearchHovered && !isSearchActive && styles.searchBoxHovered,
              ]}
              //@ts-ignore
              onMouseEnter={() => setIsSearchHovered(true)}
              onMouseLeave={() => setIsSearchHovered(false)}
            >
              {isSearchActive ? (
                <View style={styles.searchExpandedContent}>
                  <SmartVoiceSearch
                    isEmbedded={true}
                    onPartialResult={(text) => onVoicePartialSearch?.(text)}
                    onChangeText={(text) => {
                      setSearchQuery(text);
                      if (text.trim() === '') {
                        onVoiceSearch?.({
                          query: '',
                          category: 'todos',
                          originalText: '',
                          isFinal: true,
                        });
                      }
                    }}
                    onSearchComplete={(res) => {
                      setSearchQuery('');
                      getRecentSearches().then(setRecentSearches);
                      onVoiceSearch?.(res);
                    }}
                  />
                  <TouchableOpacity
                    onPress={() => handleToggleSearch(false)}
                    style={styles.searchBackBtn}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close" size={16} color={C.textPrimary} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => handleToggleSearch(true)}
                  activeOpacity={0.8}
                  style={styles.searchCollapsedBtn}
                >
                  <Ionicons name="search" size={17} color={C.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {isSearchActive &&
              (searchQuery.trim() ? suggestions.length > 0 : recentSearches.length > 0) && (
                <View style={styles.recentSearchesDropdown}>
                  {searchQuery.trim() ? (
                    <>
                      <View style={styles.recentSearchHeader}>
                        <Text style={styles.recentSearchHeaderText}>Sugerencias</Text>
                      </View>
                      {suggestions.map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          style={[styles.recentSearchItem, { gap: 12 }]}
                          activeOpacity={0.7}
                          onPress={() => {
                            setSearchQuery('');
                            onVoiceSearch?.({
                              query: item.title,
                              category: item.category || 'todos',
                              originalText: item.title,
                              isFinal: true,
                              eventId: item.id,
                            });

                            // Cambiar modo del mapa basado en la categoría
                            if (item.category) {
                              const turismoCats = [
                                'cultura',
                                'naturaleza',
                                'museo',
                                'parque',
                                'teatro',
                                'monumento',
                                'turistica',
                              ];
                              const comercialCats = [
                                'gastronomia',
                                'tienda',
                                'comercial',
                                'restaurant',
                              ];

                              const catLower = item.category.toLowerCase();
                              if (turismoCats.includes(catLower)) {
                                onMapDisplayModeChange?.('turismo');
                              } else if (comercialCats.includes(catLower)) {
                                onMapDisplayModeChange?.('comercial');
                              } else {
                                onMapDisplayModeChange?.('mapa');
                              }
                            }
                          }}
                        >
                          <Ionicons name="location-outline" size={16} color={C.textMuted} />
                          <Text style={styles.recentSearchText} numberOfLines={1}>
                            {item.title}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </>
                  ) : (
                    <>
                      <View style={styles.recentSearchHeader}>
                        <Text style={styles.recentSearchHeaderText}>Búsquedas Recientes</Text>
                      </View>
                      {recentSearches.map((item) => (
                        <RecentSearchRow
                          key={item.id}
                          item={item}
                          onSelect={() => handleRecentSearchSelect(item)}
                          onDelete={() => handleDeleteRecentSearch(item.id)}
                        />
                      ))}
                    </>
                  )}
                </View>
              )}
          </View>

          {isNarrow ? (
            /* ━━━ Menú overflow "⋮" (acciones secundarias colapsadas) ━━━ */
            <NavIconButton
              ref={overflowBtnRef}
              icon="more-vert"
              iconSet="MaterialIcons"
              label="Más opciones"
              active={
                isOverflowOpen || isSettingsVisible || isNotificationsOpen || showFilters || isVibeOpen
              }
              badge={notificationsCount > 0 || (isUserLoggedIn && !isMapPersonalized)}
              onClick={handleToggleOverflow}
            />
          ) : (
            <>
              {/* ━━━ Herramientas ━━━ */}
              <NavIconButton
                ref={toolsBtnRef}
                icon="tune"
                iconSet="MaterialIcons"
                label="Herramientas"
                active={showFilters}
                onClick={handleFiltersPress}
              />

              {/* ━━━ Personalizar mapa ━━━ */}
              {isUserLoggedIn && (
                <NavIconButton
                  ref={vibeBtnRef}
                  icon="auto-awesome"
                  iconSet="MaterialIcons"
                  label="Personalizar mapa"
                  active={isVibeOpen}
                  badge={!isMapPersonalized}
                  onClick={handleToggleVibe}
                />
              )}

              {/* ━━━ Notificaciones ━━━ */}
              <NavIconButton
                ref={notifBtnRef}
                icon="notifications-outline"
                iconSet="Ionicons"
                label={
                  notificationsCount > 0 ? `${notificationsCount} notificaciones` : 'Notificaciones'
                }
                active={isNotificationsOpen}
                badge={notificationsCount > 0}
                onClick={handleNotificationsPress}
              />

              {/* ━━━ Ajustes ━━━ */}
              <NavIconButton
                ref={settingsBtnRef}
                icon="settings"
                iconSet="MaterialIcons"
                label="Ajustes"
                active={isSettingsVisible}
                onClick={handleToggleSettings}
              />
            </>
          )}

          {/* ━━━ Botón Iniciar Sesión (visible en pantallas no angostas cuando no está autenticado) ━━━ */}
          {!isUserLoggedIn && !isNarrow && (
            <TouchableOpacity
              onPress={() => openAuthModal('login')}
              style={[
                styles.navAuthButton,
                Platform.select({
                  web: {
                    transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                  } as any,
                }),
              ]}
              activeOpacity={0.8}
            >
              <MaterialIcons name="login" size={14} color="#06281E" style={{ marginRight: 4 }} />
              <Text style={styles.navAuthButtonText}>Ingresar</Text>
            </TouchableOpacity>
          )}

          {/* ━━━ Perfil ━━━ */}
          <TouchableOpacity
            ref={avatarRef}
            onPress={isUserLoggedIn ? handleToggleDropdown : () => openAuthModal('login')}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            onPressIn={() => setIsAvatarPressed(true)}
            onPressOut={() => setIsAvatarPressed(false)}
            //@ts-ignore
            onMouseEnter={() => setIsAvatarHovered(true)}
            onMouseLeave={() => setIsAvatarHovered(false)}
            onFocus={() => setIsAvatarFocused(true)}
            onBlur={() => setIsAvatarFocused(false)}
            style={[
              styles.avatarButton,
              isAvatarActive && styles.avatarButtonActive,
              isAvatarPressed && !isAvatarActive && styles.iconBtnPressed,
              isAvatarFocused && styles.iconBtnFocused,
              Platform.select({
                web: {
                  ...(isAvatarActive ? { boxShadow: '0 0 14px rgba(52, 211, 153, 0.35)' } : {}),
                } as any,
              }),
            ]}
            accessibilityRole="button"
            accessibilityLabel="Perfil"
          >
            <View style={[styles.avatarCircle, isAvatarActive && styles.avatarCircleActive]}>
              {clerkUser?.imageUrl ? (
                <Image source={{ uri: clerkUser.imageUrl }} style={styles.clerkAvatarImage} />
              ) : (
                <MaterialIcons
                  name={(profile?.avatarIcon || 'person') as any}
                  size={14}
                  color={isAvatarActive ? C.accent : C.textPrimary}
                />
              )}
            </View>
            {Platform.OS === 'web' && isAvatarHovered && !isDropdownOpen && (
              <View style={styles.tooltip} pointerEvents="none">
                <Text style={styles.tooltipText}>{isUserLoggedIn ? 'Mi Perfil' : 'Ingresar'}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ━━━ DROPDOWN DE PERFIL (debajo del icono, alineado a la derecha) ━━━ */}
      <SidebarSubmenu
        visible={isDropdownOpen}
        onClose={() => setIsDropdownOpen(false)}
        position={{ top: dropdownPosition.top, right: dropdownPosition.right }}
        pointerPosition="top-left"
        width={220}
        maxHeight={windowHeight * 0.7}
      >
        {isUserLoggedIn ? (
          <>
            <View style={styles.dropdownUserCard}>
              <Text style={styles.dropdownUserName} numberOfLines={1}>
                {clerkUser?.fullName || profile?.fullName || 'Usuario'}
              </Text>
              <Text style={styles.dropdownUserEmail} numberOfLines={1}>
                {clerkUser?.primaryEmailAddress?.emailAddress || profile?.email || ''}
              </Text>
            </View>
            <View style={styles.dropdownDivider} />
            {PROFILE_LINKS.map((link) => (
              <DropdownItem
                key={link.tab}
                icon={link.icon}
                label={link.label}
                onPress={() => {
                  setIsDropdownOpen(false);
                  handleTabChange(link.tab);
                }}
              />
            ))}
            <View style={styles.dropdownDivider} />
            <DropdownItem
              icon="logout"
              label="Cerrar sesión"
              onPress={handleSignOut}
              isDestructive
            />
          </>
        ) : (
          <>
            <DropdownItem
              icon="login"
              label="Iniciar sesión"
              onPress={() => {
                setIsDropdownOpen(false);
                openAuthModal('login');
              }}
            />
            <DropdownItem
              icon="person-add"
              label="Crear cuenta"
              onPress={() => {
                setIsDropdownOpen(false);
                openAuthModal('register');
              }}
            />
          </>
        )}
      </SidebarSubmenu>

      {/* ━━━ DROPDOWN DE AJUSTES (debajo del icono, alineado a la derecha) ━━━ */}
      <SidebarSubmenu
        visible={isSettingsVisible}
        onClose={() => setIsSettingsVisible(false)}
        position={{ top: settingsPosition.top, right: settingsPosition.right }}
        pointerPosition="top-left"
        title="Ajustes"
        width={300}
        maxHeight={windowHeight * 0.7}
      >
        <View style={styles.settingsBody}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Notificaciones Push</Text>
              <Text style={styles.settingDesc}>
                Recibe alertas de eventos cercanos en tiempo real
              </Text>
            </View>
            <Switch
              value={pushNotifications}
              onValueChange={handlePushNotificationsChange}
              trackColor={{ false: C.borderMid, true: C.accent }}
              thumbColor={pushNotifications ? C.textPrimary : C.textMuted}
            />
          </View>
          <View style={styles.settingsDivider} />

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Efectos de Sonido</Text>
              <Text style={styles.settingDesc}>Reproduce sonidos en interacciones y búsquedas</Text>
            </View>
            <Switch
              value={soundEffects}
              onValueChange={handleSoundEffectsChange}
              trackColor={{ false: C.borderMid, true: C.accent }}
              thumbColor={soundEffects ? C.textPrimary : C.textMuted}
            />
          </View>
          <View style={styles.settingsDivider} />

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Idioma de la Guía</Text>
              <Text style={styles.settingDesc}>Idioma de los contenidos del feed y foro</Text>
            </View>
            <View style={styles.selectorGroup}>
              {(['es', 'en'] as const).map((lang) => (
                <TouchableOpacity
                  key={lang}
                  style={[styles.selectorBtn, language === lang && styles.selectorBtnActive]}
                  onPress={() => handleLanguageChange(lang)}
                >
                  <Text
                    style={[
                      styles.selectorBtnText,
                      language === lang && styles.selectorBtnTextActive,
                    ]}
                  >
                    {lang.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.settingsDivider} />

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Tema Visual</Text>
              <Text style={styles.settingDesc}>Personaliza los colores de la interfaz</Text>
            </View>
            <View style={styles.selectorGroup}>
              <TouchableOpacity
                style={[styles.selectorBtn, themeMode === 'dark' && styles.selectorBtnActive]}
                onPress={() => handleThemeChange('dark')}
              >
                <Text
                  style={[
                    styles.selectorBtnText,
                    themeMode === 'dark' && styles.selectorBtnTextActive,
                  ]}
                >
                  Oscuro
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.selectorBtn, themeMode === 'light' && styles.selectorBtnActive]}
                onPress={() => handleThemeChange('light')}
              >
                <Text
                  style={[
                    styles.selectorBtnText,
                    themeMode === 'light' && styles.selectorBtnTextActive,
                  ]}
                >
                  Claro
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SidebarSubmenu>

      {/* ━━━ PERSONALIZAR MAPA (vibe contextual) ━━━ */}
      {isUserLoggedIn && (
        <SidebarSubmenu
          visible={isVibeOpen}
          onClose={() => setIsVibeOpen(false)}
          position={{ top: vibePosition.top, right: vibePosition.right }}
          pointerPosition="top-left"
          title="Personaliza tu mapa"
          width={300}
          maxHeight={windowHeight * 0.7}
        >
          <ContextualSurveyWidget onSaved={() => setIsVibeOpen(false)} />
        </SidebarSubmenu>
      )}

      {/* ━━━ MENÚ OVERFLOW "⋮" (acciones secundarias en pantallas angostas) ━━━ */}
      <SidebarSubmenu
        visible={isOverflowOpen}
        onClose={() => setIsOverflowOpen(false)}
        position={{ top: overflowPosition.top, right: overflowPosition.right }}
        pointerPosition="top-left"
        width={240}
        maxHeight={windowHeight * 0.7}
      >
        <DropdownItem
          icon="tune"
          label="Herramientas"
          onPress={handleFiltersPress}
          isActive={showFilters}
        />
        {isUserLoggedIn && (
          <DropdownItem
            icon="auto-awesome"
            label="Personalizar mapa"
            onPress={handleToggleVibe}
            badge={!isMapPersonalized ? 'Nuevo' : undefined}
            isActive={isVibeOpen}
          />
        )}
        <DropdownItem
          icon="notifications-none"
          label={
            notificationsCount > 0 ? `Notificaciones (${notificationsCount})` : 'Notificaciones'
          }
          onPress={handleNotificationsPress}
          badge={notificationsCount > 0 ? notificationsCount : undefined}
          isActive={isNotificationsOpen}
        />
        <DropdownItem
          icon="settings"
          label="Ajustes"
          onPress={handleToggleSettings}
          isActive={isSettingsVisible}
        />
      </SidebarSubmenu>
    </>
  );
};
