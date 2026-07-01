import { useEffect, useMemo, type Dispatch, type SetStateAction } from 'react';
import useDebounce from '../../../hooks/useDebounce';
import { offlineService, OFFLINE_QUEUE_SYNCED_EVENT } from '../../../services/offlineSync';
import type { DraftCell } from './types';

type UseTransactionDraftStorageParams = {
  selectedTripId: number | null;
  draftMap: Record<string, DraftCell>;
  setDraftMap: Dispatch<SetStateAction<Record<string, DraftCell>>>;
  refetchTransactions: () => Promise<unknown>;
  refetchPassengers: () => Promise<unknown>;
};

export const useTransactionDraftStorage = ({
  selectedTripId,
  draftMap,
  setDraftMap,
  refetchTransactions,
  refetchPassengers,
}: UseTransactionDraftStorageParams) => {
  // Mỗi chuyến có một key draft riêng để tránh lẫn dữ liệu đang sửa giữa các chuyến.
  const storageKey = useMemo(
    () => (selectedTripId ? `transaction_draft_${selectedTripId}` : ''),
    [selectedTripId]
  );
  const debouncedDraftJson = useDebounce(JSON.stringify(draftMap), 600);

  // Dọn các draft cũ không còn queue offline đi kèm, tránh localStorage phình ra theo thời gian.
  useEffect(() => {
    Object.keys(localStorage)
      .filter((key) => key.startsWith('transaction_draft_'))
      .forEach((key) => {
        if (!offlineService.hasQueueForStorageKey(key)) {
          localStorage.removeItem(key);
        }
      });
  }, []);

  // Khi mở lại trang, chỉ khôi phục draft nếu còn queue offline cần đồng bộ.
  useEffect(() => {
    if (!storageKey) return;
    if (!offlineService.hasQueueForStorageKey(storageKey)) {
      localStorage.removeItem(storageKey);
      setDraftMap({});
      return;
    }

    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, DraftCell & { note?: string }>;
      if (!parsed || Object.keys(parsed).length === 0) {
        localStorage.removeItem(storageKey);
        setDraftMap({});
        return;
      }

      // Hỗ trợ dữ liệu cũ từng dùng chung field "note" trước khi tách ghi chú lượt đi/lượt về.
      const migratedDrafts = Object.fromEntries(
        Object.entries(parsed || {}).map(([key, cell]) => {
          const legacyNote = cell.note;
          if (legacyNote && !cell.checkInNote && !cell.checkOutNote) {
            return [
              key,
              {
                ...cell,
                checkInNote: legacyNote,
                checkOutNote: legacyNote,
                checkInNoteTouched: true,
                checkOutNoteTouched: true,
              },
            ];
          }

          return [
            key,
            {
              ...cell,
              checkInNoteTouched: Boolean(cell.checkInNoteTouched || cell.checkInNote),
              checkOutNoteTouched: Boolean(cell.checkOutNoteTouched || cell.checkOutNote),
            },
          ];
        })
      ) as Record<string, DraftCell>;
      if (Object.keys(migratedDrafts).length === 0) {
        localStorage.removeItem(storageKey);
        setDraftMap({});
        return;
      }

      setDraftMap(migratedDrafts);
    } catch {
      localStorage.removeItem(storageKey);
      setDraftMap({});
    }
  }, [setDraftMap, storageKey]);

  // Lưu draft xuống localStorage sau khi người dùng ngừng thao tác một chút.
  useEffect(() => {
    if (!storageKey) return;
    if (Object.keys(draftMap).length === 0) {
      localStorage.removeItem(storageKey);
      return;
    }

    localStorage.setItem(storageKey, debouncedDraftJson);
  }, [debouncedDraftJson, draftMap, storageKey]);

  // Khi queue offline sync xong, xóa draft local và refetch dữ liệu mới từ server.
  useEffect(() => {
    if (!storageKey) return;

    const handleQueueSynced = (event: Event) => {
      const detail = (event as CustomEvent<{ storageKey?: string }>).detail;
      if (detail?.storageKey !== storageKey) {
        return;
      }

      setDraftMap({});
      localStorage.removeItem(storageKey);
      void Promise.all([refetchTransactions(), refetchPassengers()]);
    };

    window.addEventListener(OFFLINE_QUEUE_SYNCED_EVENT, handleQueueSynced as EventListener);
    return () => {
      window.removeEventListener(OFFLINE_QUEUE_SYNCED_EVENT, handleQueueSynced as EventListener);
    };
  }, [refetchPassengers, refetchTransactions, setDraftMap, storageKey]);

  return storageKey;
};
