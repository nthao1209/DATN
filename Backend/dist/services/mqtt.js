"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishDashboardRefresh = exports.publishJson = void 0;
const mqtt_1 = __importDefault(require("mqtt"));
const MQTT_URL = process.env.MQTT_URL || 'wss://mqtt.toolhub.app:8084';
const MQTT_USERNAME = process.env.MQTT_USERNAME;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD;
const MQTT_DASHBOARD_TOPIC_PREFIX = process.env.MQTT_DASHBOARD_TOPIC_PREFIX || 'dashboard/tenant';
// Backend dùng một MQTT client chung để publish realtime event cho frontend/worker.
const mqttClient = mqtt_1.default.connect(MQTT_URL, {
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
    clean: true,
    clientId: `backend_${Date.now()}_${Math.random().toString(16).slice(2)}`,
});
mqttClient.on('connect', () => {
});
mqttClient.on('error', () => { });
const toMessage = (payload) => (typeof payload === 'string' ? payload : JSON.stringify(payload));
const publishJson = (topic, payload, qos = 1, options = {}) => {
    // Nếu broker chưa kết nối thì bỏ qua publish để request HTTP không bị treo.
    if (!mqttClient.connected) {
        return;
    }
    mqttClient.publish(topic, toMessage(payload), { qos, retain: options.retain ?? false });
};
exports.publishJson = publishJson;
const publishDashboardRefresh = (tenantId, payload, qos = 1) => {
    // Dashboard nghe theo tenant để chỉ refresh dữ liệu của đúng tổ chức.
    (0, exports.publishJson)(`${MQTT_DASHBOARD_TOPIC_PREFIX}/${tenantId}`, payload, qos);
};
exports.publishDashboardRefresh = publishDashboardRefresh;
