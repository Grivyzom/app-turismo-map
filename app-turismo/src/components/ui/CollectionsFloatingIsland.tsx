import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  FlatList,
  Pressable,
  Animated,
  Easing,
  Dimensions,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useCollections } from '../../context/CollectionsContext';
import { Collection, CollectionItem, COLLECTION_COLORS, COLLECTION_ICONS } from '../../types/collections';

interface CollectionsFloatingIslandProps {
  visible: boolean;
  onClose: () => void;
  mapComponent: React.ReactNode;
  onCollectionItemSelect?: (item: CollectionItem) => void;
}

const COLORS = {
  bg: 'rgba(15, 20, 28, 0.88)',
  bgGlass: 'rgba(15, 20, 28, 0.88)',
  border: 'rgba(255, 255, 255, 0.12)',
  text: '#F9FAFB',
  textMuted: '#9CA3AF',
  accent: '#34D399',
  accentBg: 'rgba(52, 211, 153, 0.12)',
};

export const CollectionsFloatingIsland = React.memo(function CollectionsFloatingIsland({
  visible,
  onClose,
  mapComponent,
  onCollectionItemSelect,
}: CollectionsFloatingIslandProps) {
  const {
    collections,
    selectedCollectionId,
    setSelectedCollection,
    createCollection,
    deleteCollection,
    renameCollection,
    reorderCollections,
  } = useCollections();

  const [showNewCollectionModal, setShowNewCollectionModal] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLLECTION_COLORS[0]);
  const [selectedIcon, setSelectedIcon] = useState(COLLECTION_ICONS[0]);
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  const selectedCollection = collections.find(c => c.id === selectedCollectionId);
  const items = selectedCollection?.items || [];

  const handleCreateCollection = useCallback(async () => {
    if (!newCollectionName.trim()) {
      Alert.alert('Error', 'Nombre de colección requerido');
      return;
    }
    try {
      await createCollection(newCollectionName, selectedIcon, selectedColor);
      setNewCollectionName('');
      setSelectedColor(COLLECTION_COLORS[0]);
      setSelectedIcon(COLLECTION_ICONS[0]);
      setShowNewCollectionModal(false);
    } catch (error) {
      Alert.alert('Error', 'No se pudo crear la colección');
    }
  }, [newCollectionName, selectedIcon, selectedColor, createCollection]);

  const handleDeleteCollection = useCallback(async (id: string) => {
    if (id === 'all') return;
    Alert.alert('Eliminar colección', '¿Estás seguro?', [
      { text: 'Cancelar', onPress: () => {} },
      {
        text: 'Eliminar',
        onPress: async () => {
          await deleteCollection(id);
        },
        style: 'destructive',
      },
    ]);
  }, [deleteCollection]);

  const handleStartRename = useCallback((id: string, currentName: string) => {
    setEditingCollectionId(id);
    setEditingName(currentName);
  }, []);

  const handleSaveRename = useCallback(async () => {
    if (!editingCollectionId || !editingName.trim()) return;
    await renameCollection(editingCollectionId, editingName);
    setEditingCollectionId(null);
    setEditingName('');
  }, [editingCollectionId, editingName, renameCollection]);

  const handleReorder = useCallback(
    async (fromIndex: number, toIndex: number) => {
      const newOrder = [...collections];
      const [movedItem] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, movedItem);
      await reorderCollections(newOrder);
    },
    [collections, reorderCollections]
  );

  if (!visible) return null;

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

        {/* Tab Selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsContainer}
          contentContainerStyle={styles.tabsContent}
        >
          {collections.map((collection, index) => (
            <CollectionTab
              key={collection.id}
              collection={collection}
              isActive={selectedCollectionId === collection.id}
              onPress={() => setSelectedCollection(collection.id)}
              onDelete={() => handleDeleteCollection(collection.id)}
              onRename={() => handleStartRename(collection.id, collection.name)}
              isDragging={draggedItem === collection.id}
              onDragStart={() => setDraggedItem(collection.id)}
              onDragEnd={() => setDraggedItem(null)}
            />
          ))}

          <TouchableOpacity
            onPress={() => setShowNewCollectionModal(true)}
            style={styles.tabNewCollection}
          >
            <MaterialIcons name="add" size={14} color={COLORS.accent} />
            <Text style={styles.tabNewText}>Nueva</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Rename Modal */}
        {editingCollectionId && (
          <Modal transparent animationType="fade" visible={!!editingCollectionId}>
            <Pressable style={styles.modalOverlay} onPress={() => setEditingCollectionId(null)}>
              <Pressable style={styles.renameModal} onPress={e => e.stopPropagation()}>
                <Text style={styles.modalTitle}>Renombrar Colección</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Nuevo nombre..."
                  placeholderTextColor={COLORS.textMuted}
                  value={editingName}
                  onChangeText={setEditingName}
                  autoFocus
                />
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalBtnCancel}
                    onPress={() => setEditingCollectionId(null)}
                  >
                    <Text style={styles.modalBtnText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalBtnSave} onPress={handleSaveRename}>
                    <Text style={[styles.modalBtnText, { color: COLORS.text }]}>Guardar</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </Pressable>
          </Modal>
        )}

        {/* Create Collection Modal */}
        <Modal transparent animationType="fade" visible={showNewCollectionModal}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowNewCollectionModal(false)}>
            <Pressable style={styles.createModal} onPress={e => e.stopPropagation()}>
              <Text style={styles.modalTitle}>Crear Colección</Text>

              <TextInput
                style={styles.modalInput}
                placeholder="Nombre de colección..."
                placeholderTextColor={COLORS.textMuted}
                value={newCollectionName}
                onChangeText={setNewCollectionName}
                autoFocus
              />

              <Text style={styles.colorLabel}>Color</Text>
              <View style={styles.colorPicker}>
                {COLLECTION_COLORS.map(color => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color },
                      selectedColor === color && styles.colorOptionSelected,
                    ]}
                    onPress={() => setSelectedColor(color)}
                  >
                    {selectedColor === color && (
                      <Ionicons name="checkmark" size={16} color="#FFF" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.colorLabel}>Icono</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.iconPicker}>
                {COLLECTION_ICONS.map(icon => (
                  <TouchableOpacity
                    key={icon}
                    style={[
                      styles.iconOption,
                      selectedIcon === icon && styles.iconOptionSelected,
                    ]}
                    onPress={() => setSelectedIcon(icon)}
                  >
                    <MaterialIcons
                      name={icon as any}
                      size={20}
                      color={selectedIcon === icon ? COLORS.accent : COLORS.textMuted}
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalBtnCancel}
                  onPress={() => setShowNewCollectionModal(false)}
                >
                  <Text style={styles.modalBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalBtnSave} onPress={handleCreateCollection}>
                  <Text style={[styles.modalBtnText, { color: COLORS.text }]}>Crear</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Content Split: Map + List */}
        <View style={styles.contentWrapper}>
          {/* Map */}
          <View style={styles.mapSection}>
            {mapComponent}
            {/* Collection Items Overlay Pins */}
            <CollectionMapPins
              items={items}
              collectionColor={selectedCollection?.color}
              onItemPress={onCollectionItemSelect}
            />
          </View>

          {/* Items List */}
          <View style={styles.listSection}>
            {items.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialIcons
                  name="bookmark-border"
                  size={48}
                  color={COLORS.textMuted}
                />
                <Text style={styles.emptyText}>
                  {selectedCollection?.id === 'all'
                    ? 'Guarda lugares para verlos aquí'
                    : 'Sin elementos en esta colección'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={items}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                  <CollectionItemRow
                    item={item}
                    onPress={() => {
                      // TODO: Centrar mapa en item
                    }}
                  />
                )}
                scrollEnabled={false}
              />
            )}
          </View>
        </View>

        {/* Footer Actions */}
        {selectedCollection && selectedCollection.id !== 'all' && (
          <View style={styles.footer}>
            <TouchableOpacity style={styles.actionBtn}>
              <Ionicons name="share-social-outline" size={16} color={COLORS.accent} />
              <Text style={styles.actionText}>Compartir</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn}>
              <MaterialIcons name="edit" size={16} color={COLORS.textMuted} />
              <Text style={styles.actionText}>Editar</Text>
            </TouchableOpacity>
          </View>
        )}
      </Pressable>
    </Pressable>
  );
});

const CollectionMapPins = React.memo(function CollectionMapPins({
  items,
  collectionColor,
  onItemPress,
}: {
  items: CollectionItem[];
  collectionColor?: string;
  onItemPress?: (item: CollectionItem) => void;
}) {
  return (
    <View style={styles.mapPinsContainer} pointerEvents="box-none">
      {items.map(item => (
        <TouchableOpacity
          key={item.id}
          style={[
            styles.mapPin,
            {
              left: `${((item.longitude + 180) / 360) * 100}%`,
              top: `${((90 - item.latitude) / 180) * 100}%`,
            },
          ]}
          onPress={() => onItemPress?.(item)}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.mapPinInner,
              { backgroundColor: collectionColor || COLORS.accent },
            ]}
          />
          <View style={styles.mapPinTooltip}>
            <Text style={styles.mapPinTooltipText} numberOfLines={1}>
              {item.title}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
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
