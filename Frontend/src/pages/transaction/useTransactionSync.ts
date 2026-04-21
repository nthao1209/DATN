import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import { publishAttendanceUpdate } from '../../services/mqtt';
import type { DraftCell } from './types';

type UseTransactionSyncParams = {
  dirtyEntries: DraftCell[];
  selectedTripId: number | null;
  storageKey: string;
  setDraftMap: React.Dispatch<React.SetStateAction<Record<string, DraftCell>>>;
  refetchTransactions: () => Promise<unknown>;
  refetchPassengers: () => Promise<unknown>;
};

export const useTransactionSync = ({
  dirtyEntries,
  selectedTripId,
  storageKey,
  setDraftMap,
  refetchTransactions,
  refetchPassengers,
}: UseTransactionSyncParams) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const isSyncingRef = useRef(false);

  const syncDrafts = useCallback(
    async (silent = false) => {
      if (!dirtyEntries.length || !isOnline || isSyncingRef.current) {
        return false;
      }

      try {
        isSyncingRef.current = true;
        setIsSaving(true);
        await Promise.all(
          dirtyEntries.map((entry) => {
            if (entry.transactionId) {
              return api.updateTransaction(String(entry.transactionId), {
                checkIn: entry.checkIn,
                checkOut: entry.checkOut,
                note: entry.note?.trim() || null,
                expectedUpdatedAt: entry.updatedAt,
              });
            }
            return api.createTransaction({
              passengerId: entry.passengerId,
              roundId: entry.roundId,
              busId: entry.busId,
              checkIn: entry.checkIn,
              checkOut: entry.checkOut,
              note: entry.note?.trim() || null,
            });
          })
        );

        setDraftMap({});
        if (storageKey) localStorage.removeItem(storageKey);
        await Promise.all([refetchTransactions(), refetchPassengers()]);

        if (selectedTripId) {
          publishAttendanceUpdate(selectedTripId);
        }

        if (!silent) {
          alert('Đã lưu điểm danh thành công');
        }
        return true;
      } catch (error: any) {
        const message = error?.message || 'Lỗi khi lưu điểm danh';
        if (message.toLowerCase().includes('vui lòng tải lại')) {
          await Promise.all([refetchTransactions(), refetchPassengers()]);
        }
        if (!silent) {
          alert(message);
        }
        return false;
      } finally {
        setIsSaving(false);
        isSyncingRef.current = false;
      }
    },
    [dirtyEntries, isOnline, refetchPassengers, refetchTransactions, selectedTripId, setDraftMap, storageKey]
  );

  const handleSave = async () => {
    if (!dirtyEntries.length) {
      alert('Không có thay đổi nào để lưu');
      return;
    }

    if (!isOnline) {
      alert('Đang offline. Dữ liệu đã lưu tạm local, sẽ tự đồng bộ khi có mạng.');
      return;
    }

    await syncDrafts(false);
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
    if (!isOnline || !dirtyEntries.length) return;
    void syncDrafts(true);
  }, [dirtyEntries.length, isOnline, syncDrafts]);

  return {
    isSaving,
    isOnline,
    hasPendingSync: dirtyEntries.length > 0,
    handleSave,
  };
};
