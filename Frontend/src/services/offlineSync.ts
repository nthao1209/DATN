export interface OfflineAction {
  id: string;
  tripId: number;
  passengerId: number;
  roundId: number;
  busId: number;
  checkIn: boolean;
  checkOut: boolean;
  checkInBy?: number | null;
  checkOutBy?: number | null;
  checkInNote?: string;
  checkOutNote?: string;
  checkInTouched?: boolean;
  checkOutTouched?: boolean;
  checkInNoteTouched?: boolean;
  checkOutNoteTouched?: boolean;
  timestamp: number;
  status: 'pending' | 'syncing';
  storageKey?: string;
}

const OFFLINE_QUEUE_KEY = 'attendance_offline_queue';
export const OFFLINE_QUEUE_UPDATED_EVENT = 'attendance-offline-queue-updated';
export const OFFLINE_QUEUE_SYNCED_EVENT = 'attendance-offline-sync-complete';

const isBrowser = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined';
const queueMatchKey = (action: Pick<OfflineAction, 'tripId' | 'passengerId' | 'roundId' | 'storageKey'>) =>
  // Một ô điểm danh chỉ cần một action mới nhất trong queue, tránh gửi nhiều bản cũ.
  `${action.storageKey || ''}:${action.tripId}:${action.passengerId}:${action.roundId}`;

const migrateOfflineAction = (action: OfflineAction & { note?: string }): OfflineAction => {
  // Hỗ trợ queue cũ từng dùng field note chung trước khi tách checkInNote/checkOutNote.
  if (!action.note || action.checkInNote || action.checkOutNote) {
    return action;
  }

  return {
    ...action,
    checkInNote: action.checkInNote ?? action.note,
    checkOutNote: action.checkOutNote ?? action.note,
  };
};

const readQueue = (): OfflineAction[] => {
  // Đọc queue từ localStorage; lỗi parse thì coi như queue rỗng để UI không crash.
  if (!isBrowser()) return [];

  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OfflineAction[];
    return Array.isArray(parsed) ? parsed.map((action) => migrateOfflineAction(action as OfflineAction & { note?: string })) : [];
  } catch {
    return [];
  }
};

const writeQueue = (queue: OfflineAction[]) => {
  // Mọi thay đổi queue đều phát event để các component sync badge/trạng thái.
  if (!isBrowser()) return;
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_UPDATED_EVENT));
};

export const offlineService = {
  getQueue: (): OfflineAction[] => readQueue(),

  getQueueByStorageKey: (storageKey: string): OfflineAction[] =>
    readQueue().filter((action) => action.storageKey === storageKey),

  hasQueueForStorageKey: (storageKey: string): boolean =>
    readQueue().some((action) => action.storageKey === storageKey),

  addToQueue: (action: Omit<OfflineAction, 'id' | 'status'>) => {
    const queue = readQueue();
    const newAction: OfflineAction = {
      ...action,
      id: Math.random().toString(36).slice(2),
      status: 'pending',
    };
    queue.push(newAction);
    writeQueue(queue);
    return newAction;
  },

  upsertQueue: (action: Omit<OfflineAction, 'id' | 'status'>) => {
    // Ghi đè action cũ của cùng passenger-round để chỉ sync trạng thái mới nhất.
    const queue = readQueue();
    const matchKey = queueMatchKey(action);
    const existingIndex = queue.findIndex((item) => queueMatchKey(item) === matchKey);
    const existingAction = existingIndex >= 0 ? queue[existingIndex] : null;
    const shouldKeepExistingId = existingAction && existingAction.status !== 'syncing';
    const nextAction: OfflineAction = {
      ...action,
      id: shouldKeepExistingId ? existingAction.id : Math.random().toString(36).slice(2),
      status: 'pending',
    };

    if (existingIndex >= 0) {
      queue[existingIndex] = nextAction;
    } else {
      queue.push(nextAction);
    }

    writeQueue(queue);
    return nextAction;
  },

  markSyncing: (id: string) => {
    const queue = readQueue().map((item) =>
      item.id === id ? { ...item, status: 'syncing' as const } : item
    );
    writeQueue(queue);
  },

  markPending: (id: string) => {
    const queue = readQueue().map((item) =>
      item.id === id ? { ...item, status: 'pending' as const } : item
    );
    writeQueue(queue);
  },

  removeFromQueue: (id: string) => {
    // Khi action cuối cùng của một draft được sync xong, báo cho page dọn draft local.
    const queue = readQueue();
    const current = queue.find((item) => item.id === id);
    const nextQueue = queue.filter((item) => item.id !== id);
    writeQueue(nextQueue);

    if (current?.storageKey && !nextQueue.some((item) => item.storageKey === current.storageKey)) {
      window.dispatchEvent(
        new CustomEvent(OFFLINE_QUEUE_SYNCED_EVENT, { detail: { storageKey: current.storageKey } })
      );
    }
  },

  clearQueue: () => {
    if (!isBrowser()) return;
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
    window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_UPDATED_EVENT));
  },
};
