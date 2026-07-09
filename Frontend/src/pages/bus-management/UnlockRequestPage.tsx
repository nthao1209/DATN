import React from 'react';
import { Send, ShieldAlert, Sparkles } from 'lucide-react';
import { useTheme } from '../../theme/ThemeContext';
import { type RequestType, useUnlockRequestForm } from './unlock-request/useUnlockRequestForm';

const UnlockRequestPage: React.FC = () => {
  const { colors, effects, isDarkMode } = useTheme();
  const {
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
    isLoading,
    handleSubmit,
  } = useUnlockRequestForm();
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
              Gửi yêu cầu cho trưởng đoàn khi chặng đang bị khóa.
            </div>
            {requestLocked ? (
              <div className="small mt-1 fw-semibold text-danger">
                Chặng này đã được xác nhận hoàn thành, không thể gửi yêu cầu mở khóa.
              </div>
            ) : null}
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
                    disabled={isLoading || createRequest.isPending || requestLocked}
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
                    disabled={isLoading || createRequest.isPending || requestLocked}
                    style={{
                      backgroundColor: isDarkMode ? colors.background : '#fff',
                      color: colors.textPrimary,
                      borderColor: colors.border,
                    }}
                  >
                    {buses.map((bus: any) => (
                      <option key={bus.id} value={bus.id}>
                        {bus.registrationNumber ? `${bus.busCode} - ${bus.registrationNumber}` : bus.busCode}
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
                    disabled={isLoading || createRequest.isPending || requestLocked}
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
                    disabled={createRequest.isPending || requestLocked}
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
                    disabled={createRequest.isPending || requestLocked}
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
                  disabled={createRequest.isPending || requestLocked}
                >
                  Xóa nội dung
                </button>
                <button
                  type="button"
                  className="btn btn-primary d-inline-flex align-items-center gap-2"
                  onClick={handleSubmit}
                  disabled={createRequest.isPending || !selectedTripId || !selectedBusId || !selectedRoundId || requestLocked}
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
