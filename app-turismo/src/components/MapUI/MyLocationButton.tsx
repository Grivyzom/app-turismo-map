import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { useUserLocationContext } from '../../context/UserLocationContext';

interface MyLocationButtonProps {
  onCenterPress: () => void;
  isDesktop?: boolean;
}

export const MyLocationButton: React.FC<MyLocationButtonProps> = ({ onCenterPress, isDesktop }) => {
  const { userLocation, isLoadingLocation, retryLocation } = useUserLocationContext();

  return (
    <TouchableOpacity
      style={[styles.controlButton, userLocation && styles.controlButtonActive]}
      onPress={() => {
        if (userLocation) {
          onCenterPress();
        } else {
          retryLocation();
        }
      }}
      activeOpacity={0.7}
    >
      <MaterialIcons
        name="my-location"
        size={isDesktop ? 18 : 22}
        color={userLocation ? '#34D399' : isLoadingLocation ? '#A0AEC0' : '#EF4444'}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  controlButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonActive: {
    backgroundColor: 'rgba(52, 211, 153, 0.05)',
  },
});
