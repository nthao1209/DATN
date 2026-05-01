import { useEffect, useRef, useState } from 'react';
import type { DraftCell } from './types';
import { offlineService, OFFLINE_QUEUE_SYNCED_EVENT, OFFLINE_QUEUE_UPDATED_EVENT, type OfflineAction } from '../../services/offlineSync';

type UseTransactionSyncParams = {
  dirtyEntries: DraftCell[];
  selectedTripId: number | null;
  storageKey: string;
};

type SyncBanner = {
  tone: 'info' | 'success' | 'warning' | 'danger';
  label: string;
};

export const useTransactionSync = ({
  dirtyEntries,
  selectedTripId,
  storageKey,
}: UseTransactionSyncParams) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [syncBanner, setSyncBanner] = useState<SyncBanner | null>(null);
  const isSyncingRef = useRef(false);

  const handleSave = async () => {
    if (!dirtyEntries.length) {
      alert('Không có thay đổi nào để lưu');
      return;
    }

    if (!selectedTripId) {
      alert('Không xác định được chuyến đi để đồng bộ');
      return;
    }

    if (isSyncingRef.current) {
      return;
    }

    try {
      isSyncingRef.current = true;
      setIsSaving(true);

      const queueActions = dirtyEntries.map<OfflineAction>((entry) => ({
        id: '',
        tripId: selectedTripId,
        passengerId: entry.passengerId,
        roundId: entry.roundId,
        busId: entry.busId,
        checkIn: entry.checkIn,
        checkOut: entry.checkOut,
        note: entry.note?.trim() || '',
        timestamp: Date.now(),
        status: 'pending',
        storageKey,
      }));

      queueActions.forEach((action) => {
        offlineService.upsertQueue(action);
      });

      setSyncBanner(
        isOnline
          ? { tone: 'info', label: 'Đã đưa vào hàng đợi, hệ thống sẽ đẩy lên MQTT khi sẵn sàng' }
          : { tone: 'warning', label: 'Offline: dữ liệu đã được lưu tạm để đồng bộ sau' }
      );

      if (!isOnline) {
        alert('Đang offline. Dữ liệu đã lưu vào hàng đợi đồng bộ local.');
      }

      window.dispatchEvent(new Event(OFFLINE_QUEUE_UPDATED_EVENT));
      return true;
    } finally {
      setIsSaving(false);
      isSyncingRef.current = false;
    }
  };

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    const handleQueueSynced = (event: Event) => {
      const detail = (event as CustomEvent<{ storageKey?: string }>).detail;
      if (detail?.storageKey && detail.storageKey === storageKey) {
        setSyncBanner({ tone: 'success', label: 'Đã đồng bộ lên máy chủ' });
      }
    };

    window.addEventListener(OFFLINE_QUEUE_SYNCED_EVENT, handleQueueSynced as EventListener);
    return () => window.removeEventListener(OFFLINE_QUEUE_SYNCED_EVENT, handleQueueSynced as EventListener);
  }, [storageKey]);

  return {
    isSaving,
    isOnline,
    hasPendingSync: dirtyEntries.length > 0 || offlineService.getQueueByStorageKey(storageKey).length > 0,
    syncBanner,
    handleSave,
  };
};
