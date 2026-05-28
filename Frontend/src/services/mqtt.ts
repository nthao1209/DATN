import mqtt, { type MqttClient } from 'mqtt';
import type { OfflineAction } from './offlineSync';

export type AttendanceUpdateEvent = {
  type:
    | 'attendance.updated'
    | 'attendance.changed'
    | 'attendance.wrong_bus';

  tripId: number;

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
const MQTT_ADMIN_TOPIC_PREFIX = import.meta.env.VITE_MQTT_ADMIN_TOPIC_PREFIX || 'attendance/trips';
const MQTT_LOCKS_TOPIC_PREFIX = import.meta.env.VITE_MQTT_LOCKS_TOPIC_PREFIX || 'attendance/trips';
const MQTT_UI_TOPIC_PREFIX = import.meta.env.VITE_MQTT_UI_TOPIC_PREFIX || 'attendance/ui/trip';
const MQTT_ATTENDANCE_TOPIC_PREFIX = import.meta.env.VITE_MQTT_ATTENDANCE_TOPIC_PREFIX || 'attendance';

const getClientId = () => `web_${Math.random().toString(16).slice(2)}_${Date.now()}`;

const topicHandlers = new Map<string, Set<(topic: string, message: Record<string, unknown>) => void>>();
const activeTopics = new Set<string>();
const statusListeners = new Set<(status: MqttBrokerStatus) => void>();

let sharedClient: MqttClient | null = null;
let currentStatus: MqttBrokerStatus = 'connecting';

const notifyStatus = (status: MqttBrokerStatus) => {
  currentStatus = status;
  statusListeners.forEach((listener) => listener(status));
};

const ensureSharedClient = () => {
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
  console.log('Connecting to MQTT broker...', { MQTT_WS_URL, MQTT_USERNAME: MQTT_USERNAME ? '***' : null });

  sharedClient.on('connect', () => {
    notifyStatus('connected');
    for (const topic of activeTopics) {
      sharedClient?.subscribe(topic, { qos: 1 });
    }
  });

  sharedClient.on('reconnect', () => notifyStatus('reconnecting'));
  sharedClient.on('close', () => notifyStatus('disconnected'));
  sharedClient.on('offline', () => notifyStatus('disconnected'));
  sharedClient.on('error', () => notifyStatus('error'));

  sharedClient.on('message', (topic, payload) => {
    const handlers = topicHandlers.get(topic);
    if (!handlers || handlers.size === 0) {
      return;
    }

    try {
      const parsed = JSON.parse(payload.toString()) as Record<string, unknown>;
      handlers.forEach((handler) => handler(topic, parsed));
    } catch (err) {
    }
  });

  notifyStatus('connecting');
  return sharedClient;
};

const waitForClientConnection = async () => {
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

export const subscribeAttendanceUpdates = (
  tripId: number,
  onMessage: (event: AttendanceUpdateEvent) => void,
): MqttSubscriptionHandle => {
  return registerTopicHandlers([`${MQTT_UI_TOPIC_PREFIX}/${tripId}`], (_topic, parsed) => {
    if (
      (parsed.type === 'attendance.updated' ||
        parsed.type === 'attendance.changed' ||
        parsed.type === 'attendance.requires_review' ||
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
  return registerTopicHandlers([`${MQTT_LOCKS_TOPIC_PREFIX}/${tripId}/locks`], (_topic, parsed) => {
    if (
      (parsed.type === 'round.lock.changed' || parsed.type === 'bus.round.lock.updated') &&
      Number(parsed.tripId) === Number(tripId)
    ) {
      onMessage(parsed as UnlockMqttEvent);
    }
  });
};

/**
 * @deprecated Use subscribeAdminUnlockRequests, subscribeRequesterUnlockResponse, subscribeLockUpdates instead
 */
export const subscribeUnlockRequestEvents = (
  tripId: number,
  onMessage: (event: UnlockMqttEvent) => void,
): MqttSubscriptionHandle => {
  return registerTopicHandlers(
    [`${MQTT_UI_TOPIC_PREFIX}/${tripId}`, `${MQTT_ADMIN_TOPIC_PREFIX}/${tripId}/admin/unlock-requests`],
    (_topic, parsed) => {
      if (
        (parsed.type === 'unlock.request.created' ||
          parsed.type === 'unlock.request.created.self' ||
          parsed.type === 'unlock.request.approved' ||
          parsed.type === 'unlock.request.rejected' ||
          parsed.type === 'round.lock.changed' ||
          parsed.type === 'bus.round.lock.updated') &&
        Number(parsed.tripId) === Number(tripId)
      ) {
        onMessage(parsed as UnlockMqttEvent);
      }
    },
  );
};

export const publishAttendanceUpdate = async (tripId: number, payload?: Partial<AttendanceUpdateEvent>) => {
  const client = await waitForClientConnection();

  const message: AttendanceUpdateEvent = {
    type: 'attendance.changed',
    tripId,
    passengerId: payload?.passengerId || 0,
    roundId: payload?.roundId || 0,
    busId: payload?.busId || 0,
    checkIn: payload?.checkIn || false,
    checkOut: payload?.checkOut || false,
    checkInNote: payload?.checkInNote,
    checkOutNote: payload?.checkOutNote,
    updatedAt: new Date().toISOString(),
    project: payload?.project,
  };

  await new Promise<void>((resolve, reject) => {
    client.publish(`${MQTT_UI_TOPIC_PREFIX}/${tripId}`, JSON.stringify(message), { qos: 1, retain: false }, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
};

export const publishAttendanceAction = async (action: OfflineAction) => {
  const client = await waitForClientConnection();

  const topic = `${MQTT_ATTENDANCE_TOPIC_PREFIX}/${action.tripId}/${action.busId}/${action.roundId}/check`;
  const payload = {
    passengerId: action.passengerId,
    roundId: action.roundId,
    busId: action.busId,
    checkIn: action.checkIn,
    checkOut: action.checkOut,
    checkInBy: action.checkInBy,
    checkOutBy: action.checkOutBy,
    checkInNote: action.checkInNote || '',
    checkOutNote: action.checkOutNote || '',
    timestamp: action.timestamp,
  };

  await new Promise<void>((resolve, reject) => {
    client.publish(topic, JSON.stringify(payload), { qos: 1, retain: false }, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
};