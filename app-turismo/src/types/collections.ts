// Tipos para el sistema de colecciones

export type CollectionItemType = 'location' | 'event';

export interface CollectionItem {
  id: string;
  type: CollectionItemType;
  title: string;
  description?: string;
  latitude: number;
  longitude: number;
  category?: string;
  imageUrl?: string;
  savedAt: number; // timestamp
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  items: CollectionItem[];
  createdAt: number;
  updatedAt: number;
  isShared?: boolean;
  shareLink?: string;
}

export interface CollectionsState {
  collections: Collection[];
  selectedCollectionId: string | null;
  loading: boolean;
  error: string | null;
}

export const COLLECTION_COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#FFE66D', // Yellow
  '#95E1D3', // Mint
  '#F38181', // Pink
  '#AA96DA', // Purple
  '#FCBAD3', // Light Pink
  '#A8D8EA', // Light Blue
];

export const COLLECTION_ICONS = [
  'favorite',
  'bookmark',
  'star',
  'pin-drop',
  'location-on',
  'map',
  'compass',
  'place',
];
