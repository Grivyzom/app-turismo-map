/**
 * Traffic Tile Cache Engine
 *
 * Intercepta peticiones de tiles de tráfico via un protocolo custom (traffic-cache://),
 * las cachea en memoria con un TTL (Time To Live), para evitar descargar el tráfico
 * repetidamente si se navega por la misma zona, actualizándose solo cada X tiempo.
 */

import maplibregl from 'maplibre-gl';

export const TRAFFIC_PROTOCOL = 'traffic-cache';

// ─── Configuración ───────────────────────────────────────────────────────────

/** Máximo de tiles en caché LRU antes de evicción */
const MAX_CACHE_ENTRIES = 400;

/** Tiempo de expiración del caché de tráfico en milisegundos (ej: 5 minutos = 300000 ms) */
const TRAFFIC_TTL_MS = 5 * 60 * 1000;

// ─── Cache con TTL ───────────────────────────────────────────────────────────

interface CacheEntry {
  data: ArrayBuffer;
  timestamp: number;
}

class TTLTileCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;

  constructor(maxSize: number = MAX_CACHE_ENTRIES) {
    this.maxSize = maxSize;
  }

  get(key: string): ArrayBuffer | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    const now = Date.now();
    if (now - entry.timestamp > TRAFFIC_TTL_MS) {
      // Expirado
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.data;
  }

  set(key: string, data: ArrayBuffer): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Evict oldest (first entry in Map iteration order)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extrae z, x, y de la URL del protocolo custom */
function parseTileUrl(url: string): { z: number; x: number; y: number } | null {
  // URL format: traffic-cache://{z}/{x}/{y}
  const match = url.match(/traffic-cache:\/\/(\d+)\/(\d+)\/(\d+)/);
  if (!match) return null;
  return {
    z: parseInt(match[1], 10),
    x: parseInt(match[2], 10),
    y: parseInt(match[3], 10),
  };
}

/** Construye la URL real de Google Traffic para un tile dado */
function buildGoogleTrafficUrl(z: number, x: number, y: number): string {
  return `https://mt0.google.com/vt?lyrs=h,traffic|seconds_into_week:-1&style=3&x=${x}&y=${y}&z=${z}&scale=2`;
}

// ─── Traffic Tile Cache Engine ─────────────────────────────────────────────

let instance: TrafficTileCache | null = null;

export class TrafficTileCache {
  private cache: TTLTileCache;
  private registered = false;

  constructor(maxCacheSize: number = MAX_CACHE_ENTRIES) {
    this.cache = new TTLTileCache(maxCacheSize);
  }

  /** Obtiene la instancia singleton del caché */
  static getInstance(): TrafficTileCache {
    if (!instance) {
      instance = new TrafficTileCache();
    }
    return instance;
  }

  /** Registra el protocolo custom en MapLibre */
  registerProtocol(): void {
    if (this.registered) return;

    maplibregl.addProtocol(
      TRAFFIC_PROTOCOL,
      async (
        params: { url: string },
        abortController: AbortController,
      ): Promise<{ data: ArrayBuffer }> => {
        const parsed = parseTileUrl(params.url);
        if (!parsed) {
          throw new Error(`Invalid traffic tile URL: ${params.url}`);
        }

        const { z, x, y } = parsed;
        const key = `${z}/${x}/${y}`;

        // 1. Cache hit (not expired) → servir directamente
        const cached = this.cache.get(key);
        if (cached) {
          return { data: cached };
        }

        // 2. Cache miss o expirado → fetch del tile original desde Google
        const realUrl = buildGoogleTrafficUrl(z, x, y);
        const response = await fetch(realUrl, {
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`Traffic Tile fetch error: ${response.status} ${response.statusText}`);
        }

        const data = await response.arrayBuffer();

        // 3. Cachear resultado
        this.cache.set(key, data);

        return { data };
      },
    );

    this.registered = true;
  }

  /** Desregistra el protocolo custom */
  unregisterProtocol(): void {
    if (!this.registered) return;
    try {
      maplibregl.removeProtocol(TRAFFIC_PROTOCOL);
    } catch {
      // Protocol might already be removed
    }
    this.registered = false;
  }

  /** Limpia todo el caché */
  clear(): void {
    this.cache.clear();
  }

  /** Limpia todo y desregistra */
  destroy(): void {
    this.unregisterProtocol();
    this.cache.clear();
    if (instance === this) {
      instance = null;
    }
  }
}
