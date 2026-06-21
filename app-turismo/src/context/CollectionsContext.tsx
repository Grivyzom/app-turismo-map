import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Collection, CollectionItem, CollectionsState } from '../types/collections';
import {
  loadCollections,
  saveCollections,
  createCollection,
  deleteCollection,
  renameCollection,
  addItemToCollection,
  removeItemFromCollection,
  getCollectionItems,
  generateShareLink,
} from '../utils/collectionsStorage';

interface CollectionsContextType extends CollectionsState {
  createCollection: (name: string, icon?: string, color?: string) => Promise<Collection>;
  deleteCollection: (id: string) => Promise<void>;
  renameCollection: (id: string, newName: string) => Promise<void>;
  addItem: (collectionId: string, item: CollectionItem) => Promise<void>;
  removeItem: (collectionId: string, itemId: string) => Promise<void>;
  setSelectedCollection: (id: string | null) => void;
  shareCollection: (id: string) => Promise<string>;
  reorderCollections: (newOrder: Collection[]) => Promise<void>;
  refresh: () => Promise<void>;
}

const CollectionsContext = createContext<CollectionsContextType | undefined>(undefined);

export function CollectionsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CollectionsState>({
    collections: [],
    selectedCollectionId: 'all',
    loading: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      const collections = await loadCollections();
      setState(prev => ({
        ...prev,
        collections,
        loading: false,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCreateCollection = useCallback(
    async (name: string, icon?: string, color?: string): Promise<Collection> => {
      const collection = await createCollection(name, icon, color);
      await refresh();
      return collection;
    },
    [refresh]
  );

  const handleDeleteCollection = useCallback(
    async (id: string) => {
      await deleteCollection(id);
      setState(prev => ({
        ...prev,
        selectedCollectionId: prev.selectedCollectionId === id ? 'all' : prev.selectedCollectionId,
      }));
      await refresh();
    },
    [refresh]
  );

  const handleRenameCollection = useCallback(
    async (id: string, newName: string) => {
      await renameCollection(id, newName);
      await refresh();
    },
    [refresh]
  );

  const handleAddItem = useCallback(
    async (collectionId: string, item: CollectionItem) => {
      await addItemToCollection(collectionId, item);
      await refresh();
    },
    [refresh]
  );

  const handleRemoveItem = useCallback(
    async (collectionId: string, itemId: string) => {
      await removeItemFromCollection(collectionId, itemId);
      await refresh();
    },
    [refresh]
  );

  const handleShareCollection = useCallback(
    async (id: string): Promise<string> => {
      const link = await generateShareLink(id);
      await refresh();
      return link;
    },
    [refresh]
  );

  const handleReorderCollections = useCallback(
    async (newOrder: Collection[]) => {
      await saveCollections(newOrder);
      await refresh();
    },
    [refresh]
  );

  const value: CollectionsContextType = {
    ...state,
    createCollection: handleCreateCollection,
    deleteCollection: handleDeleteCollection,
    renameCollection: handleRenameCollection,
    addItem: handleAddItem,
    removeItem: handleRemoveItem,
    setSelectedCollection: (id) =>
      setState(prev => ({ ...prev, selectedCollectionId: id })),
    shareCollection: handleShareCollection,
    reorderCollections: handleReorderCollections,
    refresh,
  };

  return (
    <CollectionsContext.Provider value={value}>
      {children}
    </CollectionsContext.Provider>
  );
}

export function useCollections(): CollectionsContextType {
  const context = useContext(CollectionsContext);
  if (!context) {
    throw new Error('useCollections must be used within CollectionsProvider');
  }
  return context;
}
