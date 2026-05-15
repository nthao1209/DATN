import { useEffect, useState } from 'react';
import { getMqttStatus, subscribeMqttStatus, type MqttBrokerStatus } from '../services/mqtt';

export const useMqttBrokerStatus = () => {
  const [status, setStatus] = useState<MqttBrokerStatus>(getMqttStatus());

  useEffect(() => {
    const unsubscribe = subscribeMqttStatus(setStatus);

    return () => {
      unsubscribe();
    };
  }, []);

  return status;
};