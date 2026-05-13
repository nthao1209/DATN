import React from 'react';
import { Lock, Unlock, RefreshCw, X } from 'lucide-react';

interface LockStatus {
  busId: number;
  roundId: number;
  checkInLocked?: boolean;
}

interface LockRoundModalProps {
  roundId: number | null;
  onClose: () => void;
  lockStatuses: LockStatus[];
  buses: any[];
  toggling: Record<string, boolean>;
  onToggleLock: (busId: number, roundId: number, isLocked: boolean) => void;
  onRefetch: () => void;
  colors: any;
  isDarkMode: boolean;
}

const LockRoundModal: React.FC<LockRoundModalProps> = ({
  roundId,
  onClose,
  lockStatuses,
  buses,
  toggling,
  onToggleLock,
  onRefetch,
  colors,
  isDarkMode
}) => {
  if (roundId === null) return null;

  return (
    <div style={{ 
      position: 'fixed', inset: 0, 
      background: 'rgba(15, 23, 42, 0.7)', 
      backdropFilter: 'blur(4px)', 
      zIndex: 1400, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="animate-fade-in" style={{ 
        width: '100%', maxWidth: 720, maxHeight: '85vh', 
        display: 'flex', flexDirection: 'column',
        background: colors.surface, borderRadius: 16, 
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        border: `1px solid ${colors.border}`,
        overflow: 'hidden'
      }}>
        
        {/* Header */}
        <div className="p-3 d-flex justify-content-between align-items-center border-bottom" 
             style={{ backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : '#f8fafc' }}>
          <div>
            <h6 className="m-0 fw-bold" style={{ color: colors.textPrimary }}>
              Quản lý khóa chặng {roundId}
            </h6>
          </div>
          <div className="d-flex gap-2">
            <button className="btn btn-sm btn-light rounded-pill px-3" onClick={onClose}>
              Đóng
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-3 sidebar-content" style={{ overflowY: 'auto' }}>
          <div className="d-grid gap-2">
            {lockStatuses
              .filter((s) => Number(s.roundId) === Number(roundId))
              .map((s) => {
                const busInfo = buses.find((b) => Number(b.id) === Number(s.busId));
                const busName = busInfo?.busCode || busInfo?.registrationNumber || `Xe ${s.busId}`;
                const key = `${s.busId}_${s.roundId}`;
                const isLocked = Boolean(s.checkInLocked);

                return (
                  <div key={key} className="lock-item-card d-flex align-items-center justify-content-between p-3"
                    style={{ 
                      background: isDarkMode ? 'rgba(255,255,255,0.03)' : '#ffffff',
                      border: `1px solid ${colors.border}`,
                      borderRadius: 12
                    }}>
                    <div className="d-flex align-items-center gap-3">
                      <div className={`icon-circle ${isLocked ? 'locked' : 'unlocked'}`}>
                        {isLocked ? <Lock size={16} /> : <Unlock size={16} />}
                      </div>
                      <div>
                        <div className="fw-bold" style={{ color: colors.textPrimary }}>{busName}</div>
                      </div>
                    </div>

                    <div className="d-flex align-items-center gap-3">
                      <span className={`badge-status ${isLocked ? 'locked' : 'unlocked'}`}>
                        {isLocked ? 'Đã khóa' : 'Mở'}
                      </span>
                      
                      <label className="form-switch-custom">
                        <input 
                          type="checkbox" 
                          checked={isLocked}
                          onChange={() => onToggleLock(s.busId, s.roundId, !isLocked)}
                          disabled={Boolean(toggling[key])}
                        />
                        <span className={`slider-custom ${toggling[key] ? 'loading' : ''}`}>
                          {toggling[key] && <span className="spinner-border spinner-border-sm switch-loader"></span>}
                        </span>
                      </label>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
      <style>
      {`
      /* Khung bao ngoài nút gạt */
      .form-switch-custom {
        position: relative;
        display: inline-block;
        width: 44px; /* Độ dài nút gạt */
        height: 22px; /* Độ cao nút gạt */
      }

      /* Ẩn hoàn toàn cái ô tích (checkbox) mặc định */
      .form-switch-custom input {
        opacity: 0;
        width: 0;
        height: 0;
      }

      /* Tạo hình cái rãnh gạt */
      .slider-custom {
        position: absolute;
        cursor: pointer;
        top: 0; left: 0; right: 0; bottom: 0;
        background-color: #ccc; /* Màu khi đang mở */
        transition: .4s;
        border-radius: 34px;
      }

      /* Tạo hình cái nút tròn để gạt */
      .slider-custom:before {
        position: absolute;
        content: "";
        height: 16px;
        width: 16px;
        left: 3px;
        bottom: 3px;
        background-color: white;
        transition: .4s;
        border-radius: 50%;
      }

      /* Khi đã khóa (checked) -> Đổi màu nền sang xanh/primary */
      input:checked + .slider-custom {
        background-color: ${colors.primary};
      }

      /* Khi đã khóa (checked) -> Đẩy nút tròn sang phải */
      input:checked + .slider-custom:before {
        transform: translateX(22px);
      }

      /* Hiệu ứng loading khi đang xử lý */
      .slider-custom.loading {
        opacity: 0.7;
        cursor: not-allowed;
      }
      
      .switch-loader {
        position: absolute;
        top: 3px;
        left: 13px;
        width: 14px;
        height: 14px;
      }
    `}</style>
    </div>
  );
};

export default LockRoundModal;