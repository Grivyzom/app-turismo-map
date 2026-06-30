import { API_URL } from '../config/api';

import { getCachedToken } from './tokenCache';

export interface MyProfile {
  id: number;
  name: string;
  email: string;
  picture: string;
  bio: string;
  userType: string;
  followerCount: number;
  followingCount: number;
}

export interface PublicUserProfile {
  id: number;
  name: string;
  picture: string;
  bio: string;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
}

export interface UserSearchResult {
  id: number;
  name: string;
  picture: string;
  followerCount: number;
  isFollowing: boolean;
}

export async function getMyProfile(): Promise<MyProfile | null> {
  try {
    const token = await getCachedToken();
    if (!token) return null;
    const res = await fetch(`${API_URL}/api/v1/profile/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function updateProfile(data: { name: string; bio: string }): Promise<boolean> {
  try {
    const token = await getCachedToken();
    if (!token) return false;
    const res = await fetch(`${API_URL}/api/v1/profile`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export type UploadAvatarResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export async function uploadAvatar(imageUri: string): Promise<UploadAvatarResult> {
  try {
    const token = await getCachedToken();
    if (!token) return { ok: false, error: 'Sin sesión activa' };

    const formData = new FormData();

    if (imageUri.startsWith('data:')) {
      // Web: data URI → Blob
      const res = await fetch(imageUri);
      const blob = await res.blob();
      formData.append('avatar', blob, 'avatar.jpg');
    } else {
      // Mobile: file URI — cast necesario para React Native FormData
      formData.append('avatar', {
        uri: imageUri,
        name: 'avatar.jpg',
        type: 'image/jpeg',
      } as unknown as Blob);
    }

    const uploadRes = await fetch(`${API_URL}/api/v1/profile/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!uploadRes.ok) {
      const errData = await uploadRes.json().catch(() => ({}));
      const msg = (errData as { error?: string }).error ?? 'No se pudo subir la imagen';
      return { ok: false, error: msg };
    }
    const data = await uploadRes.json();
    const url = (data.pictureUrl as string) ?? null;
    if (!url) return { ok: false, error: 'Respuesta inválida del servidor' };
    return { ok: true, url };
  } catch {
    return { ok: false, error: 'Error de conexión' };
  }
}

export async function getPublicProfile(userId: number): Promise<PublicUserProfile | null> {
  try {
    const token = await getCachedToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_URL}/api/v1/users/${userId}/profile`, { headers });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function followUser(userId: number): Promise<boolean> {
  try {
    const token = await getCachedToken();
    if (!token) return false;
    const res = await fetch(`${API_URL}/api/v1/users/${userId}/follow`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function unfollowUser(userId: number): Promise<boolean> {
  try {
    const token = await getCachedToken();
    if (!token) return false;
    const res = await fetch(`${API_URL}/api/v1/users/${userId}/follow`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  try {
    const token = await getCachedToken();
    if (!token) return [];
    const res = await fetch(`${API_URL}/api/v1/users/search?q=${encodeURIComponent(query)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}
