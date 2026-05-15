import { useState } from 'react';
import { useCreateUnlockRequest } from '../hooks/useUnlockRequests';
import { useTheme } from '../theme/ThemeContext';
import { Loader2, AlertCircle, Send, X } from 'lucide-react';

interface UnlockRequestModalProps {
  open: boolean;
  onClose: () => void;
  busId: number;
  roundId: number;
  busCode: string;
  roundName: string;
  lockType: 'check_in' | 'check_out';
  onSuccess?: () => void;
}

export const UnlockRequestModal = ({
  open,
  onClose,
  busId,
  roundId,
  busCode,
  roundName,
  lockType,
  onSuccess,
}: UnlockRequestModalProps) => {
  const { colors, isDarkMode } = useTheme();
  const [reason, setReason] = useState('');
  const createRequest = useCreateUnlockRequest();

  if (!open) return null;

  const handleSubmit = async () => {
    try {
      await createRequest.mutateAsync({
        busId,
        roundId,
        type: lockType,
        reason,
      });

      setReason('');
      onClose();
      onSuccess?.();
    } catch (error: any) {
      console.error('Failed to create unlock request:', error);
    }
  };

  return (
    <div className="modal-custom-overlay animate-fade-in">
      <div 
        className="modal-custom-content shadow-lg" 
        style={{ 
          backgroundColor: colors.surface, 
          border: `1px solid ${colors.border}`,
          width: '100%',
          maxWidth: '500px',
          borderRadius: '20px',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div className="p-4 border-bottom d-flex justify-content-between align-items-center" style={{ borderColor: colors.border }}>
          <h5 className="fw-bold mb-0" style={{ color: colors.textPrimary }}>
            Yêu cầu mở khóa
          </h5>
          <button className="btn-close-custom" onClick={onClose} style={{ color: colors.textMuted }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          {/* Thông tin chặng xe */}
          <div className="p-3 mb-4 rounded-4" style={{ backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : '#f8fafc', border: `1px solid ${colors.border}` }}>
            <div className="row g-3">
              <div className="col-6">
                <small className="text-muted d-block text-uppercase fw-bold mb-1" style={{ fontSize: '10px' }}>Số xe</small>
                <div className="fw-bold" style={{ color: colors.textPrimary }}>{busCode}</div>
              </div>
              <div className="col-6">
                <small className="text-muted d-block text-uppercase fw-bold mb-1" style={{ fontSize: '10px' }}>Loại khóa</small>
                <span className={`badge rounded-pill ${lockType === 'check_in' ? 'bg-info' : 'bg-warning'} bg-opacity-10`} style={{ color: lockType === 'check_in' ? '#0dcaf0' : '#ffc107' }}>
                  {lockType === 'check_in' ? 'Điểm danh vào' : 'Điểm danh ra'}
                </span>
              </div>
              <div className="col-12">
                <small className="text-muted d-block text-uppercase fw-bold mb-1" style={{ fontSize: '10px' }}>Tuyến đường</small>
                <div className="fw-medium" style={{ color: colors.textPrimary }}>{roundName}</div>
              </div>
            </div>
          </div>

          {createRequest.isError && (
            <div className="alert alert-danger d-flex align-items-center gap-2 border-0 mb-4" style={{ borderRadius: '12px' }}>
              <AlertCircle size={18} />
              <small>{(createRequest.error as any)?.response?.data?.message || 'Gửi yêu cầu thất bại'}</small>
            </div>
          )}

          <div className="form-group">
            <label className="small fw-bold mb-2 text-muted text-uppercase">Lý do yêu cầu</label>
            <textarea
              className="form-control"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Nhập lý do tại sao bạn cần mở khóa chặng này..."
              disabled={createRequest.isPending}
              style={{ 
                backgroundColor: isDarkMode ? colors.background : '#fff', 
                color: colors.textPrimary, 
                borderColor: colors.border,
                borderRadius: '12px',
                padding: '12px'
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-transparent d-flex gap-2 justify-content-end">
          <button 
            className="btn btn-link text-decoration-none fw-bold" 
            style={{ color: colors.textMuted }}
            onClick={onClose}
            disabled={createRequest.isPending}
          >
            Hủy bỏ
          </button>
          <button 
            className="btn-send-request" 
            onClick={handleSubmit}
            disabled={createRequest.isPending}
            style={{ backgroundColor: colors.primary }}
          >
            {createRequest.isPending ? (
              <>
                <Loader2 size={18} className="spin me-2" />
                Đang gửi...
              </>
            ) : (
              <>
                <Send size={18} className="me-2" />
                Gửi yêu cầu
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`
        .modal-custom-overlay {
          position: fixed; inset: 0; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center; z-index: 2500;
          padding: 20px;
        }
        .btn-close-custom {
          background: none; border: none; padding: 5px; border-radius: 8px; transition: all 0.2s;
        }
        .btn-close-custom:hover { background: rgba(0,0,0,0.05); transform: rotate(90deg); }
        
        .btn-send-request {
          border: none; color: white; padding: 10px 24px; border-radius: 12px;
          font-weight: 700; display: flex; align-items: center; transition: all 0.2s;
          box-shadow: 0 4px 12px ${colors.primary}44;
        }
        .btn-send-request:hover:not(:disabled) {
          transform: translateY(-2px);
          filter: brightness(1.1);
          box-shadow: 0 6px 20px ${colors.primary}66;
        }
        .btn-send-request:active:not(:disabled) { transform: translateY(0); }
        .btn-send-request:disabled { opacity: 0.6; cursor: not-allowed; }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};