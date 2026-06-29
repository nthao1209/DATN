import { useCallback, useEffect, useRef } from 'react';
import { useSnackbar } from 'notistack';
import { offlineService, OFFLINE_QUEUE_UPDATED_EVENT } from '../../services/offlineSync';
import {
  ensureMqttConnected,
  getMqttStatus,
  publishAttendanceAction,
  type MqttBrokerStatus,
} from '../../services/mqtt';
import { useMqttBrokerStatus } from '../../hooks/useMqttBrokerStatus';

const SyncManager: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const mqttStatus = useMqttBrokerStatus();
  const isFlushingRef = useRef(false);
  const retryTimerRef = useRef<number | null>(null);
  const flushQueueRef = useRef<() => void>(() => {});
  const previousMqttStatusRef = useRef<MqttBrokerStatus | null>(null);

  const scheduleRetry = useCallback(() => {
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
    }

    retryTimerRef.current = window.setTimeout(() => {
      retryTimerRef.current = null;
      flushQueueRef.current();
    }, 3000);
  }, []);

  const flushQueue = useCallback(async () => {
    if (isFlushingRef.current || !navigator.onLine) {
      return;
    }

    const initialQueueCount = offlineService.getQueue().length;
    if (!initialQueueCount) {
      return;
    }

    isFlushingRef.current = true;
    let syncedCount = 0;

    try {
      try {
        await ensureMqttConnected();
      } catch {
        enqueueSnackbar(
          `Có ${initialQueueCount} thao tác điểm danh đang chờ đồng bộ. Chưa kết nối được MQTT, hệ thống sẽ thử lại.`,
          {
            variant: 'warning',
            autoHideDuration: 4000,
          },
        );
        scheduleRetry();
        return;
      }

      while (navigator.onLine && getMqttStatus() === 'connected') {
        const queue = offlineService.getQueue().sort((a, b) => a.timestamp - b.timestamp);
        if (!queue.length) {
          break;
        }

        for (const action of queue) {
          if (!navigator.onLine || getMqttStatus() !== 'connected') {
            break;
          }

          offlineService.markSyncing(action.id);
          try {
            await publishAttendanceAction(action);
            offlineService.removeFromQueue(action.id);
            syncedCount += 1;
          } catch (error: any) {
            offlineService.markPending(action.id);
            enqueueSnackbar(
              error?.message ||
                'Chưa nhận được xác nhận DB cho thao tác điểm danh. Hệ thống sẽ tự thử lại.',
              {
                variant: 'warning',
                autoHideDuration: 5000,
              },
            );
            window.setTimeout(() => {
              void flushQueue();
            }, 5000);
            break;
          }
        }

        if (!navigator.onLine || getMqttStatus() !== 'connected') {
          break;
        }
      }

      const remainingQueueCount = offlineService.getQueue().length;
      if (syncedCount > 0 && remainingQueueCount === 0) {
        enqueueSnackbar(`Đã đồng bộ ${syncedCount} thao tác điểm danh vào DB thành công.`, {
          variant: 'success',
          autoHideDuration: 3500,
        });
      } else if (syncedCount > 0 && remainingQueueCount > 0) {
        enqueueSnackbar(
          `Đã đồng bộ ${syncedCount} thao tác, còn ${remainingQueueCount} thao tác đang chờ xác nhận DB.`,
          {
            variant: 'info',
            autoHideDuration: 4000,
          },
        );
      }
    } 
    finally {
      isFlushingRef.current = false;
    }
  }, [enqueueSnackbar, scheduleRetry]);

  useEffect(() => {
    flushQueueRef.current = () => {
      void flushQueue();
    };
  }, [flushQueue]);

  useEffect(() => {
    void flushQueue();
  }, [flushQueue, mqttStatus]);

  useEffect(() => {
    const previousStatus = previousMqttStatusRef.current;
    previousMqttStatusRef.current = mqttStatus;

    if (previousStatus === null) {
      return;
    }

    const queueCount = offlineService.getQueue().length;
    if (!queueCount) {
      return;
    }

    if (
      mqttStatus === 'connected' &&
      (previousStatus === 'disconnected' || previousStatus === 'reconnecting' || previousStatus === 'error')
    ) {
      enqueueSnackbar(`MQTT đã kết nối lại. Đang đồng bộ ${queueCount} thao tác điểm danh.`, {
        variant: 'info',
        autoHideDuration: 3500,
      });
      void flushQueue();
    }

    if (
      mqttStatus === 'disconnected' &&
      (previousStatus === 'connected' || previousStatus === 'reconnecting')
    ) {
      enqueueSnackbar(`Mất kết nối MQTT. ${queueCount} thao tác điểm danh sẽ được giữ lại để đồng bộ sau.`, {
        variant: 'warning',
        autoHideDuration: 4500,
      });
    }
  }, [enqueueSnackbar, flushQueue, mqttStatus]);

  useEffect(() => {
    const handleOffline = () => {
      const queueCount = offlineService.getQueue().length;
      enqueueSnackbar(
        queueCount > 0
          ? `Mất mạng. ${queueCount} thao tác điểm danh đang được lưu tạm trên máy.`
          : 'Mất mạng. Các thao tác điểm danh mới sẽ được lưu tạm trên máy.',
        {
          variant: 'warning',
          autoHideDuration: 4500,
        },
      );
    };

    const handleOnline = () => {
      const queueCount = offlineService.getQueue().length;
      enqueueSnackbar(
        queueCount > 0
          ? `Đã có mạng lại. Đang đồng bộ ${queueCount} thao tác điểm danh.`
          : 'Đã có mạng lại.',
        {
          variant: queueCount > 0 ? 'info' : 'success',
          autoHideDuration: 3500,
        },
      );
      void flushQueue();
    };

    const handleQueueUpdated = () => {
      void flushQueue();
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    window.addEventListener(OFFLINE_QUEUE_UPDATED_EVENT, handleQueueUpdated as EventListener);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener(OFFLINE_QUEUE_UPDATED_EVENT, handleQueueUpdated as EventListener);
    };
  }, [enqueueSnackbar, flushQueue]);

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
