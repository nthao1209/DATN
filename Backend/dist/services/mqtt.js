"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMqttClient = exports.publishDashboardRefresh = exports.publishToTripTopic = exports.publishJson = void 0;
const mqtt_1 = __importDefault(require("mqtt"));
const MQTT_URL = 'wss://mqtt.toolhub.app:8084';
const MQTT_USERNAME = process.env.MQTT_USERNAME;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD;
const MQTT_UI_TOPIC_PREFIX = process.env.MQTT_UI_TOPIC_PREFIX || 'attendance/ui/trip';
const MQTT_DASHBOARD_TOPIC_PREFIX = process.env.MQTT_DASHBOARD_TOPIC_PREFIX || 'dashboard/tenant';
const mqttClient = mqtt_1.default.connect(MQTT_URL, {
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
    clean: true,
    clientId: `backend_${Date.now()}_${Math.random().toString(16).slice(2)}`,
});
mqttClient.on('connect', () => {
});
mqttClient.on('error', (error) => {
});
const toMessage = (payload) => (typeof payload === 'string' ? payload : JSON.stringify(payload));
const publishJson = (topic, payload, qos = 1) => {
    if (!mqttClient.connected) {
        return;
    }
    mqttClient.publish(topic, toMessage(payload), { qos: 1 });
};
exports.publishJson = publishJson;
const publishToTripTopic = (tripId, payload, qos = 1) => {
    (0, exports.publishJson)(`${MQTT_UI_TOPIC_PREFIX}/${tripId}`, payload, qos);
};
exports.publishToTripTopic = publishToTripTopic;
const publishDashboardRefresh = (tenantId, payload, qos = 1) => {
    (0, exports.publishJson)(`${MQTT_DASHBOARD_TOPIC_PREFIX}/${tenantId}`, payload, qos);
};
exports.publishDashboardRefresh = publishDashboardRefresh;
const getMqttClient = () => mqttClient;
exports.getMqttClient = getMqttClient;
