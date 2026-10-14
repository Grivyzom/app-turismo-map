import { useCallback, useEffect, useMemo, useState } from 'react';

import { API_URL } from '../../config/api';

export interface MobileNotification {
  id: number;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

/** El backend responde en camelCase; se aceptan también claves snake_case por compatibilidad. */
function normalize(raw: Record<string, unknown>): MobileNotification {
  return {
    id: Number(raw.id),
    type: String(raw.type ?? 'info'),
    title: String(raw.title ?? ''),
    message: String(raw.message ?? ''),
    isRead: Boolean(raw.isRead ?? raw.is_read),
    createdAt: String(raw.createdAt ?? raw.created_at ?? ''),
  };
}

async function fetchNotifications(token: string): Promise<MobileNotification[]> {
  const res = await fetch(`${API_URL}/api/v1/notifications`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (data.notifications ?? []).map(normalize);
}

interface LoadResult {
  /** Petición que produjo este resultado (token + nº de recarga). */
  key: string;
  token: string;
  items: MobileNotification[];
  error: string | null;
}

/**
 * Avisos del usuario (GET /api/v1/notifications). Sin sesión la lista queda vacía:
 * el badge del header solo aparece cuando de verdad hay avisos sin leer.
 */
export function useMobileNotifications(token: string | null) {
  const [reloads, setReloads] = useState(0);
  const [result, setResult] = useState<LoadResult | null>(null);
  const key = `${token}:${reloads}`;

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchNotifications(token)
      .then((items) => !cancelled && setResult({ key, token, items, error: null }))
      .catch(() => {
        if (cancelled) return;
        setResult((prev) => ({
          key,
          token,
          items: prev?.token === token ? prev.items : [],
          error: 'No pudimos cargar tus avisos.',
        }));
      });
    return () => {
      cancelled = true;
    };
  }, [token, key]);

  const current = token && result?.token === token ? result : null;
  const items = useMemo(() => current?.items ?? [], [current]);

  const refresh = useCallback(() => setReloads((n) => n + 1), []);

  const markRead = useCallback(
    (ids: number[]) => {
      if (!token || ids.length === 0) return;
      setResult((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((n) => (ids.includes(n.id) ? { ...n, isRead: true } : n)),
            }
          : prev,
      );
      ids.forEach((id) =>
        fetch(`${API_URL}/api/v1/notifications/${id}/read`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {}),
      );
    },
    [token],
  );

  const markAsRead = useCallback((id: number) => markRead([id]), [markRead]);
  const markAllAsRead = useCallback(
    () => markRead(items.filter((n) => !n.isRead).map((n) => n.id)),
    [items, markRead],
  );

  return {
    items,
    unreadCount: items.filter((n) => !n.isRead).length,
    loading: !!token && result?.key !== key,
    error: current?.error ?? null,
    refresh,
    markAsRead,
    markAllAsRead,
  };
}
