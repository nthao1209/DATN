import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { offlineService, OFFLINE_QUEUE_UPDATED_EVENT } from '../../services/offlineSync';
import { publishAttendanceAction } from '../../services/mqtt';
import { useMqttBrokerStatus } from '../../hooks/useMqttBrokerStatus';

const SyncManager: React.FC = () => {
  const queryClient = useQueryClient();
  const mqttStatus = useMqttBrokerStatus();
  const isFlushingRef = useRef(false);

  const flushQueue = useCallback(async () => {
    if (isFlushingRef.current || !navigator.onLine || mqttStatus !== 'connected') {
      return;
    }

    const queue = offlineService.getQueue().sort((a, b) => a.timestamp - b.timestamp);
    if (!queue.length) {
      return;
    }

    isFlushingRef.current = true;

    try {
      for (const action of queue) {
        if (!navigator.onLine || mqttStatus !== 'connected') {
          break;
        }

        offlineService.markSyncing(action.id);
        await publishAttendanceAction(action);
        offlineService.removeFromQueue(action.id);
      }

      await queryClient.invalidateQueries();
    } catch (error) {
      console.error('Offline sync failed:', error);
    } finally {
      isFlushingRef.current = false;
    }
  }, [mqttStatus, queryClient]);

  useEffect(() => {
    void flushQueue();
  }, [flushQueue, mqttStatus]);

  useEffect(() => {
    const handleOnline = () => {
      void flushQueue();
    };

    const handleQueueUpdated = () => {
      void flushQueue();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener(OFFLINE_QUEUE_UPDATED_EVENT, handleQueueUpdated as EventListener);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener(OFFLINE_QUEUE_UPDATED_EVENT, handleQueueUpdated as EventListener);
    };
  }, [flushQueue]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void flushQueue();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [flushQueue]);

  return null;
};

export default SyncManager;