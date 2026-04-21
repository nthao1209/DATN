import mqtt, { type MqttClient } from 'mqtt';

export type AttendanceUpdateEvent = {
  type: 'attendance.updated' | 'attendance.changed';
  project?: string;
  tripId: number;
  passengerId: number;
  roundId: number;
  busId: number;
  checkIn: boolean;
  checkOut: boolean;
  note?: string;
  updatedAt?: string;
};

const MQTT_WS_URL = import.meta.env.VITE_MQTT_WS_URL || 'wss://mqtt.toolhub.app:8084/mqtt';
const MQTT_USERNAME = import.meta.env.VITE_MQTT_USERNAME || '';
const MQTT_PASSWORD = import.meta.env.VITE_MQTT_PASSWORD || '';
const MQTT_UI_TOPIC_PREFIX = import.meta.env.VITE_MQTT_UI_TOPIC_PREFIX || 'attendance/ui/trip';

const getClientId = () => `web_${Math.random().toString(16).slice(2)}_${Date.now()}`;

export const subscribeAttendanceUpdates = (
  tripId: number,
  onMessage: (event: AttendanceUpdateEvent) => void,
): MqttClient => {
  const client = mqtt.connect(MQTT_WS_URL, {
    username: MQTT_USERNAME || undefined,
    password: MQTT_PASSWORD || undefined,
    clientId: getClientId(),
    clean: true,
    reconnectPeriod: 5000,
    connectTimeout: 10000,
    keepalive: 30,
  });

  client.on('connect', () => {
    client.subscribe(`${MQTT_UI_TOPIC_PREFIX}/${tripId}`, { qos: 1 });
  });

  client.on('message', (_topic, payload) => {
    try {
      const parsed = JSON.parse(payload.toString()) as AttendanceUpdateEvent;
      if (
        (parsed?.type === 'attendance.updated' || parsed?.type === 'attendance.changed') &&
        Number(parsed.tripId) === Number(tripId)
      ) {
        onMessage(parsed);
      }
    } catch {
      // Ignore malformed payloads from the broker.
    }
  });

  return client;
};

export const publishAttendanceUpdate = (tripId: number, payload?: Partial<AttendanceUpdateEvent>) => {
  const client = mqtt.connect(MQTT_WS_URL, {
    username: MQTT_USERNAME || undefined,
    password: MQTT_PASSWORD || undefined,
    clientId: getClientId(),
    clean: true,
    reconnectPeriod: 0,
    connectTimeout: 10000,
  });

  client.on('connect', () => {
    const message: AttendanceUpdateEvent = {
      type: 'attendance.changed',
      tripId,
      passengerId: payload?.passengerId || 0,
      roundId: payload?.roundId || 0,
      busId: payload?.busId || 0,
      checkIn: payload?.checkIn || false,
      checkOut: payload?.checkOut || false,
      note: payload?.note,
      updatedAt: new Date().toISOString(),
      project: payload?.project,
    };

    client.publish(`${MQTT_UI_TOPIC_PREFIX}/${tripId}`, JSON.stringify(message), { qos: 1, retain: false }, () => {
      client.end(true);
    });
  });

  client.on('error', () => {
    client.end(true);
  });
};