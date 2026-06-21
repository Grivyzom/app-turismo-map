import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Text,
  Modal,
  Pressable,
  Switch,
  ScrollView,
  LayoutAnimation,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

import { TopAppBarProps, TabType } from '../types';
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
};

// Shared glassmorphism shadow applied to both floating islands
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
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  },
}) as any;

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Root wrapper – fills the vertical space provided by `topBarWrapper`
  sidebarWrapper: {
    flex: 1,
    flexDirection: 'column',
    gap: 8,
    alignItems: 'flex-start', // Prevent stretching when search bar expands
    // Add safety margin to the right so shadows/borders don't peek out when translated
    paddingRight: 20,
  },

  // ── Search floating island ────────────────────────────────────────────────
  searchIsland: {
    height: 48, // Match sidebar width
    borderRadius: 24,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden', // Hide overflow during expansion animation
    ...ISLAND_SHADOW,
    ...Platform.select({
      web: {
        backgroundColor: C.bgGlass,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      } as any,
    }),
  },
  searchIslandFocused: {
    borderColor: C.accent,
  },
  searchIslandHovered: {
    borderColor: C.borderMid,
  },
  searchInactiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 9,
  },
  searchInactiveBtnIconOnly: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    width: 48, // Exactly match sidebar's 48px inner width
  },
  searchPlaceholder: {
    color: C.textMuted,
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  searchActiveContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    height: '100%',
    width: Platform.OS === 'web' ? 300 : 260, // Fixed expanded width
    gap: 6,
  },
  searchBackBtn: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },

  // ── Nav sidebar floating island ───────────────────────────────────────────
  sidebarIsland: {
    flex: 1,
    width: 48,
    borderRadius: 24,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 8,
    paddingHorizontal: 0,
    alignItems: 'center',
    flexDirection: 'column',
    justifyContent: 'space-between',
    overflow: 'visible',
    ...ISLAND_SHADOW,
    ...Platform.select({ web: { backgroundColor: C.bgGlass } as any }),
  },

  navSection: {
    flexDirection: 'column',
    gap: 4,
    width: '100%',
    alignItems: 'center',
    overflow: 'visible',
  },

  sidebarDivider: {
    height: 1,
    backgroundColor: C.divider,
    marginVertical: 8,
    width: 24,
  },

  actionsSection: {
    flexDirection: 'column',
    gap: 6,
    width: '100%',
    alignItems: 'center',
    overflow: 'visible',
  },

  // ── Sidebar item (nav tab) ────────────────────────────────────────────────
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'transparent',
    overflow: 'visible',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      },
    }),
  },
  sidebarItemActive: {
    backgroundColor: C.borderMid,
    borderColor: C.border,
  },
  sidebarItemMarked: {
    backgroundColor: 'rgba(127, 109, 242, 0.08)',
    borderColor: 'rgba(127, 109, 242, 0.2)',
  },
  markedDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.accent,
    borderWidth: 1,
    borderColor: C.bgDeep,
  },
  sidebarItemIconOnly: {
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  sidebarItemLabel: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.1,
  },

  // ── Avatar button ─────────────────────────────────────────────────────────
  avatarButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'transparent',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      },
    }),
  },
  avatarButtonActive: {
    backgroundColor: C.borderMid,
    borderColor: C.border,
  },
  avatarCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.borderMid,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarCircleActive: {
    backgroundColor: C.accentBg,
  },
  avatarLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.1,
    flex: 1,
  },

  // ── Notification button ───────────────────────────────────────────────────
  notificationButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.bgDeep,
    position: 'relative',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      },
    }),
  },
  notificationButtonHovered: {
    backgroundColor: C.borderMid,
    borderColor: C.borderHover,
  },
  notificationBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.destructive,
    borderWidth: 1.5,
    borderColor: C.bgDeep,
  },

  // ── Dropdown menu ─────────────────────────────────────────────────────────
  dropdownBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'transparent',
  },
  dropdownMenu: {
    position: 'absolute',
    backgroundColor: 'rgba(30, 30, 30, 0.6)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.border,
    padding: 6,
    minWidth: 180,
    zIndex: 9999,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
      },
      android: { elevation: 12 },
      web: {
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
      } as any,
    }),
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 10,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      },
    }),
  },
  dropdownItemText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: C.divider,
    marginVertical: 4,
    marginHorizontal: 8,
  },

  // ── Recent Searches Dropdown ─────────────────────────────────────────────
  recentSearchesDropdown: {
    position: 'absolute',
    top: 56, // height of search island (48) + gap (8)
    left: 0,
    width: Platform.OS === 'web' ? 348 : 308, // Active search width approx
    backgroundColor: C.bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 8,
    zIndex: 150,
    ...ISLAND_SHADOW,
    ...Platform.select({
      web: {
        backgroundColor: C.bgGlass,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      } as any,
    }),
  },
  recentSearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  recentSearchItemHovered: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  recentSearchText: {
    flex: 1,
    color: C.textPrimary,
    fontSize: 13,
  },
  recentSearchDeleteBtn: {
    padding: 4,
    marginLeft: 8,
  },
  recentSearchHeader: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 4,
  },
  recentSearchHeaderText: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Settings modal ────────────────────────────────────────────────────────
  settingsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      } as any,
    }),
  },
  settingsCard: {
    backgroundColor: C.bg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.divider,
    width: '90%',
    maxWidth: 420,
    padding: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
      },
      android: { elevation: 20 },
      web: { boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)' } as any,
    }),
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  settingsTitle: { color: C.textPrimary, fontSize: 18, fontWeight: '700', letterSpacing: 0.2 },
  settingsCloseBtn: { padding: 4 },
  settingsBody: { gap: 18, marginBottom: 24 },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
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
  settingsFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  btnSecondary: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.borderMid,
  },
  btnSecondaryText: { color: C.textMuted, fontSize: 13, fontWeight: '600' },
  btnPrimary: {
    backgroundColor: C.accent,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  btnPrimaryText: { color: C.textPrimary, fontSize: 13, fontWeight: '700' },

  // ── Tooltip ───────────────────────────────────────────────────────────────
  tooltip: {
    position: 'absolute',
    left: 50, // just past the icon button
    top: 6,
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
        WebkitBackdropFilter: 'blur(10px)',
      } as any,
    }),
  },
  tooltipText: {
    color: C.textPrimary,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Vertical sidebar navigation item — icon-only with a hover tooltip */
const SidebarItem = React.memo(function SidebarItem({
  icon,
  label,
  active,
  isMarked,
  onClick,
  onHover,
}: {
  icon: string;
  label?: string;
  active: boolean;
  isMarked?: boolean;
  onClick?: () => void;
  onHover?: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <TouchableOpacity
      onPress={onClick}
      activeOpacity={0.7}
      //@ts-ignore
      onMouseEnter={() => {
        setIsHovered(true);
        onHover?.();
      }}
      onMouseLeave={() => setIsHovered(false)}
      style={[
        styles.sidebarItem,
        styles.sidebarItemIconOnly,
        active && styles.sidebarItemActive,
        isMarked && styles.sidebarItemMarked,
        isHovered &&
          !active &&
          !isMarked && {
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            borderColor: C.border,
          },
        isHovered &&
          isMarked && {
            backgroundColor: C.accentBg,
            borderColor: C.accent,
          },
      ]}
    >
      <MaterialIcons
        name={icon as any}
        size={20}
        color={active || isMarked ? C.accent : C.textInactive}
      />
      {/* Red dot for marked items */}
      {isMarked && <View style={styles.markedDot} />}
      {/* Web-only tooltip */}
      {Platform.OS === 'web' && isHovered && label && (
        <View style={styles.tooltip} pointerEvents="none">
          <Text style={styles.tooltipText}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

/** Dropdown action item (profile menu) */
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
        isHovered && {
          backgroundColor: isDestructive ? C.destructiveBg : 'rgba(255, 255, 255, 0.06)',
        },
      ]}
    >
      <MaterialIcons
        name={icon as any}
        size={18}
        color={isDestructive ? C.destructive : isHovered ? C.accent : C.textMuted}
      />
      <Text
        style={[
          styles.dropdownItemText,
          isDestructive
            ? { color: C.destructive }
            : isHovered
              ? { color: C.textPrimary }
              : { color: '#E5E7EB' },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
});

/** Recent Search Row item */
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

// ─── Tab definitions ─────────────────────────────────────────────────────────
const TABS: { id: TabType; icon: string; label: string }[] = [
  { id: 'map', icon: 'map', label: 'Mapa' },
  { id: 'feed', icon: 'dynamic-feed', label: 'Feed' },
  { id: 'saved', icon: 'collections', label: 'Colección' },
  { id: 'forum', icon: 'forum', label: 'Foro' },
];

// ─── Main export ─────────────────────────────────────────────────────────────
export const TopAppBar: React.FC<
  TopAppBarProps & {
    onHoverIn?: () => void;
    onHoverOut?: () => void;
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
    onTabHover,
    notificationsCount = 0,
    onNotificationClick,
    isModalOpen = false,
    forceSidebarVisible = false,
    onSearchFocus,
    onCollectionsClick,
  } = props;

  const { signOut, isAuthenticated } = useAuth();
  const router = useRouter();
  const { height: windowHeight } = useWindowDimensions();

  // ── Core navigation state ─────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabType>(currentTab);
  const [isSearchActive, setIsSearchActive] = useState(false);

  // ── Profile state ─────────────────────────────────────────────────────────
  const [profile, setProfile] = useState<NormalUserProfile | null>(null);

  // ── Dropdown state ────────────────────────────────────────────────────────
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  // Dropdown opens to the RIGHT of the sidebar
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const avatarRef = useRef<View>(null);

  // ── Settings state ────────────────────────────────────────────────────────
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [soundEffects, setSoundEffects] = useState(true);
  const [language, setLanguage] = useState<'es' | 'en'>('es');
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');

  // ── Hover state (web only) ────────────────────────────────────────────────
  const [isSearchHovered, setIsSearchHovered] = useState(false);
  const [isAvatarHovered, setIsAvatarHovered] = useState(false);
  const [isNotifHovered, setIsNotifHovered] = useState(false);
  const [personalizationCompleted, setPersonalizationCompleted] = useState(true);

  // ── Recent Searches State ──────────────────────────────────────────────────
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);

  // ── Effects ───────────────────────────────────────────────────────────────
  const fetchPersonalizationStatus = useCallback(async () => {
    try {
      const completed = await AsyncStorage.getItem('app-turismo.personalization-completed');
      setPersonalizationCompleted(completed === 'true');
    } catch {
      setPersonalizationCompleted(false);
    }
  }, []);

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
    fetchPersonalizationStatus();
    fetchProfile();
    loadSettings();
  }, [fetchPersonalizationStatus, fetchProfile, loadSettings]);

  const saveSettings = useCallback(async () => {
    try {
      await Promise.all([
        AsyncStorage.setItem('app-turismo.settings.notifications', String(pushNotifications)),
        AsyncStorage.setItem('app-turismo.settings.sound', String(soundEffects)),
        AsyncStorage.setItem('app-turismo.settings.language', language),
        AsyncStorage.setItem('app-turismo.settings.theme', themeMode),
      ]);
      setIsSettingsVisible(false);
    } catch {
      /* ignore */
    }
  }, [pushNotifications, soundEffects, language, themeMode]);

  useEffect(() => {
    fetchProfile();
    loadSettings();
  }, [fetchProfile, loadSettings]);

  useEffect(() => {
    const t = setTimeout(() => setActiveTab(currentTab), 0);
    return () => clearTimeout(t);
  }, [currentTab]);

  // ── Animation for Sidebar when Modals open ────────────────────────────────
  const sidebarAnim = useRef(new Animated.Value(1)).current;
  const isHidden = isModalOpen && !forceSidebarVisible;

  useEffect(() => {
    // Hide sidebar when a modal is open to give it more space
    Animated.timing(sidebarAnim, {
      toValue: isHidden ? 0 : 1,
      duration: 350,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [isHidden, sidebarAnim]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleTabChange = useCallback(
    (tab: TabType) => {
      if (tab === 'saved') {
        onCollectionsClick?.();
        return;
      }
      setActiveTab(tab);
      onTabChange?.(tab);
    },
    [onTabChange, onCollectionsClick],
  );

  const handleToggleSearch = useCallback(
    (active: boolean) => {
      // Elegant expansion animation
      LayoutAnimation.configureNext(
        LayoutAnimation.create(
          300,
          LayoutAnimation.Types.easeInEaseOut,
          LayoutAnimation.Properties.opacity,
        ),
      );
      if (active && isModalOpen) {
        onSearchFocus?.(); // Close modal when interacting with search
      }
      if (active) {
        getRecentSearches().then(setRecentSearches);
      }
      setIsSearchActive(active);
    },
    [isModalOpen, onSearchFocus],
  );

  const handleRecentSearchSelect = useCallback(
    (item: RecentSearch) => {
      onVoiceSearch?.({
        query: item.query,
        category: item.category,
        originalText: item.query,
        isFinal: true,
      });
    },
    [onVoiceSearch],
  );

  const handleDeleteRecentSearch = useCallback(async (id: string) => {
    await removeRecentSearch(id);
    setRecentSearches((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleToggleDropdown = useCallback(() => {
    if (isDropdownOpen) {
      setIsDropdownOpen(false);
      return;
    }
    void fetchProfile();
    if (avatarRef.current) {
      avatarRef.current.measure((x, y, w, h, px, py) => {
        // Place dropdown to the RIGHT of the sidebar button
        const estimatedHeight = 160; // Estimated height for Mi Perfil, Ajustes, Logout
        const topPos = py + estimatedHeight > windowHeight - 20 ? py - estimatedHeight + h : py;

        setDropdownPosition({ top: Math.max(16, topPos), left: px + w + 12 });
        setIsDropdownOpen(true);
      });
    } else {
      setDropdownPosition({ top: 120, left: 76 });
      setIsDropdownOpen(true);
    }
  }, [isDropdownOpen, fetchProfile, windowHeight]);

  const handleSignOut = useCallback(async () => {
    setIsDropdownOpen(false);
    await signOut();
  }, [signOut]);

  // ─── Derived values ───────────────────────────────────────────────────────
  const isAvatarActive = activeTab === 'profile' || isDropdownOpen;
  const firstName = profile?.fullName ? profile.fullName.split(' ')[0] : 'Perfil';

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Animated.View
      style={[
        styles.sidebarWrapper,
        {
          opacity: sidebarAnim,
          transform: [
            {
              translateX: sidebarAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-200, 0], // Smooth slide from left completely off-screen
              }),
            },
          ],
          // Completely ignore interactions if hidden
          pointerEvents: isHidden ? 'none' : 'auto',
        },
      ]}
    >
      {/* ━━━ ISLAND 1: Search Bar ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <View style={{ zIndex: 100 }}>
        <View
          style={[
            styles.searchIsland,
            isSearchActive && styles.searchIslandFocused,
            isSearchHovered && !isSearchActive && styles.searchIslandHovered,
          ]}
          //@ts-ignore
          onMouseEnter={() => setIsSearchHovered(true)}
          onMouseLeave={() => setIsSearchHovered(false)}
        >
          {isSearchActive ? (
            // ── Active: show voice search UI ──────────────────────────────────
            <View style={styles.searchActiveContent}>
              <TouchableOpacity
                onPress={() => handleToggleSearch(false)}
                style={styles.searchBackBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={18} color={C.textPrimary} />
              </TouchableOpacity>
              <SmartVoiceSearch
                isEmbedded={true}
                onPartialResult={(text) => {
                  onVoicePartialSearch?.(text);
                }}
                onSearchComplete={(res) => {
                  // Actualizar recientes si busca una nueva desde el SmartVoiceSearch
                  getRecentSearches().then(setRecentSearches);
                  onVoiceSearch?.(res);
                }}
              />
            </View>
          ) : (
            // ── Inactive: icon-only compact search trigger ────────────────────
            <TouchableOpacity
              onPress={() => handleToggleSearch(true)}
              activeOpacity={0.8}
              style={styles.searchInactiveBtnIconOnly}
            >
              <Ionicons name="search" size={17} color={C.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Recent Searches Dropdown ── */}
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

      {/* ━━━ ISLAND 2: Navigation Sidebar ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <View style={styles.sidebarIsland}>
        {/* ── Top: Nav Tabs ───────────────────────────────────────────────── */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.navSection}
          showsVerticalScrollIndicator={false}
        >
          {TABS.map((tab) => (
            <SidebarItem
              key={tab.id}
              icon={tab.icon}
              label={tab.label}
              active={activeTab === tab.id}
              onClick={() => handleTabChange(tab.id)}
              onHover={onTabHover ? () => onTabHover(tab.id) : undefined}
            />
          ))}

          {!personalizationCompleted && (
            <SidebarItem
              icon="gift"
              label="Personalizar"
              active={false}
              isMarked={true}
              onClick={() => router.push('/onboarding')}
            />
          )}
        </ScrollView>

        <View style={styles.sidebarDivider} />

        {/* ── Bottom: Actions (Avatar + Notifications) ─────────────────────── */}
        <View style={styles.actionsSection}>
          {isAuthenticated ? (
            <>
              {/* Avatar / Profile button */}
              <TouchableOpacity
                ref={avatarRef}
                onPress={handleToggleDropdown}
                activeOpacity={0.7}
                //@ts-ignore
                onMouseEnter={() => setIsAvatarHovered(true)}
                onMouseLeave={() => setIsAvatarHovered(false)}
                style={[
                  styles.avatarButton,
                  styles.sidebarItemIconOnly,
                  isAvatarActive && styles.avatarButtonActive,
                  isAvatarHovered &&
                    !isAvatarActive && {
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      borderColor: C.border,
                    },
                ]}
              >
                <View style={[styles.avatarCircle, isAvatarActive && styles.avatarCircleActive]}>
                  <MaterialIcons
                    name={(profile?.avatarIcon || 'person') as any}
                    size={14}
                    color={isAvatarActive ? C.accent : C.textPrimary}
                  />
                </View>
                {/* Web-only avatar tooltip */}
                {Platform.OS === 'web' && isAvatarHovered && !isDropdownOpen && (
                  <View style={styles.tooltip} pointerEvents="none">
                    <Text style={styles.tooltipText}>{firstName}</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Notifications button */}
              <TouchableOpacity
                onPress={onNotificationClick}
                activeOpacity={0.7}
                //@ts-ignore
                onMouseEnter={() => setIsNotifHovered(true)}
                onMouseLeave={() => setIsNotifHovered(false)}
                style={[
                  styles.notificationButton,
                  isNotifHovered && styles.notificationButtonHovered,
                ]}
              >
                <Ionicons name="notifications-outline" size={18} color={C.textPrimary} />
                {notificationsCount > 0 && <View style={styles.notificationBadge} />}
                {/* Web-only tooltip */}
                {Platform.OS === 'web' && isNotifHovered && (
                  <View style={styles.tooltip} pointerEvents="none">
                    <Text style={styles.tooltipText}>
                      {notificationsCount > 0
                        ? `${notificationsCount} notificaciones`
                        : 'Notificaciones'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <SidebarItem
              icon="login"
              label="Ingresar"
              active={false}
              onClick={() => router.push('/ingresar')}
            />
          )}
        </View>

        <ContextualSurveyWidget isSearchActive={isSearchActive} />
      </View>

      {/* ━━━ DROPDOWN MODAL (opens to the right of the sidebar) ━━━━━━━━━━━━ */}
      <SidebarSubmenu
        visible={isDropdownOpen}
        onClose={() => setIsDropdownOpen(false)}
        position={{ top: dropdownPosition.top, left: dropdownPosition.left }}
        pointerPosition="top-left"
        width={180}
        maxHeight={windowHeight * 0.6}
      >
        {isAuthenticated ? (
          <>
            <DropdownItem
              icon="person"
              label="Mi Perfil"
              onPress={() => {
                setIsDropdownOpen(false);
                handleTabChange('profile');
              }}
            />
            <DropdownItem
              icon="settings"
              label="Ajustes"
              onPress={() => {
                setIsDropdownOpen(false);
                setIsSettingsVisible(true);
              }}
            />
            <View style={styles.dropdownDivider} />
            <DropdownItem
              icon="logout"
              label="Cerrar sesión"
              onPress={handleSignOut}
              isDestructive
            />
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

      {/* ━━━ SETTINGS MODAL ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <Modal
        visible={isSettingsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSettingsVisible(false)}
      >
        <View style={styles.settingsOverlay}>
          <View style={styles.settingsCard}>
            <View style={styles.settingsHeader}>
              <Text style={styles.settingsTitle}>Ajustes de la Aplicación</Text>
              <TouchableOpacity
                onPress={() => setIsSettingsVisible(false)}
                style={styles.settingsCloseBtn}
              >
                <Ionicons name="close" size={20} color={C.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.settingsBody}>
              {/* Notificaciones Push */}
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Notificaciones Push</Text>
                  <Text style={styles.settingDesc}>
                    Recibe alertas de eventos cercanos en tiempo real
                  </Text>
                </View>
                <Switch
                  value={pushNotifications}
                  onValueChange={setPushNotifications}
                  trackColor={{ false: C.borderMid, true: C.accent }}
                  thumbColor={pushNotifications ? C.textPrimary : C.textMuted}
                />
              </View>
              <View style={styles.settingsDivider} />

              {/* Efectos de Sonido */}
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Efectos de Sonido</Text>
                  <Text style={styles.settingDesc}>
                    Reproduce sonidos en interacciones y búsquedas
                  </Text>
                </View>
                <Switch
                  value={soundEffects}
                  onValueChange={setSoundEffects}
                  trackColor={{ false: C.borderMid, true: C.accent }}
                  thumbColor={soundEffects ? C.textPrimary : C.textMuted}
                />
              </View>
              <View style={styles.settingsDivider} />

              {/* Idioma */}
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
                      onPress={() => setLanguage(lang)}
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

              {/* Tema Visual */}
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Tema Visual</Text>
                  <Text style={styles.settingDesc}>Personaliza los colores de la interfaz</Text>
                </View>
                <View style={styles.selectorGroup}>
                  <TouchableOpacity
                    style={[styles.selectorBtn, themeMode === 'dark' && styles.selectorBtnActive]}
                    onPress={() => setThemeMode('dark')}
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
                    onPress={() => setThemeMode('light')}
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
            </ScrollView>

            <View style={styles.settingsFooter}>
              <TouchableOpacity
                style={styles.btnSecondary}
                onPress={() => setIsSettingsVisible(false)}
              >
                <Text style={styles.btnSecondaryText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={saveSettings}>
                <Text style={styles.btnPrimaryText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
};
