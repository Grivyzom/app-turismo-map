import { API_URL } from '../config/api';

import { getCachedToken, clearTokenCache } from './tokenCache';

export { clearTokenCache };

export interface BackendCollection {
  id: number;
  name: string;
  itemCount: number;
  createdAt: string;
}

export interface BackendSavedLocation {
  id: number;
  collectionId: number;
  locationType: string;
  refId: string;
  latitude: number;
  longitude: number;
  title: string;
  notes: string;
}

export async function fetchCollectionsFromBackend(): Promise<BackendCollection[]> {
  try {
    const token = await getCachedToken();
    if (!token) return [];

    const response = await fetch(`${API_URL}/api/v1/collections`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error('[collectionsApi] Failed to fetch collections:', response.statusText);
      return [];
    }

    return await response.json();
  } catch (error) {
    console.error('[collectionsApi] Error fetching collections:', error);
    return [];
  }
}

export async function fetchCollectionLocations(
  collectionId: number,
): Promise<BackendSavedLocation[]> {
  try {
    const token = await getCachedToken();
    if (!token) return [];

    const response = await fetch(`${API_URL}/api/v1/collections/${collectionId}/locations`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error('[collectionsApi] Failed to fetch locations:', response.statusText);
      return [];
    }

    return await response.json();
  } catch (error) {
    console.error('[collectionsApi] Error fetching locations:', error);
    return [];
  }
}

export async function createCollectionOnBackend(name: string): Promise<BackendCollection | null> {
  try {
    const token = await getCachedToken();
    if (!token) return null;

    const response = await fetch(`${API_URL}/api/v1/collections`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      console.error('[collectionsApi] Failed to create collection:', response.statusText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('[collectionsApi] Error creating collection:', error);
    return null;
  }
}

export async function deleteCollectionOnBackend(collectionId: number): Promise<boolean> {
  try {
    const token = await getCachedToken();
    if (!token) return false;

    const response = await fetch(`${API_URL}/api/v1/collections/${collectionId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.ok;
  } catch (error) {
    console.error('[collectionsApi] Error deleting collection:', error);
    return false;
  }
}

export async function addLocationToCollection(
  collectionId: number,
  location: Omit<BackendSavedLocation, 'id' | 'collectionId' | 'createdAt'>,
): Promise<BackendSavedLocation | null> {
  try {
    const token = await getCachedToken();
    if (!token) return null;

    const response = await fetch(`${API_URL}/api/v1/collections/${collectionId}/locations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(location),
    });

    if (!response.ok) {
      console.error('[collectionsApi] Failed to add location:', response.statusText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('[collectionsApi] Error adding location:', error);
    return null;
  }
}

export async function removeLocationFromCollection(
  collectionId: number,
  locationId: number,
): Promise<boolean> {
  try {
    const token = await getCachedToken();
    if (!token) return false;

    const response = await fetch(
      `${API_URL}/api/v1/collections/${collectionId}/locations/${locationId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    return response.ok;
  } catch (error) {
    console.error('[collectionsApi] Error removing location:', error);
    return false;
  }
}
