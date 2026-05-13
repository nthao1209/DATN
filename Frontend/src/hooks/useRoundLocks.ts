// hooks/useRoundLocks.ts
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

type BusRoundStatus = {
  busId: number;
  roundId: number;
  checkInLocked?: boolean;
  checkOutLocked?: boolean;
};

export const useRoundLocks = (tripId: number | null) => {
  const { data: lockStatuses = [], refetch: refetchLocks } = useQuery<BusRoundStatus[]>({
    queryKey: ['bus-round-locks', tripId],
    queryFn: async () => {
      const data = await api.getBusRoundStatuses(String(tripId));
      return Array.isArray(data) ? data : [];
    },
    enabled: !!tripId,
  });

  // Hàm trả về true nếu ô đó đã bị khóa
  const isLocked = (busId: number, roundId: number, type: 'checkIn' | 'checkOut') => {
    const status = lockStatuses.find(
      (s) => Number(s.busId) === Number(busId) && Number(s.roundId) === Number(roundId)
    );
    
    if (!status) return false;
    return type === 'checkIn' ? Boolean(status.checkInLocked) : Boolean(status.checkOutLocked);
  };

  return { isLocked, refetchLocks };
};