/**
 * Smart Satellite Tile Cache Engine
 *
 * Intercepta peticiones de tiles satelitales via un protocolo custom (hd-esri://),
 * las cachea en memoria con evicción LRU, y provee compositing de tiles de alta
 * resolución para servir calidad superior cuando el usuario hace zoom out.
 *
 * Arquitectura:
 * 1. addProtocol('hd-esri') → intercepta todas las peticiones de tiles
 * 2. Cache hit → sirve instantáneamente desde memoria
 * 3. Cache miss → fetch del tile original, cachea, y sirve
 * 4. Reverse overzooming → cuando se solicita un tile de zoom bajo y existen
 *    tiles de zoom más alto en caché, los compone en un Canvas para obtener
 *    un tile de calidad visual superior.
 */

import maplibregl from 'maplibre-gl';

import { TileCacheStats } from '../components/Map/types';
import { HD_ESRI_PROTOCOL } from '../config/mapStyles.web';

// ─── Configuración ───────────────────────────────────────────────────────────

/** Máximo de tiles en caché LRU antes de evicción */
const MAX_CACHE_ENTRIES = 600;

/** Máxima diferencia de zoom para compositing (ej: 2 = componer hasta 16 tiles) */
const MAX_COMPOSITE_ZOOM_DIFF = 2;

/** Tamaño de tile estándar en píxeles */
const TILE_SIZE = 256;

// ─── LRU Cache ───────────────────────────────────────────────────────────────

class LRUTileCache {
  private cache = new Map<string, ArrayBuffer>();
  private maxSize: number;
  private hits = 0;
  private misses = 0;

  constructor(maxSize: number = MAX_CACHE_ENTRIES) {
    this.maxSize = maxSize;
  }

  get(key: string): ArrayBuffer | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
      this.hits++;
      return value;
    }
    this.misses++;
    return undefined;
  }

  set(key: string, value: ArrayBuffer): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Evict oldest (first entry in Map iteration order)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, value);
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  /** Verifica si tenemos todos los sub-tiles de un nivel de zoom superior para una celda dada */
  getChildTiles(z: number, x: number, y: number, targetZ: number): ArrayBuffer[] | null {
    if (targetZ <= z) return null;
    const diff = targetZ - z;
    const count = Math.pow(2, diff);
    const tiles: ArrayBuffer[] = [];

    for (let dy = 0; dy < count; dy++) {
      for (let dx = 0; dx < count; dx++) {
        const childX = x * count + dx;
        const childY = y * count + dy;
        const key = tileKey(targetZ, childX, childY);
        const tile = this.cache.get(key);
        if (!tile) return null; // Missing at least one child tile
        tiles.push(tile);
      }
    }
    return tiles;
  }

  get size(): number {
    return this.cache.size;
  }

  get memoryBytes(): number {
    let total = 0;
    for (const buf of this.cache.values()) {
      total += buf.byteLength;
    }
    return total;
  }

  get hitRate(): number {
    const total = this.hits + this.misses;
    return total > 0 ? this.hits / total : 0;
  }

  getStats(): TileCacheStats {
    return {
      totalTiles: this.cache.size,
      memoryMB: Math.round((this.memoryBytes / (1024 * 1024)) * 10) / 10,
      hitRate: Math.round(this.hitRate * 100) / 100,
    };
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Genera la key del caché para un tile dado */
function tileKey(z: number, x: number, y: number): string {
  return `${z}/${x}/${y}`;
}

/** Extrae z, x, y de la URL del protocolo custom */
function parseTileUrl(url: string): { z: number; x: number; y: number } | null {
  // URL format: hd-esri://services.arcgisonline.com/.../tile/{z}/{y}/{x}
  const match = url.match(/\/tile\/(\d+)\/(\d+)\/(\d+)/);
  if (!match) return null;
  return {
    z: parseInt(match[1], 10),
    y: parseInt(match[2], 10),
    x: parseInt(match[3], 10),
  };
}

/** Construye la URL real de ESRI para un tile dado */
function buildEsriUrl(z: number, y: number, x: number): string {
  return `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
}

// ─── Tile Compositor ─────────────────────────────────────────────────────────

/**
 * Compone múltiples tiles de un nivel de zoom superior en un solo tile
 * de nivel de zoom inferior, produciendo un resultado de mayor calidad visual.
 *
 * Ej: 4 tiles de zoom 19 → 1 tile de zoom 18 con calidad de zoom 19
 */
async function compositeTiles(childTiles: ArrayBuffer[], zoomDiff: number): Promise<ArrayBuffer> {
  const gridSize = Math.pow(2, zoomDiff); // 2 for 1 level diff, 4 for 2 levels
  const subTileSize = TILE_SIZE / gridSize;

  const canvas = document.createElement('canvas');
  canvas.width = TILE_SIZE;
  canvas.height = TILE_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot create 2D context for compositing');

  // Decodificar todos los tiles a ImageBitmap
  const bitmaps = await Promise.all(
    childTiles.map((buf) => {
      const blob = new Blob([buf], { type: 'image/png' });
      return createImageBitmap(blob);
    }),
  );

  // Dibujar cada sub-tile en su posición correspondiente
  for (let dy = 0; dy < gridSize; dy++) {
    for (let dx = 0; dx < gridSize; dx++) {
      const idx = dy * gridSize + dx;
      const bitmap = bitmaps[idx];
      ctx.drawImage(bitmap, dx * subTileSize, dy * subTileSize, subTileSize, subTileSize);
      bitmap.close(); // Liberar memoria del bitmap
    }
  }

  // Convertir el canvas a ArrayBuffer (PNG)
  return new Promise<ArrayBuffer>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas toBlob failed'));
          return;
        }
        blob.arrayBuffer().then(resolve).catch(reject);
      },
      'image/png',
      1.0,
    );
  });
}

// ─── Satellite Tile Cache Engine ─────────────────────────────────────────────

let instance: SatelliteTileCache | null = null;

export class SatelliteTileCache {
  private cache: LRUTileCache;
  private registered = false;
  private statsCallback: ((stats: TileCacheStats) => void) | null = null;
  private statsIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor(maxCacheSize: number = MAX_CACHE_ENTRIES) {
    this.cache = new LRUTileCache(maxCacheSize);
  }

  /** Obtiene la instancia singleton del caché */
  static getInstance(): SatelliteTileCache {
    if (!instance) {
      instance = new SatelliteTileCache();
    }
    return instance;
  }

  /** Registra el protocolo custom en MapLibre */
  registerProtocol(): void {
    if (this.registered) return;

    maplibregl.addProtocol(
      HD_ESRI_PROTOCOL,
      async (
        params: { url: string },
        abortController: AbortController,
      ): Promise<{ data: ArrayBuffer }> => {
        const parsed = parseTileUrl(params.url);
        if (!parsed) {
          throw new Error(`Invalid tile URL: ${params.url}`);
        }

        const { z, x, y } = parsed;
        const key = tileKey(z, x, y);

        // 1. Cache hit → servir directamente
        const cached = this.cache.get(key);
        if (cached) {
          return { data: cached };
        }

        // 2. Intentar compositing con tiles de zoom superior (reverse overzooming)
        const composited = await this.tryComposite(z, x, y);
        if (composited) {
          this.cache.set(key, composited);
          return { data: composited };
        }

        // 3. Cache miss → fetch del tile original desde ESRI
        const realUrl = buildEsriUrl(z, y, x);
        const response = await fetch(realUrl, {
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`Tile fetch error: ${response.status} ${response.statusText}`);
        }

        const data = await response.arrayBuffer();
        this.cache.set(key, data);

        return { data };
      },
    );

    this.registered = true;
  }

  /** Intenta componer un tile usando tiles de zoom superior cacheados */
  private async tryComposite(z: number, x: number, y: number): Promise<ArrayBuffer | null> {
    // Intentar con cada nivel de zoom superior, empezando por el más cercano
    for (let diff = 1; diff <= MAX_COMPOSITE_ZOOM_DIFF; diff++) {
      const targetZ = z + diff;
      const childTiles = this.cache.getChildTiles(z, x, y, targetZ);
      if (childTiles) {
        try {
          return await compositeTiles(childTiles, diff);
        } catch {
          // Si el compositing falla, continuar con el siguiente nivel
          continue;
        }
      }
    }
    return null;
  }

  /** Desregistra el protocolo custom */
  unregisterProtocol(): void {
    if (!this.registered) return;
    try {
      maplibregl.removeProtocol(HD_ESRI_PROTOCOL);
    } catch {
      // Protocol might already be removed
    }
    this.registered = false;
  }

  /** Activa el reporting periódico de estadísticas */
  startStatsReporting(callback: (stats: TileCacheStats) => void, intervalMs = 2000): void {
    this.stopStatsReporting();
    this.statsCallback = callback;
    // Report initial stats
    callback(this.cache.getStats());
    this.statsIntervalId = setInterval(() => {
      if (this.statsCallback) {
        this.statsCallback(this.cache.getStats());
      }
    }, intervalMs);
  }

  /** Detiene el reporting de estadísticas */
  stopStatsReporting(): void {
    if (this.statsIntervalId) {
      clearInterval(this.statsIntervalId);
      this.statsIntervalId = null;
    }
    this.statsCallback = null;
  }

  /** Obtiene estadísticas actuales del caché */
  getStats(): TileCacheStats {
    return this.cache.getStats();
  }

  /** Limpia todo el caché */
  clear(): void {
    this.cache.clear();
  }

  /** Limpia todo y desregistra */
  destroy(): void {
    this.stopStatsReporting();
    this.unregisterProtocol();
    this.cache.clear();
    if (instance === this) {
      instance = null;
    }
  }
}
