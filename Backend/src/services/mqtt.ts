import mqtt from 'mqtt';

const MQTT_URL = process.env.MQTT_URL || 'wss://mqtt.toolhub.app:8084';
const MQTT_USERNAME = process.env.MQTT_USERNAME;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD;
const MQTT_DASHBOARD_TOPIC_PREFIX = process.env.MQTT_DASHBOARD_TOPIC_PREFIX || 'dashboard/tenant';

// Backend dùng một MQTT client chung để publish realtime event cho frontend/worker.
const mqttClient = mqtt.connect(MQTT_URL, {
  username: MQTT_USERNAME,
  password: MQTT_PASSWORD,
  clean: true,
  clientId: `backend_${Date.now()}_${Math.random().toString(16).slice(2)}`,
});


mqttClient.on('connect', () => {
});

mqttClient.on('error', () => {});

const toMessage = (payload: unknown) => (typeof payload === 'string' ? payload : JSON.stringify(payload));

type PublishOptions = {
  retain?: boolean;
};

export const publishJson = (topic: string, payload: unknown, qos: 0 | 1 | 2 = 1, options: PublishOptions = {}) => {
  // Nếu broker chưa kết nối thì bỏ qua publish để request HTTP không bị treo.
  if (!mqttClient.connected) {
    return;
  }

  mqttClient.publish(topic, toMessage(payload), { qos, retain: options.retain ?? false });
};

export const publishDashboardRefresh = (tenantId: number, payload: unknown, qos: 0 | 1 | 2 = 1) => {
  // Dashboard nghe theo tenant để chỉ refresh dữ liệu của đúng tổ chức.
  publishJson(`${MQTT_DASHBOARD_TOPIC_PREFIX}/${tenantId}`, payload, qos);
};
