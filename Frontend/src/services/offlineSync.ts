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
  note?: string;
  timestamp: number;
  status: 'pending' | 'syncing';
  storageKey?: string;
}

const OFFLINE_QUEUE_KEY = 'attendance_offline_queue';
export const OFFLINE_QUEUE_UPDATED_EVENT = 'attendance-offline-queue-updated';
export const OFFLINE_QUEUE_SYNCED_EVENT = 'attendance-offline-sync-complete';

const isBrowser = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined';
const queueMatchKey = (action: Pick<OfflineAction, 'tripId' | 'passengerId' | 'roundId' | 'storageKey'>) =>
  `${action.storageKey || ''}:${action.tripId}:${action.passengerId}:${action.roundId}`;

const readQueue = (): OfflineAction[] => {
  if (!isBrowser()) return [];

  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OfflineAction[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeQueue = (queue: OfflineAction[]) => {
  if (!isBrowser()) return;
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_UPDATED_EVENT));
};

export const offlineService = {
  getQueue: (): OfflineAction[] => readQueue(),

  getQueueByStorageKey: (storageKey: string): OfflineAction[] =>
    readQueue().filter((action) => action.storageKey === storageKey),

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
    const queue = readQueue();
    const matchKey = queueMatchKey(action);
    const existingIndex = queue.findIndex((item) => queueMatchKey(item) === matchKey);
    const nextAction: OfflineAction = {
      ...action,
      id: existingIndex >= 0 ? queue[existingIndex].id : Math.random().toString(36).slice(2),
      status: existingIndex >= 0 ? queue[existingIndex].status : 'pending',
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

  removeFromQueue: (id: string) => {
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