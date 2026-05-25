import React, { useMemo, useState } from 'react';
import { CheckCircle2, TriangleAlert, Info } from 'lucide-react';
import { useSnackbar } from 'notistack';
import api from '../../../services/api';
import type { RoundOption } from './types';
import { useTheme } from '../../../theme/ThemeContext';

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
  busRoundStatuses: BusRoundStatus[];
  onSuccess: () => void;
}

const CompleteRoundPanel: React.FC<CompleteRoundPanelProps> = ({
  selectedRounds,
  selectedBusIds,
  busRoundStatuses,
  onSuccess,
}) => {
  const { colors, isDarkMode } = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(false);

  const selectedBusId = selectedBusIds.length === 1 ? Number(selectedBusIds[0]) : null;
  const selectedRound = selectedRounds.length === 1 ? selectedRounds[0] : null;

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

    const label = `chặng ${selectedRound.name || selectedRound.id} cho xe ${selectedBusId}`;
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
        <div className="vr d-none d-md-block mx-3 opacity-10" style={{ height: '28px' }}></div>

        {/* Khối nội dung thông tin chính giữa */}
        <div className="flex-grow-1 d-flex align-items-center justify-content-between gap-3 flex-wrap">
          <div className="d-flex flex-column gap-0.5">
            <div className="fw-semibold main-text" style={{ color: colors.textPrimary }}>
              {selectedBusIds.length === 1 && selectedRounds.length === 1 ? (
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <span>Xe {selectedBusId}</span>
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
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" style={{ width: '12px', height: '12px' }}></span>
                <span>Đang lưu...</span>
              </div>
            ) : (
              'Xác nhận hoàn thành'
            )}
          </button>
        </div>
      </div>

      <style>{`
        /* Container bọc ngoài định vị sticky thông minh tạo khoảng cách nhẹ với viền */
        .complete-panel-wrapper {
          position: sticky;
          bottom: 16px;
          left: 0;
          right: 0;
          width: calc(100% - 32px);
          margin: 0 auto;
          z-index: 100;
        }

        /* Khung Card chính mang phong cách Glassmorphism hiện đại */
        .complete-round-container {
          background: ${isDarkMode ? 'rgba(23, 32, 59, 0.85)' : 'rgba(255, 255, 255, 0.9)'} !important;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'} !important;
          border-radius: 14px;
          padding: 12px 20px !important;
          display: flex;
          align-items: center;
          gap: 16px;
          box-shadow: ${isDarkMode ? '0 12px 30px rgba(0, 0, 0, 0.5)' : '0 10px 25px rgba(15, 23, 42, 0.08)'};
        }

        /* Icon Badge tròn nhỏ */
        .icon-badge {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: rgba(16, 185, 129, 0.12);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .main-text {
          font-size: 14px;
          letter-spacing: -0.01em;
        }

        .dot-divider {
          opacity: 0.3;
        }

        .sub-tip {
          font-size: 11px;
          opacity: 0.85;
          font-weight: 500;
        }

        /* Hệ thống Badge UI tinh tế */
        .badge-ui {
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
        }
        .badge-ui.success { background: rgba(16, 185, 129, 0.12); color: #10b981; }
        .badge-ui.info { background: rgba(59, 130, 246, 0.12); color: #3b82f6; }
        .badge-ui.warning { background: rgba(245, 158, 11, 0.12); color: #f59e0b; }

        /* Nút xác nhận phủ Gradient tinh xảo */
        .btn-complete-pill {
          border: none;
          padding: 8px 18px;
          font-size: 12px;
          font-weight: 700;
          border-radius: 8px;
          letter-spacing: 0.01em;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          color: white;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
        }

        .btn-complete-pill:hover:not(:disabled) {
          filter: brightness(1.1);
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(16, 185, 129, 0.3);
        }

        .btn-complete-pill:active { 
          transform: translateY(0); 
          filter: brightness(0.95);
        }
        
        /* Trạng thái tắt nút mượt mà, hòa nhập với nền tối/sáng */
        .btn-complete-pill:disabled { 
          background: ${isDarkMode ? 'rgba(255,255,255,0.06)' : '#e2e8f0'} !important; 
          color: ${isDarkMode ? 'rgba(255,255,255,0.25)' : '#94a3b8'} !important;
          box-shadow: none;
          cursor: not-allowed; 
          transform: none; 
        }

        /* Tối ưu Mobile (Responsive cực mượt) */
        @media (max-width: 576px) {
          .complete-panel-wrapper {
            bottom: 8px;
            width: calc(100% - 16px);
          }
          .complete-round-container {
            padding: 10px 14px !important;
            gap: 10px;
          }
          .main-text {
            font-size: 13px;
          }
          .btn-complete-pill {
            width: 100%;
            text-align: center;
            padding: 8px;
          }
        }
      `}</style>
    </div>
  );
};

export default CompleteRoundPanel;