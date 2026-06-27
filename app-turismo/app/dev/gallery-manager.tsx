import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  TextInput,
  Image,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

import { pinGalleryApi, PinGalleryData } from '../../src/utils/pinGalleryApi';

export default function GalleryManagerScreen() {
  const [galleries, setGalleries] = useState<PinGalleryData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGallery, setSelectedGallery] = useState<PinGalleryData | null>(null);
  const [isAddingImages, setIsAddingImages] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState('');

  useEffect(() => {
    loadGalleries();
  }, []);

  const loadGalleries = () => {
    const allGalleries = pinGalleryApi.getAllGalleries();
    setGalleries(allGalleries);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim() === '') {
      loadGalleries();
    } else {
      const results = pinGalleryApi.searchGalleries(query);
      setGalleries(results);
    }
  };

  const handleAddImage = async () => {
    if (!selectedGallery || !newImageUrl.trim()) {
      alert('Por favor ingresa una URL de imagen válida');
      return;
    }

    try {
      const updated = await pinGalleryApi.addImageToGallery(selectedGallery.pinId, newImageUrl);
      setSelectedGallery({
        ...selectedGallery,
        images: updated,
      });
      setNewImageUrl('');
      loadGalleries();
      alert('Imagen agregada correctamente');
    } catch (error) {
      alert('Error al agregar imagen: ' + (error as Error).message);
    }
  };

  const handleRemoveImage = async (imageUrl: string) => {
    if (!selectedGallery) return;

    try {
      const updated = await pinGalleryApi.removeImageFromGallery(selectedGallery.pinId, imageUrl);
      setSelectedGallery({
        ...selectedGallery,
        images: updated,
      });
      loadGalleries();
    } catch (error) {
      alert('Error al remover imagen: ' + (error as Error).message);
    }
  };

  const handleDeleteGallery = async (pinId: string) => {
    try {
      await pinGalleryApi.setGallery(pinId, '', '', []);
      setSelectedGallery(null);
      loadGalleries();
      alert('Galería eliminada');
    } catch (error) {
      alert('Error al eliminar galería');
    }
  };

  const filteredGalleries = searchQuery.trim() === '' ? galleries : galleries;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Galería de Pines</Text>
        <View style={{ width: 24 }} />
      </View>

      {!selectedGallery ? (
        <>
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <MaterialIcons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar galería..."
              placeholderTextColor="#6B7280"
              value={searchQuery}
              onChangeText={handleSearch}
            />
            {searchQuery ? (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  loadGalleries();
                }}
              >
                <MaterialIcons name="close" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Galleries List */}
          {galleries.length > 0 ? (
            <FlatList
              data={filteredGalleries}
              keyExtractor={(item) => item.pinId}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.galleryCard}
                  onPress={() => setSelectedGallery(item)}
                >
                  <LinearGradient
                    colors={['rgba(59, 130, 246, 0.2)', 'rgba(59, 130, 246, 0.05)']}
                    style={styles.cardGradient}
                  >
                    <View style={styles.cardContent}>
                      <View>
                        <Text style={styles.cardTitle}>{item.pinTitle}</Text>
                        <Text style={styles.cardCategory}>{item.category}</Text>
                        <Text style={styles.cardImageCount}>
                          {item.images.length} imagen
                          {item.images.length !== 1 ? 'es' : ''}
                        </Text>
                      </View>
                      <MaterialIcons name="chevron-right" size={24} color="#3B82F6" />
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              )}
              scrollEnabled={false}
            />
          ) : (
            <View style={styles.emptyState}>
              <MaterialIcons name="image-not-supported" size={48} color="#6B7280" />
              <Text style={styles.emptyText}>
                {searchQuery ? 'No se encontraron galerías' : 'No hay galerías creadas aún'}
              </Text>
            </View>
          )}
        </>
      ) : (
        <>
          {/* Gallery Detail */}
          <View style={styles.detailHeader}>
            <TouchableOpacity onPress={() => setSelectedGallery(null)}>
              <MaterialIcons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <View style={styles.detailTitleContainer}>
              <Text style={styles.detailTitle}>{selectedGallery.pinTitle}</Text>
              <Text style={styles.detailCategory}>{selectedGallery.category}</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                if (confirm(`¿Eliminar galería de "${selectedGallery.pinTitle}"?`)) {
                  handleDeleteGallery(selectedGallery.pinId);
                }
              }}
            >
              <MaterialIcons name="delete" size={24} color="#EF4444" />
            </TouchableOpacity>
          </View>

          {/* Add Image Section */}
          <View style={styles.addImageSection}>
            <Text style={styles.sectionTitle}>Agregar Imagen</Text>
            <View style={styles.inputGroup}>
              <TextInput
                style={styles.imageInput}
                placeholder="URL de la imagen (https://...)"
                placeholderTextColor="#6B7280"
                value={newImageUrl}
                onChangeText={setNewImageUrl}
                editable={!isAddingImages}
              />
              <TouchableOpacity
                style={[styles.addButton, isAddingImages && styles.addButtonDisabled]}
                onPress={handleAddImage}
                disabled={isAddingImages}
              >
                <MaterialIcons name="add" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Images Grid */}
          <Text style={styles.sectionTitle}>Imágenes ({selectedGallery.images.length})</Text>
          {selectedGallery.images.length > 0 ? (
            <ScrollView
              contentContainerStyle={styles.imagesGrid}
              showsVerticalScrollIndicator={false}
            >
              {selectedGallery.images.map((image, index) => (
                <View key={index} style={styles.imageGridItem}>
                  {image.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                    <Image source={{ uri: image }} style={styles.gridImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.imageEmoji}>
                      <Text style={styles.emojiText}>{image}</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemoveImage(image)}
                  >
                    <MaterialIcons name="close" size={16} color="#FFF" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyImages}>
              <Text style={styles.emptyImagesText}>Sin imágenes</Text>
            </View>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 14,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  galleryCard: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardGradient: {
    padding: 16,
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 4,
  },
  cardCategory: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 8,
    textTransform: 'capitalize',
  },
  cardImageCount: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  detailTitleContainer: {
    flex: 1,
    marginHorizontal: 12,
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  detailCategory: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  addImageSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
  },
  inputGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  imageInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFF',
    fontSize: 13,
  },
  addButton: {
    width: 44,
    height: 44,
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  imagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  imageGridItem: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  imageEmoji: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(100, 100, 100, 0.1)',
  },
  emojiText: {
    fontSize: 32,
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    backgroundColor: 'rgba(239, 68, 68, 0.8)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyImages: {
    marginHorizontal: 16,
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyImagesText: {
    color: '#6B7280',
    fontSize: 14,
  },
});
