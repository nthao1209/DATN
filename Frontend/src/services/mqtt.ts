import mqtt, { type MqttClient } from 'mqtt';
import type { OfflineAction } from './offlineSync';

export type AttendanceUpdateEvent = {
  type:
    | 'attendance.updated'
    | 'attendance.wrong_bus';

  tripId: number;
  tenantId?: number;
  entity?: string;

  roundId: number;
  roundName?: string;

  // ===== XE HIỆN TẠI =====
  busId: number;
  busCode?: string;

  // ===== KHÁCH =====
  passengerId: number;
  passengerName?: string;

  // ===== XE BIÊN CHẾ =====
  passengerBusId?: number;
  passengerBusCode?: string;
  passengerBusRegistrationNumber?: string;
  passengerBusManagerId?: number | null;

  // ===== CHECK IN =====
  checkIn: boolean;
  checkInBy?: number | null;
  checkInAt?: string;
  checkInBusId?: number | null;

  // ===== CHECK OUT =====
  checkOut: boolean;
  checkOutBy?: number | null;
  checkOutAt?: string;
  checkOutBusId?: number | null;

  targetManagerId?: number | null;
  requiresReview?: boolean;

  // ===== Khác =====
  checkInNote?: string;
  checkOutNote?: string;
  project?: string;
  updatedAt?: string;
};

export type UnlockMqttEvent = {
  type: 'unlock.request.created' | 'unlock.request.created.self' | 'unlock.request.approved' | 'unlock.request.rejected' | 'round.lock.changed' | 'bus.round.lock.updated';
  tripId: number;
  requestId?: number;
  busId: number;
  busCode?: string;
  roundId: number;
  roundName?: string;
  lockType?: 'check_in' | 'check_out';
  reason?: string;
  requestedBy?: number | string;
  handledBy?: number | string;
  rejectReason?: string;
  checkInLocked?: boolean;
  checkOutLocked?: boolean;
  lockedBy?: string;
  scope?: 'ADMIN_ONLY' | 'TRIP_UI';
  timestamp?: string;
};

export type MqttBrokerStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';
export type MqttSubscriptionHandle = {
  end: (...args: any[]) => void;
};

const MQTT_WS_URL = import.meta.env.VITE_MQTT_WS_URL || 'wss://mqtt.toolhub.app:8084';
const MQTT_USERNAME = import.meta.env.VITE_MQTT_USERNAME || '';
const MQTT_PASSWORD = import.meta.env.VITE_MQTT_PASSWORD || '';
const MQTT_LOCKS_TOPIC_PREFIX = import.meta.env.VITE_MQTT_LOCKS_TOPIC_PREFIX || 'attendance/trips';
const MQTT_UI_TOPIC_PREFIX = import.meta.env.VITE_MQTT_UI_TOPIC_PREFIX || 'attendance/ui/trip';
const MQTT_ATTENDANCE_TOPIC_PREFIX = import.meta.env.VITE_MQTT_ATTENDANCE_TOPIC_PREFIX || 'attendance';
const MQTT_ATTENDANCE_ACK_TOPIC_PREFIX = import.meta.env.VITE_MQTT_ATTENDANCE_ACK_TOPIC_PREFIX || 'attendance/ack/action';

const getClientId = () => `web_${Math.random().toString(16).slice(2)}_${Date.now()}`;

const topicHandlers = new Map<string, Set<(topic: string, message: Record<string, unknown>) => void>>();
const activeTopics = new Set<string>();
const statusListeners = new Set<(status: MqttBrokerStatus) => void>();

let sharedClient: MqttClient | null = null;
let currentStatus: MqttBrokerStatus = 'connecting';

const notifyStatus = (status: MqttBrokerStatus) => {
  // Đẩy trạng thái broker ra UI để hiện connected/reconnecting/error.
  currentStatus = status;
  statusListeners.forEach((listener) => listener(status));
};

const ensureSharedClient = () => {
  // Toàn app dùng một MQTT client duy nhất để tránh mở nhiều websocket không cần thiết.
  if (sharedClient) {
    return sharedClient;
  }

  sharedClient = mqtt.connect(MQTT_WS_URL, {
    username: MQTT_USERNAME || undefined,
    password: MQTT_PASSWORD || undefined,
    clientId: getClientId(),
    clean: true,
    reconnectPeriod: 5000,
    connectTimeout: 10000,
    keepalive: 30,
  });

  sharedClient.on('connect', () => {
    notifyStatus('connected');
    // Khi reconnect, subscribe lại toàn bộ topic đang có listener.
    for (const topic of activeTopics) {
      sharedClient?.subscribe(topic, { qos: 1 });
    }
  });

  sharedClient.on('reconnect', () => notifyStatus('reconnecting'));
  sharedClient.on('close', () => notifyStatus('disconnected'));
  sharedClient.on('offline', () => notifyStatus('disconnected'));
  sharedClient.on('error', () => notifyStatus('error'));

  sharedClient.on('message', (topic, payload) => {
    // Mỗi topic có thể có nhiều component nghe, nên dispatch tới toàn bộ handler đã đăng ký.
    const handlers = topicHandlers.get(topic);
    if (!handlers || handlers.size === 0) {
      return;
    }
      // Payload MQTT luôn đi qua JSON để mọi listener nhận cùng một cấu trúc dữ liệu.
      const parsed = JSON.parse(payload.toString()) as Record<string, unknown>;
      handlers.forEach((handler) => handler(topic, parsed));
    
  });

  notifyStatus('connecting');
  return sharedClient;
};

const waitForClientConnection = async () => {
  // Dùng trước khi publish để đảm bảo client đã kết nối broker.
  const client = ensureSharedClient();

  if (client.connected) {
    return client;
  }

  return await new Promise<MqttClient>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('MQTT connection timeout'));
    }, 10000);

    const cleanup = () => {
      window.clearTimeout(timeout);
      client.off('connect', onConnect);
      client.off('error', onError);
    };

    const onConnect = () => {
      cleanup();
      resolve(client);
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    client.on('connect', onConnect);
    client.on('error', onError);
  });
};

const registerTopicHandlers = (
  topics: string[],
  handler: (topic: string, message: Record<string, unknown>) => void,
): MqttSubscriptionHandle => {
  // Quản lý subscribe/unsubscribe theo số lượng listener thực sự còn dùng topic.
  const client = ensureSharedClient();

  topics.forEach((topic) => {
    let handlers = topicHandlers.get(topic);

    if (!handlers) {
      handlers = new Set();
      topicHandlers.set(topic, handlers);
    }

    const wasEmpty = handlers.size === 0;
    handlers.add(handler);
    activeTopics.add(topic);

    if (wasEmpty && client.connected) {
      client.subscribe(topic, { qos: 1 });
    }
  });

  return {
    end: (_force?: boolean, callback?: () => void) => {
      topics.forEach((topic) => {
        const handlers = topicHandlers.get(topic);
        if (!handlers) {
          return;
        }

        handlers.delete(handler);
        if (handlers.size === 0) {
          topicHandlers.delete(topic);
          activeTopics.delete(topic);
          if (client.connected) {
            client.unsubscribe(topic);
          }
        }
      });

      callback?.();
    },
  };
};

export const subscribeMqttTopics = (
  topics: string[],
  onMessage: (topic: string, message: Record<string, unknown>) => void,
): MqttSubscriptionHandle => {
  return registerTopicHandlers(topics, onMessage);
};

export const subscribeMqttStatus = (listener: (status: MqttBrokerStatus) => void) => {
  ensureSharedClient();
  statusListeners.add(listener);
  listener(currentStatus);

  return () => {
    statusListeners.delete(listener);
  };
};

export const getMqttStatus = () => currentStatus;

export const ensureMqttConnected = async () => {
  await waitForClientConnection();
};

export const subscribeAttendanceUpdates = (
  tripId: number,
  onMessage: (event: AttendanceUpdateEvent) => void,
): MqttSubscriptionHandle => {
  // Màn transaction nghe event điểm danh theo trip để refetch bảng.
  return registerTopicHandlers([`${MQTT_UI_TOPIC_PREFIX}/${tripId}`], (_topic, parsed) => {
    if (
      (parsed.type === 'attendance.updated' ||
        parsed.type === 'attendance.wrong_bus') &&
      Number(parsed.tripId) === Number(tripId)
    ) {
      onMessage(parsed as AttendanceUpdateEvent);
    }
  });
};

export const subscribeAdminUnlockRequests = (
  userId: number,
  onMessage: (event: UnlockMqttEvent) => void,
): MqttSubscriptionHandle => {
  return registerTopicHandlers([`attendance/admin/${userId}/unlock-requests`], (_topic, parsed) => {
    if (parsed.type === 'unlock.request.created' && Number(parsed.tripId) > 0) {
      onMessage(parsed as UnlockMqttEvent);
    }
  });
};

export const subscribeRequesterUnlockResponse = (
  userId: number,
  onMessage: (event: UnlockMqttEvent) => void,
): MqttSubscriptionHandle => {
  return registerTopicHandlers([`attendance/requester/${userId}/unlock-response`], (_topic, parsed) => {
    if (
      (parsed.type === 'unlock.request.created.self' ||
        parsed.type === 'unlock.request.approved' ||
        parsed.type === 'unlock.request.rejected') &&
      Number(parsed.requestId) > 0
    ) {
      onMessage(parsed as UnlockMqttEvent);
    }
  });
};

export const subscribeLockUpdates = (
  tripId: number,
  onMessage: (event: UnlockMqttEvent) => void,
): MqttSubscriptionHandle => {
  return registerTopicHandlers([`${MQTT_LOCKS_TOPIC_PREFIX}/${tripId}/locks`, 'attendance/ui/locks'], (_topic, parsed) => {
    if (
      (parsed.type === 'round.lock.changed' || parsed.type === 'bus.round.lock.updated') &&
      Number(parsed.tripId) === Number(tripId)
    ) {
      onMessage(parsed as UnlockMqttEvent);
    }
  });
};


const createAttendanceAckWaiter = (actionId: string, timeoutMs = 15000) => {
  // Frontend chỉ xóa action khỏi offline queue khi worker đã publish ACK sau khi commit DB.
  let timeoutId: number | undefined;
  let subscription: MqttSubscriptionHandle | null = null;

  const promise = new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }

      subscription?.end(true);
      subscription = null;
    };

    subscription = registerTopicHandlers(
      [`${MQTT_ATTENDANCE_ACK_TOPIC_PREFIX}/${actionId}`],
      (_topic, parsed) => {
        if (
          parsed.type === 'attendance.persisted' &&
          parsed.status === 'ok' &&
          parsed.actionId === actionId
        ) {
          cleanup();
          resolve();
        }
      },
    );

    timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for attendance DB ack'));
    }, timeoutMs);
  });

  return promise;
};

export const publishAttendanceAction = async (action: OfflineAction) => {
  const client = await waitForClientConnection();

  // Topic chứa trip/bus/round để worker xử lý điểm danh độc lập với HTTP API.
  const topic = `${MQTT_ATTENDANCE_TOPIC_PREFIX}/${action.tripId}/${action.busId}/${action.roundId}/check`;
  const ackPromise = action.id ? createAttendanceAckWaiter(action.id) : Promise.resolve();
  const payload = {
    // actionId giúp ghép đúng thao tác gửi đi với ACK trả về từ worker.
    actionId: action.id,
    passengerId: action.passengerId,
    roundId: action.roundId,
    busId: action.busId,
    checkIn: action.checkIn,
    checkOut: action.checkOut,
    checkInBy: action.checkInBy,
    checkOutBy: action.checkOutBy,
    checkInNote: action.checkInNote || '',
    checkOutNote: action.checkOutNote || '',
    checkInTouched: Boolean(action.checkInTouched),
    checkOutTouched: Boolean(action.checkOutTouched),
    checkInNoteTouched: Boolean(action.checkInNoteTouched),
    checkOutNoteTouched: Boolean(action.checkOutNoteTouched),
    timestamp: action.timestamp,
  };

  await new Promise<void>((resolve, reject) => {
    // retain=true giúp worker vẫn nhận được action nếu publish xong rồi worker mới reconnect.
    // Sau khi xử lý thành công, worker sẽ clear retained message của topic này.
    client.publish(topic, JSON.stringify(payload), { qos: 1, retain: true }, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  await ackPromise;
};
