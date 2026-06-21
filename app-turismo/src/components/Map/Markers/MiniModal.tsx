import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Animated, {
  ZoomIn,
  ZoomOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { getCategoryColor } from '../../../utils/mapUtils';
import { TurismoEvent } from '../types';

interface MiniModalProps {
  event: TurismoEvent;
  isLightMode?: boolean;
  isSelected?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/* eslint-disable react-hooks/immutability */
// Animation for tactile feel (98% scale on press)
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

export const MiniModal = ({ event, isLightMode, isSelected }: MiniModalProps) => {
  const isFauna = event.category?.toLowerCase() === 'fauna';
  const isHospital = event.category?.toLowerCase() === 'hospital';
  const isBombero = event.category?.toLowerCase() === 'bombero';
  const isCarabinero = event.category?.toLowerCase() === 'carabinero';
  const isCamara = event.category?.toLowerCase() === 'camara';
  const isTienda = event.category?.toLowerCase() === 'tienda';
  const isUniversidad = event.category?.toLowerCase() === 'universidad';

  const [isExpanded, setIsExpanded] = React.useState(isSelected || isTienda);

  React.useEffect(() => {
    if (isSelected) {
      setIsExpanded(true);
    } else if (!isTienda) {
      setIsExpanded(false);
    }
  }, [isSelected, isTienda]);
  const color = getCategoryColor(event.category);

  const isInformative =
    isFauna || isTienda || isHospital || isBombero || isCarabinero || isCamara || isUniversidad;

  const handleToggleExpand = () => {
    if (isInformative) {
      setIsExpanded(!isExpanded);
    }
  };

  const handleDirections = () => {
    const url = Platform.select({
      ios: `maps:0,0?q=${event.latitude},${event.longitude}`,
      android: `geo:0,0?q=${event.latitude},${event.longitude}`,
      web: `https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`,
    });
    if (url) Linking.openURL(url);
  };

  const handleContact = () => {
    if (event.contactPhone) {
      Linking.openURL(`tel:${event.contactPhone}`);
    } else if (event.contactEmail) {
      Linking.openURL(`mailto:${event.contactEmail}`);
    }
  };

  const handleProductPress = (productName: string) => {
    if (event.contactPhone) {
      const cleanPhone = event.contactPhone.replace(/\D/g, '');
      if (cleanPhone.startsWith('569') || cleanPhone.length === 9 || cleanPhone.startsWith('9')) {
        const fullPhone = cleanPhone.length === 9 ? `56${cleanPhone}` : cleanPhone;
        const text = encodeURIComponent(
          `¡Hola! Estoy interesado en el producto "${productName}" de tu tienda "${event.title}" que vi en el mapa turístico.`,
        );
        Linking.openURL(`https://wa.me/${fullPhone}?text=${text}`);
      } else {
        Linking.openURL(`tel:${event.contactPhone}`);
      }
    } else if (event.contactEmail) {
      const subject = encodeURIComponent(`Consulta sobre: ${productName}`);
      const body = encodeURIComponent(
        `Hola, me interesa obtener más información sobre el producto "${productName}" publicado en ${event.title}.`,
      );
      Linking.openURL(`mailto:${event.contactEmail}?subject=${subject}&body=${body}`);
    }
  };

  const getBusinessStatus = (openingHours?: string) => {
    if (!openingHours) return null;
    const isOpen = true; // Placeholder for demo
    return {
      isOpen,
      text: isOpen ? 'Abierto' : 'Cerrado',
      subtext: openingHours.split(',')[0],
      color: isOpen ? '#10B981' : '#EF4444',
      bgColor: isOpen ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
    };
  };

  const status = getBusinessStatus(event.openingHours);

  const primaryBtn = useTactileScale();
  const secondaryBtn = useTactileScale();
  const catalogBtn = useTactileScale();

  const textColor = isLightMode ? '#191C1D' : '#F0F1F2';
  const subtextColor = isLightMode ? '#414844' : '#C1C8C3';
  const bgColor = isLightMode ? '#FFFFFF' : 'rgba(34, 34, 34, 0.95)';
  const borderColor = isLightMode ? 'rgba(0,0,0,0.05)' : 'rgba(255, 255, 255, 0.1)';
  const btnBg = isLightMode ? '#F3F4F5' : 'rgba(255, 255, 255, 0.08)';

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
            backgroundColor: bgColor,
            color: textColor,
            borderColor: borderColor,
            borderWidth: 1,
            borderStyle: 'solid',
            borderRadius: 8,
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: '500',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
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
        style={[
          styles.tooltipContainer,
          {
            backgroundColor: bgColor,
            borderColor: borderColor,
          },
        ]}
      >
        <Text style={[styles.tooltipText, { color: textColor }]}>{event.title}</Text>
        <View style={[styles.pointer, { borderTopColor: bgColor }]} />
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={ZoomIn.duration(300)}
      exiting={ZoomOut.duration(200)}
      style={[
        styles.modalContainer,
        {
          backgroundColor: bgColor,
          borderColor: borderColor,
          transformOrigin: 'bottom center',
          maxWidth: isExpanded ? (event.category === 'tienda' ? 320 : 300) : 260,
        },
      ]}
    >
      <Pressable
        onPress={(e) => {
          e.stopPropagation();
          handleToggleExpand();
        }}
        style={styles.pressableContent}
      >
        {isExpanded &&
          (event.imageUrl ? (
            <Image source={{ uri: event.imageUrl }} style={styles.bannerImage} />
          ) : (
            isInformative && (
              <View style={[styles.bannerPlaceholder, { backgroundColor: color }]}>
                <MaterialIcons
                  name={
                    isFauna
                      ? 'pets'
                      : isHospital
                        ? 'local-hospital'
                        : isBombero
                          ? 'fire-extinguisher'
                          : isCarabinero
                            ? 'local-police'
                            : isCamara
                              ? 'videocam'
                              : isUniversidad
                                ? 'school'
                                : 'storefront'
                  }
                  size={40}
                  color="#FFF"
                />
              </View>
            )
          ))}

        <View style={styles.contentRow}>
          {!isExpanded &&
            (event.imageUrl ? (
              <Image source={{ uri: event.imageUrl }} style={styles.thumbnail} />
            ) : (
              <View style={[styles.thumbnailPlaceholder, { backgroundColor: color }]}>
                <MaterialIcons
                  name={
                    isFauna
                      ? 'pets'
                      : isHospital
                        ? 'local-hospital'
                        : isBombero
                          ? 'fire-extinguisher'
                          : isCarabinero
                            ? 'local-police'
                            : isCamara
                              ? 'videocam'
                              : isUniversidad
                                ? 'school'
                                : 'storefront'
                  }
                  size={20}
                  color="#FFF"
                />
              </View>
            ))}

          <View style={styles.infoCol}>
            <Text
              style={[styles.title, { color: textColor }, isExpanded && styles.expandedTitle]}
              numberOfLines={isExpanded ? 2 : 1}
            >
              {event.title}
            </Text>

            {isInformative && !isExpanded && (
              <View style={styles.expandHint}>
                <MaterialIcons name="keyboard-arrow-down" size={16} color={color} />
                <Text style={[styles.expandHintText, { color: color }]}>Toca para más info</Text>
              </View>
            )}

            {status && (
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                <Text style={[styles.statusText, { color: subtextColor }]} numberOfLines={1}>
                  {status.text} • {status.subtext}
                </Text>
              </View>
            )}

            {event.description && (
              <View style={{ position: 'relative' }}>
                <Text
                  style={[
                    styles.descriptionText,
                    { color: subtextColor, paddingRight: isFauna ? 24 : 0 },
                  ]}
                  numberOfLines={isExpanded ? 15 : isFauna ? 3 : 2}
                >
                  {event.description}
                </Text>
                {isFauna && (
                  <TouchableOpacity
                    onPress={(e: any) => {
                      e.stopPropagation();
                      setIsExpanded(!isExpanded);
                    }}
                    style={{
                      position: 'absolute',
                      right: 0,
                      bottom: 0,
                      backgroundColor: bgColor,
                      paddingLeft: 4,
                    }}
                  >
                    <MaterialIcons
                      name={isExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                      size={18}
                      color={color}
                    />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {isExpanded && (
              <View style={[styles.extraInfo, { borderTopColor: borderColor }]}>
                {event.organizer && !isFauna && (
                  <View style={styles.extraInfoItem}>
                    <MaterialIcons name="person" size={14} color={color} />
                    <Text style={[styles.extraInfoText, { color: subtextColor }]}>
                      {event.organizer}
                    </Text>
                  </View>
                )}
                {event.address && (
                  <View style={styles.extraInfoItem}>
                    <MaterialIcons name="location-on" size={14} color={color} />
                    <Text style={[styles.extraInfoText, { color: subtextColor }]}>
                      {event.address}
                    </Text>
                  </View>
                )}
                {event.time && !isFauna && (
                  <View style={styles.extraInfoItem}>
                    <MaterialIcons name="access-time" size={14} color={color} />
                    <Text style={[styles.extraInfoText, { color: subtextColor }]}>
                      {event.time}
                    </Text>
                  </View>
                )}
                {!isFauna && event.contactPhone && (
                  <View style={styles.extraInfoItem}>
                    <MaterialIcons name="phone" size={14} color={color} />
                    <Text style={[styles.extraInfoText, { color: subtextColor }]}>
                      {event.contactPhone}
                    </Text>
                  </View>
                )}
                {!isFauna && event.openingHours && (
                  <View style={styles.extraInfoItem}>
                    <MaterialIcons name="schedule" size={14} color={color} />
                    <Text style={[styles.extraInfoText, { color: subtextColor }]}>
                      {event.openingHours}
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View style={styles.actionsRow}>
              <AnimatedPressable
                style={[
                  styles.actionButton,
                  { backgroundColor: color },
                  isFauna && styles.fullWidthButton,
                  primaryBtn.animatedStyle,
                ]}
                onPress={(e) => {
                  e.stopPropagation();
                  handleDirections();
                }}
                onPressIn={primaryBtn.onPressIn}
                onPressOut={primaryBtn.onPressOut}
              >
                <MaterialIcons name="directions" size={16} color="#FFFFFF" />
                {isFauna && <Text style={styles.buttonText}>Cómo llegar</Text>}
              </AnimatedPressable>

              {!isFauna && (
                <AnimatedPressable
                  style={[
                    styles.iconButton,
                    { backgroundColor: btnBg },
                    secondaryBtn.animatedStyle,
                  ]}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleContact();
                  }}
                  onPressIn={secondaryBtn.onPressIn}
                  onPressOut={secondaryBtn.onPressOut}
                >
                  <MaterialIcons name="chat" size={16} color={textColor} />
                </AnimatedPressable>
              )}

              {!isFauna && event.catalog && event.catalog.length > 0 && (
                <AnimatedPressable
                  style={[styles.iconButton, { backgroundColor: btnBg }, catalogBtn.animatedStyle]}
                  onPressIn={catalogBtn.onPressIn}
                  onPressOut={catalogBtn.onPressOut}
                  onPress={(e) => {
                    e.stopPropagation();
                    setIsExpanded(!isExpanded);
                  }}
                >
                  <MaterialIcons name="shopping-bag" size={16} color={color} />
                </AnimatedPressable>
              )}
            </View>
          </View>
        </View>

        {isExpanded && event.catalog && event.catalog.length > 0 && (
          <View style={[styles.carouselContainer, { borderTopColor: borderColor }]}>
            <View style={styles.carouselHeader}>
              <MaterialIcons name="shopping-bag" size={16} color={color} />
              <Text style={[styles.carouselTitle, { color: textColor }]}>
                Productos de la Tienda
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselScroll}
              snapToInterval={138}
              decelerationRate="fast"
            >
              {event.catalog.map((product) => (
                <Pressable
                  key={product.id}
                  style={({ pressed }) => [
                    styles.productCard,
                    {
                      backgroundColor: btnBg,
                      borderColor: borderColor,
                      opacity: pressed ? 0.9 : 1,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    },
                  ]}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleProductPress(product.name);
                  }}
                >
                  {product.imageUrl ? (
                    <Image source={{ uri: product.imageUrl }} style={styles.productImage} />
                  ) : (
                    <View
                      style={[styles.productImagePlaceholder, { backgroundColor: color + '15' }]}
                    >
                      <MaterialIcons name="image" size={24} color={color} />
                    </View>
                  )}
                  <View style={styles.productInfo}>
                    <Text style={[styles.productName, { color: textColor }]} numberOfLines={2}>
                      {product.name}
                    </Text>
                    <Text style={[styles.productPrice, { color: color }]}>
                      {`$${product.price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
      </Pressable>
      {/* Pointer triangle adapting towards the pin */}
      <View style={[styles.pointer, { borderTopColor: bgColor }]} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    maxWidth: 260,
    minWidth: 180,
    borderRadius: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    alignItems: 'center',
    overflow: 'hidden',
  },
  pressableContent: {
    width: '100%',
  },
  bannerImage: {
    width: '100%',
    height: 120,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
  },
  bannerPlaceholder: {
    width: '100%',
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
  },
  contentRow: {
    flexDirection: 'row',
    padding: 10,
    gap: 12,
    alignItems: 'flex-start',
    width: '100%',
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 12,
    marginTop: 2,
  },
  expandedThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 15,
  },
  thumbnailPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  infoCol: {
    flex: 1,
  },
  title: {
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif-medium',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  expandedTitle: {
    fontSize: 16,
    marginBottom: 4,
  },
  expandHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 2,
  },
  expandHintText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  descriptionText: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
  extraInfo: {
    marginTop: 4,
    marginBottom: 12,
    gap: 6,
    borderTopWidth: 1,
    paddingTop: 8,
  },
  extraInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  extraInfoText: {
    fontSize: 11,
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  iconButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButton: {
    height: 32,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    gap: 6,
  },
  fullWidthButton: {
    flex: 1,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  carouselContainer: {
    marginTop: 4,
    paddingTop: 8,
    paddingBottom: 10,
    borderTopWidth: 1,
    width: '100%',
  },
  carouselHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    paddingHorizontal: 10,
  },
  carouselTitle: {
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif-medium',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  carouselScroll: {
    paddingHorizontal: 10,
    gap: 8,
  },
  productCard: {
    width: 130,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
  productImage: {
    width: '100%',
    height: 75,
    resizeMode: 'cover',
  },
  productImagePlaceholder: {
    width: '100%',
    height: 75,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productInfo: {
    padding: 6,
  },
  productName: {
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
    height: 28,
  },
  productPrice: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
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
  tooltipContainer: {
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
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
