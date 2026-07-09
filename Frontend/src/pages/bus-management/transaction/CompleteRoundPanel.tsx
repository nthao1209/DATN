import React, { useMemo, useState } from 'react';
import { CheckCircle2, TriangleAlert, Info } from 'lucide-react';
import { useSnackbar } from 'notistack';
import api from '../../../services/api';
import type { BusOption, RoundOption } from './types';
import './CompleteRoundPanel.css';

type BusRoundStatus = {
  busId: number;
  roundId: number;
  checkInLocked?: boolean;
  checkOutLocked?: boolean;
  driverConfirmedBy?: number | null;
};

interface CompleteRoundPanelProps {
  selectedRounds: RoundOption[];
  selectedBusIds: number[];
  buses: BusOption[];
  busRoundStatuses: BusRoundStatus[];
  onSuccess: () => void;
}

const CompleteRoundPanel: React.FC<CompleteRoundPanelProps> = ({
  selectedRounds,
  selectedBusIds,
  buses,
  busRoundStatuses,
  onSuccess,
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(false);

  const selectedBusId = selectedBusIds.length === 1 ? Number(selectedBusIds[0]) : null;
  const selectedRound = selectedRounds.length === 1 ? selectedRounds[0] : null;
  const selectedBus = selectedBusId
    ? buses.find((bus) => Number(bus.id) === selectedBusId)
    : null;
  const selectedBusLabel =
    selectedBus?.busCode ||
    selectedBus?.registrationNumber ||
    (selectedBusId ? `Xe #${selectedBusId}` : '');

  const currentStatus = useMemo(() => {
    if (!selectedBusId || !selectedRound) return null;

    return (
      busRoundStatuses.find(
        (status) =>
          Number(status.busId) === selectedBusId &&
          Number(status.roundId) === Number(selectedRound.id)
      ) ?? null
    );
  }, [busRoundStatuses, selectedBusId, selectedRound]);

  if (!selectedRounds.length) return null;

  const bothLocked = Boolean(currentStatus?.checkInLocked) && Boolean(currentStatus?.checkOutLocked);
  const alreadyCompleted = Boolean(currentStatus?.driverConfirmedBy);
  const canSubmit = Boolean(selectedBusId && selectedRound && bothLocked && !alreadyCompleted);

  const handleComplete = async () => {
    if (!selectedBusId || !selectedRound) {
      enqueueSnackbar('Vui lòng chỉ chọn 1 xe và 1 chặng để hoàn thành.', { variant: 'warning' });
      return;
    }

    if (!bothLocked) {
      enqueueSnackbar('Cần khóa đủ cả lượt đi và lượt về trước khi hoàn thành chặng.', { variant: 'warning' });
      return;
    }

    const label = `chặng ${selectedRound.name || selectedRound.id} cho xe ${selectedBusLabel || selectedBusId}`;
    if (!window.confirm(`Xác nhận hoàn thành ${label}?`)) {
      return;
    }

    setLoading(true);
    try {
      await api.confirmBusRoundCompletion(selectedBusId, Number(selectedRound.id));
      enqueueSnackbar('Đã ghi nhận xe hoàn thành chặng.', { variant: 'success' });
      onSuccess();
    } catch (error: any) {
      enqueueSnackbar(error?.message || 'Không thể hoàn thành chặng', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="complete-panel-wrapper animate-fade-up">
      <div className="complete-round-container">
        
        {/* Khối tiêu đề bên trái */}
        <div className="d-flex align-items-center gap-2 text-success small fw-bold tracking-wider flex-shrink-0">
          <div className="icon-badge">
            <CheckCircle2 size={16} />
          </div>
          <span className="d-none d-md-inline">HOÀN THÀNH CHẶNG</span>
        </div>

        {/* Thanh ngăn cách dọc (Chỉ hiện trên màn PC) */}
        <div className="vr d-none d-md-block mx-3 opacity-10 complete-round-divider"></div>

        {/* Khối nội dung thông tin chính giữa */}
        <div className="flex-grow-1 d-flex align-items-center justify-content-between gap-3 flex-wrap">
          <div className="d-flex flex-column gap-0.5">
            <div className="fw-semibold main-text">
              {selectedBusIds.length === 1 && selectedRounds.length === 1 ? (
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <span>{selectedBusLabel}</span>
                  <span className="dot-divider">•</span>
                  <span>{selectedRound?.name || selectedRound?.id}</span>
                  
                  {/* Badge hiển thị trạng thái động */}
                  {alreadyCompleted ? (
                    <span className="badge-ui success">Đã hoàn thành</span>
                  ) : bothLocked ? (
                    <span className="badge-ui info">Đủ điều kiện khóa</span>
                  ) : (
                    <span className="badge-ui warning">Chưa đủ khóa lượt</span>
                  )}
                </div>
              ) : (
                <div className="d-flex align-items-center gap-1.5 text-muted small">
                  <Info size={14} className="opacity-60" />
                  <span>Vui lòng chọn duy nhất 1 xe và 1 chặng từ danh sách.</span>
                </div>
              )}
            </div>
            
            {/* Hướng dẫn chi tiết dạng text nhỏ mờ, ẩn bớt khi trên mobile để giữ độ gọn */}
            {!canSubmit && selectedBusIds.length === 1 && selectedRounds.length === 1 && (
              <div className="sub-tip d-flex align-items-center gap-1 text-warning">
                <TriangleAlert size={12} />
                <span>{alreadyCompleted ? 'Chặng này đã đóng.' : 'Cần kích hoạt khóa cả 2 lượt đi/về để mở nút.'}</span>
              </div>
            )}
          </div>

          {/* Nút hành động */}
          <button
            type="button"
            className="btn-complete-pill"
            disabled={!canSubmit || loading}
            onClick={handleComplete}
          >
            {loading ? (
              <div className="d-flex align-items-center gap-1.5">
                <span className="spinner-border spinner-border-sm complete-round-spinner" role="status" aria-hidden="true"></span>
                <span>Đang lưu...</span>
              </div>
            ) : (
              'Xác nhận hoàn thành'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompleteRoundPanel;
