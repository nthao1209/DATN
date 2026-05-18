import { useEffect, useRef, useState } from 'react';
import { enqueueSnackbar } from 'notistack';
import { useSelector } from 'react-redux';
import type { DraftCell } from './types';
import type { RootState } from '../../redux/store';
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
  const authUserId = useSelector((state: RootState) => state.auth.user?.id ?? null);

  const handleSave = async () => {
    if (!dirtyEntries.length) {
      enqueueSnackbar('Không có thay đổi nào để lưu', { variant: 'info' });
      return;
    }

    if (!selectedTripId) {
      enqueueSnackbar('Không xác định được chuyến đi để đồng bộ', { variant: 'warning' });
      return;
    }

    if (isSyncingRef.current) {
      return;
    }

    try {
      isSyncingRef.current = true;
      setIsSaving(true);

      // Get current user ID from localStorage (set during auth)
      const userIdStr = localStorage.getItem('userId');
      const localUserId = userIdStr ? parseInt(userIdStr, 10) : null;
      const currentUserId = Number.isFinite(authUserId) ? authUserId : localUserId;

      const queueActions = dirtyEntries.map<OfflineAction>((entry) => ({
        id: '',
        tripId: selectedTripId,
        passengerId: entry.passengerId,
        roundId: entry.roundId,
        busId: entry.busId,
        checkIn: entry.checkIn,
        checkOut: entry.checkOut,
        checkInBy: currentUserId,
        checkOutBy: currentUserId,
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
        enqueueSnackbar('Đang offline. Dữ liệu đã lưu vào hàng đợi đồng bộ local.', { variant: 'warning' });
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
    let timeoutId : ReturnType<typeof setTimeout>; 
    const handleQueueSynced = (event: Event) => {
      const detail = (event as CustomEvent<{ storageKey?: string }>).detail;
      if (detail?.storageKey && detail.storageKey === storageKey) {
        setSyncBanner({ tone: 'success', label: 'Đã đồng bộ lên máy chủ' });

        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() =>{
          setSyncBanner(null);
      },300);
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
