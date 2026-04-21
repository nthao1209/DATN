import { useEffect, useState } from 'react';
import mqtt from 'mqtt';

export type MqttBrokerStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';

const MQTT_WS_URL = import.meta.env.VITE_MQTT_WS_URL || 'wss://mqtt.toolhub.app:8084/mqtt';
const MQTT_USERNAME = import.meta.env.VITE_MQTT_USERNAME || '';
const MQTT_PASSWORD = import.meta.env.VITE_MQTT_PASSWORD || '';

const getClientId = () => `web_status_${Math.random().toString(16).slice(2)}_${Date.now()}`;

export const useMqttBrokerStatus = () => {
  const [status, setStatus] = useState<MqttBrokerStatus>('connecting');

  useEffect(() => {
    const client = mqtt.connect(MQTT_WS_URL, {
      username: MQTT_USERNAME || undefined,
      password: MQTT_PASSWORD || undefined,
      clientId: getClientId(),
      clean: true,
      reconnectPeriod: 5000,
      connectTimeout: 10000,
      keepalive: 30,
    });

    client.on('connect', () => setStatus('connected'));
    client.on('reconnect', () => setStatus('reconnecting'));
    client.on('close', () => setStatus('disconnected'));
    client.on('offline', () => setStatus('disconnected'));
    client.on('error', () => setStatus('error'));

    return () => {
      client.end(true);
    };
  }, []);

  return status;
};