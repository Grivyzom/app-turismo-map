import AsyncStorage from '@react-native-async-storage/async-storage';
import { Collection, CollectionItem } from '../types/collections';

const STORAGE_KEY = 'app-turismo.collections';

const DEFAULT_COLLECTIONS: Collection[] = [
  {
    id: 'all',
    name: 'Todos',
    description: 'Todos tus lugares y eventos guardados',
    icon: 'collections',
    color: '#34D399',
    items: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

export async function loadCollections(): Promise<Collection[]> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return DEFAULT_COLLECTIONS;
    }
    return JSON.parse(stored);
  } catch (error) {
    console.error('[collectionsStorage] Error loading collections:', error);
    return DEFAULT_COLLECTIONS;
  }
}

export async function saveCollections(collections: Collection[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(collections));
  } catch (error) {
    console.error('[collectionsStorage] Error saving collections:', error);
  }
}

export async function createCollection(
  name: string,
  icon?: string,
  color?: string
): Promise<Collection> {
  const collections = await loadCollections();

  const newCollection: Collection = {
    id: `collection_${Date.now()}`,
    name,
    icon,
    color,
    items: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  collections.push(newCollection);
  await saveCollections(collections);

  return newCollection;
}

export async function deleteCollection(collectionId: string): Promise<void> {
  const collections = await loadCollections();
  const filtered = collections.filter(c => c.id !== collectionId);
  await saveCollections(filtered);
}

export async function renameCollection(
  collectionId: string,
  newName: string
): Promise<void> {
  const collections = await loadCollections();
  const idx = collections.findIndex(c => c.id === collectionId);
  if (idx >= 0) {
    collections[idx].name = newName;
    collections[idx].updatedAt = Date.now();
    await saveCollections(collections);
  }
}

export async function addItemToCollection(
  collectionId: string,
  item: CollectionItem
): Promise<void> {
  const collections = await loadCollections();

  // Add to specific collection
  const collIdx = collections.findIndex(c => c.id === collectionId);
  if (collIdx >= 0) {
    const existingIdx = collections[collIdx].items.findIndex(i => i.id === item.id);
    if (existingIdx < 0) {
      collections[collIdx].items.push(item);
      collections[collIdx].updatedAt = Date.now();
    }
  }

  // Always add to "Todos" (all)
  const allIdx = collections.findIndex(c => c.id === 'all');
  if (allIdx >= 0) {
    const existingIdx = collections[allIdx].items.findIndex(i => i.id === item.id);
    if (existingIdx < 0) {
      collections[allIdx].items.push(item);
      collections[allIdx].updatedAt = Date.now();
    }
  }

  await saveCollections(collections);
}

export async function removeItemFromCollection(
  collectionId: string,
  itemId: string
): Promise<void> {
  const collections = await loadCollections();
  const idx = collections.findIndex(c => c.id === collectionId);
  if (idx >= 0) {
    collections[idx].items = collections[idx].items.filter(i => i.id !== itemId);
    collections[idx].updatedAt = Date.now();
    await saveCollections(collections);
  }
}

export async function getCollectionItems(collectionId: string): Promise<CollectionItem[]> {
  const collections = await loadCollections();
  const collection = collections.find(c => c.id === collectionId);
  return collection?.items || [];
}

export async function generateShareLink(collectionId: string): Promise<string> {
  const collections = await loadCollections();
  const idx = collections.findIndex(c => c.id === collectionId);
  if (idx >= 0) {
    const shareLink = `https://app.turismo.local/collections/${collectionId}/share/${Date.now()}`;
    collections[idx].shareLink = shareLink;
    collections[idx].isShared = true;
    collections[idx].updatedAt = Date.now();
    await saveCollections(collections);
    return shareLink;
  }
  return '';
}
