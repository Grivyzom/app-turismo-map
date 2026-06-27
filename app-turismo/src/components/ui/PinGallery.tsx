import React, { useRef, Dimensions } from 'react';
import { View, StyleSheet, ScrollView, Image, Text, Pressable } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

interface PinGalleryProps {
  images: string[];
  pinTitle: string;
  onImageClick?: (index: number) => void;
  isLightMode?: boolean;
}

/**
 * PinGallery: Componente galería compatible con mobile y web.
 * - Mobile: ScrollView horizontal
 * - Web: ScrollView (fallback antes de instalar LightGallery)
 *
 * Para agregar LightGallery en web:
 * 1. npm install lightgallery lg-thumbnail lg-zoom
 * 2. Importar en archivo que lo use (o web-specific wrapper)
 * 3. Inicializar en useEffect con ref
 */
export const PinGallery = ({ images, pinTitle, onImageClick, isLightMode }: PinGalleryProps) => {
  const { width } = Dimensions.get('window');

  return (
    <View style={[styles.container, { backgroundColor: isLightMode ? '#f5f5f5' : '#1a1a1a' }]}>
      {images.length > 0 ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          style={styles.scrollView}
        >
          {images.map((img, i) => (
            <Pressable key={i} onPress={() => onImageClick?.(i)} style={[styles.slide, { width }]}>
              {img.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                <Image source={{ uri: img }} style={styles.image} resizeMode="cover" />
              ) : (
                <View style={styles.emojiSlide}>
                  <Text style={styles.emoji}>{img}</Text>
                </View>
              )}
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.emptyState}>
          <MaterialIcons
            name="image-not-supported"
            size={48}
            color={isLightMode ? '#999' : '#666'}
          />
          <Text style={[styles.emptyText, { color: isLightMode ? '#666' : '#999' }]}>
            Sin imágenes disponibles
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 8,
  },
  scrollView: {
    flex: 1,
  },
  slide: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  emojiSlide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(100,100,100,0.1)',
  },
  emoji: {
    fontSize: 72,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
