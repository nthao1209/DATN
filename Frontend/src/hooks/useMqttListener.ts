import { useEffect } from 'react';
import { getMqttStatus, subscribeMqttTopics } from '../services/mqtt';

interface MqttMessage {
  type: string;
  [key: string]: any;
}

interface UseMqttListenerOptions {
  topics: string[];
  onMessage: (topic: string, message: MqttMessage) => void;
  enabled?: boolean;
}

export const useMqttListener = ({ topics, onMessage, enabled = true }: UseMqttListenerOptions) => {
  useEffect(() => {
    if (!enabled || topics.length === 0) return;

    const subscription = subscribeMqttTopics(topics, (topic, message) => {
      const parsed = message as MqttMessage;
      onMessage(topic, parsed);
    });

    return () => {
      subscription.end(true);
    };
  }, [topics, onMessage, enabled]);

  return { isConnected: getMqttStatus() === 'connected' };
};
