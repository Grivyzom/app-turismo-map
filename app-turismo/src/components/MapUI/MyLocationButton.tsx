import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { useUserLocationContext } from '../../context/UserLocationContext';
import { SelvaTokens } from '../../theme/tokens';

interface MyLocationButtonProps {
  onCenterPress: () => void;
  isDesktop?: boolean;
}

export const MyLocationButton: React.FC<MyLocationButtonProps> = ({ onCenterPress, isDesktop }) => {
  const { userLocation, isLoadingLocation, retryLocation } = useUserLocationContext();
  const btnSize = isDesktop
    ? (SelvaTokens.layout?.buttonSizeDesktop ?? 36)
    : (SelvaTokens.layout?.buttonSizeMobile ?? 44);
  const iconSize = isDesktop
    ? (SelvaTokens.layout?.iconSizeDesktop ?? 18)
    : (SelvaTokens.layout?.iconSizeMobile ?? 22);

  const activeColor = SelvaTokens.colors?.brand?.emeraldLight ?? SelvaTokens.brand?.emeraldLight ?? '#34D399';
  const loadingColor = SelvaTokens.colors?.text?.secondary ?? SelvaTokens.text?.secondary ?? '#94A3B8';
  const inactiveColor = SelvaTokens.colors?.brand?.notroRed ?? SelvaTokens.brand?.notroRed ?? '#EF4444';

  return (
    <TouchableOpacity
      style={[
        styles.controlButton,
        { width: btnSize, height: btnSize },
        userLocation && styles.controlButtonActive,
      ]}
      onPress={() => {
        if (userLocation) {
          onCenterPress();
        } else {
          retryLocation();
        }
      }}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="Mi ubicación"
    >
      <MaterialIcons
        name="my-location"
        size={iconSize}
        color={
          userLocation
            ? activeColor
            : isLoadingLocation
            ? loadingColor
            : inactiveColor
        }
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  controlButton: {
    borderRadius: SelvaTokens.radii?.button ?? 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
  },
  controlButtonActive: {
    backgroundColor: SelvaTokens.colors?.surface?.activeItem ?? 'rgba(16, 185, 129, 0.16)',
  },
});

