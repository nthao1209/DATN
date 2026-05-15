import { useEffect } from 'react';
import { useNotification } from '../contexts/NotificationContext';
import { subscribeUnlockRequestEvents } from '../services/mqtt';
import { useQueryClient } from '@tanstack/react-query';

interface MqttUnlockListenerProps {
  tripId?: number;
  roleId?: number | null;
  enabled?: boolean;
}

export const MqttUnlockListener = ({ tripId, roleId, enabled = true }: MqttUnlockListenerProps) => {
  const { addNotification } = useNotification();
  const queryClient = useQueryClient();

  const shouldNotify = (type: string) => {
    if (roleId === 2) {
      return type === 'unlock.request.created' || type === 'unlock.request.approved' || type === 'unlock.request.rejected' || type === 'round.lock.changed';
    }

    if (roleId === 3) {
      return type === 'unlock.request.approved' || type === 'unlock.request.rejected' || type === 'round.lock.changed';
    }

    return true;
  };

  useEffect(() => {
    if (!enabled || !tripId) {
      return;
    }

    const subscription = subscribeUnlockRequestEvents(tripId, (message) => {
      console.log('[Unlock] Received MQTT message:', message);

      if (!shouldNotify(message.type)) {
        return;
      }

      if (message.type === 'unlock.request.approved') {
        addNotification(
          `Yêu cầu mở khóa cho xe ${message.busCode} - ${message.roundName} đã được phê duyệt bởi ${message.approvedBy}`,
          'success',
          5000,
          { showToast: false, persist: true },
        );
        queryClient.invalidateQueries({ queryKey: ['pending-unlock-requests', message.busId] });
        queryClient.invalidateQueries({ queryKey: ['unlock-requests'] });
        queryClient.invalidateQueries({ queryKey: ['bus-round-locks', message.tripId] });
        return;
      }

      if (message.type === 'unlock.request.rejected') {
        addNotification(
          `Yêu cầu mở khóa cho xe ${message.busCode} - ${message.roundName} bị từ chối. Lý do: ${message.rejectReason}`,
          'error',
          6000,
          { showToast: false, persist: true },
        );
        queryClient.invalidateQueries({ queryKey: ['pending-unlock-requests', message.busId] });
        queryClient.invalidateQueries({ queryKey: ['unlock-requests'] });
        queryClient.invalidateQueries({ queryKey: ['bus-round-locks', message.tripId] });
        return;
      }

      if (message.type === 'unlock.request.created') {
        addNotification(
          `Xe ${message.busCode} yêu cầu mở khóa ${message.lockType === 'check_in' ? 'điểm danh vào' : 'điểm danh ra'} cho tuyến ${message.roundName}. Lý do: ${message.reason}`,
          'info',
          7000,
          { showToast: false, persist: true },
        );
        queryClient.invalidateQueries({ queryKey: ['unlock-requests'] });
        queryClient.invalidateQueries({ queryKey: ['pending-unlock-requests', message.busId] });
        return;
      }

      if (message.type === 'round.lock.changed') {
        const lockLabel = message.checkInLocked || message.checkOutLocked ? 'đã khóa' : 'đã mở khóa';
        const detailLabel = message.checkInLocked !== undefined
          ? 'lượt đi'
          : message.checkOutLocked !== undefined
            ? 'lượt về'
            : 'chặng';

        addNotification(
          `Xe ${message.busCode} ${lockLabel} ${detailLabel} của tuyến ${message.roundName} bởi ${message.lockedBy || 'Unknown'}`,
          'info',
          7000,
          { showToast: false, persist: true },
        );
        queryClient.invalidateQueries({ queryKey: ['bus-round-locks', message.tripId] });
      }
    });

    return () => {
      subscription.end(true);
    };
  }, [addNotification, enabled, queryClient, tripId, roleId]);

  return null;
};
