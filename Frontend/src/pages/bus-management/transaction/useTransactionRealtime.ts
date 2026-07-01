import { useEffect } from 'react';
import { subscribeAttendanceUpdates, subscribeLockUpdates } from '../../../services/mqtt';

type RealtimeRefetch = () => Promise<unknown>;

type UseTransactionRealtimeParams = {
  selectedTripId: number | null;
  refetchTransactions: RealtimeRefetch;
  refetchPassengers: RealtimeRefetch;
  refetchBusRoundStatuses: RealtimeRefetch;
  refetchLocks: RealtimeRefetch;
};

export const useTransactionRealtime = ({
  selectedTripId,
  refetchTransactions,
  refetchPassengers,
  refetchBusRoundStatuses,
  refetchLocks,
}: UseTransactionRealtimeParams) => {
  // Nghe các sự kiện điểm danh từ MQTT; khi có thay đổi thì nạp lại dữ liệu liên quan.
  useEffect(() => {
    if (!selectedTripId) return;

    const client = subscribeAttendanceUpdates(selectedTripId, async () => {
      await Promise.all([
        refetchTransactions(),
        refetchPassengers(),
        refetchBusRoundStatuses(),
        refetchLocks(),
      ]);
    });

    return () => {
      client.end(true);
    };
  }, [
    selectedTripId,
    refetchBusRoundStatuses,
    refetchLocks,
    refetchPassengers,
    refetchTransactions,
  ]);

  // Nghe các sự kiện khóa/mở khóa lượt; trạng thái khóa ảnh hưởng trực tiếp tới quyền sửa ô điểm danh.
  useEffect(() => {
    if (!selectedTripId) return;

    const client = subscribeLockUpdates(selectedTripId, async () => {
      await Promise.all([
        refetchTransactions(),
        refetchPassengers(),
        refetchBusRoundStatuses(),
        refetchLocks(),
      ]);
    });

    return () => {
      client.end(true);
    };
  }, [
    selectedTripId,
    refetchBusRoundStatuses,
    refetchLocks,
    refetchPassengers,
    refetchTransactions,
  ]);
};
