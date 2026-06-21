import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  StyleSheet,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

// ─── Types ──────────────────────────────────────────────────────────────────────

type MediaType = 'photo' | 'video' | 'video360' | 'floorplan' | 'audio';

interface MediaItem {
  id: number;
  type: MediaType;
  title: string;
  thumbnail_url: string;
  media_url: string;
  floor?: number | null;
  description?: string;
}

interface BuildingGalleryProps {
  zoneId: number;
  activeFloor: number | null;
  isDesktop: boolean;
  visible: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8081';

const MEDIA_TYPE_CONFIG: Record<MediaType, { iconName: any; label: string; color: string }> = {
  photo: { iconName: 'photo-camera', label: 'Foto', color: '#38BDF8' },
  video: { iconName: 'videocam', label: 'Video', color: '#F472B6' },
  video360: { iconName: '360', label: '360°', color: '#A78BFA' },
  floorplan: { iconName: 'map', label: 'Plano', color: '#34D399' },
  audio: { iconName: 'volume-up', label: 'Audio', color: '#FBBF24' },
};

const THUMBNAIL_WIDTH = 160;
const THUMBNAIL_HEIGHT = 120;

// ─── Component ──────────────────────────────────────────────────────────────────

export const BuildingGallery: React.FC<BuildingGalleryProps> = ({
  zoneId,
  activeFloor,
  isDesktop,
  visible,
}) => {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ─── Animate in/out ─────────────────────────────────────────────────────────

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: visible ? 1 : 0,
        duration: 380,
        useNativeDriver: false,
      }),
      Animated.timing(fadeAnim, {
        toValue: visible ? 1 : 0,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start();
  }, [visible, slideAnim, fadeAnim]);

  // ─── Fetch media ────────────────────────────────────────────────────────────

  const fetchMedia = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `${API_URL}/api/v1/zones/${zoneId}/media`;
      if (activeFloor !== null && activeFloor !== undefined) {
        url += `?floor=${activeFloor}`;
      }
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setMedia(Array.isArray(data) ? data : data.media || []);
    } catch (err: any) {
      console.warn('[BuildingGallery] Error fetching media:', err.message);
      setError('Error al cargar contenido');
      setMedia([]);
    } finally {
      setLoading(false);
    }
  }, [zoneId, activeFloor]);

  useEffect(() => {
    if (visible && zoneId) {
      fetchMedia();
    }
  }, [visible, zoneId, activeFloor, fetchMedia]);

  // ─── Lightbox navigation ───────────────────────────────────────────────────

  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null);
  }, []);

  const goToPrev = useCallback(() => {
    if (lightboxIndex !== null && lightboxIndex > 0) {
      setLightboxIndex(lightboxIndex - 1);
    }
  }, [lightboxIndex]);

  const goToNext = useCallback(() => {
    if (lightboxIndex !== null && lightboxIndex < media.length - 1) {
      setLightboxIndex(lightboxIndex + 1);
    }
  }, [lightboxIndex, media.length]);

  // ─── Don't render if not visible (after animation out) ──────────────────────

  if (!visible && !loading) {
    return null;
  }

  // ─── Render helpers ─────────────────────────────────────────────────────────

  const renderTypeBadge = (type: MediaType) => {
    const config = MEDIA_TYPE_CONFIG[type] || MEDIA_TYPE_CONFIG.photo;
    return (
      <View style={[s.typeBadge, { backgroundColor: `${config.color}22` }]}>
        <MaterialIcons
          name={config.iconName}
          size={14}
          color="#FFFFFF"
          style={{ marginRight: 4 }}
        />
        <Text style={[s.typeBadgeLabel, { color: config.color }]}>{config.label}</Text>
      </View>
    );
  };

  const renderThumbnailCard = (item: MediaItem, index: number) => (
    <TouchableOpacity
      key={item.id}
      activeOpacity={0.85}
      onPress={() => openLightbox(index)}
      style={[s.thumbnailCard, Platform.select({ web: { cursor: 'pointer' } as any })]}
    >
      <Image source={{ uri: item.thumbnail_url }} style={s.thumbnailImage} resizeMode="cover" />
      {/* Gradient overlay */}
      <View style={s.thumbnailGradient} />

      {/* Type badge */}
      <View style={s.thumbnailBadgeContainer}>{renderTypeBadge(item.type)}</View>

      {/* Title */}
      <View style={s.thumbnailTitleContainer}>
        <Text style={s.thumbnailTitle} numberOfLines={2}>
          {item.title}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={s.emptyContainer}>
      <MaterialIcons name="photo-library" size={28} color="#4B5563" />
      <Text style={s.emptyText}>No hay contenido disponible</Text>
      <Text style={s.emptySubtext}>
        {activeFloor !== null
          ? `Piso ${activeFloor === 0 ? 'PB' : `P${activeFloor}`} sin multimedia`
          : 'Este edificio aún no tiene multimedia'}
      </Text>
    </View>
  );

  const renderLoadingState = () => (
    <View style={s.loadingContainer}>
      <ActivityIndicator size="small" color="#38BDF8" />
      <Text style={s.loadingText}>Cargando galería…</Text>
    </View>
  );

  // ─── Lightbox Modal ─────────────────────────────────────────────────────────

  const renderLightbox = () => {
    if (lightboxIndex === null || !media[lightboxIndex]) return null;
    const currentItem = media[lightboxIndex];
    const config = MEDIA_TYPE_CONFIG[currentItem.type] || MEDIA_TYPE_CONFIG.photo;
    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

    return (
      <Modal
        visible={lightboxIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={closeLightbox}
        statusBarTranslucent
      >
        <View style={s.lightboxOverlay}>
          {/* Background tap to close */}
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={closeLightbox}
          />

          {/* Top bar */}
          <View style={[s.lightboxTopBar, { paddingTop: Platform.OS === 'web' ? 20 : 50 }]}>
            <View style={s.lightboxTitleSection}>
              <View style={[s.lightboxTypeIndicator, { backgroundColor: config.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.lightboxTitle} numberOfLines={1}>
                  {currentItem.title}
                </Text>
                <Text style={s.lightboxSubtitle}>
                  <MaterialIcons
                    name={config.iconName}
                    size={16}
                    color="#FFFFFF"
                    style={{ marginRight: 6 }}
                  />
                  {config.label} · {lightboxIndex + 1} de {media.length}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={closeLightbox}
              style={s.lightboxCloseButton}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Media content */}
          <View style={s.lightboxMediaContainer}>
            <Image
              source={{ uri: currentItem.media_url }}
              style={{
                width: isDesktop ? Math.min(screenWidth * 0.7, 1000) : screenWidth - 40,
                height: isDesktop ? Math.min(screenHeight * 0.65, 700) : screenHeight * 0.55,
                borderRadius: 12,
              }}
              resizeMode="contain"
            />
          </View>

          {/* Description */}
          {currentItem.description && (
            <View style={s.lightboxDescriptionContainer}>
              <Text style={s.lightboxDescription}>{currentItem.description}</Text>
            </View>
          )}

          {/* Navigation arrows */}
          {lightboxIndex > 0 && (
            <TouchableOpacity
              style={[s.lightboxNavButton, s.lightboxNavLeft]}
              onPress={goToPrev}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          )}
          {lightboxIndex < media.length - 1 && (
            <TouchableOpacity
              style={[s.lightboxNavButton, s.lightboxNavRight]}
              onPress={goToNext}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-forward" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          {/* Dots indicator */}
          {media.length > 1 && (
            <View style={s.lightboxDots}>
              {media.map((_, idx) => (
                <View
                  key={idx}
                  style={[s.lightboxDot, idx === lightboxIndex && s.lightboxDotActive]}
                />
              ))}
            </View>
          )}
        </View>
      </Modal>
    );
  };

  // ─── Main render ────────────────────────────────────────────────────────────

  return (
    <>
      <Animated.View
        pointerEvents={visible ? 'auto' : 'none'}
        style={[
          s.container,
          {
            left: isDesktop ? 104 : 0,
            opacity: fadeAnim,
            transform: [
              {
                translateY: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [200, 0],
                }),
              },
            ],
          },
        ]}
      >
        {/* Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <View style={s.headerAccent} />
            <View>
              <Text style={s.headerLabel}>GALERÍA DEL EDIFICIO</Text>
              {activeFloor !== null && (
                <Text style={s.headerFloor}>
                  Piso {activeFloor === 0 ? 'PB' : `P${activeFloor}`}
                </Text>
              )}
            </View>
          </View>
          {media.length > 0 && (
            <View style={s.headerCount}>
              <Text style={s.headerCountText}>{media.length}</Text>
              <Text style={s.headerCountLabel}>items</Text>
            </View>
          )}
        </View>

        {/* Content */}
        {loading ? (
          renderLoadingState()
        ) : error ? (
          <View style={s.emptyContainer}>
            <Ionicons name="alert-circle-outline" size={28} color="#EF4444" />
            <Text style={[s.emptyText, { color: '#EF4444' }]}>{error}</Text>
          </View>
        ) : media.length === 0 ? (
          renderEmptyState()
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.carouselContent}
            decelerationRate="fast"
            snapToInterval={THUMBNAIL_WIDTH + 12}
            snapToAlignment="start"
          >
            {media.map((item, index) => renderThumbnailCard(item, index))}
          </ScrollView>
        )}
      </Animated.View>

      {/* Fullscreen lightbox overlay */}
      {renderLightbox()}
    </>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // ── Container ──────────────────────────────────────────────────────────────
  container: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    zIndex: 998,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 12,
    paddingBottom: Platform.OS === 'web' ? 16 : 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
      },
      android: { elevation: 12 },
      web: {
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.4)',
      } as any,
    }),
  },

  // ── Header ─────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerAccent: {
    width: 3,
    height: 24,
    backgroundColor: '#38BDF8',
    borderRadius: 2,
  },
  headerLabel: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  headerFloor: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  headerCount: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
  },
  headerCountText: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  headerCountLabel: {
    color: '#9CA3AF',
    fontSize: 9,
    fontWeight: '600',
  },

  // ── Carousel ───────────────────────────────────────────────────────────────
  carouselContent: {
    paddingHorizontal: 16,
    gap: 12,
  },

  // ── Thumbnail Card ─────────────────────────────────────────────────────────
  thumbnailCard: {
    width: THUMBNAIL_WIDTH,
    height: THUMBNAIL_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
      web: {
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      } as any,
    }),
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  thumbnailGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
    backgroundColor: 'transparent',
    // Simulated gradient via layered approach
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    ...Platform.select({
      web: {
        background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 100%)',
      } as any,
      default: {
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
      },
    }),
  },
  thumbnailBadgeContainer: {
    position: 'absolute',
    top: 8,
    left: 8,
  },
  thumbnailTitleContainer: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
  },
  thumbnailTitle: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // ── Type Badge ─────────────────────────────────────────────────────────────
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 3,
  },
  typeBadgeEmoji: {
    fontSize: 10,
  },
  typeBadgeLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // ── Empty State ────────────────────────────────────────────────────────────
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 6,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
  },
  emptySubtext: {
    color: '#4B5563',
    fontSize: 11,
    fontWeight: '500',
  },

  // ── Loading State ──────────────────────────────────────────────────────────
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  loadingText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
  },

  // ── Lightbox ───────────────────────────────────────────────────────────────
  lightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      } as any,
    }),
  },
  lightboxTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  lightboxTitleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  lightboxTypeIndicator: {
    width: 4,
    height: 28,
    borderRadius: 2,
  },
  lightboxTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  lightboxSubtitle: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  lightboxCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({ web: { cursor: 'pointer' } as any }),
  },
  lightboxMediaContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  lightboxDescriptionContainer: {
    position: 'absolute',
    bottom: 80,
    left: 40,
    right: 40,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  lightboxDescription: {
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
    textAlign: 'center',
  },
  lightboxNavButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({ web: { cursor: 'pointer' } as any }),
  },
  lightboxNavLeft: {
    left: 16,
  },
  lightboxNavRight: {
    right: 16,
  },
  lightboxDots: {
    position: 'absolute',
    bottom: 30,
    flexDirection: 'row',
    gap: 6,
    alignSelf: 'center',
  },
  lightboxDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  lightboxDotActive: {
    backgroundColor: '#38BDF8',
    width: 18,
    borderRadius: 4,
  },
});
