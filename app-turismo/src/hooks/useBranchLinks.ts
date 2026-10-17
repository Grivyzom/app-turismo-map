import { useEffect, useState } from 'react';
import { Alert, Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { API_URL } from '../config/api';

/** WhatsApp, web y carta PDF de un comercio (GET /api/v1/branches/{id}/links). */
export interface BranchLinks {
  whatsapp?: string;
  whatsappMessage?: string;
  websiteUrl?: string;
  menuPdfUrl?: string;
  menuPdfSize?: number;
}

// Caché por sesión: abrir el mismo pin varias veces no repite la petición, y
// las peticiones simultáneas al mismo comercio comparten la misma promesa.
const cache = new Map<number, Promise<BranchLinks | null>>();

/** Los comercios llegan del backend como `branch-<id>`; el resto de pines no tiene enlaces. */
export function branchIdOf(eventId: string | number | undefined): number | null {
  const m = /^branch-(\d+)$/.exec(String(eventId ?? ''));
  return m ? Number(m[1]) : null;
}

function fetchBranchLinks(branchId: number): Promise<BranchLinks | null> {
  let p = cache.get(branchId);
  if (!p) {
    p = fetch(`${API_URL}/api/v1/branches/${branchId}/links`)
      .then((r) => (r.ok ? (r.json() as Promise<BranchLinks>) : null))
      .catch(() => null)
      .then((links) => {
        // Un fallo de red no se queda cacheado: se reintenta al volver a abrir el pin
        if (!links) cache.delete(branchId);
        return links;
      });
    cache.set(branchId, p);
  }
  return p;
}

/** Pide los enlaces solo cuando se abre el pin; el payload del mapa no los incluye. */
export function useBranchLinks(eventId: string | number | undefined): BranchLinks | null {
  const branchId = branchIdOf(eventId);
  // Se guarda junto al id para no mostrar enlaces de otro comercio mientras carga el nuevo
  const [state, setState] = useState<{ id: number; links: BranchLinks | null } | null>(null);

  useEffect(() => {
    if (branchId == null) return;
    let alive = true;
    fetchBranchLinks(branchId).then((links) => alive && setState({ id: branchId, links }));
    return () => {
      alive = false;
    };
  }, [branchId]);

  return state && state.id === branchId ? state.links : null;
}

export function hasAnyLink(links: BranchLinks | null): links is BranchLinks {
  return !!links && !!(links.whatsapp || links.websiteUrl || links.menuPdfUrl);
}

export function formatPdfSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Navegador in-app: el usuario ve la web o la carta sin salir de la app. */
export function openInApp(url: string) {
  WebBrowser.openBrowserAsync(url).catch(() =>
    Linking.openURL(url).catch(() => Alert.alert('No se pudo abrir el enlace', url)),
  );
}

/** wa.me abre la app de WhatsApp si está instalada y, si no, WhatsApp Web. */
export function openWhatsapp(links: BranchLinks) {
  if (!links.whatsapp) return;
  const text = links.whatsappMessage ? `?text=${encodeURIComponent(links.whatsappMessage)}` : '';
  const url = `https://wa.me/${links.whatsapp}${text}`;
  Linking.openURL(url).catch(() => Alert.alert('No se pudo abrir WhatsApp', url));
}
