import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { getCategoryColor } from '../../../utils/mapUtils';
import { TurismoEvent } from '../types';

import { MiniModal } from './MiniModal';

interface StoreMarkerProps {
  event: TurismoEvent;
  isSelected: boolean;
  onPress: (event: TurismoEvent) => void;
  isLightMode?: boolean;
  noWrapper?: boolean;
}

export const StoreMarker = ({
  event,
  isSelected,
  onPress,
  isLightMode,
  noWrapper,
}: StoreMarkerProps) => {
  // Performance: only enable tracksViewChanges briefly when the marker
  // visual changes (isSelected toggle), then disable it so react-native-maps
  // stops re-rendering the bitmap on every map frame, reducing GPU usage.
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      // On first render, allow the initial bitmap to be captured, then disable.
      isFirstRender.current = false;
      const timer = setTimeout(() => setTracksViewChanges(false), 300);
      return () => clearTimeout(timer);
    }

    // When isSelected changes, briefly re-enable tracking so the new
    // appearance (size, MiniModal) is captured into the bitmap.
    setTracksViewChanges(true);
    const timer = setTimeout(() => setTracksViewChanges(false), 300);
    return () => clearTimeout(timer);
  }, [isSelected]);

  const color = getCategoryColor(event.category);

  const pinSize = isSelected ? 46 : 36;
  const pinBorderRadius = pinSize / 2;
  const iconSize = isSelected ? 24 : 20;

  const content = (
    <View style={[styles.container, isSelected && { zIndex: 9999 }]}>
      {isSelected && <MiniModal event={event} isLightMode={isLightMode} />}

      <View
        style={[
          styles.markerPin,
          {
            backgroundColor: color,
            borderColor: '#FFFFFF', // Always white as per DESIGN.md
            width: pinSize,
            height: pinSize,
            borderRadius: pinBorderRadius,
          },
        ]}
      >
        <MaterialIcons name="store" size={iconSize} color="#FFFFFF" />
      </View>
    </View>
  );

  if (noWrapper) {
    return content;
  }

  return (
    <Marker
      coordinate={{ latitude: event.latitude, longitude: event.longitude }}
      onPress={() => onPress(event)}
      zIndex={isSelected ? 9999 : 1}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={tracksViewChanges}
    >
      {content}
    </Marker>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    // Added padding to allow for shadow and scale without clipping
    padding: 10,
  },
  markerPin: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1A4335', // Tinted shadow
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
});
