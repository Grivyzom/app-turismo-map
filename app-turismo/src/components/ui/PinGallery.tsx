import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Text,
  Pressable,
  Platform,
  Dimensions,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

interface PinGalleryProps {
  images: string[];
  pinTitle: string;
  onImageClick?: (index: number) => void;
  isLightMode?: boolean;
}

export const PinGallery = ({
  images,
  pinTitle,
  onImageClick,
  isLightMode,
}: PinGalleryProps) => {
  const { width } = Dimensions.get('window');
  const galleryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (Platform.OS === 'web' && galleryRef.current && images.length > 1) {
      initLightGallery();
    }
  }, [images]);

  const initLightGallery = async () => {
    try {
      const lightGallery = await import('lightgallery');
      const lgThumbnail = await import('lightgallery/plugins/thumbnail');
      const lgZoom = await import('lightgallery/plugins/zoom');

      const { default: LG } = lightGallery;
      const { default: Thumbnail } = lgThumbnail;
      const { default: Zoom } = lgZoom;

      if (galleryRef.current) {
        LG(galleryRef.current, {
          plugins: [Thumbnail, Zoom],
          speed: 500,
          counter: true,
          licenseKey: 'free',
        } as any);
      }
    } catch (error) {
      console.warn('LightGallery initialization skipped:', error);
    }
  };

  if (Platform.OS === 'web' && images.length > 0) {
    return (
      <div
        ref={galleryRef}
        id={`gallery-${pinTitle.replace(/\s+/g, '-')}`}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: '8px',
          padding: '8px',
          borderRadius: '12px',
          backgroundColor: isLightMode ? '#f5f5f5' : '#1a1a1a',
          marginVertical: '8px',
        } as any}
      >
        {images.map((img, i) => (
          <a
            key={i}
            href={img}
            data-lg-size={`800-600`}
            data-src={img}
            style={{
              cursor: 'pointer',
              overflow: 'hidden',
              borderRadius: '8px',
              display: 'block',
            } as any}
          >
            {img.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
              <img
                src={img}
                alt={`${pinTitle} ${i + 1}`}
                style={{
                  width: '100%',
                  height: '120px',
                  objectFit: 'cover',
                  display: 'block',
                } as any}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '120px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '48px',
                  backgroundColor: 'rgba(100,100,100,0.1)',
                } as any}
              >
                {img}
              </div>
            )}
          </a>
        ))}
      </div>
    );
  }

  // ── Mobile ScrollView ──────────────────────────────────────────
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isLightMode ? '#f5f5f5' : '#1a1a1a' },
      ]}
    >
      {images.length > 0 ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          style={styles.scrollView}
        >
          {images.map((img, i) => (
            <Pressable
              key={i}
              onPress={() => onImageClick?.(i)}
              style={[styles.slide, { width }]}
            >
              {img.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                <Image
                  source={{ uri: img }}
                  style={styles.image}
                  resizeMode="cover"
                />
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
          <Text
            style={[
              styles.emptyText,
              { color: isLightMode ? '#666' : '#999' },
            ]}
          >
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
