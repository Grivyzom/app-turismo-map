import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Animated, { ZoomIn, ZoomOut } from 'react-native-reanimated';
import { FurniturePOI } from '../../../data/mobiliarioData';

interface FurnitureMarkerProps {
  item: FurniturePOI;
  isDark?: boolean;
  isSelected?: boolean;
  onPress?: () => void;
}

export const FurnitureMarker: React.FC<FurnitureMarkerProps> = React.memo(({ item, isDark = true, isSelected = false, onPress }) => {
  const icon = useMemo(() => {
    switch (item.amenity) {
      case 'bench':
        return <MaterialIcons name="chair" size={16} color={isDark ? '#A0AEC0' : '#4A5568'} />;
      case 'waste_basket':
        return <MaterialIcons name="delete" size={16} color={isDark ? '#A0AEC0' : '#4A5568'} />;
      case 'drinking_water':
        return <MaterialIcons name="water-drop" size={16} color="#63B3ED" />;
      case 'toilets':
        return <MaterialIcons name="wc" size={16} color={isDark ? '#A0AEC0' : '#4A5568'} />;
      default:
        return <MaterialIcons name="place" size={16} color={isDark ? '#A0AEC0' : '#4A5568'} />;
    }
  }, [item.amenity, isDark]);

  const displayName = useMemo(() => {
    switch (item.amenity) {
      case 'bench':
        return 'Banco / Asiento';
      case 'waste_basket':
        return 'Basurero';
      case 'drinking_water':
        return 'Punto de Agua Potable';
      case 'toilets':
        return 'Baños Públicos';
      default:
        return 'Mobiliario Urbano';
    }
  }, [item.amenity]);

  const textColor = isDark ? '#F0F1F2' : '#191C1D';
  const bgColor = isDark ? 'rgba(34, 34, 34, 0.95)' : '#FFFFFF';
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0,0,0,0.05)';

  return (
    <Marker
      coordinate={{ latitude: item.latitude, longitude: item.longitude }}
      tracksViewChanges={isSelected} // Permite actualizar cambios cuando se activa la selección
      anchor={{ x: 0.5, y: isSelected ? 1 : 0.5 }}
      style={{ zIndex: isSelected ? 9999 : 1 }}
      onPress={onPress}
    >
      <View style={styles.container}>
        {isSelected && (
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
            <Text style={[styles.tooltipText, { color: textColor }]}>
              {displayName}
            </Text>
            <View style={[styles.pointer, { borderTopColor: bgColor }]} />
          </Animated.View>
        )}
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.9)',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: isSelected ? '#10B981' : isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            elevation: 5,
          }}
        >
          {icon}
        </View>
      </View>
    </Marker>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 8,
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
  pointer: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    position: 'absolute',
    bottom: -6,
    alignSelf: 'center',
  },
});
