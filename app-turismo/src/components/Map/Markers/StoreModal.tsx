import React from 'react';
import { View, Text, StyleSheet, Linking, Platform, Pressable } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Animated, {
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { getCategoryColor } from '../../../utils/mapUtils';
import { TurismoEvent } from '../types';

interface StoreModalProps {
  event: TurismoEvent;
  isLightMode?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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

export const StoreModal = ({ event, isLightMode }: StoreModalProps) => {
  const color = getCategoryColor(event.category);

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

  const getBusinessStatus = (openingHours?: string) => {
    const isOpen = openingHours
      ? openingHours.toLowerCase().includes('abierto') || openingHours.includes('24/7')
      : true;
    return {
      isOpen,
      text: isOpen ? 'Abierto' : 'Cerrado',
      subtext: openingHours || '24/7',
      color: isOpen ? '#10B981' : '#EF4444',
    };
  };

  const status = getBusinessStatus(event.openingHours);

  const textColor = isLightMode ? '#191C1D' : '#F0F1F2';
  const subtextColor = isLightMode ? '#414844' : '#C1C8C3';
  const bgColor = isLightMode ? '#FFFFFF' : 'rgba(34, 34, 34, 0.95)';
  const borderColor = isLightMode ? 'rgba(0,0,0,0.05)' : 'rgba(255, 255, 255, 0.1)';

  const primaryBtn = useTactileScale();
  const secondaryBtn = useTactileScale();

  return (
    <Animated.View
      entering={ZoomIn.springify()}
      style={[
        styles.modalContainer,
        {
          backgroundColor: bgColor,
          borderColor: borderColor,
          transformOrigin: 'bottom center',
        },
      ]}
    >
      <View style={styles.pressableContent}>
        <View style={styles.contentRow}>
          <View style={styles.infoCol}>
            {/* Title */}
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: textColor }]} numberOfLines={2}>
                {event.title}
              </Text>
            </View>

            {/* Status / Hours */}
            {status && (
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                <Text style={[styles.statusText, { color: status.color }]} numberOfLines={1}>
                  {status.text}
                </Text>
                {status.subtext !== '24/7' && (
                  <Text style={[styles.hoursText, { color: subtextColor }]} numberOfLines={1}>
                    {status.subtext}
                  </Text>
                )}
              </View>
            )}

            {/* Address */}
            {event.address && (
              <View style={styles.extraInfoItem}>
                <MaterialIcons name="location-on" size={14} color={color} />
                <Text style={[styles.extraInfoText, { color: subtextColor }]} numberOfLines={2}>
                  {event.address}
                </Text>
              </View>
            )}

            {/* Contact */}
            {(event.contactPhone || event.contactEmail) && (
              <View style={styles.extraInfoItem}>
                <MaterialIcons
                  name={event.contactPhone ? 'phone' : 'email'}
                  size={14}
                  color={color}
                />
                <Text style={[styles.extraInfoText, { color: subtextColor }]} numberOfLines={1}>
                  {event.contactPhone || event.contactEmail}
                </Text>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionsRow}>
              <AnimatedPressable
                style={[styles.actionButton, { backgroundColor: color }, primaryBtn.animatedStyle]}
                onPress={(e) => {
                  e.stopPropagation();
                  handleContact();
                }}
                onPressIn={primaryBtn.onPressIn}
                onPressOut={primaryBtn.onPressOut}
              >
                <MaterialIcons
                  name={event.contactPhone ? 'call' : 'email'}
                  size={16}
                  color="#FFFFFF"
                />
                <Text style={styles.buttonText}>
                  {event.contactPhone ? 'Llamar' : 'Contactar'}
                </Text>
              </AnimatedPressable>

              <AnimatedPressable
                style={[
                  styles.actionButton,
                  { backgroundColor: isLightMode ? '#F3F4F5' : 'rgba(255,255,255,0.1)' },
                  secondaryBtn.animatedStyle,
                ]}
                onPress={(e) => {
                  e.stopPropagation();
                  handleDirections();
                }}
                onPressIn={secondaryBtn.onPressIn}
                onPressOut={secondaryBtn.onPressOut}
              >
                <MaterialIcons name="directions" size={16} color={textColor} />
                <Text style={[styles.buttonText, { color: textColor }]}>Ir</Text>
              </AnimatedPressable>
            </View>
          </View>
        </View>
      </View>
      {/* Pointer triangle */}
      <View style={[styles.pointer, { borderTopColor: bgColor }]} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    width: 280,
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
  contentRow: {
    flexDirection: 'row',
    padding: 14,
    alignItems: 'flex-start',
    width: '100%',
  },
  infoCol: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif-medium',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  hoursText: {
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 'auto',
  },
  extraInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  extraInfoText: {
    fontSize: 12,
    fontWeight: '500',
    flexShrink: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  actionButton: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    gap: 6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  pointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    position: 'absolute',
    bottom: -8,
  },
});
