import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import {  Send, ShieldAlert, Sparkles } from 'lucide-react';
import { useSnackbar } from 'notistack';
import { type RootState } from '../redux/store';
import api from '../services/api';
import { useCreateUnlockRequest } from '../hooks/useUnlockRequests';
import { useTheme } from '../theme/ThemeContext';

type RequestType = 'check_in' | 'check_out';

const UnlockRequestPage: React.FC = () => {
  const { colors, effects, isDarkMode } = useTheme();
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
    enabled: roleId === 3,
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


  const createRequest = useCreateUnlockRequest();

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
  if (!selectedBusId || !selectedRoundId) {
    enqueueSnackbar('Vui lòng chọn xe và chặng đi.', {
      variant: 'warning',
    });
    return;
  }

  try {
    const statuses =await api.getBusRoundStatuses(
      String(selectedTripId)
    );
    console.log(statuses);

    const currentStatus = statuses.find(
      (s: any) =>
        Number(s.busId) === Number(selectedBusId) &&
        Number(s.roundId) === Number(selectedRoundId)
    );

    if (!currentStatus) {
      enqueueSnackbar(
        'Không tìm thấy trạng thái khóa.',
        { variant: 'warning' }
      );
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
        {
          variant: 'info',
        }
      );
      return;
    }

    await createRequest.mutateAsync({
      busId: selectedBusId,
      roundId: selectedRoundId,
      type: requestType,
      reason,
    });

    enqueueSnackbar(
      'Đã gửi yêu cầu mở khóa thành công.',
      {
        variant: 'success',
      },
    );

    setReason('');
  } catch (error: any) {
    console.error(error);

    enqueueSnackbar(
      error?.response?.data?.message ||
        error?.message ||
        'Gửi yêu cầu thất bại',
      {
        variant: 'error',
      }
    );
  }
};
  const isLoading = tripsLoading || busesLoading || roundsLoading;

  return (
    <div className="animate-fade-in p-0 p-md-3">
      <div className="d-flex align-items-center justify-content-between gap-3 mb-4 px-2">
        <div className="d-flex align-items-center gap-3">
          <div
            className="d-flex align-items-center justify-content-center rounded-circle shadow-sm"
            style={{
              width: '42px',
              height: '42px',
              backgroundColor: isDarkMode ? colors.primaryGlow : `${colors.primary}15`,
              border: `1px solid ${colors.primary}33`,
            }}
          >
            <ShieldAlert size={20} style={{ color: colors.primary }} />
          </div>
          <div>
            <h1 className="h4 fw-bold m-0" style={{ letterSpacing: '-0.02em', color: colors.textPrimary }}>
              Yêu cầu mở điểm danh
            </h1>
            <div className="small" style={{ color: colors.textMuted }}>
              Gửi yêu cầu cho admin khi chặng đang bị khóa.
            </div>
          </div>
        </div>

        <div className="d-flex align-items-center gap-2 small" style={{ color: colors.textMuted }}>
          <Sparkles size={14} />
          {currentTenant?.name || 'Bus manager'}
        </div>
      </div>

      <div className="row g-4">
        <div className="col-12 col-xl-7">
          <div
            className="shadow-sm"
            style={{
              backgroundColor: colors.surface,
              borderRadius: effects.borderRadius.lg,
              border: `1px solid ${colors.border}`,
              overflow: 'hidden',
            }}
          >
            <div className="p-4 border-bottom" style={{ borderColor: colors.border }}>
              <h5 className="fw-bold mb-1" style={{ color: colors.textPrimary }}>
                Tạo yêu cầu mới
              </h5>
              <div className="small" style={{ color: colors.textMuted }}>
                Chọn xe, chặng và loại khóa cần mở.
              </div>
            </div>

            <div className="p-4">
              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <label className="form-label small fw-semibold" style={{ color: colors.textSecondary }}>
                    Trip
                  </label>
                  <select
                    className="form-select"
                    value={selectedTripId ?? ''}
                    onChange={(event) => setSelectedTripId(Number(event.target.value) || null)}
                    disabled={isLoading || createRequest.isPending}
                    style={{
                      backgroundColor: isDarkMode ? colors.background : '#fff',
                      color: colors.textPrimary,
                      borderColor: colors.border,
                    }}
                  >
                    {trips.map((trip: any) => (
                      <option key={trip.id} value={trip.id}>
                        {trip.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label small fw-semibold" style={{ color: colors.textSecondary }}>
                    Xe
                  </label>
                  <select
                    className="form-select"
                    value={selectedBusId ?? ''}
                    onChange={(event) => setSelectedBusId(Number(event.target.value) || null)}
                    disabled={isLoading || createRequest.isPending}
                    style={{
                      backgroundColor: isDarkMode ? colors.background : '#fff',
                      color: colors.textPrimary,
                      borderColor: colors.border,
                    }}
                  >
                    {buses.map((bus: any) => (
                      <option key={bus.id} value={bus.id}>
                        {bus.busCode} - {bus.registrationNumber}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label small fw-semibold" style={{ color: colors.textSecondary }}>
                    Chặng
                  </label>
                  <select
                    className="form-select"
                    value={selectedRoundId ?? ''}
                    onChange={(event) => setSelectedRoundId(Number(event.target.value) || null)}
                    disabled={isLoading || createRequest.isPending}
                    style={{
                      backgroundColor: isDarkMode ? colors.background : '#fff',
                      color: colors.textPrimary,
                      borderColor: colors.border,
                    }}
                  >
                    {rounds.map((round: any) => (
                      <option key={round.id} value={round.id}>
                        {round.name} - {round.time}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label small fw-semibold" style={{ color: colors.textSecondary }}>
                    Loại yêu cầu
                  </label>
                  <select
                    className="form-select"
                    value={requestType}
                    onChange={(event) => setRequestType(event.target.value as RequestType)}
                    disabled={createRequest.isPending}
                    style={{
                      backgroundColor: isDarkMode ? colors.background : '#fff',
                      color: colors.textPrimary,
                      borderColor: colors.border,
                    }}
                  >
                    <option value="check_in">Mở điểm danh vào</option>
                    <option value="check_out">Mở điểm danh ra</option>
                  </select>
                </div>

                <div className="col-12">
                  <label className="form-label small fw-semibold" style={{ color: colors.textSecondary }}>
                    Lý do
                  </label>
                  <textarea
                    className="form-control"
                    rows={4}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    disabled={createRequest.isPending}
                    style={{
                      backgroundColor: isDarkMode ? colors.background : '#fff',
                      color: colors.textPrimary,
                      borderColor: colors.border,
                    }}
                  />
                </div>
              </div>

              <div className="d-flex flex-wrap gap-2 mt-4 justify-content-end">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setReason('')}
                  disabled={createRequest.isPending}
                >
                  Xóa nội dung
                </button>
                <button
                  type="button"
                  className="btn btn-primary d-inline-flex align-items-center gap-2"
                  onClick={handleSubmit}
                  disabled={createRequest.isPending || !selectedTripId || !selectedBusId || !selectedRoundId}
                >
                  <Send size={16} />
                  {createRequest.isPending ? 'Đang gửi...' : 'Gửi yêu cầu'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnlockRequestPage;