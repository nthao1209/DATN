import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';
import { useRoundLocks } from '../../../hooks/useRoundLocks';
import { subscribeMqttTopics } from '../../../services/mqtt';

const EMPTY_UNLOCK_REQUESTS: any[] = [];

type LockModalState = {
  roundId: number;
  lockType: 'check_in' | 'check_out';
} | null;

export const useRoundLockManagement = ({
  tripId,
  enqueueSnackbar,
}: {
  tripId?: string;
  enqueueSnackbar: (message: string, options?: any) => void;
}) => {
  const queryClient = useQueryClient();
  const [openLockModal, setOpenLockModal] = useState<LockModalState>(null);
  const [toggling, setToggling] = useState<Record<string, boolean>>({});

  const { lockStatuses = [], refetchLocks } = useRoundLocks(
    tripId ? Number(tripId) : null,
    () => null
  );

  const { data: unlockRequestsData, refetch: refetchUnlockRequests } = useQuery<any[]>({
    queryKey: ['unlock-requests', tripId, openLockModal?.roundId],
    queryFn: async () => {
      const response = await api.getPendingUnlockRequests(String(tripId), String(openLockModal?.roundId));
      return Array.isArray(response) ? response : [];
    },
    enabled: !!tripId && !!openLockModal?.roundId,
  });

  const unlockRequests = unlockRequestsData ?? EMPTY_UNLOCK_REQUESTS;

  useEffect(() => {
    const subscription = subscribeMqttTopics(['attendance/ui/locks'], (_topic, message: any) => {
      if (Number(message?.tripId) !== Number(tripId)) return;

      if (message.type === 'bus.round.lock.updated') {
        queryClient.setQueryData(['bus-round-locks', tripId], (oldData: any[]) => {
          if (!oldData) return oldData;
          return oldData.map((item) =>
            Number(item.busId) === message.busId && Number(item.roundId) === message.roundId
              ? {
                  ...item,
                  checkInLocked: message.checkInLocked,
                  checkOutLocked: message.checkOutLocked,
                }
              : item
          );
        });
        refetchLocks();
      }

      if (
        message.type === 'unlock.request.created' ||
        message.type === 'unlock.request.approved' ||
        message.type === 'unlock.request.rejected'
      ) {
        refetchUnlockRequests();
      }
    });

    return () => {
      subscription.end(true);
    };
  }, [queryClient, tripId, refetchLocks, refetchUnlockRequests]);

  const toggleLock = async (
    busId: number,
    roundId: number,
    value: boolean,
    lockType: 'check_in' | 'check_out'
  ) => {
    const key = `${busId}_${roundId}_${lockType}`;
    setToggling((state) => ({ ...state, [key]: true }));
    try {
      await api.confirmBusRoundChecks(
        Number(busId),
        Number(roundId),
        lockType === 'check_in' ? { checkInLocked: value } : { checkOutLocked: value }
      );
      enqueueSnackbar(
        `${value ? 'Đã khóa' : 'Đã mở khóa'} ${lockType === 'check_in' ? 'lượt đi' : 'lượt về'} cho xe ${busId}`,
        { variant: 'success' }
      );
      refetchLocks();
    } catch (err: any) {
      enqueueSnackbar(err?.message || 'Lỗi khi cập nhật khóa', { variant: 'error' });
    } finally {
      setToggling((state) => ({ ...state, [key]: false }));
    }
  };

  const handleUnlockRequest = async (
    requestId: number,
    status: 'APPROVED' | 'REJECTED',
    rejectReason?: string
  ) => {
    try {
      if (status === 'APPROVED') {
        await api.approveUnlockRequest(requestId);
      } else {
        await api.rejectUnlockRequest(requestId, { rejectReason });
      }

      enqueueSnackbar(
        status === 'APPROVED'
          ? 'Đã phê duyệt yêu cầu mở khóa'
          : 'Đã từ chối yêu cầu mở khóa',
        { variant: 'success' }
      );
      refetchUnlockRequests();
    } catch (err: any) {
      enqueueSnackbar(err?.message || 'Lỗi khi xử lý yêu cầu mở khóa', { variant: 'error' });
    }
  };

  return {
    openLockModal,
    setOpenLockModal,
    lockStatuses,
    refetchLocks,
    unlockRequests,
    refetchUnlockRequests,
    toggling,
    toggleLock,
    handleUnlockRequest,
  };
};
