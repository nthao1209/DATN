import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

type BusRoundStatus = {
  busId: number;
  roundId: number;
  checkInLocked?: boolean;
  checkOutLocked?: boolean;
};

export const useRoundLocks = (
  tripId: number | null,
  getActualBusId: (passengerId: number, roundId: number, assignedBusId?: number | null) => number | null
) => {
  const { data: lockStatuses = [], refetch: refetchLocks } = useQuery<BusRoundStatus[]>({
    queryKey: ['bus-round-locks', tripId],
    queryFn: async () => {
      const data = await api.getBusRoundStatuses(String(tripId));
      return Array.isArray(data) ? data : [];
    },
    enabled: !!tripId,
  });


  const isLocked = (
    passengerId: number,
    assignedBusId: number | null,
    roundId: number,
    type: 'checkIn' | 'checkOut'
  ) => {
    const actualBusId = getActualBusId(
      passengerId,
      roundId,
      assignedBusId
    );

    if (actualBusId == null) return false;
    
    const status = lockStatuses.find(
      (s) =>
        Number(s.busId) === Number(actualBusId) &&
        Number(s.roundId) === Number(roundId)
    );

    if (!status) return false;

    return type === 'checkIn'
      ? Boolean(status.checkInLocked)
      : Boolean(status.checkOutLocked);
  };

  return {
    isLocked,
    refetchLocks,
    lockStatuses,
  };
};