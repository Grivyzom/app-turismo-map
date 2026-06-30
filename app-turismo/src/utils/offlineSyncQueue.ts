import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_URL } from '../config/api';

import { getCachedToken } from './tokenCache';

export interface QueuedReport {
  id: string;
  payload: any;
  timestamp: number;
  retries: number;
}

const OFFLINE_QUEUE_KEY = '@turismo_offline_reports';
const TTL_MS = 12 * 60 * 60 * 1000;
const MAX_RETRIES = 3;

export async function enqueueReport(payload: any): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    const queue: QueuedReport[] = raw ? JSON.parse(raw) : [];

    queue.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      payload,
      timestamp: Date.now(),
      retries: 0,
    });

    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error('[OfflineSync] Error al encolar reporte:', error);
  }
}

export async function syncPendingReports(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return;

    const queue: QueuedReport[] = JSON.parse(raw);
    if (queue.length === 0) return;

    const now = Date.now();
    const valid = queue.filter((r) => now - r.timestamp < TTL_MS && r.retries < MAX_RETRIES);

    const discarded = queue.length - valid.length;
    if (discarded > 0) {
      console.log(`[OfflineSync] Descartados ${discarded} reportes (TTL o reintentos agotados).`);
    }

    const token = await getCachedToken();
    const failed: QueuedReport[] = [];

    await Promise.all(
      valid.map(async (report) => {
        try {
          const res = await fetch(`${API_URL}/api/v1/reports`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(report.payload),
          });

          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        } catch (err) {
          console.error(`[OfflineSync] Falló reporte ${report.id}:`, err);
          failed.push({ ...report, retries: report.retries + 1 });
        }
      }),
    );

    if (failed.length > 0) {
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(failed));
      console.log(`[OfflineSync] ${failed.length} reportes retenidos para reintento.`);
    } else {
      await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
      console.log(`[OfflineSync] Cola vaciada. ${valid.length} reportes enviados.`);
    }
  } catch (error) {
    console.error('[OfflineSync] Error sincronizando:', error);
  }
}
