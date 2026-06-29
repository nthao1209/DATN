import { useEffect, useState } from 'react';
import { getMqttStatus, subscribeMqttStatus, type MqttBrokerStatus } from '../services/mqtt';

const resolveVisibleStatus = (mqttStatus: MqttBrokerStatus): MqttBrokerStatus => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'disconnected';
  }

  return mqttStatus;
};

export const useMqttBrokerStatus = () => {
  const [status, setStatus] = useState<MqttBrokerStatus>(() => resolveVisibleStatus(getMqttStatus()));

  useEffect(() => {
    const syncStatus = () => {
      setStatus(resolveVisibleStatus(getMqttStatus()));
    };

    const unsubscribe = subscribeMqttStatus((nextStatus) => {
      setStatus(resolveVisibleStatus(nextStatus));
    });

    window.addEventListener('online', syncStatus);
    window.addEventListener('offline', syncStatus);

    return () => {
      unsubscribe();
      window.removeEventListener('online', syncStatus);
      window.removeEventListener('offline', syncStatus);
    };
  }, []);

  return status;
};
