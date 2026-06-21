import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  FlatList,
  Pressable,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useAuth } from '../../context/AuthContext';
import {
  fetchCollectionsFromBackend,
  fetchCollectionLocations,
  BackendCollection,
  BackendSavedLocation,
} from '../../utils/collectionsApi';

interface CollectionsFloatingIslandProps {
  visible: boolean;
  onClose: () => void;
}

const COLORS = {
  bg: 'rgba(15, 20, 28, 0.88)',
  border: 'rgba(255, 255, 255, 0.12)',
  text: '#F9FAFB',
  textMuted: '#9CA3AF',
  accent: '#34D399',
  accentBg: 'rgba(52, 211, 153, 0.12)',
};

export const CollectionsFloatingIsland = React.memo(function CollectionsFloatingIsland({
  visible,
  onClose,
}: CollectionsFloatingIslandProps) {
  const { isAuthenticated } = useAuth();

  const [collections, setCollections] = useState<BackendCollection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(null);
  const [locations, setLocations] = useState<BackendSavedLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(false);

  useEffect(() => {
    if (visible && isAuthenticated) {
      loadCollections();
    }
  }, [visible, isAuthenticated]);

  const loadCollections = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCollectionsFromBackend();
      setCollections(data);
      if (data.length > 0) {
        setSelectedCollectionId(data[0].id);
        loadLocationsForCollection(data[0].id);
      }
    } catch (error) {
      console.error('Error loading collections:', error);
      Alert.alert('Error', 'No se pudieron cargar tus colecciones');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLocationsForCollection = useCallback(async (collectionId: number) => {
    setLoadingLocations(true);
    try {
      const data = await fetchCollectionLocations(collectionId);
      setLocations(data);
    } catch (error) {
      console.error('Error loading locations:', error);
    } finally {
      setLoadingLocations(false);
    }
  }, []);

  const handleSelectCollection = useCallback((collectionId: number) => {
    setSelectedCollectionId(collectionId);
    loadLocationsForCollection(collectionId);
  }, [loadLocationsForCollection]);

  if (!visible) return null;
  if (!isAuthenticated) {
    return (
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.islandContainer} onPress={e => e.stopPropagation()}>
          <View style={styles.emptyStateContainer}>
            <MaterialIcons name="lock-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyStateText}>Inicia sesión para ver tus colecciones</Text>
          </View>
        </Pressable>
      </Pressable>
    );
  }

  return (
    <Pressable style={styles.overlay} onPress={onClose}>
      <Pressable style={styles.islandContainer} onPress={e => e.stopPropagation()}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mi Colección</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.accent} />
          </View>
        ) : collections.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="bookmark-border" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No tienes colecciones creadas</Text>
          </View>
        ) : (
          <>
            {/* Collection Tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tabsContainer}
              contentContainerStyle={styles.tabsContent}
            >
              {collections.map(collection => (
                <TouchableOpacity
                  key={collection.id}
                  onPress={() => handleSelectCollection(collection.id)}
                  style={[
                    styles.tab,
                    selectedCollectionId === collection.id && styles.tabActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.tabText,
                      selectedCollectionId === collection.id && styles.tabTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {collection.name} ({collection.itemCount})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Items List */}
            <View style={styles.listContainer}>
              {loadingLocations ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={COLORS.accent} />
                </View>
              ) : locations.length === 0 ? (
                <View style={styles.emptyState}>
                  <MaterialIcons name="list" size={40} color={COLORS.textMuted} />
                  <Text style={styles.emptyText}>Sin lugares guardados</Text>
                </View>
              ) : (
                <FlatList
                  data={locations}
                  keyExtractor={item => String(item.id)}
                  renderItem={({ item }) => <LocationItem location={item} />}
                  scrollEnabled={true}
                />
              )}
            </View>
          </>
        )}
      </Pressable>
    </Pressable>
  );
});

const LocationItem = React.memo(function LocationItem({
  location,
}: {
  location: BackendSavedLocation;
}) {
  return (
    <View style={styles.locationItem}>
      <View style={styles.locationIcon}>
        <MaterialIcons
          name={location.locationType === 'event' ? 'calendar-today' : 'location-on'}
          size={20}
          color={COLORS.accent}
        />
      </View>

      <View style={styles.locationContent}>
        <Text style={styles.locationTitle} numberOfLines={1}>
          {location.title}
        </Text>
        {location.notes && (
          <Text style={styles.locationDesc} numberOfLines={2}>
            {location.notes}
          </Text>
        )}
        <Text style={styles.locationCoords}>
          {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
        </Text>
      </View>

      <TouchableOpacity style={styles.locationAction}>
        <MaterialIcons name="chevron-right" size={20} color={COLORS.textMuted} />
      </TouchableOpacity>
    </View>
  );
});

const CollectionTab = React.memo(function CollectionTab({
  collection,
  isActive,
  onPress,
  onDelete,
  onRename,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  collection: Collection;
  isActive: boolean;
  onPress: () => void;
  onDelete: () => void;
  onRename: () => void;
  isDragging?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  const [showActions, setShowActions] = React.useState(false);

  if (collection.id === 'all') {
    return (
      <TouchableOpacity
        onPress={onPress}
        style={[styles.tab, isActive && styles.tabActive]}
      >
        {collection.icon && (
          <MaterialIcons
            name={collection.icon as any}
            size={14}
            color={isActive ? COLORS.accent : COLORS.textMuted}
            style={{ marginRight: 6 }}
          />
        )}
        <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
          {collection.name} ({collection.items.length})
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View
      onMouseEnter={() => Platform.OS === 'web' && setShowActions(true)}
      onMouseLeave={() => Platform.OS === 'web' && setShowActions(false)}
      //@ts-ignore
      style={[styles.tabWrapper, isDragging && styles.tabWrapperDragging]}
    >
      <TouchableOpacity
        onPress={onPress}
        style={[styles.tab, isActive && styles.tabActive]}
      >
        {collection.color && (
          <View
            style={[
              styles.tabColorBadge,
              { backgroundColor: collection.color },
            ]}
          />
        )}
        {collection.icon && (
          <MaterialIcons
            name={collection.icon as any}
            size={14}
            color={isActive ? COLORS.accent : COLORS.textMuted}
            style={{ marginRight: 6 }}
          />
        )}
        <Text style={[styles.tabText, isActive && styles.tabTextActive]} numberOfLines={1}>
          {collection.name} ({collection.items.length})
        </Text>
      </TouchableOpacity>

      {showActions && (
        <View style={styles.tabActions}>
          <TouchableOpacity onPress={onRename} style={styles.tabActionBtn}>
            <MaterialIcons name="edit" size={12} color={COLORS.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={styles.tabActionBtn}>
            <MaterialIcons name="delete" size={12} color={COLORS.accent} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
});

const CollectionItemRow = React.memo(function CollectionItemRow({
  item,
  onPress,
}: {
  item: CollectionItem;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.itemRow} onPress={onPress}>
      <View style={styles.itemImage}>
        {item.imageUrl ? (
          <View style={styles.imagePlaceholder} />
        ) : (
          <MaterialIcons
            name={item.type === 'location' ? 'location-on' : 'calendar-today'}
            size={20}
            color={COLORS.accent}
          />
        )}
      </View>

      <View style={styles.itemContent}>
        <Text style={styles.itemTitle} numberOfLines={1}>
          {item.title}
        </Text>
        {item.description && (
          <Text style={styles.itemDesc} numberOfLines={1}>
            {item.description}
          </Text>
        )}
        <Text style={styles.itemMeta}>
          {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
        </Text>
      </View>

      <TouchableOpacity style={styles.itemAction}>
        <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  islandContainer: {
    width: '90%',
    height: '90%',
    maxWidth: 500,
    borderRadius: 24,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    flexDirection: 'column',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      } as any,
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  closeBtn: {
    padding: 8,
  },
  tabsContainer: {
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  tabsContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabActive: {
    backgroundColor: COLORS.accentBg,
    borderColor: COLORS.accent,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  tabTextActive: {
    color: COLORS.accent,
  },
  listContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  locationIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  locationContent: {
    flex: 1,
  },
  locationTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  locationDesc: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  locationCoords: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  locationAction: {
    padding: 8,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  renameModal: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: COLORS.bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    gap: 16,
  },
  createModal: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: COLORS.bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    gap: 16,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.text,
    fontSize: 14,
  },
  colorLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  colorPicker: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: COLORS.text,
  },
  iconPicker: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  iconOption: {
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'transparent',
    marginRight: 8,
  },
  iconOptionSelected: {
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    borderColor: COLORS.accent,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  modalBtnCancel: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  modalBtnSave: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
  },
  modalBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
  },

  // Tab wrapper for actions
  tabWrapper: {
    position: 'relative',
  },
  tabWrapperDragging: {
    opacity: 0.5,
  },
  tabColorBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  tabActions: {
    position: 'absolute',
    right: 4,
    top: '50%',
    transform: [{ translateY: -16 }],
    flexDirection: 'row',
    gap: 2,
  },
  tabActionBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  islandContainer: {
    width: '90%',
    height: '90%',
    maxWidth: 1200,
    borderRadius: 24,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      } as any,
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  closeBtn: {
    padding: 8,
  },
  tabsContainer: {
    flexGrow: 0,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  tabsContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabActive: {
    backgroundColor: COLORS.accentBg,
    borderColor: COLORS.accent,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  tabTextActive: {
    color: COLORS.accent,
  },
  tabNewCollection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: COLORS.accentBg,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  tabNewText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.accent,
    marginLeft: 4,
  },
  contentWrapper: {
    flex: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  mapSection: {
    flex: 1.5,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    position: 'relative',
    overflow: 'hidden',
  },
  mapPinsContainer: {
    ...StyleSheet.absoluteFill,
    pointerEvents: 'box-none',
  },
  mapPin: {
    position: 'absolute',
    width: 32,
    height: 32,
    marginLeft: -16,
    marginTop: -40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPinInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  mapPinTooltip: {
    position: 'absolute',
    top: -32,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 80,
    maxWidth: 150,
  },
  mapPinTooltipText: {
    fontSize: 11,
    color: COLORS.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  listSection: {
    flex: 1,
    borderLeftWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  itemImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: 'rgba(52, 211, 153, 0.2)',
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  itemDesc: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  itemMeta: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  itemAction: {
    padding: 8,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
});
