import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';
import { useNotification } from '../../contexts/NotificationContext';
import {
  subscribeAdminUnlockRequests,
  subscribeRequesterUnlockResponse,
  subscribeLockUpdates,
  type MqttSubscriptionHandle,
} from '../../services/mqtt';
import { type RootState } from '../../redux/store';
import { ROLE_IDS } from '../../auth/rbac';

interface MqttUnlockListenerProps {
  tripId?: number;
  roleId?: number | null;
  adminUserId?: number | null;
  enabled?: boolean;
  listenRequester?: boolean;
}

export const MqttUnlockListener = ({
  tripId,
  roleId,
  adminUserId,
  enabled = true,
  listenRequester = true,
}: MqttUnlockListenerProps) => {
  const { addNotification, refreshNotifications } = useNotification();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    if (!enabled || authLoading || !user?.id) {
      return;
    }

    const subscriptions: MqttSubscriptionHandle[] = [];

    if (roleId === ROLE_IDS.ADMIN && adminUserId) {
      const adminSub = subscribeAdminUnlockRequests(adminUserId, (message) => {
        addNotification(
          `Xe ${message.busCode} yêu cầu mở khóa ${
            message.lockType === 'check_in' ? 'điểm danh vào' : 'điểm danh ra'
          } cho tuyến ${message.roundName}. Lý do: ${message.reason}`,
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

    if (listenRequester) {
      const requesterSub = subscribeRequesterUnlockResponse(user.id, (message) => {
        if (message.type === 'unlock.request.created.self') {
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
    }

    if (tripId) {
      const lockSub = subscribeLockUpdates(tripId, (message) => {
        if (message.type === 'round.lock.changed' || message.type === 'bus.round.lock.updated') {
          void refreshNotifications();
          queryClient.invalidateQueries({ queryKey: ['bus-round-locks', message.tripId] });
        }
      });
      subscriptions.push(lockSub);
    }

    return () => {
      subscriptions.forEach((sub) => sub.end(true));
    };
  }, [
    tripId,
    roleId,
    adminUserId,
    enabled,
    listenRequester,
    authLoading,
    user?.id,
    addNotification,
    refreshNotifications,
    queryClient,
  ]);

  return null;
};
