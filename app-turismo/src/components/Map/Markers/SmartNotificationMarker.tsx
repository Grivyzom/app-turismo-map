import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AnimatedReanimated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing as ReanimatedEasing,
  interpolate,
  FadeInUp,
  FadeOutDown,
} from 'react-native-reanimated';
import { Marker } from 'react-native-maps';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { TurismoEvent } from '../types';
import { getCategoryColor } from '../../../utils/mapUtils';

interface Props {
  event: TurismoEvent;
  isSelected: boolean;
  onPress: (event: TurismoEvent) => void;
  isLightMode?: boolean;
}

const getIconForSmartNotification = (recommendationType?: string) => {
  switch (recommendationType) {
    case 'new_item': return 'new-releases';
    case 'invitation_club': return 'local-activity';
    case 'invitation_sports': return 'sports-basketball';
    case 'new_spot': return 'park';
    default: return 'notifications-active';
  }
};

const getLabelForSmartNotification = (recommendationType?: string) => {
  switch (recommendationType) {
    case 'new_item': return 'NUEVO';
    case 'invitation_club': return 'INVITACIÓN';
    case 'invitation_sports': return 'PARTIDO';
    case 'new_spot': return 'NUEVA ZONA';
    default: return 'NOVEDAD';
  }
};

export const SmartNotificationMarker = React.memo(
  ({ event, isSelected, onPress, isLightMode }: Props) => {
    const jumpAnim = useSharedValue(0);
    const pulseAnim = useSharedValue(0);
    const [trackChanges, setTrackChanges] = useState(true);

    useEffect(() => {
      // Setup jumping animation
      jumpAnim.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 400, easing: ReanimatedEasing.out(ReanimatedEasing.ease) }), // Jump up
          withTiming(0, { duration: 400, easing: ReanimatedEasing.in(ReanimatedEasing.ease) }), // Fall down
          withTiming(0, { duration: 1200 }) // Pause
        ),
        -1 // Infinite
      );

      // Setup pulse animation
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 2000 }),
          withTiming(0, { duration: 0 })
        ),
        -1
      );

      // Disable track changes after a short while to save memory
      const timer = setTimeout(() => setTrackChanges(false), 2500);
      return () => {
        clearTimeout(timer);
        jumpAnim.value = 0;
        pulseAnim.value = 0;
      };
    }, []);

    const animatedStyle = useAnimatedStyle(() => {
      const translateY = interpolate(jumpAnim.value, [0, 1], [0, -15]);
      return {
        transform: [
          { translateY },
          { scale: isSelected ? 1.2 : 1 }
        ],
      };
    });

    const pulseStyle = useAnimatedStyle(() => {
      const scale = interpolate(pulseAnim.value, [0, 1], [1, 2.5]);
      const opacity = interpolate(pulseAnim.value, [0, 0.8, 1], [0.6, 0, 0]);
      return {
        transform: [{ scale }],
        opacity,
      };
    });

    const color = getCategoryColor(event.category as any, event.musicStyle) || '#F43F5E';
    const iconName = getIconForSmartNotification(event.recommendationType) as any;
    const label = getLabelForSmartNotification(event.recommendationType);

    const handlePress = useCallback(() => {
      onPress(event);
    }, [onPress, event]);

    return (
      <Marker
        key={event.id}
        coordinate={{ latitude: event.latitude, longitude: event.longitude }}
        onPress={handlePress}
        tracksViewChanges={trackChanges || isSelected}
        anchor={{ x: 0.5, y: 1 }}
        zIndex={isSelected ? 9999 : 100}
      >
        <View style={styles.container}>
          <AnimatedReanimated.View 
            style={[styles.pulse, { backgroundColor: color }, pulseStyle]} 
          />
          
          <AnimatedReanimated.View 
            entering={FadeInUp.duration(600).springify()} 
            exiting={FadeOutDown.duration(300)}
            style={[animatedStyle, styles.markerContent]}
          >
            {/* Pequeña viñeta flotante encima */}
            <View style={[styles.badge, { backgroundColor: color }]}>
              <Text style={styles.badgeText}>{label}</Text>
            </View>

            <View style={[styles.pin, { backgroundColor: color, borderColor: isLightMode ? '#FFF' : '#111827' }]}>
              <MaterialIcons name={iconName} size={20} color="#FFFFFF" />
            </View>
            
            <View style={[styles.triangle, { borderTopColor: color }]} />
          </AnimatedReanimated.View>
        </View>
      </Marker>
    );
  }
);

SmartNotificationMarker.displayName = 'SmartNotificationMarker';

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: 60,
    height: 80,
    overflow: 'visible',
  },
  markerContent: {
    alignItems: 'center',
  },
  pin: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  triangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 0,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -2,
  },
  pulse: {
    position: 'absolute',
    bottom: 0,
    width: 30,
    height: 10,
    borderRadius: 15,
  },
  badge: {
    position: 'absolute',
    top: -15,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
});
