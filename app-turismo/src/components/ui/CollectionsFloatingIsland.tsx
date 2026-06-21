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
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useCollections } from '../../context/CollectionsContext';
import { Collection, CollectionItem } from '../../types/collections';

interface CollectionsFloatingIslandProps {
  visible: boolean;
  onClose: () => void;
  mapComponent: React.ReactNode; // Componente mapa a renderizar
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
}: CollectionsFloatingIslandProps) {
  const { collections, selectedCollectionId, setSelectedCollection } = useCollections();
  const [showNewCollectionModal, setShowNewCollectionModal] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');

  const selectedCollection = collections.find(c => c.id === selectedCollectionId);
  const items = selectedCollection?.items || [];

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
          {collections.map(collection => (
            <TouchableOpacity
              key={collection.id}
              onPress={() => setSelectedCollection(collection.id)}
              style={[
                styles.tab,
                selectedCollectionId === collection.id && styles.tabActive,
              ]}
            >
              {collection.icon && (
                <MaterialIcons
                  name={collection.icon as any}
                  size={14}
                  color={selectedCollectionId === collection.id ? COLORS.accent : COLORS.textMuted}
                  style={{ marginRight: 6 }}
                />
              )}
              <Text
                style={[
                  styles.tabText,
                  selectedCollectionId === collection.id && styles.tabTextActive,
                ]}
              >
                {collection.name}
                {collection.id !== 'all' && ` (${collection.items.length})`}
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            onPress={() => setShowNewCollectionModal(true)}
            style={styles.tabNewCollection}
          >
            <MaterialIcons name="add" size={14} color={COLORS.accent} />
            <Text style={styles.tabNewText}>Nueva</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Content Split: Map + List */}
        <View style={styles.contentWrapper}>
          {/* Map */}
          <View style={styles.mapSection}>
            {mapComponent}
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
