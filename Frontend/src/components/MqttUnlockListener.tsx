import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNotification } from '../contexts/NotificationContext';
import { subscribeAdminUnlockRequests, subscribeRequesterUnlockResponse, subscribeLockUpdates, type MqttSubscriptionHandle } from '../services/mqtt';
import { useQueryClient } from '@tanstack/react-query';
import { type RootState } from '../redux/store';

interface MqttUnlockListenerProps {
  tripId?: number;
  roleId?: number | null;
  enabled?: boolean;
}

export const MqttUnlockListener = ({ tripId, roleId, enabled = true }: MqttUnlockListenerProps) => {
  const { addNotification, refreshNotifications } = useNotification();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    if (!enabled || !tripId || authLoading || !user?.id) {
      return;
    }

    const subscriptions: MqttSubscriptionHandle[] = [];

    // Admin listens to unlock requests
    if (roleId === 2) {
      const adminSub = subscribeAdminUnlockRequests(tripId, (message) => {
        console.log('[Unlock] Admin received unlock request:', message);
        addNotification(
          `Xe ${message.busCode} yêu cầu mở khóa ${message.lockType === 'check_in' ? 'điểm danh vào' : 'điểm danh ra'} cho tuyến ${message.roundName}. Lý do: ${message.reason}`,
          'info',
          7000,
          { showToast: true },
        );
        void refreshNotifications();
        queryClient.invalidateQueries({ queryKey: ['unlock-requests'] });
        queryClient.invalidateQueries({ queryKey: ['pending-unlock-requests', message.busId] });
      });
      subscriptions.push(adminSub);
    }

    // Requester listens to approval/rejection responses (personal)
    const requesterSub = subscribeRequesterUnlockResponse(user.id, (message) => {
      console.log('[Unlock] Requester received response:', message);
      if (message.type === 'unlock.request.created.self') {
        addNotification(
          `Đã gửi yêu cầu mở khóa cho xe ${message.busCode} - ${message.roundName}`,
          'info',
          5000,
          { showToast: true },
        );
        void refreshNotifications();
        queryClient.invalidateQueries({ queryKey: ['unlock-requests'] });
        queryClient.invalidateQueries({ queryKey: ['pending-unlock-requests', message.busId] });
        return;
      }

      if (message.type === 'unlock.request.approved') {
        addNotification(
          `Yêu cầu mở khóa cho xe ${message.busCode} - ${message.roundName} đã được phê duyệt`,
          'success',
          5000,
          { showToast: true },
        );
        void refreshNotifications();
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
          { showToast: true },
        );
        void refreshNotifications();
        queryClient.invalidateQueries({ queryKey: ['pending-unlock-requests', message.busId] });
        queryClient.invalidateQueries({ queryKey: ['unlock-requests'] });
        queryClient.invalidateQueries({ queryKey: ['bus-round-locks', message.tripId] });
      }
    });
    subscriptions.push(requesterSub);

    // All users listen to lock changes
    const lockSub = subscribeLockUpdates(tripId, (message) => {
      console.log('[Unlock] Lock update:', message);
      if (message.type === 'round.lock.changed' || message.type === 'bus.round.lock.updated') {
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
          { showToast: true },
        );
        void refreshNotifications();
        queryClient.invalidateQueries({ queryKey: ['bus-round-locks', message.tripId] });
      }
    });
    subscriptions.push(lockSub);

    return () => {
      subscriptions.forEach((sub) => sub.end(true));
    };
  }, [tripId, roleId, enabled, authLoading, user?.id, addNotification, refreshNotifications, queryClient]);

  return null;
};
