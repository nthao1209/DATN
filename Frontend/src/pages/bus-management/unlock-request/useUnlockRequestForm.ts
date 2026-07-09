import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { useSnackbar } from 'notistack';
import { ROLE_IDS } from '../../../auth/rbac';
import { useCreateUnlockRequest } from '../../../hooks/useUnlockRequests';
import { type RootState } from '../../../redux/store';
import api from '../../../services/api';

export type RequestType = 'check_in' | 'check_out';

export const useUnlockRequestForm = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { currentTenant, roleId } = useSelector((state: RootState) => state.auth);
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [selectedBusId, setSelectedBusId] = useState<number | null>(null);
  const [selectedRoundId, setSelectedRoundId] = useState<number | null>(null);
  const [requestType, setRequestType] = useState<RequestType>('check_in');
  const [reason, setReason] = useState('');

  const { data: trips = [], isLoading: tripsLoading } = useQuery<any[]>({
    queryKey: ['unlock-request-trips'],
    queryFn: api.getTrips,
    enabled: roleId === ROLE_IDS.BUS_MANAGEMENT,
  });

  const { data: buses = [], isLoading: busesLoading } = useQuery<any[]>({
    queryKey: ['unlock-request-buses', selectedTripId],
    queryFn: () => api.getBuses(String(selectedTripId)),
    enabled: !!selectedTripId,
  });

  const { data: rounds = [], isLoading: roundsLoading } = useQuery<any[]>({
    queryKey: ['unlock-request-rounds', selectedTripId],
    queryFn: () => api.getRounds(String(selectedTripId)),
    enabled: !!selectedTripId,
  });

  const { data: busRoundStatuses = [] } = useQuery<any[]>({
    queryKey: ['unlock-request-bus-round-statuses', selectedTripId],
    queryFn: async () => {
      if (!selectedTripId) return [];

      const response = await api.getBusRoundStatuses(String(selectedTripId));
      const data = Array.isArray(response)
        ? response
        : Array.isArray((response as any)?.data)
          ? (response as any).data
          : [];

      return data;
    },
    enabled: !!selectedTripId,
  });

  const currentStatus = busRoundStatuses.find(
    (status: any) =>
      Number(status.busId) === Number(selectedBusId) &&
      Number(status.roundId) === Number(selectedRoundId)
  ) as any | undefined;
  const requestLocked = Boolean(currentStatus?.driverConfirmedBy);
  const createRequest = useCreateUnlockRequest();
  const selectedBus = buses.find((bus: any) => Number(bus.id) === Number(selectedBusId));
  const selectedRound = rounds.find((round: any) => Number(round.id) === Number(selectedRoundId));

  useEffect(() => {
    if (trips.length === 0) {
      setSelectedTripId(null);
      return;
    }

    setSelectedTripId((prev) => {
      if (prev && trips.some((trip) => Number(trip.id) === prev)) {
        return prev;
      }
      return Number(trips[0].id);
    });
  }, [trips]);

  useEffect(() => {
    setSelectedBusId(null);
    setSelectedRoundId(null);
  }, [selectedTripId]);

  useEffect(() => {
    if (buses.length === 0) {
      setSelectedBusId(null);
      return;
    }

    setSelectedBusId((prev) => {
      if (prev && buses.some((bus) => Number(bus.id) === prev)) {
        return prev;
      }
      return Number(buses[0].id);
    });
  }, [buses]);

  useEffect(() => {
    if (rounds.length === 0) {
      setSelectedRoundId(null);
      return;
    }

    setSelectedRoundId((prev) => {
      if (prev && rounds.some((round) => Number(round.id) === prev)) {
        return prev;
      }
      return Number(rounds[0].id);
    });
  }, [rounds]);

  const handleSubmit = async () => {
    if (!selectedTripId || !selectedBusId || !selectedRoundId) {
      enqueueSnackbar('Vui lòng chọn chuyến đi, xe và chặng.', {
        variant: 'warning',
      });
      return;
    }

    if (roleId !== ROLE_IDS.BUS_MANAGEMENT) {
      enqueueSnackbar('Bạn không có quyền gửi yêu cầu mở điểm danh.', {
        variant: 'error',
      });
      return;
    }

    if (requestLocked) {
      enqueueSnackbar('Chặng này đã được bạn xác nhận hoàn thành nên không thể gửi yêu cầu mở khóa nữa.', { variant: 'warning' });
      return;
    }

    try {
      if (!currentStatus) {
        enqueueSnackbar('Không tìm thấy trạng thái khóa.', {
          variant: 'warning',
        });
        return;
      }

      const isLocked =
        requestType === 'check_in'
          ? Boolean(currentStatus.checkInLocked)
          : Boolean(currentStatus.checkOutLocked);

      if (!isLocked) {
        enqueueSnackbar(
          requestType === 'check_in'
            ? 'Điểm danh vào chưa bị khóa.'
            : 'Điểm danh ra chưa bị khóa.',
          { variant: 'info' }
        );
        return;
      }

      await createRequest.mutateAsync({
        busId: selectedBusId,
        roundId: selectedRoundId,
        type: requestType,
        reason,
      });

      const successMessage =
        'Yêu cầu mở khóa đã được gửi cho trưởng đoàn trong chặng ' +
        (selectedRound?.name || 'đã chọn') +
        (selectedBus?.busCode ? ' (' + selectedBus.busCode + ')' : '') +
        '.';
      enqueueSnackbar(successMessage, { variant: 'success' });

      setReason('');
    } catch (error: any) {
      enqueueSnackbar(
        error?.response?.data?.message ||
          error?.message ||
          'Gửi yêu cầu thất bại',
        { variant: 'error' }
      );
    }
  };
  return {
    currentTenant,
    selectedTripId,
    setSelectedTripId,
    selectedBusId,
    setSelectedBusId,
    selectedRoundId,
    setSelectedRoundId,
    requestType,
    setRequestType,
    reason,
    setReason,
    trips,
    buses,
    rounds,
    createRequest,
    requestLocked,
    isLoading: tripsLoading || busesLoading || roundsLoading,
    handleSubmit,
  };
};
