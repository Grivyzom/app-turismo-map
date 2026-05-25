import AsyncStorage from '@react-native-async-storage/async-storage';

export interface QueuedReport {
  id: string;
  payload: any;
  timestamp: number;
}

const OFFLINE_QUEUE_KEY = '@turismo_offline_reports';
// 12 hours in milliseconds
const TTL_MS = 12 * 60 * 60 * 1000; 

/**
 * Agrega un reporte a la cola offline.
 */
export async function enqueueReport(payload: any): Promise<void> {
  try {
    const currentQueueStr = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    let queue: QueuedReport[] = currentQueueStr ? JSON.parse(currentQueueStr) : [];
    
    const newReport: QueuedReport = {
      id: Date.now().toString() + Math.random().toString(36).substring(7),
      payload,
      timestamp: Date.now(),
    };
    
    queue.push(newReport);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    console.log('[OfflineSync] Reporte encolado:', newReport.id);
  } catch (error) {
    console.error('[OfflineSync] Error al encolar reporte:', error);
  }
}

/**
 * Sincroniza la cola con el servidor, descartando los que hayan superado el TTL.
 */
export async function syncPendingReports(): Promise<void> {
  try {
    const currentQueueStr = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!currentQueueStr) return;
    
    const queue: QueuedReport[] = JSON.parse(currentQueueStr);
    if (queue.length === 0) return;
    
    const now = Date.now();
    const validReports = queue.filter(r => now - r.timestamp < TTL_MS);
    
    const discardedCount = queue.length - validReports.length;
    if (discardedCount > 0) {
      console.log(`[OfflineSync] Descartados ${discardedCount} reportes por superar el TTL de 12 horas.`);
    }
    
    // Aquí iteraríamos y enviaríamos a nuestro backend de Go:
    // fetch('/api/v1/reports', ...)
    let successCount = 0;
    for (const report of validReports) {
      try {
        // TODO: Reemplazar con llamada real a Go. Simulamos éxito:
        console.log(`[OfflineSync] Enviando reporte ${report.id} al servidor...`);
        // await api.post('/api/v1/reports', report.payload);
        successCount++;
      } catch (err) {
        console.error(`[OfflineSync] Falló envío del reporte ${report.id}`, err);
        // Podríamos mantenerlo en la cola si falla por red
      }
    }
    
    // Por simplicidad del MVP, vaciamos la cola
    await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
    console.log(`[OfflineSync] Sincronización completada. ${successCount} reportes enviados.`);
  } catch (error) {
    console.error('[OfflineSync] Error sincronizando reportes:', error);
  }
}
