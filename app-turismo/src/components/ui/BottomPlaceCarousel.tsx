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
  TextInput,
  Dimensions,
  StyleSheet,
  Platform,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { CATEGORY_ICONS, CategoryFilter } from '../../data/mockEvents';
import {
  addVisitedPlace,
  getVisitedPlaces,
  clearVisitedPlaces,
} from '../../utils/visitedPlacesStorage';

// ─── Layout ──────────────────────────────────────────────────────────────────

const { width: SW } = Dimensions.get('window');
const IS_DESKTOP = SW >= 768;

const PANEL_R        = 72;
const CARD_W         = (IS_DESKTOP ? 380 : Math.min(SW - 72 - 12, 320)) - 16;
const SPACING        = 8;
const THUMB_SZ       = 46;
const REMOVE_CLIPPED = Platform.OS !== 'web';
const CARD_STRIDE    = CARD_W + SPACING; // para getItemLayout

const H_HEADER  = 42;
const H_TOOLBAR = 40;
const H_INNER   = 34;
const H_SEARCH  = 44;
const H_CHIPS   = 46;
const H_CARDS   = 78;

const SPRING_CFG = { damping: 22, stiffness: 220, mass: 0.8, overshootClamping: false } as const;

type Section  = 'recommend' | 'search' | 'filter' | 'history';
type SortMode = 'none' | 'distance' | 'rating';

const PANEL_H: Record<Section, number> = {
  recommend: H_HEADER + H_TOOLBAR + H_INNER  + H_CARDS,
  search:    H_HEADER + H_TOOLBAR + H_SEARCH + H_CARDS,
  filter:    H_HEADER + H_TOOLBAR + H_CHIPS  + H_CARDS,
  history:   H_HEADER + H_TOOLBAR + H_INNER  + H_CARDS,
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
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function parseDist(d?: string) {
  if (!d) return Infinity;
  return parseFloat(d.replace(/[^0-9.]/g, '')) || Infinity;
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
      <MaterialIcons name="auto-awesome" size={iconSize} color={isOpen ? '#34D399' : '#9CA3AF'} />
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

  const [activeSection,      setActiveSection]      = useState<Section>('recommend');
  const [searchQuery,        setSearchQuery]        = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sortMode,           setSortMode]           = useState<SortMode>('none');
  const [visitedData,        setVisitedData]        = useState<PlaceItem[]>([]);
  const [canScrollLeft,      setCanScrollLeft]      = useState(false);
  const [canScrollRight,     setCanScrollRight]     = useState(true);

  const handleScroll = useCallback((event: any) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    scrollOffset.current = contentOffset.x;
    setCanScrollLeft(contentOffset.x > 0);
    setCanScrollRight(contentOffset.x + layoutMeasurement.width < contentSize.width - 1);
  }, []);

  const scrollLeft = useCallback(() => {
    const newPos = Math.max(scrollOffset.current - CARD_STRIDE * 2, 0);
    flatListRef.current?.scrollToOffset({ offset: newPos, animated: true });
  }, []);

  const scrollRight = useCallback(() => {
    const newPos = scrollOffset.current + CARD_STRIDE * 2;
    flatListRef.current?.scrollToOffset({ offset: newPos, animated: true });
  }, []);

  const panelH = useSharedValue(0);
  const openProgress = useSharedValue(0);

  useEffect(() => {
    mountedRef.current = true;
    getVisitedPlaces().then((items) => { if (mountedRef.current) setVisitedData(items); });
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (data.length > 0) {
      setActiveSection('recommend');
      setSortMode('none');
      setSearchQuery('');
      setSelectedCategories([]);
    }
  }, [data.length]);

  useEffect(() => {
    openProgress.value = isOpen
      ? withSpring(1, SPRING_CFG)
      : withTiming(0, { duration: 220 });
    panelH.value = isOpen
      ? withSpring(PANEL_H[activeSection], SPRING_CFG)
      : withTiming(0, { duration: 220 });
  }, [isOpen, activeSection]);

  useEffect(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    setCanScrollLeft(false);
    setCanScrollRight(true);
  }, [activeSection, sortMode, searchQuery, selectedCategories]);

  const availableCategories = useMemo(
    () => [...new Set(data.map((d) => d.category))],
    [data],
  );

  const displayData = useMemo(() => {
    if (activeSection === 'history') return visitedData;
    let items = [...data];
    if (activeSection === 'search' && searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter((d) =>
        d.name.toLowerCase().includes(q) || d.category.toLowerCase().includes(q),
      );
    }
    if (activeSection === 'filter' && selectedCategories.length > 0) {
      items = items.filter((d) => selectedCategories.includes(d.category));
    }
    if (activeSection === 'recommend') {
      if (sortMode === 'distance')
        items = [...items].sort((a, b) => parseDist(a.distance) - parseDist(b.distance));
      else if (sortMode === 'rating')
        items = [...items].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    }
    return items;
  }, [activeSection, data, searchQuery, selectedCategories, sortMode, visitedData]);

  const tabsMeta = useMemo(() => {
    const filteredCount = selectedCategories.length > 0
      ? data.filter((d) => selectedCategories.includes(d.category)).length
      : null;
    const historyCount = visitedData.length > 0 ? visitedData.length : null;
    return [
      { key: 'recommend' as Section, icon: 'auto-awesome', label: 'Para vos', count: null },
      { key: 'search'    as Section, icon: 'search',       label: 'Buscar',   count: null },
      { key: 'filter'    as Section, icon: 'tune',         label: 'Filtrar',  count: filteredCount },
      { key: 'history'   as Section, icon: 'history',      label: 'Historial',count: historyCount },
    ] as const;
  }, [selectedCategories, data, visitedData]);

  const animatedPanel = useAnimatedStyle(() => ({
    height:  panelH.value,
    opacity: interpolate(panelH.value, [0, 40], [0, 1], Extrapolation.CLAMP),
    right: interpolate(openProgress.value, [0, 1], [PANEL_R, 12]),
  }));

  const handleSectionChange = useCallback((section: Section) => {
    setActiveSection(section);
    if (section === 'search') setTimeout(() => searchInputRef.current?.focus(), 280);
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

  const renderItem = useCallback(({ item }: { item: PlaceItem }) => {
    const iconData = CATEGORY_ICONS[item.category as CategoryFilter];
    const CatIcon  = iconData
      ? (iconData.family === 'Ionicons' ? Ionicons : MaterialIcons)
      : null;
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => handlePlacePress(item)}
        style={[styles.card, { width: CARD_W }]}
      >
        <View style={styles.thumb}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.thumbImg} resizeMode="cover" />
          ) : (
            <View style={styles.thumbEmpty}>
              <MaterialIcons name="image-not-supported" size={18} color="#374151" />
            </View>
          )}
        </View>
        <View style={styles.cardInfo}>
          <View style={styles.cardTopRow}>
            <View style={styles.catBadge}>
              {CatIcon && <CatIcon name={iconData!.name as any} size={9} color="#34D399" />}
              <Text style={styles.catText} numberOfLines={1}>{item.category.toUpperCase()}</Text>
            </View>
            {item.distance && (
              <View style={styles.distRow}>
                <MaterialIcons name="location-on" size={10} color="#6B7280" />
                <Text style={styles.distText}>{item.distance}</Text>
              </View>
            )}
          </View>
          <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
          {item.rating != null && (
            <View style={styles.ratingRow}>
              <MaterialIcons name="star" size={11} color="#FBBF24" />
              <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
              {item.reviews != null && <Text style={styles.reviewsText}> ({item.reviews})</Text>}
            </View>
          )}
        </View>
        <MaterialIcons name="chevron-right" size={15} color="#374151" />
      </TouchableOpacity>
    );
  }, [handlePlacePress]);

  if (!visible || data.length === 0) return null;

  return (
    <Animated.View
      style={[
        styles.panelRoot,
        { bottom: bottomOffset },
        IS_DESKTOP ? { width: 380 } : { left: 12 },
        animatedPanel
      ]}
    >
      <View style={styles.panelInner}>

        {/* Header */}
        <View style={styles.panelHeader}>
          <MaterialIcons name="auto-awesome" size={13} color="#34D399" />
          <Text style={styles.panelTitle}>Recomendados</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.75}>
            <MaterialIcons name="close" size={16} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Toolbar */}
        <View style={styles.toolbar}>
          {tabsMeta.map(({ key, icon, label, count }) => {
            const active = activeSection === key;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.toolbarBtn, active && styles.toolbarBtnActive]}
                onPress={() => handleSectionChange(key)}
                activeOpacity={0.75}
              >
                <View style={styles.toolbarIconWrap}>
                  <MaterialIcons name={icon as any} size={14} color={active ? '#34D399' : '#6B7280'} />
                  {count != null && (
                    <View style={[styles.tabBadge, active && styles.tabBadgeActive]}>
                      <Text style={[styles.tabBadgeText, active && styles.tabBadgeTextActive]}>
                        {count > 99 ? '99+' : count}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.toolbarLabel, active && styles.toolbarLabelActive]}>{label}</Text>
                {active && <View style={styles.activeBar} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Sort chips — Para vos */}
        {activeSection === 'recommend' && (
          <View style={styles.innerRow}>
            <Text style={styles.innerLabel}>Ordenar:</Text>
            {(['distance', 'rating'] as SortMode[]).map((mode) => {
              const active = sortMode === mode;
              return (
                <TouchableOpacity
                  key={mode}
                  onPress={() => setSortMode((p) => p === mode ? 'none' : mode)}
                  activeOpacity={0.75}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <MaterialIcons
                    name={mode === 'distance' ? 'near-me' : 'star'}
                    size={10}
                    color={active ? '#34D399' : '#6B7280'}
                  />
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {mode === 'distance' ? 'Cercanos' : 'Rating'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* History header */}
        {activeSection === 'history' && (
          <View style={styles.innerRow}>
            <Text style={styles.innerLabel}>Últimos visitados</Text>
            {visitedData.length > 0 && (
              <TouchableOpacity onPress={handleClearHistory} activeOpacity={0.75} style={styles.clearBtn}>
                <MaterialIcons name="delete-outline" size={11} color="#EF4444" />
                <Text style={styles.clearBtnText}>Limpiar</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Search input */}
        {activeSection === 'search' && (
          <View style={styles.searchRow}>
            <MaterialIcons name="search" size={14} color="#6B7280" />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Buscar lugar o categoría..."
              placeholderTextColor="#374151"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.75}>
                <MaterialIcons name="close" size={13} color="#6B7280" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Filter chips */}
        {activeSection === 'filter' && (
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
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Cards */}
        {displayData.length > 0 ? (
          <View style={styles.carouselContainer}>
            {canScrollLeft && (
              <TouchableOpacity style={[styles.scrollBtn, styles.scrollBtnLeft]} onPress={scrollLeft} activeOpacity={0.8}>
                <MaterialIcons name="chevron-left" size={24} color="#FFF" />
              </TouchableOpacity>
            )}
            <FlatList
              ref={flatListRef}
              data={displayData}
              keyExtractor={(item) => String(item.id)}
              horizontal
              showsHorizontalScrollIndicator={true}
              snapToInterval={CARD_STRIDE}
              decelerationRate="fast"
              contentContainerStyle={styles.flatListContent}
              getItemLayout={getItemLayout}
              renderItem={renderItem}
              windowSize={3}
              initialNumToRender={3}
              maxToRenderPerBatch={3}
              removeClippedSubviews={REMOVE_CLIPPED}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            />
            {canScrollRight && (
              <TouchableOpacity style={[styles.scrollBtn, styles.scrollBtnRight]} onPress={scrollRight} activeOpacity={0.8}>
                <MaterialIcons name="chevron-right" size={24} color="#FFF" />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <MaterialIcons
              name={activeSection === 'history' ? 'history' : 'search-off'}
              size={20}
              color="#374151"
            />
            <Text style={styles.emptyText}>
              {activeSection === 'history' ? 'Aún no visitaste lugares' : 'Sin resultados'}
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
  triggerActive: {
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
  },
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
  triggerBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '800',
    lineHeight: 11,
  },

  // ── Panel ──
  panelRoot: {
    position: 'absolute',
    zIndex: 4999,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 12,
    overflow: 'hidden',
  },
  panelInner: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(10, 17, 32, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    ...Platform.select({ web: { backdropFilter: 'blur(20px)' } as any }),
  },
  panelHeader: {
    height: H_HEADER,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  panelTitle: {
    flex: 1,
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  closeBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },

  // ── Toolbar ──
  toolbar: {
    height: H_TOOLBAR,
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  toolbarBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    position: 'relative',
  },
  toolbarBtnActive:   { backgroundColor: 'rgba(52, 211, 153, 0.06)' },
  toolbarIconWrap:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
  toolbarLabel:       { color: '#4B5563', fontSize: 9, fontWeight: '600', letterSpacing: 0.3 },
  toolbarLabelActive: { color: '#34D399' },
  activeBar: {
    position: 'absolute',
    bottom: 0,
    left: '20%',
    right: '20%',
    height: 2,
    borderRadius: 1,
    backgroundColor: '#34D399',
  },
  tabBadge: {
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  tabBadgeActive:     { backgroundColor: 'rgba(52,211,153,0.18)' },
  tabBadgeText:       { color: '#4B5563', fontSize: 8, fontWeight: '700', lineHeight: 12 },
  tabBadgeTextActive: { color: '#34D399' },

  // ── Inner rows ──
  innerRow: {
    height: H_INNER,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  innerLabel: { color: '#374151', fontSize: 10, fontWeight: '600' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  chipActive:     { borderColor: 'rgba(52,211,153,0.35)', backgroundColor: 'rgba(52,211,153,0.1)' },
  chipText:       { color: '#4B5563', fontSize: 10, fontWeight: '600' },
  chipTextActive: { color: '#34D399' },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
    backgroundColor: 'rgba(239,68,68,0.07)',
  },
  clearBtnText: { color: '#EF4444', fontSize: 10, fontWeight: '600' },

  // ── Search ──
  searchRow: {
    height: H_SEARCH,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  searchInput: { flex: 1, color: '#E2E8F0', fontSize: 12, paddingVertical: 0 },

  // ── Filter ──
  filterScroll:        { height: H_CHIPS, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  filterScrollContent: { paddingHorizontal: SPACING, gap: 6, alignItems: 'center' },

  // ── FlatList ──
  carouselContainer: { position: 'relative', flex: 1, justifyContent: 'center' },
  flatListContent: { paddingLeft: SPACING, paddingRight: SPACING },
  scrollBtn: {
    position: 'absolute',
    top: '50%',
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  scrollBtnLeft: { left: -8 },
  scrollBtnRight: { right: -8 },

  // ── Card ──
  card: {
    height: 66,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 7,
    gap: 8,
    marginTop: 6,
    marginRight: SPACING,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  thumb:      { width: THUMB_SZ, height: THUMB_SZ, borderRadius: 8, overflow: 'hidden', flexShrink: 0, backgroundColor: '#0F172A' },
  thumbImg:   { width: '100%', height: '100%' },
  thumbEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cardInfo:   { flex: 1, gap: 3 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  catBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(52,211,153,0.1)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.2)',
  },
  catText:     { color: '#34D399', fontSize: 8, fontWeight: '700', letterSpacing: 0.4 },
  distRow:     { flexDirection: 'row', alignItems: 'center', gap: 2 },
  distText:    { color: '#4B5563', fontSize: 10 },
  cardName:    { color: '#E2E8F0', fontSize: 12, fontWeight: '600' },
  ratingRow:   { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingText:  { color: '#FBBF24', fontSize: 10, fontWeight: '600' },
  reviewsText: { color: '#4B5563', fontSize: 10 },

  // ── Empty ──
  emptyState: { height: H_CARDS, alignItems: 'center', justifyContent: 'center', gap: 6 },
  emptyText:  { color: '#374151', fontSize: 12, fontWeight: '500' },
});
