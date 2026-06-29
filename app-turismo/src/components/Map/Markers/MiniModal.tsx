import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  LayoutChangeEvent,
  Dimensions,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Animated, {
  ZoomIn,
  ZoomOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  FadeIn,
  LinearTransition,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { TurismoEvent } from '../types';
import { PinGallery } from '../../ui/PinGallery';
import { pinGalleryApi } from '../../../utils/pinGalleryApi';

interface MiniModalProps {
  event: TurismoEvent;
  isLightMode?: boolean;
  isSelected?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/* eslint-disable react-hooks/immutability */
const useTactileScale = () => {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = () => {
    scale.value = withSpring(0.92, { damping: 10, stiffness: 300 });
  };
  const onPressOut = () => {
    scale.value = withSpring(1, { damping: 10, stiffness: 300 });
  };

  return { animatedStyle, onPressIn, onPressOut };
};
/* eslint-enable react-hooks/immutability */

// ─── Constants matching the standalone design ──────────────────────────
const MODAL_MAX_WIDTH = 340;
const GALLERY_HEIGHT = 196;

export const MiniModal = ({ event, isLightMode, isSelected }: MiniModalProps) => {
  const isCamara = event.category?.toLowerCase() === 'camara';
  const isUniversidad = event.category?.toLowerCase() === 'universidad';

  const windowHeight = Dimensions.get('window').height;
  const maxModalHeight = Math.min(windowHeight * 0.6, 480);

  const hasUniversidadInfo = isUniversidad && (event.nivelEducativo || event.anioFundacion);
  const shouldAutoExpand = isSelected && hasUniversidadInfo;

  const [isExpanded, setIsExpanded] = useState<boolean>(shouldAutoExpand ? true : false);
  const [galeriaIndex, setGaleriaIndex] = useState(0);
  const [modalWidth, setModalWidth] = useState(MODAL_MAX_WIDTH);
  const [galeriaImages, setGaleriaImages] = useState<string[]>([]);

  useEffect(() => {
    if (isSelected) {
      setIsExpanded(shouldAutoExpand ? true : false);
    } else {
      setIsExpanded(false);
    }
  }, [isSelected, shouldAutoExpand]);

  useEffect(() => {
    const loadGalleryImages = async () => {
      try {
        const images = await pinGalleryApi.getGallery(event.id);
        if (images.length > 0) {
          setGaleriaImages(images);
        } else if (event.galeria?.length) {
          setGaleriaImages(event.galeria);
        }
      } catch (error) {
        console.warn('Error loading gallery:', error);
        if (event.galeria?.length) {
          setGaleriaImages(event.galeria);
        }
      }
    };
    loadGalleryImages();
  }, [event.id, event.galeria]);

  const onModalLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setModalWidth(w);
  }, []);

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const handleDirections = () => {
    const url = Platform.select({
      ios: `maps:0,0?q=${event.latitude},${event.longitude}`,
      android: `geo:0,0?q=${event.latitude},${event.longitude}`,
      web: `https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`,
    });
    if (url) Linking.openURL(url);
  };

  const handleContact = (
    type: 'phone' | 'email' | 'instagram' | 'facebook' | 'linkedin',
    value?: string,
  ) => {
    if (!value) return;
    switch (type) {
      case 'phone':
        Linking.openURL(`tel:${value}`);
        break;
      case 'email':
        Linking.openURL(`mailto:${value}`);
        break;
      default:
        Linking.openURL(value);
        break;
    }
  };

  const expandBtn = useTactileScale();
  const ubicarBtn = useTactileScale();
  const phoneBtn = useTactileScale();
  const emailBtn = useTactileScale();
  const instaBtn = useTactileScale();
  const inBtn = useTactileScale();
  const fbBtn = useTactileScale();

  // ─── Data with defaults ────────────────────────────────────────────
  const nombre = event.title || 'Ubicación';
  const categoria = event.category || 'Punto de interés';
  const galeria =
    galeriaImages.length > 0
      ? galeriaImages
      : event.galeria || (event.imageUrl ? [event.imageUrl] : ['📍', '🗺️', '📌']);
  const distancia = event.distancia || '';
  const descripcion = event.description || '';
  const nivelEducativo = event.nivelEducativo;
  const anioFundacion = event.anioFundacion;
  const ubicacion = event.address || '';
  const telefono = event.contactPhone;
  const email = event.contactEmail;
  const horarios = event.openingHours;
  const instagram = event.instagram;
  const linkedin = event.linkedin;
  const facebook = event.facebook;

  // ─── Title scroll animation ────────────────────────────────────────
  // The standalone uses `translateX(calc(-100% - 24px))` which scrolls
  // the full text width. We measure via a shared value that represents
  // a percentage of the title width overflow — we'll use a generous
  // fixed distance proportional to character count.
  const titleAnimValue = useSharedValue(0);

  useEffect(() => {
    if (nombre.length > 30) {
      // Approximate scroll distance based on character count.
      // ~7px per character is a rough estimate for 17px Inter font.
      const scrollDistance = Math.max(nombre.length * 7 - modalWidth + 60, 100);
      titleAnimValue.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 1800 }),
          withTiming(-scrollDistance, { duration: 5000, easing: Easing.linear }),
          withTiming(-scrollDistance, { duration: 1200 }),
          withTiming(0, { duration: 1800, easing: Easing.linear }),
        ),
        -1,
        false,
      );
    } else {
      titleAnimValue.value = 0;
    }
  }, [nombre, modalWidth, titleAnimValue]);

  const animatedTitleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: titleAnimValue.value }],
  }));

  // ─── Chevron rotation animation ────────────────────────────────────
  const chevronRotation = useSharedValue(0);
  useEffect(() => {
    chevronRotation.value = withTiming(isExpanded ? 180 : 0, { duration: 350 });
  }, [isExpanded, chevronRotation]);

  const arrowAnimStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value}deg` }],
  }));

  // ─── Camara tooltip ────────────────────────────────────────────────
  if (isCamara) {
    if (Platform.OS === 'web') {
      const { Tooltip } = require('react-tooltip');
      const { createPortal } = require('react-dom');
      return createPortal(
        <Tooltip
          anchorSelect={`#maplibre-pin-${event.id}, #google-pin-${event.id}`}
          isOpen={true}
          place="top"
          content={event.title}
          style={{
            backgroundColor: '#0d1117',
            color: '#c8d4dc',
            borderColor: 'rgba(200,150,100,0.18)',
            borderWidth: 1,
            borderStyle: 'solid',
            borderRadius: 8,
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: '500',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            zIndex: 99999,
          }}
        />,
        document.body,
      );
    }

    return (
      <Animated.View
        entering={ZoomIn.duration(200)}
        exiting={ZoomOut.duration(150)}
        style={[styles.tooltipContainer]}
      >
        <Text style={styles.tooltipText}>{event.title}</Text>
        <View style={[styles.pointer, { borderTopColor: '#0d1117' }]} />
      </Animated.View>
    );
  }

  // ─── Helpers ───────────────────────────────────────────────────────
  const hasContactInfo = ubicacion || telefono;
  const hasExpandedContact = email || horarios;
  const hasSocial = instagram || linkedin || facebook;

  return (
    <Animated.View
      entering={ZoomIn.duration(250)}
      exiting={ZoomOut.duration(150)}
      layout={LinearTransition.duration(400)}
      onLayout={onModalLayout}
      style={[styles.modalContainer, { transformOrigin: 'bottom', maxHeight: maxModalHeight } as any]}
    >
      {/* ── Handle / drag indicator ─────────────────────────────── */}
      <View style={styles.handleContainer}>
        <View style={styles.handle} />
      </View>

      {/* ── Gallery carousel ────────────────────────────────────── */}
      <View style={styles.galleryContainer}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={(e) => {
            const index = Math.round(e.nativeEvent.contentOffset.x / modalWidth);
            if (index !== galeriaIndex && index >= 0 && index < galeria.length) {
              setGaleriaIndex(index);
            }
          }}
          scrollEventThrottle={16}
        >
          {galeria.map((imagen, i) => (
            <View key={i} style={[styles.slide, { width: modalWidth }]}>
              {imagen.startsWith('http') ? (
                <Image source={{ uri: imagen }} style={styles.slideImage} />
              ) : (
                <View style={styles.slideEmojiContainer}>
                  <Text style={styles.slideEmoji}>{imagen}</Text>
                </View>
              )}
            </View>
          ))}
        </ScrollView>

        {/* Top bar: categoria + dots */}
        <View style={styles.topBar}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{categoria}</Text>
          </View>
          {galeria.length > 1 && (
            <View style={styles.dotsContainer}>
              {galeria.map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, galeriaIndex === i ? styles.dotActive : styles.dotInactive]}
                />
              ))}
            </View>
          )}
        </View>

        {/* Bottom gradient + title overlay */}
        <LinearGradient
          colors={['transparent', 'rgba(13,17,23,0.55)', 'rgba(13,17,23,0.98)']}
          locations={[0, 0.45, 1]}
          style={styles.bottomGradientContainer}
          pointerEvents="none"
        >
          <View style={styles.titleWrapper}>
            <Animated.Text style={[styles.titleText, animatedTitleStyle]} numberOfLines={1}>
              {nombre}
            </Animated.Text>
          </View>
          {distancia ? (
            <View style={styles.distanceRow}>
              <MaterialIcons name="place" size={11} color="#c89664" />
              <Text style={styles.distanceText}>{distancia}</Text>
            </View>
          ) : null}
        </LinearGradient>
      </View>

      {/* ── Body ────────────────────────────────────────────────── */}
      <ScrollView contentContainerStyle={[styles.bodyContainer, { gap: isExpanded ? 10 : 14 }]} scrollEnabled={isExpanded} showsVerticalScrollIndicator={false}>
        {/* Descripción */}
        {descripcion ? (
          <Text style={styles.descriptionText} numberOfLines={isExpanded ? 15 : 2}>
            {descripcion}
          </Text>
        ) : null}

        {/* Info grid — Universidades (Nivel 1, no expandido) */}
        {isUniversidad && (nivelEducativo || anioFundacion) && (
          <Animated.View entering={FadeIn.duration(250)} style={styles.infoGrid}>
            {nivelEducativo ? (
              <View style={styles.infoGridCell}>
                <Text style={styles.infoGridLabel}>Carreras</Text>
                <Text style={styles.infoGridValue1}>{nivelEducativo}</Text>
              </View>
            ) : null}
            {anioFundacion ? (
              <View
                style={[styles.infoGridCell, nivelEducativo ? styles.infoGridCellBorder : null]}
              >
                <Text style={styles.infoGridLabel}>Trayectoria</Text>
                <Text style={styles.infoGridValue2}>{anioFundacion}</Text>
              </View>
            ) : null}
          </Animated.View>
        )}

        {/* Contacto Nivel 1: Ubicación + Teléfono (siempre) */}
        {(ubicacion || telefono) && (
          <View style={styles.contactRowsContainer}>
            {/* Ubicación — siempre */}
            {ubicacion ? (
              <View style={styles.contactRow}>
                <View style={styles.iconBox}>
                  <MaterialIcons name="location-on" size={15} color="#c89664" />
                </View>
                <View style={styles.contactRowTextContent}>
                  <Text style={styles.contactRowLabel}>Ubicación</Text>
                  <Text style={styles.contactRowValue}>{ubicacion}</Text>
                </View>
              </View>
            ) : null}

            {/* Teléfono — siempre */}
            {telefono && (
              <>
                {ubicacion ? <View style={styles.internalDivider} /> : null}
                <AnimatedPressable
                  style={[styles.contactRow, phoneBtn.animatedStyle]}
                  onPress={() => handleContact('phone', telefono)}
                  onPressIn={phoneBtn.onPressIn}
                  onPressOut={phoneBtn.onPressOut}
                >
                  <View style={styles.iconBox}>
                    <MaterialIcons name="phone" size={15} color="#c89664" />
                  </View>
                  <View style={styles.contactRowTextContent}>
                    <Text style={styles.contactRowLabel}>Teléfono</Text>
                    <Text style={styles.contactRowValueHighlighted}>{telefono}</Text>
                  </View>
                  <MaterialIcons
                    name="chevron-right"
                    size={14}
                    color="rgba(200,150,100,0.35)"
                    style={{ alignSelf: 'center' }}
                  />
                </AnimatedPressable>
              </>
            )}

            {/* Divider entre Nivel 1 y Nivel 2 */}
            {isExpanded && (email || horarios) && <View style={styles.internalDivider} />}

            {/* Email — solo expandido (Nivel 2) */}
            {isExpanded && email && (
              <Animated.View entering={FadeIn.duration(200)}>
                <AnimatedPressable
                  style={[styles.contactRow, emailBtn.animatedStyle]}
                  onPress={() => handleContact('email', email)}
                  onPressIn={emailBtn.onPressIn}
                  onPressOut={emailBtn.onPressOut}
                >
                  <View style={styles.iconBox}>
                    <MaterialIcons name="email" size={15} color="#c89664" />
                  </View>
                  <View style={styles.contactRowTextContent}>
                    <Text style={styles.contactRowLabel}>Email</Text>
                    <Text style={styles.contactRowValueHighlighted}>{email}</Text>
                  </View>
                  <MaterialIcons
                    name="chevron-right"
                    size={14}
                    color="rgba(200,150,100,0.35)"
                    style={{ alignSelf: 'center' }}
                  />
                </AnimatedPressable>
              </Animated.View>
            )}

            {/* Horarios — solo expandido (Nivel 2) */}
            {isExpanded && horarios && (
              <Animated.View entering={FadeIn.duration(200)}>
                {email && <View style={styles.internalDivider} />}
                <View style={styles.contactRow}>
                  <View style={styles.iconBox}>
                    <MaterialIcons name="schedule" size={15} color="#c89664" />
                  </View>
                  <View style={styles.contactRowTextContent}>
                    <Text style={styles.contactRowLabel}>Horarios</Text>
                    <Text style={styles.contactRowValue}>{horarios}</Text>
                  </View>
                </View>
              </Animated.View>
            )}
          </View>
        )}

        {/* Redes sociales — solo expandido */}
        {isExpanded && hasSocial && (
          <Animated.View entering={FadeIn.duration(250)} style={styles.socialContainer}>
            <Text style={styles.socialLabel}>Síguenos</Text>
            <View style={styles.socialRow}>
              {instagram && (
                <AnimatedPressable
                  style={[styles.socialButton, instaBtn.animatedStyle]}
                  onPress={() => handleContact('instagram', instagram)}
                  onPressIn={instaBtn.onPressIn}
                  onPressOut={instaBtn.onPressOut}
                >
                  <MaterialIcons name="camera-alt" size={15} color="#c89664" />
                </AnimatedPressable>
              )}
              {linkedin && (
                <AnimatedPressable
                  style={[styles.socialButton, inBtn.animatedStyle]}
                  onPress={() => handleContact('linkedin', linkedin)}
                  onPressIn={inBtn.onPressIn}
                  onPressOut={inBtn.onPressOut}
                >
                  <MaterialIcons name="work" size={15} color="#c89664" />
                </AnimatedPressable>
              )}
              {facebook && (
                <AnimatedPressable
                  style={[styles.socialButton, fbBtn.animatedStyle]}
                  onPress={() => handleContact('facebook', facebook)}
                  onPressIn={fbBtn.onPressIn}
                  onPressOut={fbBtn.onPressOut}
                >
                  <MaterialIcons name="facebook" size={15} color="#c89664" />
                </AnimatedPressable>
              )}
            </View>
          </Animated.View>
        )}

        {/* Divider */}
        <LinearGradient
          colors={['transparent', 'rgba(200,150,100,0.12)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.divider}
        />

        {/* Botones */}
        <View style={styles.actionButtonsRow}>
          <AnimatedPressable
            style={[styles.expandButton, expandBtn.animatedStyle]}
            onPress={handleToggleExpand}
            onPressIn={expandBtn.onPressIn}
            onPressOut={expandBtn.onPressOut}
          >
            <Text style={styles.expandButtonText}>{isExpanded ? 'Ver menos' : 'Ver más'}</Text>
            <Animated.View style={arrowAnimStyle}>
              <MaterialIcons name="keyboard-arrow-up" size={14} color="#c89664" />
            </Animated.View>
          </AnimatedPressable>

          <AnimatedPressable
            style={[styles.ubicarButtonWrapper, ubicarBtn.animatedStyle]}
            onPress={handleDirections}
            onPressIn={ubicarBtn.onPressIn}
            onPressOut={ubicarBtn.onPressOut}
          >
            <LinearGradient
              colors={['#c89664', '#d9af7e']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ubicarButton}
            >
              <MaterialIcons name="near-me" size={14} color="#0a0e14" />
              <Text style={styles.ubicarButtonText}>Ubicar</Text>
            </LinearGradient>
          </AnimatedPressable>
        </View>
      </ScrollView>

      {/* Pointer triangle */}
      <View style={[styles.pointer, { borderTopColor: '#0d1117' }]} />
    </Animated.View>
  );
};

// ─── Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  modalContainer: {
    width: MODAL_MAX_WIDTH,
    backgroundColor: '#0d1117',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.9,
    shadowRadius: 40,
    elevation: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(200,150,100,0.08)',
    alignItems: 'center',
  },
  handleContainer: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 11,
    paddingBottom: 7,
    zIndex: 10,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(200,150,100,0.2)',
    borderRadius: 2,
  },

  // ── Gallery ──────────────────────────────────────────────
  galleryContainer: {
    position: 'relative',
    width: '100%',
    height: GALLERY_HEIGHT,
    backgroundColor: '#0a0e14',
    overflow: 'hidden',
  },
  slide: {
    height: '100%',
    backgroundColor: '#141c28',
  },
  slideImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  slideEmojiContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideEmoji: {
    fontSize: 52,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    zIndex: 10,
  },
  categoryBadge: {
    backgroundColor: 'rgba(10,14,20,0.82)',
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(200,150,100,0.18)',
  },
  categoryBadgeText: {
    color: '#c89664',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10,14,20,0.7)',
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderRadius: 20,
    gap: 5,
  },
  dot: {
    height: 4,
    borderRadius: 2,
  },
  dotActive: {
    width: 16,
    backgroundColor: '#c89664',
  },
  dotInactive: {
    width: 6,
    backgroundColor: 'rgba(200,150,100,0.28)',
  },
  bottomGradientContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 5,
    paddingTop: 52,
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  titleWrapper: {
    overflow: 'hidden',
    height: 26,
    marginBottom: 5,
  },
  titleText: {
    color: '#f0f4f8',
    fontSize: 17,
    fontWeight: '700',
    ...(Platform.OS === 'ios' ? { fontFamily: 'Inter' } : {}),
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  distanceText: {
    color: '#c89664',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.1,
  },

  // ── Body ─────────────────────────────────────────────────
  bodyContainer: {
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 12,
    width: '100%',
    gap: 14,
  },
  descriptionText: {
    color: '#8a96a3',
    fontSize: 13,
    lineHeight: 21,
  },

  // ── Info Grid ────────────────────────────────────────────
  infoGrid: {
    flexDirection: 'row',
    backgroundColor: 'rgba(200,150,100,0.1)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(200,150,100,0.1)',
    overflow: 'hidden',
  },
  infoGridCell: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 13,
    backgroundColor: '#0d1117',
  },
  infoGridCellBorder: {
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(200,150,100,0.1)',
  },
  infoGridLabel: {
    color: '#44505c',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.65,
    marginBottom: 4,
  },
  infoGridValue1: {
    color: '#c8d4dc',
    fontSize: 12,
    lineHeight: 17,
  },
  infoGridValue2: {
    color: '#c89664',
    fontSize: 12,
    fontWeight: '600',
  },

  // ── Contact Rows ─────────────────────────────────────────
  contactRowsContainer: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },
  contactRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  iconBox: {
    width: 34,
    height: 34,
    backgroundColor: 'rgba(200,150,100,0.07)',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderWidth: 1,
    borderColor: 'rgba(200,150,100,0.12)',
  },
  contactRowTextContent: {
    flex: 1,
    minWidth: 0,
    paddingTop: 1,
  },
  contactRowLabel: {
    color: '#3e4a56',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.65,
    marginBottom: 2,
  },
  contactRowValue: {
    color: '#c8d4dc',
    fontSize: 13,
  },
  contactRowValueHighlighted: {
    color: '#c89664',
    fontSize: 13,
    fontWeight: '500',
  },
  internalDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginHorizontal: 14,
  },

  // ── Social ───────────────────────────────────────────────
  socialContainer: {
    gap: 10,
  },
  socialLabel: {
    color: '#3e4a56',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.65,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 8,
  },
  socialButton: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(200,150,100,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(200,150,100,0.14)',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Action Buttons ───────────────────────────────────────
  divider: {
    height: 1,
    width: '100%',
    marginVertical: 0,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  expandButton: {
    flex: 1,
    backgroundColor: 'rgba(200,150,100,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(200,150,100,0.18)',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  expandButtonText: {
    color: '#c89664',
    fontSize: 13,
    fontWeight: '600',
  },
  ubicarButtonWrapper: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: 'rgba(200,150,100,1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 6,
  },
  ubicarButton: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  ubicarButtonText: {
    color: '#0a0e14',
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Pointer ──────────────────────────────────────────────
  pointer: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    position: 'absolute',
    bottom: -8,
  },

  // ── Tooltip (camara) ─────────────────────────────────────
  tooltipContainer: {
    backgroundColor: '#0d1117',
    borderColor: 'rgba(200,150,100,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    position: 'relative',
    minWidth: 100,
  },
  tooltipText: {
    color: '#c8d4dc',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
