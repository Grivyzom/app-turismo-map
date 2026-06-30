import { getAuthTokenAsync, clearAuthTokenAsync } from './authStorage';

let _cache: { value: string; expiresAt: number } | null = null;

function isJwtExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    // exp es Unix timestamp en segundos; damos 30s de margen
    return typeof payload.exp === 'number' && payload.exp - 30 < Date.now() / 1000;
  } catch {
    return true;
  }
}

export async function getCachedToken(): Promise<string | null> {
  if (_cache && Date.now() < _cache.expiresAt) {
    if (isJwtExpired(_cache.value)) {
      _cache = null;
      await clearAuthTokenAsync();
      return null;
    }
    return _cache.value;
  }
  const token = await getAuthTokenAsync();
  if (!token || isJwtExpired(token)) {
    _cache = null;
    if (token) await clearAuthTokenAsync();
    return null;
  }
  _cache = { value: token, expiresAt: Date.now() + 5 * 60_000 };
  return token;
}

export function clearTokenCache(): void {
  _cache = null;
}
