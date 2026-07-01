import { useQuery } from '@tanstack/react-query';
import api from '../../../services/api';
import type { BusOption, BusRoundStatus, RoundOption, TransactionRecord, TripOption } from './types';

export const useTransactionData = (selectedTripId: number | null) => {
  // Lấy danh sách chuyến để hiển thị dropdown chọn chuyến.
  const {
    data: trips = [],
    isLoading: tripsLoading,
  } = useQuery<TripOption[]>({
    queryKey: ['trips'],
    queryFn: api.getTrips,
  });

  // Khi đã chọn chuyến, lấy danh sách xe thuộc chuyến đó.
  const {
    data: buses = [],
    isLoading: busesLoading,
  } = useQuery<BusOption[]>({
    queryKey: ['transaction-buses', selectedTripId],
    queryFn: () => api.getBuses(String(selectedTripId)),
    enabled: !!selectedTripId,
  });

  // Lấy danh sách chặng/vòng của chuyến đang chọn.
  const {
    data: rounds = [],
    isLoading: roundsLoading,
  } = useQuery<RoundOption[]>({
    queryKey: ['transaction-rounds', selectedTripId],
    queryFn: () => api.getRounds(String(selectedTripId)),
    enabled: !!selectedTripId,
  });

  // Lấy danh sách hành khách theo chuyến để dựng các dòng trong bảng điểm danh.
  const {
    data: passengers = [],
    isLoading: passengersLoading,
    refetch: refetchPassengers,
  } = useQuery<any[]>({
    queryKey: ['transaction-passengers', selectedTripId],
    queryFn: () => api.getAttendancePassengers(String(selectedTripId)),
    enabled: !!selectedTripId,
  });

  // Lấy dữ liệu điểm danh đã lưu trong database.
  const {
    data: transactions = [],
    isLoading: transactionsLoading,
    refetch: refetchTransactions,
  } = useQuery<TransactionRecord[]>({
    queryKey: ['transactions', selectedTripId],
    queryFn: () => api.getTransactions(),
    enabled: !!selectedTripId,
  });

  // Lấy trạng thái khóa/xác nhận theo từng cặp xe - chặng.
  const {
    data: busRoundStatuses = [],
    refetch: refetchBusRoundStatuses,
  } = useQuery<BusRoundStatus[]>({
    queryKey: ['transaction-bus-round-statuses', selectedTripId],
    queryFn: async () => {
      const response = await api.getBusRoundStatuses(String(selectedTripId));
      const data = Array.isArray(response)
        ? response
        : Array.isArray((response as any)?.data)
          ? (response as any).data
          : [];

      return data as BusRoundStatus[];
    },
    enabled: !!selectedTripId,
  });

  // Trả về cả dữ liệu và hàm refetch để page/hook realtime dùng lại sau khi có thay đổi.
  return {
    trips,
    tripsLoading,
    buses,
    busesLoading,
    rounds,
    roundsLoading,
    passengers,
    passengersLoading,
    transactions,
    transactionsLoading,
    refetchPassengers,
    refetchTransactions,
    busRoundStatuses,
    refetchBusRoundStatuses,
  };
};
