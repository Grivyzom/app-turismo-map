import React, {
  useRef,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Pressable,
  TextInput,
  Dimensions,
  StyleSheet,
  Platform,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
  withDelay,
  cancelAnimation,
  Easing,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { CATEGORY_ICONS, CategoryFilter } from '../../data/mockEvents';
import {
  addVisitedPlace,
  getVisitedPlaces,
  clearVisitedPlaces,
} from '../../utils/visitedPlacesStorage';
import { loadCollections } from '../../utils/collectionsStorage';

// ─── Layout ──────────────────────────────────────────────────────────────────

const { width: SW } = Dimensions.get('window');
const IS_DESKTOP = SW >= 768;

const CARD_W      = IS_DESKTOP ? 224 : 200;
const SPACING     = 14;
const CARD_H      = 288;
const CARD_STRIDE = CARD_W + SPACING;
const REMOVE_CLIPPED = Platform.OS !== 'web';

const H_HEADER = 48;
const H_TABS   = 62;
const H_CHIPS  = 40;
const H_SEARCH = 46;
const H_CARDS  = CARD_H + 24;

const SPRING_CFG    = { damping: 22, stiffness: 220, mass: 0.8, overshootClamping: false } as const;
const SPRING_BOUNCE = { damping: 10, stiffness: 400 } as const;

// ─── Paleta ──────────────────────────────────────────────────────────────────
const ACCENT      = '#34D399';   // solo CTA primarios y tab activo
const MUTED       = '#64748B';
const MUTED_DARK  = '#334155';
const ON_LIGHT    = '#0F172A';
const STAR_COLOR  = '#FBBF24';
// Fondo elevado de cards — ligeramente más claro que el panel
const CARD_BG     = '#131D2E';
const CARD_BORDER = 'rgba(255,255,255,0.07)';

type Tab = 'nearby' | 'top' | 'category' | 'favorites' | 'history';

const PANEL_H: Record<Tab, number> = {
  nearby:    H_HEADER + H_TABS + H_CARDS,
  top:       H_HEADER + H_TABS + H_CARDS,
  category:  H_HEADER + H_TABS + H_CHIPS + H_CARDS,
  favorites: H_HEADER + H_TABS + H_CARDS,
  history:   H_HEADER + H_TABS + H_CARDS,
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlaceItem {
  id: string | number;
  name: string;
  category: string;
  imageUrl?: string;
  rating?: number;
  reviews?: number;
  distance?: string;
  address?: string;
  time?: string;
  description?: string;
  spotsCount?: number;
  openingHours?: string;
}

// ─── Utils ───────────────────────────────────────────────────────────────────

function parseDist(d?: string) {
  if (!d) return Infinity;
  return parseFloat(d.replace(/[^0-9.]/g, '')) || Infinity;
}

// Color de categoría — solo para texto del badge y estado activo de iconos
const CAT_COLOR: Record<string, string> = {
  cultura:     '#F59E0B',
  museo:       '#A78BFA',
  teatro:      '#F472B6',
  naturaleza:  '#34D399',
  parque:      '#6EE7B7',
  bosque:      '#4ADE80',
  gastronomia: '#FB923C',
  monumento:   '#94A3B8',
  escultura:   '#CBD5E1',
  torreon:     '#94A3B8',
  estatua:     '#BAC8D3',
  tienda:      '#60A5FA',
};
const IMG_H = 132; // altura fija — todos los cards idénticos en proporción

// ─── MarqueeText ─────────────────────────────────────────────────────────────

function MarqueeText({
  text,
  textStyle,
  active,
  maxLines = 1,
}: {
  text: string;
  textStyle?: any;
  active: boolean;
  maxLines?: number;
}) {
  const [containerW, setContainerW] = useState(0);
  const [fullTextW,  setFullTextW]  = useState(0);
  const translateX = useSharedValue(0);

  const overflow = Math.max(0, fullTextW - containerW + 4);
  const needsScroll = overflow > 8;

  useEffect(() => {
    if (active && needsScroll) {
      translateX.value = withDelay(
        280,
        withRepeat(
          withSequence(
            withTiming(-overflow, {
              duration: Math.max(overflow * 22, 1400),
              easing: Easing.inOut(Easing.quad),
            }),
            withTiming(0, { duration: 500, easing: Easing.out(Easing.quad) }),
          ),
          -1,
          false,
        ),
      );
    } else {
      cancelAnimation(translateX);
      translateX.value = withTiming(0, { duration: 180 });
    }
  }, [active, needsScroll, overflow]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View
      style={styles.marqueeContainer}
      onLayout={(e) => setContainerW(e.nativeEvent.layout.width)}
    >
      {/* Nodo oculto para medir ancho real del texto sin truncar */}
      <Text
        style={[textStyle, styles.marqueeHidden]}
        numberOfLines={1}
        onLayout={(e) => setFullTextW(e.nativeEvent.layout.width)}
        aria-hidden
      >
        {text}
      </Text>
      <Animated.Text
        style={[
          textStyle,
          animStyle,
          Platform.OS === 'web' ? ({ whiteSpace: 'nowrap' } as any) : undefined,
        ]}
        numberOfLines={needsScroll && active ? 1 : maxLines}
      >
        {text}
      </Animated.Text>
    </View>
  );
}

// ─── PlaceCard ────────────────────────────────────────────────────────────────

interface PlaceCardProps {
  item: PlaceItem;
  index: number;
  onPress: () => void;
  onViewMore: () => void;
  onSaveToggle: (saved: boolean) => void;
}

function PlaceCard({ item, index, onPress, onViewMore, onSaveToggle }: PlaceCardProps) {
  const [userRating, setUserRating] = useState(0);
  const [liked,      setLiked]      = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [focused,    setFocused]    = useState(false);
  const [hintStar,   setHintStar]   = useState(0);
  const hintTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const cardScale = useSharedValue(1);
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: cardScale.value }] }));

  const catColor = CAT_COLOR[item.category] ?? ACCENT;
  const iconData = CATEGORY_ICONS[item.category as CategoryFilter];
  const CatIcon  = iconData
    ? (iconData.family === 'Ionicons' ? Ionicons : MaterialIcons)
    : null;

  const clearHint = () => { hintTimers.current.forEach(clearTimeout); hintTimers.current = []; };

  const runHint = () => {
    if (userRating > 0) return;
    clearHint();
    setHintStar(0);
    [1, 2, 3, 4, 5].forEach((star, i) => {
      const t = setTimeout(() => setHintStar(star), 60 + i * 100);
      hintTimers.current.push(t);
    });
    hintTimers.current.push(setTimeout(() => setHintStar(0), 60 + 5 * 100 + 350));
  };

  useEffect(() => () => clearHint(), []);

  // Hover web — solo marquee, sin escala
  const hoverIn  = () => setFocused(true);
  const hoverOut = () => { setFocused(false); cardScale.value = withSpring(1, SPRING_CFG); };
  // Press — escala + marquee + hint
  const pressIn  = () => { setFocused(true); cardScale.value = withSpring(0.97, SPRING_BOUNCE); runHint(); };
  const pressOut = () => { cardScale.value = withSpring(1, SPRING_CFG); };

  const handleRate = (star: number) => {
    setUserRating(star === userRating ? 0 : star);
    clearHint();
    setHintStar(0);
  };

  const getStarName = (i: number): 'star' | 'star-half' | 'star-border' => {
    if (userRating > 0) return i <= userRating ? 'star' : 'star-border';
    if (hintStar > 0)   return i <= hintStar   ? 'star' : 'star-border';
    if (item.rating != null) {
      const full = Math.floor(item.rating);
      const half = item.rating - full >= 0.5;
      if (i <= full) return 'star';
      if (i === full + 1 && half) return 'star-half';
    }
    return 'star-border';
  };

  const getStarColor = (i: number): string => {
    if (userRating > 0) return i <= userRating ? STAR_COLOR : MUTED_DARK;
    if (hintStar > 0)   return i <= hintStar   ? STAR_COLOR : MUTED_DARK;
    if (item.rating != null) {
      const full = Math.floor(item.rating);
      const half = item.rating - full >= 0.5;
      return (i <= full || (i === full + 1 && half)) ? STAR_COLOR : MUTED_DARK;
    }
    return MUTED_DARK;
  };

  const displayRatingText = userRating > 0
    ? `${userRating}.0`
    : item.rating != null ? item.rating.toFixed(1) : null;

  const webHoverProps = Platform.OS === 'web'
    ? { onMouseEnter: hoverIn, onMouseLeave: hoverOut } as any
    : {};

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 55).springify().damping(18)}
      style={[styles.cardWrapper, cardStyle]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={styles.card}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${item.category}`}
        {...webHoverProps}
      >
        {/* ── Imagen fija ───────────────────────────────── */}
        <View style={styles.thumb}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.thumbImg} resizeMode="cover" />
          ) : (
            // Placeholder limpio: fondo sólido + icono atenuado
            <View style={styles.thumbPlaceholder}>
              {CatIcon ? (
                <CatIcon name={iconData!.name as any} size={36} color={catColor} style={{ opacity: 0.35 }} />
              ) : (
                <MaterialIcons name="place" size={36} color="#64748B" style={{ opacity: 0.35 }} />
              )}
            </View>
          )}

          {/* Gradiente imagen → fondo, sin horizontes duros */}
          <LinearGradient
            colors={['transparent', 'transparent', CARD_BG]}
            locations={[0, 0.55, 1]}
            style={styles.imgGradient}
            pointerEvents="none"
          />

          {/* Badge categoría — sin borde */}
          <View style={styles.catBadgeImg}>
            {CatIcon && <CatIcon name={iconData!.name as any} size={9} color={catColor} />}
            <Text style={[styles.catTextImg, { color: catColor }]}>{item.category.toUpperCase()}</Text>
          </View>

          {/* Distancia + spots — esquina inf-der, sin borde */}
          <View style={styles.imgBadgesRight}>
            {item.distance != null && (
              <View style={styles.distPill}>
                <MaterialIcons name="near-me" size={8} color="#94A3B8" />
                <Text style={styles.distPillText}>{item.distance}</Text>
              </View>
            )}
            {(item.spotsCount ?? 0) > 0 && (
              <View style={styles.spotsPill}>
                <MaterialIcons name="place" size={8} color="#94A3B8" />
                <Text style={styles.spotsPillText}>{item.spotsCount} spots</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Info con flexbox para alinear footer ─────── */}
        <View style={styles.cardInfo}>
          {/* Título — ocupa espacio disponible y empuja rating hacia abajo */}
          <View style={styles.cardNameWrap}>
            <MarqueeText text={item.name} textStyle={styles.cardName} active={focused} maxLines={2} />
          </View>

          {/* Rating — siempre anclado sobre el footer */}
          <View style={styles.ratingRow}>
            <View style={styles.starGroup}>
              {[1, 2, 3, 4, 5].map((i) => (
                <TouchableOpacity key={i} onPress={() => handleRate(i)} hitSlop={6} activeOpacity={0.75}>
                  <MaterialIcons name={getStarName(i)} size={15} color={getStarColor(i)} />
                </TouchableOpacity>
              ))}
            </View>
            {displayRatingText != null && (
              <Text style={styles.ratingValue}>{displayRatingText}</Text>
            )}
            {userRating === 0 && item.reviews != null && (
              <Text style={styles.reviewsText}>({item.reviews})</Text>
            )}
            {userRating > 0 && (
              <Text style={{ fontSize: 9, fontWeight: '700', color: ACCENT, opacity: 0.85 }}>tu nota</Text>
            )}
          </View>

          {/* Horario o dirección — solo si disponible */}
          {(item.openingHours || item.address) && (
            <View style={styles.infoRow}>
              {item.openingHours ? (
                <View style={styles.infoPill}>
                  <MaterialIcons name="access-time" size={9} color={MUTED} />
                  <Text style={styles.infoPillText} numberOfLines={1}>{item.openingHours}</Text>
                </View>
              ) : (
                <View style={styles.infoPill}>
                  <MaterialIcons name="location-on" size={9} color={MUTED} />
                  <Text style={styles.infoPillText} numberOfLines={1}>{item.address}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* ── Footer: ghost icons + CTA ─────────────────── */}
        <View style={styles.cardFooter}>
          {/* Ghost: Like */}
          <Pressable
            onPress={() => setLiked(p => !p)}
            style={styles.ghostBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={liked ? 'Quitar like' : 'Dar like'}
          >
            <MaterialIcons
              name={liked ? 'thumb-up' : 'thumb-up-off-alt'}
              size={16}
              color={liked ? ACCENT : MUTED}
            />
          </Pressable>

          {/* Ghost: Guardar */}
          <Pressable
            onPress={() => { setBookmarked(p => !p); onSaveToggle(!bookmarked); }}
            style={styles.ghostBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={bookmarked ? 'Quitar guardado' : 'Guardar lugar'}
          >
            <MaterialIcons
              name={bookmarked ? 'bookmark' : 'bookmark-border'}
              size={16}
              color={bookmarked ? ACCENT : MUTED}
            />
          </Pressable>

          {/* CTA: Ver más — único elemento estilizado */}
          <TouchableOpacity
            onPress={onViewMore}
            style={styles.viewMoreBtn}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Ver más sobre ${item.name}`}
          >
            <Text style={styles.viewMoreText}>Ver más</Text>
            <MaterialIcons name="arrow-forward" size={12} color={ACCENT} />
          </TouchableOpacity>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── PlacesShelfTrigger ───────────────────────────────────────────────────────

interface TriggerProps {
  isOpen: boolean;
  onPress: () => void;
  count: number;
  isDesktop?: boolean;
}

export function PlacesShelfTrigger({ isOpen, onPress, count, isDesktop = false }: TriggerProps) {
  const btnSize  = isDesktop ? 36 : 44;
  const iconSize = isDesktop ? 18 : 22;
  const label    = count > 99 ? '99+' : String(count);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel="Lugares recomendados"
      style={[styles.trigger, { width: btnSize, height: btnSize }, isOpen && styles.triggerActive]}
    >
      <MaterialIcons name="auto-awesome" size={iconSize} color={isOpen ? ACCENT : '#9CA3AF'} />
      {!isOpen && count > 0 && (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={styles.triggerBadge}>
          <Text style={styles.triggerBadgeText}>{label}</Text>
        </Animated.View>
      )}
    </TouchableOpacity>
  );
}

// ─── PlacesShelfPanel ─────────────────────────────────────────────────────────

interface PanelProps {
  data: PlaceItem[];
  visible: boolean;
  isOpen: boolean;
  onClose: () => void;
  onPlacePress?: (place: PlaceItem) => void;
  bottomOffset?: number;
}

const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'nearby',    icon: 'near-me',      label: 'Cercanos' },
  { key: 'top',       icon: 'star',         label: 'Valorado' },
  { key: 'category',  icon: 'category',     label: 'Categorías' },
  { key: 'favorites', icon: 'favorite',     label: 'Favoritos' },
  { key: 'history',   icon: 'history',      label: 'Historial' },
];

export function PlacesShelfPanel({
  data,
  visible,
  isOpen,
  onClose,
  onPlacePress,
  bottomOffset = 20,
}: PanelProps) {
  const flatListRef    = useRef<FlatList>(null);
  const searchInputRef = useRef<TextInput>(null);
  const mountedRef     = useRef(true);
  const scrollOffset   = useRef(0);

  const [activeTab,          setActiveTab]          = useState<Tab>('nearby');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showSearch,         setShowSearch]         = useState(false);
  const [showFilter,         setShowFilter]         = useState(false);
  const [searchQuery,        setSearchQuery]        = useState('');
  const [visitedData,        setVisitedData]        = useState<PlaceItem[]>([]);
  const [favoritesData,      setFavoritesData]      = useState<PlaceItem[]>([]);
  const [canScrollLeft,      setCanScrollLeft]      = useState(false);
  const [canScrollRight,     setCanScrollRight]     = useState(true);

  const panelH       = useSharedValue(0);
  const openProgress = useSharedValue(0);

  const handleScroll = useCallback((event: any) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    scrollOffset.current = contentOffset.x;
    setCanScrollLeft(contentOffset.x > 4);
    setCanScrollRight(contentOffset.x + layoutMeasurement.width < contentSize.width - 4);
  }, []);

  const scrollLeft = useCallback(() => {
    const newPos = Math.max(scrollOffset.current - CARD_STRIDE * 2, 0);
    flatListRef.current?.scrollToOffset({ offset: newPos, animated: true });
  }, []);

  const scrollRight = useCallback(() => {
    const newPos = scrollOffset.current + CARD_STRIDE * 2;
    flatListRef.current?.scrollToOffset({ offset: newPos, animated: true });
  }, []);

  const loadFavorites = useCallback(async () => {
    const collections = await loadCollections();
    const all = collections.find((c) => c.id === 'all');
    const items: PlaceItem[] = (all?.items ?? []).map((it) => ({
      id: it.id,
      name: it.title,
      category: it.category ?? 'lugar',
      imageUrl: it.imageUrl,
      description: it.description,
    }));
    if (mountedRef.current) setFavoritesData(items);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    getVisitedPlaces().then((items) => { if (mountedRef.current) setVisitedData(items); });
    loadFavorites();
    return () => { mountedRef.current = false; };
  }, [loadFavorites]);

  useEffect(() => {
    if (data.length > 0) {
      setActiveTab('nearby');
      setSelectedCategories([]);
    }
  }, [data.length]);

  useEffect(() => {
    if (activeTab === 'favorites') loadFavorites();
  }, [activeTab, loadFavorites]);

  const filterRowVisible = showFilter && activeTab !== 'category';

  const targetH =
    PANEL_H[activeTab] +
    (showSearch ? H_SEARCH : 0) +
    (filterRowVisible ? H_CHIPS : 0);

  useEffect(() => {
    openProgress.value = isOpen
      ? withSpring(1, SPRING_CFG)
      : withTiming(0, { duration: 220 });
    panelH.value = isOpen
      ? withSpring(targetH, SPRING_CFG)
      : withTiming(0, { duration: 220 });
  }, [isOpen, activeTab, targetH]);

  useEffect(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    setCanScrollLeft(false);
    setCanScrollRight(true);
  }, [activeTab, selectedCategories, searchQuery]);

  const availableCategories = useMemo(
    () => [...new Set(data.map((d) => d.category))],
    [data],
  );

  const displayData = useMemo(() => {
    let items: PlaceItem[];
    if (activeTab === 'history') {
      items = [...visitedData];
    } else if (activeTab === 'favorites') {
      items = [...favoritesData];
    } else {
      items = [...data];
      if (activeTab === 'nearby') {
        items.sort((a, b) => parseDist(a.distance) - parseDist(b.distance));
      } else if (activeTab === 'top') {
        items.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      }
    }

    if (selectedCategories.length > 0) {
      items = items.filter((d) => selectedCategories.includes(d.category));
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      items = items.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.category.toLowerCase().includes(q),
      );
    }
    return items;
  }, [activeTab, data, selectedCategories, searchQuery, visitedData, favoritesData]);

  const animatedPanel = useAnimatedStyle(() => ({
    height:  panelH.value,
    opacity: interpolate(panelH.value, [0, 40], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(openProgress.value, [0, 1], [20, 0], Extrapolation.CLAMP) },
    ],
  }));

  const toggleSearch = useCallback(() => {
    setShowSearch((prev) => {
      const next = !prev;
      if (next) setTimeout(() => searchInputRef.current?.focus(), 280);
      else setSearchQuery('');
      return next;
    });
  }, []);

  const toggleFilter = useCallback(() => {
    setShowFilter((prev) => {
      if (prev) setSelectedCategories([]);
      return !prev;
    });
  }, []);

  const handlePlacePress = useCallback(async (place: PlaceItem) => {
    await addVisitedPlace(place);
    if (!mountedRef.current) return;
    setVisitedData((prev) => [place, ...prev.filter((p) => String(p.id) !== String(place.id))]);
    onPlacePress?.(place);
  }, [onPlacePress]);

  const handleClearHistory = useCallback(async () => {
    await clearVisitedPlaces();
    if (!mountedRef.current) return;
    setVisitedData([]);
  }, []);

  const getItemLayout = useCallback((_: any, i: number) => ({
    length: CARD_STRIDE,
    offset: CARD_STRIDE * i,
    index:  i,
  }), []);

  const renderItem = useCallback(({ item, index }: { item: PlaceItem; index: number }) => (
    <PlaceCard
      item={item}
      index={index}
      onPress={() => handlePlacePress(item)}
      onViewMore={() => handlePlacePress(item)}
      onSaveToggle={(_saved) => {}}
    />
  ), [handlePlacePress]);

  const renderCategoryChips = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.filterScroll}
      contentContainerStyle={styles.filterScrollContent}
    >
      {availableCategories.map((cat) => {
        const active = selectedCategories.includes(cat);
        return (
          <TouchableOpacity
            key={cat}
            onPress={() =>
              setSelectedCategories((p) =>
                p.includes(cat) ? p.filter((c) => c !== cat) : [...p, cat],
              )
            }
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Categoría ${cat}`}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  if (!visible || data.length === 0) return null;

  const emptyFavorites = activeTab === 'favorites' && displayData.length === 0;
  const emptyHistory   = activeTab === 'history'   && displayData.length === 0;

  return (
    <Animated.View
      style={[
        styles.panelRoot,
        { bottom: bottomOffset },
        { left: IS_DESKTOP ? 24 : 12, right: IS_DESKTOP ? 24 : 12 },
        animatedPanel,
      ]}
    >
      <View style={styles.panelInner}>

        {/* Header */}
        <View style={styles.panelHeader}>
          <View style={styles.headerBadge}>
            <MaterialIcons name="auto-awesome" size={14} color={ACCENT} />
          </View>
          <Text style={styles.panelTitle}>Recomendados</Text>

          <TouchableOpacity
            onPress={toggleFilter}
            style={[styles.headerAction, showFilter && styles.headerActionActive]}
            activeOpacity={0.75}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityState={{ expanded: showFilter }}
            accessibilityLabel="Filtrar por categoría"
          >
            <MaterialIcons name="tune" size={15} color={showFilter ? ACCENT : '#CBD5E1'} />
            <Text style={[styles.headerActionText, showFilter && styles.headerActionTextActive]}>Filtrar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={toggleSearch}
            style={[styles.headerAction, showSearch && styles.headerActionActive]}
            activeOpacity={0.75}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityState={{ expanded: showSearch }}
            accessibilityLabel="Buscar lugar"
          >
            <MaterialIcons name="search" size={15} color={showSearch ? ACCENT : '#CBD5E1'} />
            <Text style={[styles.headerActionText, showSearch && styles.headerActionTextActive]}>Buscar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            activeOpacity={0.75}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Cerrar panel"
          >
            <MaterialIcons name="close" size={18} color="#E2E8F0" />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabBar}>
          {TABS.map(({ key, icon, label }) => {
            const active = activeTab === key;
            return (
              <TouchableOpacity
                key={key}
                style={styles.tabBtn}
                onPress={() => setActiveTab(key)}
                activeOpacity={0.75}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={label}
              >
                <View style={[styles.tabIconWrap, active && styles.tabIconWrapActive]}>
                  <MaterialIcons name={icon as any} size={20} color={active ? ACCENT : MUTED} />
                </View>
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]} numberOfLines={1}>
                  {label}
                </Text>
                {active && <View style={styles.activeBar} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Search row */}
        {showSearch && (
          <View style={styles.searchRow}>
            <MaterialIcons name="search" size={16} color={MUTED} />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Buscar lugar o categoría..."
              placeholderTextColor={MUTED_DARK}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                activeOpacity={0.75}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Borrar búsqueda"
              >
                <MaterialIcons name="close" size={15} color={MUTED} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Category chips */}
        {(filterRowVisible || activeTab === 'category') && renderCategoryChips()}

        {/* Cards */}
        {displayData.length > 0 ? (
          <View style={styles.carouselContainer}>
            {canScrollLeft && (
              <TouchableOpacity
                style={[styles.scrollBtn, styles.scrollBtnLeft]}
                onPress={scrollLeft}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Anterior"
              >
                <MaterialIcons name="chevron-left" size={26} color={ON_LIGHT} />
              </TouchableOpacity>
            )}
            <FlatList
              ref={flatListRef}
              data={displayData}
              keyExtractor={(item) => String(item.id)}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_STRIDE}
              decelerationRate="fast"
              contentContainerStyle={styles.flatListContent}
              getItemLayout={getItemLayout}
              renderItem={renderItem}
              windowSize={3}
              initialNumToRender={4}
              maxToRenderPerBatch={4}
              removeClippedSubviews={REMOVE_CLIPPED}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            />
            {canScrollRight && (
              <TouchableOpacity
                style={[styles.scrollBtn, styles.scrollBtnRight]}
                onPress={scrollRight}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Siguiente"
              >
                <MaterialIcons name="chevron-right" size={26} color={ON_LIGHT} />
              </TouchableOpacity>
            )}
            {activeTab === 'history' && (
              <TouchableOpacity onPress={handleClearHistory} activeOpacity={0.75} style={styles.clearBtn}>
                <MaterialIcons name="delete-outline" size={13} color="#EF4444" />
                <Text style={styles.clearBtnText}>Limpiar</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <MaterialIcons
              name={emptyFavorites ? 'favorite-border' : emptyHistory ? 'history' : 'search-off'}
              size={26}
              color="#334155"
            />
            <Text style={styles.emptyText}>
              {emptyFavorites
                ? 'Aún no tienes favoritos'
                : emptyHistory
                ? 'Aún no visitaste lugares'
                : 'Sin resultados'}
            </Text>
          </View>
        )}

      </View>
    </Animated.View>
  );
}

// ─── Legacy export ────────────────────────────────────────────────────────────
export { PlacesShelfPanel as BottomPlaceCarousel };

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  // ── Trigger ──
  trigger: {
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
  },
  triggerActive: { backgroundColor: 'rgba(52, 211, 153, 0.12)' },
  triggerBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: 'rgba(10, 17, 32, 0.9)',
  },
  triggerBadgeText: { color: '#fff', fontSize: 8, fontWeight: '800', lineHeight: 11 },

  // ── Panel ──
  panelRoot: {
    position: 'absolute',
    zIndex: 4999,
    borderRadius: 26,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
      web: { boxShadow: '0px 12px 40px rgba(0, 0, 0, 0.35)' },
    }),
  },
  panelInner: {
    flex: 1,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: 'rgba(10, 17, 32, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      } as any,
    }),
  },

  // ── Header ──
  panelHeader: {
    height: H_HEADER,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerBadge: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(52,211,153,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.28)',
  },
  panelTitle: {
    flex: 1,
    color: '#F1F5F9',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  headerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  headerActionActive: {
    backgroundColor: 'rgba(52,211,153,0.14)',
    borderColor: 'rgba(52,211,153,0.32)',
  },
  headerActionText:       { color: '#CBD5E1', fontSize: 11, fontWeight: '600' },
  headerActionTextActive: { color: ACCENT, fontWeight: '700' },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  searchRow: {
    height: H_SEARCH,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 9,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  searchInput: {
    flex: 1,
    color: '#F1F5F9',
    fontSize: 13,
    paddingVertical: 0,
    ...Platform.select({ web: { outlineStyle: 'none' } as any }),
  },

  // ── Tabs ──
  tabBar: {
    height: H_TABS,
    flexDirection: 'row',
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    position: 'relative',
    paddingHorizontal: 2,
  },
  tabIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  tabIconWrapActive: {
    backgroundColor: 'rgba(52,211,153,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.3)',
  },
  tabLabel:       { color: '#94A3B8', fontSize: 10, fontWeight: '600', letterSpacing: 0.2 },
  tabLabelActive: { color: ACCENT, fontWeight: '700' },
  activeBar: {
    position: 'absolute',
    bottom: 0,
    width: 22,
    height: 3,
    borderRadius: 2,
    backgroundColor: ACCENT,
  },

  // ── Category chips ──
  filterScroll: { height: H_CHIPS, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  filterScrollContent: { paddingHorizontal: 12, gap: 8, alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  chipActive:     { borderColor: 'rgba(52,211,153,0.4)', backgroundColor: 'rgba(52,211,153,0.12)' },
  chipText:       { color: '#94A3B8', fontSize: 11, fontWeight: '600' },
  chipTextActive: { color: ACCENT },

  // ── Carousel ──
  carouselContainer: { position: 'relative', flex: 1, justifyContent: 'center' },
  flatListContent: { paddingHorizontal: SPACING, alignItems: 'center' },
  scrollBtn: {
    position: 'absolute',
    top: '50%',
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
      },
      android: { elevation: 6 },
      web: { boxShadow: '0px 4px 14px rgba(0,0,0,0.4)' } as any,
    }),
  },
  scrollBtnLeft:  { left: 6 },
  scrollBtnRight: { right: 6 },
  clearBtn: {
    position: 'absolute',
    top: 8,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    backgroundColor: 'rgba(239,68,68,0.12)',
    zIndex: 11,
  },
  clearBtnText: { color: '#EF4444', fontSize: 10, fontWeight: '700' },

  // ── Card ──
  cardWrapper: {
    marginRight: SPACING,
  },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    flexDirection: 'column',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
      },
      android: { elevation: 10 },
      web: { boxShadow: '0px 6px 24px rgba(0,0,0,0.5)' } as any,
    }),
  },

  // ── Card image ──
  thumb: {
    width: '100%',
    height: IMG_H,
    position: 'relative',
  },
  thumbImg: { width: '100%', height: '100%' },
  thumbPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D1626',
  },
  imgGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 56,
  },

  // Badge categoría (sup-izq)
  catBadgeImg: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  catTextImg: { fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },

  // Badges inf-der agrupados
  imgBadgesRight: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
  },
  distPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  distPillText: { color: '#94A3B8', fontSize: 8, fontWeight: '600' },
  spotsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  spotsPillText: { color: '#94A3B8', fontSize: 8, fontWeight: '600' },

  // ── Card info ──
  cardInfo: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
    flexDirection: 'column',
  },
  cardNameWrap: { flex: 1 },
  cardName: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },

  // Rating row (unificada comunidad + usuario)
  ratingRow:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  starGroup:   { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingValue: { color: STAR_COLOR, fontSize: 11, fontWeight: '700' },
  reviewsText: { color: '#64748B', fontSize: 10, fontWeight: '500' },

  // Fila de info extra
  infoRow: { marginTop: 5 },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  infoPillText: { color: '#475569', fontSize: 9, fontWeight: '500', flex: 1 },

  // ── Marquee ──
  marqueeContainer: { overflow: 'hidden' },
  marqueeHidden: { position: 'absolute', opacity: 0, width: 9999 },

  // ── Card footer ──
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  ghostBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewMoreBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(52,211,153,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.25)',
  },
  viewMoreText: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: '700',
  },

  // ── Empty ──
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText:  { color: '#475569', fontSize: 13, fontWeight: '600' },
});
