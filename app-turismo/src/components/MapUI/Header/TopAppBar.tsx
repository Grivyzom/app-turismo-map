import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Text,
  Switch,
  LayoutAnimation,
  useWindowDimensions,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

import { TopAppBarProps, TabType, MapDisplayMode } from '../types';
import { NAVBAR_TOP } from '../../../utils/layout';
import { SmartVoiceSearch } from '../../ui/SmartVoiceSearch';
import { ParsedSearch } from '../../../utils/aiSearchParser';
import { useAuth } from '../../../context/AuthContext';
import { loadUserProfile, NormalUserProfile } from '../../../utils/userProfileStorage';
import { ContextualSurveyWidget } from '../../ui/ContextualSurveyWidget';
import { SidebarSubmenu } from '../../ui/SidebarSubmenu';
import { getRecentSearches, removeRecentSearch, RecentSearch } from '../../../utils/recentSearches';

// ─── Design Tokens (Premium Glassmorphism) ──────────────────────────────────
const C = {
  bg: 'rgba(30, 30, 30, 0.6)',
  bgGlass: 'rgba(30, 30, 30, 0.6)',
  bgDeep: 'rgba(18, 22, 30, 0.95)',
  bgDark: 'rgba(15, 20, 25, 0.95)',
  border: 'rgba(255, 255, 255, 0.1)',
  borderMid: 'rgba(255, 255, 255, 0.15)',
  borderHover: 'rgba(255, 255, 255, 0.25)',
  textPrimary: '#FFFFFF',
  textMuted: '#9CA3AF',
  textInactive: '#A3A3A3',
  accent: '#34D399',
  accentBg: 'rgba(52, 211, 153, 0.12)',
  destructive: '#EF4444',
  destructiveBg: 'rgba(239, 68, 68, 0.12)',
  divider: 'rgba(255, 255, 255, 0.1)',
  tourist: '#F59E0B',
  touristBg: 'rgba(245, 158, 11, 0.15)',
  local: '#10B981',
  localBg: 'rgba(16, 185, 129, 0.15)',
};

const ISLAND_SHADOW = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  android: { elevation: 6 },
  web: {
    boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.2)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  },
}) as any;

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  navWrapper: {
    flex: 1,
    flexDirection: 'row',
  },
  navIsland: {
    flex: 1,
    height: '100%',
    // Efecto "notch": pegada arriba, solo las esquinas inferiores curvas —
    // parece una pestaña que sobresale desde el borde superior de la pantalla.
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingTop: NAVBAR_TOP,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    overflow: 'visible',
    ...ISLAND_SHADOW,
    ...Platform.select({ web: { backgroundColor: C.bgGlass } as any }),
  },

  // ── Logo / brand ──────────────────────────────────────────────────────────
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  logoBadge: {
    width: 33,
    height: 33,
    borderRadius: 10,
    backgroundColor: 'rgba(110, 231, 183, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(110, 231, 183, 0.25)',
  },
  logoTextBlock: { justifyContent: 'center' },
  logoTitle: { color: '#F5FAF7', fontSize: 14, fontWeight: '900', letterSpacing: 0.3 },
  logoSubtitle: {
    color: '#6B7280',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 1,
  },

  divider: {
    width: 1,
    height: 24,
    backgroundColor: C.divider,
  },

  // ── OPCIONES (Mapa / Turismo / Comercial) ─────────────────────────────────
  modeGroup: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 14,
    padding: 4,
    gap: 4,
    flexShrink: 0,
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9,
    gap: 6,
    ...Platform.select({ web: { cursor: 'pointer', transition: 'all 0.2s ease' } }),
  },
  modeButtonActive: {
    backgroundColor: C.accentBg,
    borderWidth: 1,
    borderColor: 'rgba(110, 231, 183, 0.25)',
  },
  modeButtonText: { color: C.textInactive, fontSize: 13, fontWeight: '600' },
  modeButtonTextActive: { color: C.accent, fontWeight: '700' },

  flexSpacer: { flex: 1 },

  // ── Search box (inline, collapsible) ──────────────────────────────────────
  searchAnchor: { position: 'relative' },
  searchBox: {
    height: 38,
    borderRadius: 19,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    ...Platform.select({ web: { backgroundColor: C.bgGlass, transition: 'all 0.25s ease' } }),
  },
  searchBoxFocused: { borderColor: C.accent },
  searchBoxHovered: { borderColor: C.borderMid },
  searchCollapsedBtn: {
    width: 38,
    height: 38,
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
    top: 46,
    right: 0,
    width: Platform.OS === 'web' ? 320 : 260,
    backgroundColor: C.bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 8,
    zIndex: 150,
    ...ISLAND_SHADOW,
    ...Platform.select({
      web: { backgroundColor: C.bgGlass, backdropFilter: 'blur(12px)' } as any,
    }),
  },
  recentSearchItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16 },
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
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.bgDeep,
    flexShrink: 0,
    position: 'relative',
    ...Platform.select({ web: { cursor: 'pointer', transition: 'all 0.2s ease' } }),
  },
  iconBtnActive: { backgroundColor: C.accentBg, borderColor: 'rgba(52, 211, 153, 0.3)' },
  iconBtnHovered: { backgroundColor: C.borderMid, borderColor: C.borderHover },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.destructive,
    borderWidth: 1.5,
    borderColor: C.bgDeep,
  },

  // ── Estado (Turista / Local) ─────────────────────────────────────────────
  estadoGroup: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 14,
    padding: 4,
    gap: 4,
    flexShrink: 0,
  },
  estadoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 9,
    gap: 6,
    ...Platform.select({ web: { cursor: 'pointer', transition: 'all 0.2s ease' } }),
  },
  estadoButtonText: { fontSize: 12, fontWeight: '700' },
  // Fila del toggle Turista/Local dentro del menú overflow "⋮"
  overflowEstadoRow: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 6, paddingHorizontal: 8 },

  // ── Avatar button ─────────────────────────────────────────────────────────
  avatarButton: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.bgDeep,
    flexShrink: 0,
    ...Platform.select({ web: { cursor: 'pointer', transition: 'all 0.2s ease' } }),
  },
  avatarButtonActive: { backgroundColor: C.accentBg, borderColor: 'rgba(52, 211, 153, 0.3)' },
  avatarCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.borderMid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircleActive: { backgroundColor: C.accentBg },

  // ── Dropdown menu ─────────────────────────────────────────────────────────
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 10,
    ...Platform.select({ web: { cursor: 'pointer', transition: 'all 0.2s ease' } }),
  },
  dropdownItemText: { fontSize: 13, fontWeight: '600' },
  dropdownDivider: { height: 1, backgroundColor: C.divider, marginVertical: 4, marginHorizontal: 8 },

  // ── Settings dropdown ─────────────────────────────────────────────────────
  settingsBody: { gap: 18, padding: 14 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  settingInfo: { flex: 1, paddingRight: 16 },
  settingLabel: { color: C.textPrimary, fontSize: 14, fontWeight: '600' },
  settingDesc: { color: C.textMuted, fontSize: 12, marginTop: 2 },
  settingsDivider: { height: 1, backgroundColor: C.divider, marginVertical: 4 },
  selectorGroup: {
    flexDirection: 'row',
    backgroundColor: C.bgDark,
    borderRadius: 10,
    padding: 2,
    borderWidth: 1,
    borderColor: C.divider,
  },
  selectorBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  selectorBtnActive: { backgroundColor: C.accent },
  selectorBtnText: { color: C.textMuted, fontSize: 12, fontWeight: '600' },
  selectorBtnTextActive: { color: C.textPrimary, fontWeight: '700' },

  // ── Tooltip ───────────────────────────────────────────────────────────────
  tooltip: {
    position: 'absolute',
    top: 44,
    backgroundColor: 'rgba(26, 26, 26, 0.97)',
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: C.borderMid,
    zIndex: 9999,
    ...Platform.select({
      web: {
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(10px)',
      } as any,
    }),
  },
  tooltipText: { color: C.textPrimary, fontSize: 12, fontWeight: '600', letterSpacing: 0.2 },
});

// ─── Sub-components ──────────────────────────────────────────────────────────

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
    const IconComp = iconSet === 'Ionicons' ? Ionicons : MaterialIcons;

    return (
      <TouchableOpacity
        ref={ref}
        onPress={onClick}
        activeOpacity={0.7}
        //@ts-ignore
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={[styles.iconBtn, active && styles.iconBtnActive, isHovered && !active && styles.iconBtnHovered]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <IconComp name={icon as any} size={17} color={active ? C.accent : C.textPrimary} />
        {badge && <View style={styles.notificationBadge} />}
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
}: {
  icon: string;
  label: string;
  onPress: () => void;
  isDestructive?: boolean;
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
        isHovered && { backgroundColor: isDestructive ? C.destructiveBg : 'rgba(255, 255, 255, 0.06)' },
      ]}
    >
      <MaterialIcons name={icon as any} size={18} color={isDestructive ? C.destructive : isHovered ? C.accent : C.textMuted} />
      <Text
        style={[
          styles.dropdownItemText,
          isDestructive ? { color: C.destructive } : isHovered ? { color: C.textPrimary } : { color: '#E5E7EB' },
        ]}
      >
        {label}
      </Text>
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
      <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }} onPress={onSelect} activeOpacity={0.7}>
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
const BP_ESTADO_LABELS = 1100; // ≥ : etiquetas Turista/Local

// ─── Mode/estado definitions ─────────────────────────────────────────────────
const MODE_OPTIONS: { id: MapDisplayMode; label: string; icon: string }[] = [
  { id: 'mapa', label: 'Mapa', icon: 'map' },
  { id: 'turismo', label: 'Turismo', icon: 'explore' },
  { id: 'comercial', label: 'Comercial', icon: 'storefront' },
];

const PROFILE_LINKS: { tab: TabType; label: string; icon: string }[] = [
  { tab: 'profile', label: 'Mi Perfil', icon: 'person' },
  { tab: 'feed', label: 'Feed de Eventos', icon: 'dynamic-feed' },
  { tab: 'eventos', label: 'Eventos', icon: 'event' },
  { tab: 'saved', label: 'Mis Guardados', icon: 'collections' },
  { tab: 'historial', label: 'Recientes', icon: 'history' },
  { tab: 'forum', label: 'Foro', icon: 'forum' },
];

// ─── Estado (Turista / Local) ─────────────────────────────────────────────────
/** Toggle compartido entre la navbar inline y el menú overflow. */
const EstadoToggle = React.memo(function EstadoToggle({
  viewMode,
  onSelect,
  showLabels,
}: {
  viewMode: 'local' | 'tourist';
  onSelect: (target: 'local' | 'tourist') => void;
  showLabels: boolean;
}) {
  return (
    <View style={styles.estadoGroup}>
      <TouchableOpacity
        style={[styles.estadoButton, viewMode === 'tourist' && { backgroundColor: C.touristBg }]}
        onPress={() => onSelect('tourist')}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityState={{ selected: viewMode === 'tourist' }}
        accessibilityLabel="Modo Turista"
      >
        <MaterialIcons name="explore" size={15} color={viewMode === 'tourist' ? C.tourist : C.textInactive} />
        {showLabels && (
          <Text style={[styles.estadoButtonText, { color: viewMode === 'tourist' ? C.tourist : C.textInactive }]}>
            Turista
          </Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.estadoButton, viewMode === 'local' && { backgroundColor: C.localBg }]}
        onPress={() => onSelect('local')}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityState={{ selected: viewMode === 'local' }}
        accessibilityLabel="Modo Local"
      >
        <MaterialIcons name="home" size={15} color={viewMode === 'local' ? C.local : C.textInactive} />
        {showLabels && (
          <Text style={[styles.estadoButtonText, { color: viewMode === 'local' ? C.local : C.textInactive }]}>
            Local
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
});

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

  const { signOut, isAuthenticated } = useAuth();
  const router = useRouter();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();

  // ── Breakpoints responsive ────────────────────────────────────────────────
  // Bajo BP_OVERFLOW se colapsan las acciones secundarias en un menú "⋮".
  // Las etiquetas de texto aparecen progresivamente al haber más ancho.
  const isNarrow = windowWidth < BP_OVERFLOW;
  const showLogoText = windowWidth >= BP_LOGO_TEXT;
  const showModeLabels = windowWidth >= BP_MODE_LABELS;
  const showEstadoLabels = windowWidth >= BP_ESTADO_LABELS;

  // ── Search state ──────────────────────────────────────────────────────────
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [isSearchHovered, setIsSearchHovered] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);

  // ── Profile state ─────────────────────────────────────────────────────────
  const [profile, setProfile] = useState<NormalUserProfile | null>(null);

  // ── Dropdown state ────────────────────────────────────────────────────────
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const avatarRef = useRef<View>(null);
  const [isAvatarHovered, setIsAvatarHovered] = useState(false);

  // ── Anclaje de botones del navbar (para medir y posicionar sus menús) ─────
  const toolsBtnRef = useRef<View>(null);
  const notifBtnRef = useRef<View>(null);
  const settingsBtnRef = useRef<View>(null);
  const overflowBtnRef = useRef<View>(null);

  const measureAnchor = useCallback(
    (ref: React.RefObject<View>): Promise<{ top: number; left: number; right: number }> => {
      return new Promise((resolve) => {
        if (ref.current) {
          ref.current.measure((_x, _y, w, h, px, py) => {
            resolve({ top: py + h + 8, left: px, right: Math.max(16, windowWidth - (px + w)) });
          });
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

  const handleEstadoSelect = useCallback(
    (target: 'local' | 'tourist') => {
      if (target !== viewMode) {
        onToggleViewMode?.();
      }
    },
    [viewMode, onToggleViewMode],
  );

  const handleToggleSearch = useCallback(
    (active: boolean) => {
      LayoutAnimation.configureNext(
        LayoutAnimation.create(250, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity),
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
      onVoiceSearch?.({ query: item.query, category: item.category, originalText: item.query, isFinal: true });
    },
    [onVoiceSearch],
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
      <View style={styles.navWrapper}>
        <View style={styles.navIsland}>
          {/* ━━━ Logo ━━━ */}
          <TouchableOpacity
            style={styles.logoSection}
            activeOpacity={0.8}
            onPress={() => handleModeSelect('mapa')}
            accessibilityRole="button"
            accessibilityLabel="Ir al mapa"
          >
            <View style={styles.logoBadge}>
              <MaterialIcons name="explore" size={20} color="#6EE7B7" />
            </View>
            {showLogoText && (
              <View style={styles.logoTextBlock}>
                <Text style={styles.logoTitle}>Valdivia</Text>
                <Text style={styles.logoSubtitle}>PORTAL TURÍSTICO</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* ━━━ OPCIONES: Mapa / Turismo / Comercial ━━━ */}
          <View style={styles.modeGroup}>
            {MODE_OPTIONS.map((mode) => {
              const isActive = mapDisplayMode === mode.id && currentTab === 'map';
              return (
                <TouchableOpacity
                  key={mode.id}
                  style={[styles.modeButton, isActive && styles.modeButtonActive]}
                  onPress={() => handleModeSelect(mode.id)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={`Modo ${mode.label}`}
                >
                  <MaterialIcons name={mode.icon as any} size={16} color={isActive ? C.accent : C.textInactive} />
                  {showModeLabels && (
                    <Text style={[styles.modeButtonText, isActive && styles.modeButtonTextActive]}>{mode.label}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.flexSpacer} />

          {/* ━━━ Searchbar ━━━ */}
          <View style={styles.searchAnchor}>
            <View
              style={[styles.searchBox, isSearchActive && styles.searchBoxFocused, isSearchHovered && !isSearchActive && styles.searchBoxHovered]}
              //@ts-ignore
              onMouseEnter={() => setIsSearchHovered(true)}
              onMouseLeave={() => setIsSearchHovered(false)}
            >
              {isSearchActive ? (
                <View style={styles.searchExpandedContent}>
                  <SmartVoiceSearch
                    isEmbedded={true}
                    onPartialResult={(text) => onVoicePartialSearch?.(text)}
                    onSearchComplete={(res) => {
                      getRecentSearches().then(setRecentSearches);
                      onVoiceSearch?.(res);
                    }}
                  />
                  <TouchableOpacity onPress={() => handleToggleSearch(false)} style={styles.searchBackBtn} activeOpacity={0.7}>
                    <Ionicons name="close" size={16} color={C.textPrimary} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={() => handleToggleSearch(true)} activeOpacity={0.8} style={styles.searchCollapsedBtn}>
                  <Ionicons name="search" size={17} color={C.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {isSearchActive && recentSearches.length > 0 && (
              <View style={styles.recentSearchesDropdown}>
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
              active={isOverflowOpen}
              badge={notificationsCount > 0}
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

              {/* ━━━ Notificaciones ━━━ */}
              <NavIconButton
                ref={notifBtnRef}
                icon="notifications-outline"
                iconSet="Ionicons"
                label={notificationsCount > 0 ? `${notificationsCount} notificaciones` : 'Notificaciones'}
                badge={notificationsCount > 0}
                onClick={handleNotificationsPress}
              />

              {/* ━━━ Estado: Turista / Local ━━━ */}
              <EstadoToggle viewMode={viewMode} onSelect={handleEstadoSelect} showLabels={showEstadoLabels} />

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

          {/* ━━━ Perfil ━━━ */}
          <TouchableOpacity
            ref={avatarRef}
            onPress={isAuthenticated ? handleToggleDropdown : () => router.push('/ingresar')}
            activeOpacity={0.7}
            //@ts-ignore
            onMouseEnter={() => setIsAvatarHovered(true)}
            onMouseLeave={() => setIsAvatarHovered(false)}
            style={[styles.avatarButton, isAvatarActive && styles.avatarButtonActive, isAvatarHovered && !isAvatarActive && styles.iconBtnHovered]}
            accessibilityRole="button"
            accessibilityLabel="Perfil"
          >
            <View style={[styles.avatarCircle, isAvatarActive && styles.avatarCircleActive]}>
              <MaterialIcons
                name={(profile?.avatarIcon || 'person') as any}
                size={14}
                color={isAvatarActive ? C.accent : C.textPrimary}
              />
            </View>
            {Platform.OS === 'web' && isAvatarHovered && !isDropdownOpen && (
              <View style={styles.tooltip} pointerEvents="none">
                <Text style={styles.tooltipText}>{isAuthenticated ? 'Mi Perfil' : 'Ingresar'}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ContextualSurveyWidget isSearchActive={isSearchActive} />

      {/* ━━━ DROPDOWN DE PERFIL (debajo del icono, alineado a la derecha) ━━━ */}
      <SidebarSubmenu
        visible={isDropdownOpen}
        onClose={() => setIsDropdownOpen(false)}
        position={{ top: dropdownPosition.top, right: dropdownPosition.right }}
        pointerPosition="top-left"
        width={220}
        maxHeight={windowHeight * 0.7}
      >
        {isAuthenticated ? (
          <>
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
            <DropdownItem icon="logout" label="Cerrar sesión" onPress={handleSignOut} isDestructive />
          </>
        ) : (
          <DropdownItem
            icon="login"
            label="Ingresar"
            onPress={() => {
              setIsDropdownOpen(false);
              router.push('/ingresar');
            }}
          />
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
              <Text style={styles.settingDesc}>Recibe alertas de eventos cercanos en tiempo real</Text>
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
                <TouchableOpacity key={lang} style={[styles.selectorBtn, language === lang && styles.selectorBtnActive]} onPress={() => handleLanguageChange(lang)}>
                  <Text style={[styles.selectorBtnText, language === lang && styles.selectorBtnTextActive]}>{lang.toUpperCase()}</Text>
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
              <TouchableOpacity style={[styles.selectorBtn, themeMode === 'dark' && styles.selectorBtnActive]} onPress={() => handleThemeChange('dark')}>
                <Text style={[styles.selectorBtnText, themeMode === 'dark' && styles.selectorBtnTextActive]}>Oscuro</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.selectorBtn, themeMode === 'light' && styles.selectorBtnActive]} onPress={() => handleThemeChange('light')}>
                <Text style={[styles.selectorBtnText, themeMode === 'light' && styles.selectorBtnTextActive]}>Claro</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SidebarSubmenu>

      {/* ━━━ MENÚ OVERFLOW "⋮" (acciones secundarias en pantallas angostas) ━━━ */}
      <SidebarSubmenu
        visible={isOverflowOpen}
        onClose={() => setIsOverflowOpen(false)}
        position={{ top: overflowPosition.top, right: overflowPosition.right }}
        pointerPosition="top-left"
        width={240}
        maxHeight={windowHeight * 0.7}
      >
        <View style={styles.overflowEstadoRow}>
          <EstadoToggle viewMode={viewMode} onSelect={handleEstadoSelect} showLabels />
        </View>
        <View style={styles.dropdownDivider} />
        <DropdownItem icon="tune" label="Herramientas" onPress={handleFiltersPress} />
        <DropdownItem
          icon="notifications-none"
          label={notificationsCount > 0 ? `Notificaciones (${notificationsCount})` : 'Notificaciones'}
          onPress={handleNotificationsPress}
        />
        <DropdownItem icon="settings" label="Ajustes" onPress={handleToggleSettings} />
      </SidebarSubmenu>
    </>
  );
};
