import mqtt from 'mqtt';

const MQTT_URL = 'wss://mqtt.toolhub.app:8084';
const MQTT_USERNAME = process.env.MQTT_USERNAME;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD;
const MQTT_UI_TOPIC_PREFIX = process.env.MQTT_UI_TOPIC_PREFIX || 'attendance/ui/trip';
const MQTT_DASHBOARD_TOPIC_PREFIX = process.env.MQTT_DASHBOARD_TOPIC_PREFIX || 'dashboard/tenant';

const mqttClient = mqtt.connect(MQTT_URL, {
  username: MQTT_USERNAME,
  password: MQTT_PASSWORD,
  clean: true,
  clientId: `backend_${Date.now()}_${Math.random().toString(16).slice(2)}`,
});

mqttClient.on('connect', () => {
  console.log('[MQTT] connected');
});

mqttClient.on('error', (error) => {
  console.error('[MQTT] error:', error);
});

const toMessage = (payload: unknown) => (typeof payload === 'string' ? payload : JSON.stringify(payload));

export const publishJson = (topic: string, payload: unknown, qos = 1) => {
  if (!mqttClient.connected) {
    console.warn('[MQTT] not connected');
    return;
  }

  mqttClient.publish(topic, toMessage(payload), { qos : 1 });
};

export const publishToTripTopic = (tripId: number, payload: unknown, qos = 1) => {
  publishJson(`${MQTT_UI_TOPIC_PREFIX}/${tripId}`, payload, qos);
};

export const publishDashboardRefresh = (tenantId: number, payload: unknown, qos = 1) => {
  publishJson(`${MQTT_DASHBOARD_TOPIC_PREFIX}/${tenantId}`, payload, qos);
};

export const getMqttClient = () => mqttClient;