import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import type { DraftCell } from './types';
import type { RootState } from '../../../redux/store';
import {
  offlineService,
  OFFLINE_QUEUE_SYNCED_EVENT,
  OFFLINE_QUEUE_UPDATED_EVENT,
  type OfflineAction,
} from '../../../services/offlineSync';

type UseTransactionSyncParams = {
  dirtyEntries: DraftCell[];
  dirtyEntryDetails?: string[];
  enabled?: boolean;
  selectedTripId: number | null;
  storageKey: string;
};

type SyncBanner = {
  tone: 'info' | 'Thành công' | 'warning' | 'danger';
  label: string;
};

type PendingSyncStatus = {
  label: string;
  detail: string;
};

const buildEntrySignature = (entries: DraftCell[]) =>
  // Signature giúp tránh enqueue lại cùng một tập thay đổi nhiều lần khi component re-render.
  entries
    .map((entry) =>
      [
        entry.passengerId,
        entry.roundId,
        entry.busId,
        entry.checkIn,
        entry.checkOut,
        entry.checkInBusId ?? '',
        entry.checkOutBusId ?? '',
        entry.checkInNote?.trim() || '',
        entry.checkOutNote?.trim() || '',
        entry.checkInTouched ? 1 : 0,
        entry.checkOutTouched ? 1 : 0,
        entry.checkInNoteTouched ? 1 : 0,
        entry.checkOutNoteTouched ? 1 : 0,
      ].join(':')
    )
    .sort()
    .join('|');

export const useTransactionSync = ({
  dirtyEntries,
  dirtyEntryDetails = [],
  enabled = true,
  selectedTripId,
  storageKey,
}: UseTransactionSyncParams) => {
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [syncBanner, setSyncBanner] = useState<SyncBanner | null>(null);
  const [, setQueueVersion] = useState(0);
  const lastQueuedSignatureRef = useRef('');
  const authUserId = useSelector((state: RootState) => state.auth.user?.id ?? null);

  useEffect(() => {
    // Theo dõi trạng thái online/offline của browser để đổi banner sync.
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
    // Mỗi lần queue thay đổi thì ép hook tính lại pending count.
    const bumpQueueVersion = () => setQueueVersion((version) => version + 1);

    window.addEventListener(OFFLINE_QUEUE_UPDATED_EVENT, bumpQueueVersion);
    window.addEventListener(OFFLINE_QUEUE_SYNCED_EVENT, bumpQueueVersion);

    return () => {
      window.removeEventListener(OFFLINE_QUEUE_UPDATED_EVENT, bumpQueueVersion);
      window.removeEventListener(OFFLINE_QUEUE_SYNCED_EVENT, bumpQueueVersion);
    };
  }, []);

  useEffect(() => {
    // Khi có ô dirty, chuyển chúng thành offline action để worker/sync manager gửi lên MQTT.
    if (!enabled) {
      return;
    }

    if (!dirtyEntries.length) {
      lastQueuedSignatureRef.current = '';
      return;
    }

    if (!selectedTripId || !storageKey) {
      return;
    }

    const signature = `${storageKey}:${selectedTripId}:${buildEntrySignature(dirtyEntries)}`;
    if (signature === lastQueuedSignatureRef.current) {
      return;
    }
    lastQueuedSignatureRef.current = signature;

    const userIdStr = localStorage.getItem('userId');
    const localUserId = userIdStr ? parseInt(userIdStr, 10) : null;
    const currentUserId = Number.isFinite(authUserId) ? authUserId : localUserId;
    const timestamp = Date.now();

    const queueActions = dirtyEntries.map<OfflineAction>((entry) => ({
      // Mỗi DraftCell tương ứng một action điểm danh cho passenger-round.
      id: '',
      tripId: selectedTripId,
      passengerId: entry.passengerId,
      roundId: entry.roundId,
      busId: entry.busId,
      checkIn: entry.checkIn,
      checkOut: entry.checkOut,
      checkInBy: currentUserId,
      checkOutBy: currentUserId,
      checkInNote: entry.checkInNote?.trim() || '',
      checkOutNote: entry.checkOutNote?.trim() || '',
      checkInTouched: Boolean(entry.checkInTouched),
      checkOutTouched: Boolean(entry.checkOutTouched),
      checkInNoteTouched: Boolean(entry.checkInNoteTouched),
      checkOutNoteTouched: Boolean(entry.checkOutNoteTouched),
      timestamp,
      status: 'pending',
      storageKey,
    }));

    queueActions.forEach((action) => {
      offlineService.upsertQueue(action);
    });

    setSyncBanner(
      isOnline
        ? { tone: 'info', label: 'Đang gửi thay đổi điểm danh lên MQTT...' }
        : { tone: 'warning', label: 'Offline: thay đổi đã được lưu vào hàng đợi đồng bộ' }
    );
  }, [authUserId, dirtyEntries, enabled, isOnline, selectedTripId, storageKey]);

  useEffect(() => {
    // Khi queue sync xong, hiện banner thành công ngắn rồi ẩn.
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const handleQueueSynced = (event: Event) => {
      const detail = (event as CustomEvent<{ storageKey?: string }>).detail;
      if (detail?.storageKey && detail.storageKey === storageKey) {
        setSyncBanner({ tone: 'Thành công', label: 'Đã gửi lên MQTT, đang chờ cập nhật realtime' });

        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
          setSyncBanner(null);
        }, 300);
      }
    };

    window.addEventListener(OFFLINE_QUEUE_SYNCED_EVENT, handleQueueSynced as EventListener);
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      window.removeEventListener(OFFLINE_QUEUE_SYNCED_EVENT, handleQueueSynced as EventListener);
    };
  }, [storageKey]);

  const pendingQueueCount = offlineService.getQueueByStorageKey(storageKey).length;
  const dirtyEntryCount = dirtyEntries.length;
  // Ưu tiên trạng thái queue; nếu queue rỗng nhưng ô vẫn khác DB thì báo mismatch để debug.
  const pendingSyncStatus: PendingSyncStatus | null = pendingQueueCount > 0
    ? {
        label: isOnline
          ? `Đang gửi ${pendingQueueCount} thao tác lên MQTT`
          : `${pendingQueueCount} thao tác đang lưu offline`,
        detail: 'Có action trong offline_attendance_queue chưa nhận ACK ghi DB.',
      }
    : dirtyEntryCount > 0
      ? {
          label: `${dirtyEntryCount} thay đổi chưa khớp DB`,          detail: dirtyEntryDetails.length
            ? dirtyEntryDetails.join('\n')
            : 'Queue localStorage c? th? null, nh?ng ? tr?n b?ng v?n kh?c d? li?u DB/realtime.',
        }
      : null;

  return {
    isOnline,
    hasPendingSync: Boolean(pendingSyncStatus),
    pendingSyncStatus,
    syncBanner,
  };
};
