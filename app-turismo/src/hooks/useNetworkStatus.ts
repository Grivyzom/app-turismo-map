import { useState, useEffect, useRef } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { syncPendingReports } from '../utils/offlineSyncQueue';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const wasOffline = useRef(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const currentlyOnline = state.isConnected ?? true;
      setIsOnline(currentlyOnline);

      if (!currentlyOnline) {
        wasOffline.current = true;
      } else if (currentlyOnline && wasOffline.current) {
        // Volvimos a conectarnos
        console.log('[NetInfo] Recuperamos conexión. Sincronizando cola...');
        syncPendingReports();
        wasOffline.current = false;
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return { isOnline };
}
