import React, { useRef, useEffect } from 'react';
import { View, Text, Image, FlatList, TouchableOpacity, Dimensions, StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.75;
const SPACING = 16;

export interface PlaceItem {
  id: string | number;
  name: string;
  category: string;
  imageUrl?: string;
  rating?: number;
  reviews?: number;
  distance?: string; // e.g., "1.2 km"
}

interface BottomPlaceCarouselProps {
  data: PlaceItem[];
  visible: boolean;
  onPlacePress?: (place: PlaceItem) => void;
  className?: string;
}

export function BottomPlaceCarousel({ data, visible, onPlacePress, className = '' }: BottomPlaceCarouselProps) {
  const flatListRef = useRef<FlatList>(null);

  // When data changes, scroll back to start
  useEffect(() => {
    if (data.length > 0 && flatListRef.current) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
    }
  }, [data]);

  if (!visible || data.length === 0) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(400).springify()}
      exiting={FadeOutDown.duration(300)}
      style={styles.wrapper}
      className={className}
    >
      <FlatList
        ref={flatListRef}
        data={data}
        keyExtractor={(item) => item.id.toString()}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + SPACING}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: SPACING }}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => onPlacePress?.(item)}
            style={[styles.card, { width: CARD_WIDTH, marginRight: SPACING }]}
            className="bg-white rounded-2xl overflow-hidden"
          >
            {/* Imagen Principal */}
            <View className="h-32 w-full bg-gray-200">
              {item.imageUrl ? (
                <Image 
                  source={{ uri: item.imageUrl }} 
                  className="w-full h-full" 
                  resizeMode="cover"
                />
              ) : (
                <View className="flex-1 items-center justify-center bg-gray-100">
                  <MaterialIcons name="image-not-supported" size={32} color="#9ca3af" />
                </View>
              )}
              {/* Badge de Categoría */}
              <View className="absolute top-3 left-3 bg-black/60 px-2 py-1 rounded-md backdrop-blur-md">
                <Text className="text-white text-xs font-semibold uppercase">{item.category}</Text>
              </View>
            </View>

            {/* Info del Lugar */}
            <View className="p-4">
              <Text className="text-lg font-bold text-gray-900 mb-1" numberOfLines={1}>
                {item.name}
              </Text>
              
              <View className="flex-row items-center mt-1">
                {/* Rating */}
                {item.rating && (
                  <View className="flex-row items-center mr-3">
                    <MaterialIcons name="star" size={16} color="#fbbf24" />
                    <Text className="text-sm font-medium text-gray-700 ml-1">
                      {item.rating} <Text className="text-gray-400 font-normal">({item.reviews || 0})</Text>
                    </Text>
                  </View>
                )}
                {/* Distancia */}
                {item.distance && (
                  <View className="flex-row items-center">
                    <MaterialIcons name="location-on" size={16} color="#6b7280" />
                    <Text className="text-sm text-gray-600 ml-1">{item.distance}</Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Anclado abajo (NativeWind no aplica className de posición sobre Animated.View en web).
  wrapper: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  }
});
