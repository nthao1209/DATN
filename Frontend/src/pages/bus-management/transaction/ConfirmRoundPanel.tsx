import React, { useState } from 'react';
import { useSnackbar } from 'notistack';
import api from '../../../services/api';
import type { BusRoundStatus, RoundOption } from './types';
import { useTheme } from '../../../theme/ThemeContext';

interface ConfirmRoundPanelProps {
  selectedRounds: RoundOption[];
  selectedBusIds: number[];
  lockStatuses: BusRoundStatus[];
  onSuccess: () => void;
}

const ConfirmRoundPanel: React.FC<ConfirmRoundPanelProps> = ({
  selectedRounds,
  selectedBusIds,
  lockStatuses,
  onSuccess,
}) => {
  const { colors, isDarkMode } = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const[loading, setLoading] = useState<{ roundId: number; type: string } | null>(null);

  const isBusLocked = (busId: number, roundId: number, type: 'checkIn' | 'checkOut') => {
    const status = lockStatuses.find(
      (item) => Number(item.busId) === Number(busId) && Number(item.roundId) === Number(roundId)
    );

    if (!status) return false;

    return type === 'checkIn' ? Boolean(status.checkInLocked) : Boolean(status.checkOutLocked);
  };

  const getLockedBusCount = (roundId: number, type: 'checkIn' | 'checkOut') =>
    selectedBusIds.filter((busId) => isBusLocked(busId, roundId, type)).length;

  const handleConfirm = async (roundId: number, roundName: string, type: 'checkIn' | 'checkOut') => {
    if (!selectedBusIds.length) {
      enqueueSnackbar('Vui lòng chọn ít nhất một xe để xác nhận', { variant: 'warning' });
      return;
    }

    const targetBusIds = selectedBusIds.filter((busId) => !isBusLocked(busId, roundId, type));
    if (!targetBusIds.length) {
      enqueueSnackbar(
        `Lượt ${type === 'checkIn' ? 'đi' : 'về'} của các xe đã được khóa trước đó`,
        { variant: 'info' }
      );
      return;
    }

    const confirmText = type === 'checkIn' ? 'lượt đi' : 'lượt về';
    if (!window.confirm(`Bạn có chắc chắn muốn XÁC NHẬN và KHÓA ${confirmText} cho ${roundName}? Dữ liệu sau khi khóa sẽ không thể chỉnh sửa.`)) {
      return;
    }

    setLoading({ roundId, type });
    try {
      const payload = type === 'checkIn' ? { checkInLocked: true } : { checkOutLocked: true };
      const promises = targetBusIds.map((busId) => 
        api.confirmBusRoundChecks(Number(busId), roundId, payload)
      );
      
      await Promise.all(promises);
      if (targetBusIds.length !== selectedBusIds.length) {
        enqueueSnackbar(
          `Đã bỏ qua ${selectedBusIds.length - targetBusIds.length} xe đã khóa sẵn và khóa ${confirmText} cho ${roundName} thành công!`,
          { variant: 'success' }
        );
      } else {
        enqueueSnackbar(`Đã khóa ${confirmText} cho ${roundName} thành công!`, { variant: 'success' });
      }
      onSuccess(); 
    } catch (err: any) {
      enqueueSnackbar(err?.message || `Lỗi khi xác nhận ${confirmText}`, { variant: 'error' });
    } finally {
      setLoading(null);
    }
  };

  if (!selectedRounds.length) return null;

 return (
  <div className="confirm-lock-container animate-fade-up">
    <div className="d-flex align-items-center gap-2 text-primary small fw-bold flex-shrink-0">
      <i className="bi bi-shield-lock-fill"></i>
      <span> KHÓA BẢNG ĐIỂM DANH</span>
    </div>

    <div className="vr d-none d-sm-block mx-2" style={{ opacity: 0.2, height: '40px' }}></div>
    
    <div className="d-flex align-items-center gap-3 overflow-auto no-scrollbar py-1">
      {selectedRounds.map((round) => {
        const rId = Number(round.id);
        const isCheckInLoading = loading?.roundId === rId && loading?.type === 'checkIn';
        const isCheckOutLoading = loading?.roundId === rId && loading?.type === 'checkOut';
        const lockedCheckInCount = getLockedBusCount(rId, 'checkIn');
        const lockedCheckOutCount = getLockedBusCount(rId, 'checkOut');
        const isCheckInDisabled = isCheckInLoading || (selectedBusIds.length > 0 && lockedCheckInCount === selectedBusIds.length);
        const isCheckOutDisabled = isCheckOutLoading || (selectedBusIds.length > 0 && lockedCheckOutCount === selectedBusIds.length);

        return (
          <div key={rId} className="lock-round-item d-flex align-items-center gap-1 p-1 pr-2 rounded-pill shadow-sm"> 
            <div className="d-flex gap-1">
              <button
                className={`btn-lock-pill go ${isCheckInLoading ? 'loading' : ''}`}
                disabled={isCheckInDisabled}
                title={isCheckInDisabled && selectedBusIds.length > 0 ? 'Lượt đi của các xe đã được khóa' : undefined}
                onClick={() => handleConfirm(rId, round.name || '', 'checkIn')}
              >
                {isCheckInLoading ? '...' : isCheckInDisabled ? 'ĐÃ KHÓA' : 'LƯỢT ĐI'}
              </button>

              <button
                className={`btn-lock-pill back ${isCheckOutLoading ? 'loading' : ''}`}
                disabled={isCheckOutDisabled}
                title={isCheckOutDisabled && selectedBusIds.length > 0 ? 'Lượt về của các xe đã được khóa' : undefined}
                onClick={() => handleConfirm(rId, round.name || '', 'checkOut')}
              >
                {isCheckOutLoading ? '...' : isCheckOutDisabled ? 'ĐÃ KHÓA' : 'LƯỢT VỀ'}
              </button>
            </div>
          </div>
        );
      })}
    </div>

    <style>{`
      .confirm-lock-container {
        position: sticky;
        bottom: 0;
        left: 0;
        right: 0;
        width: 100%;
        background: ${isDarkMode ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.92)'} !important;
        backdrop-filter: blur(8px) ;
        border-top: 1px solid ${colors.border} !important;
        z-index: 10;
        border-radius: 0;
        padding: 10px 20px !important;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
      }

      .lock-round-item {
        background: ${isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#f8fafc'};
        border: 1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0'};
      }

      .btn-lock-pill {
        border: none;
        padding: 4px 14px;
        font-size: 11px;
        font-weight: 800;
        border-radius: 50px;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        color: white;
      }

      .btn-lock-pill.go {
        background-color: #3b82f6;
        box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
      }
      .btn-lock-pill.go:hover { background-color: #2563eb; transform: translateY(-1px); }

      .btn-lock-pill.back {
        background-color: #f59e0b;
        box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
      }
      .btn-lock-pill.back:hover { background-color: #d97706; transform: translateY(-1px); }

      .btn-lock-pill:active { transform: scale(0.95); }
      .btn-lock-pill:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

      .no-scrollbar::-webkit-scrollbar { display: none; }
      .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

      @media (max-width: 768px) {
        .confirm-lock-container {
          bottom: 10px;
          padding: 8px 12px !important;
        }
        .confirm-lock-container span {
          font-size: 11px; 
        }
      }
    `}</style>
  </div>
);
};

export default ConfirmRoundPanel;