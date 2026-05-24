import React, { useState } from 'react';
import { Lock, Unlock, Check, X, AlertCircle } from 'lucide-react';

interface LockStatus {
  busId: number;
  roundId: number;
  checkInLocked?: boolean;
  checkOutLocked?: boolean;
}

interface UnlockRequest {
  id: number;
  busId: number;
  roundId: number;
  type: string;
  reason?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedBy: number;
  rejectReason?: string | null;
  requester?: {
    name: string;
  };
}

interface LockRoundModalProps {
  roundId: number | null;
  lockType: 'check_in' | 'check_out' | null;
  onClose: () => void;
  lockStatuses: LockStatus[];
  buses: any[];
  toggling: Record<string, boolean>;
  
  // Hàm xử lý thay đổi trạng thái khóa thông thường
  onToggleLock: (
    busId: number,
    roundId: number,
    isLocked: boolean,
    lockType: 'check_in' | 'check_out'
  ) => void;

  // BỔ SUNG: Danh sách yêu cầu và hàm xử lý Duyệt/Từ chối từ component cha truyền vào
  unlockRequests?: UnlockRequest[];
  onHandleUnlockRequest?: (
    requestId: number,
    status: 'APPROVED' | 'REJECTED',
    rejectReason?: string
  ) => Promise<void>;

  colors: any;
  isDarkMode: boolean;
}

const LockRoundModal: React.FC<LockRoundModalProps> = ({
  roundId,
  lockType,
  onClose,
  lockStatuses,
  buses,
  toggling,
  onToggleLock,
  unlockRequests = [],
  onHandleUnlockRequest,
  colors,
  isDarkMode,
}) => {
  // Quản lý trạng thái nhập lý do từ chối cho từng request ID cụ thể
  const [rejectingRequestId, setRejectingRequestId] = useState<number | null>(null);
  const [rejectReasonText, setRejectReasonText] = useState<string>('');
  const [isSubmittingHandle, setIsSubmittingHandle] = useState<boolean>(false);

  if (roundId === null || !lockType) return null;

  // ===== LỌC TRẠNG THÁI KHÓA =====
  const filteredLocks = lockStatuses.filter((s) => {
    if (Number(s.roundId) !== Number(roundId)) return false;
    return lockType === 'check_in' ? s.checkInLocked === true : s.checkOutLocked === true;
  });

  // ===== LỌC YÊU CẦU ĐANG CHỜ PHÊ DUYỆT (PENDING) =====
  console.log(unlockRequests);
  const pendingRequests = unlockRequests.filter((req) => {
    return (
      Number(req.roundId) === Number(roundId) &&
      req.type === lockType &&
      req.status === 'PENDING'
    );
  });

  // Xử lý gửi phản hồi Từ chối
  const handleRejectSubmit = async (requestId: number) => {
    if (!onHandleUnlockRequest) return;
    if (!rejectReasonText.trim()) {
      alert('Vui lòng nhập lý do từ chối!');
      return;
    }

    try {
      setIsSubmittingHandle(true);
      await onHandleUnlockRequest(requestId, 'REJECTED', rejectReasonText);
      setRejectingRequestId(null);
      setRejectReasonText('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingHandle(false);
    }
  };

  // Xử lý phê duyệt nhanh qua nút bấm công cụ
  const handleApproveQuick = async (requestId: number) => {
    if (!onHandleUnlockRequest) return;
    try {
      setIsSubmittingHandle(true);
      await onHandleUnlockRequest(requestId, 'APPROVED');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingHandle(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(4px)',
        zIndex: 1400,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        className="animate-fade-in"
        style={{
          width: '100%',
          maxWidth: 720,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          background: colors.surface,
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          border: `1px solid ${colors.border}`,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          className="p-3 d-flex justify-content-between align-items-center border-bottom"
          style={{
            backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : '#f8fafc',
          }}
        >
          <div>
            <h6 className="m-0 fw-bold" style={{ color: colors.textPrimary }}>
              Quản lý khóa {lockType === 'check_in' ? 'lượt đi' : 'lượt về'} - chặng {roundId}
            </h6>
          </div>
          <div>
            <button className="btn btn-sm btn-light rounded-pill px-3" onClick={onClose}>
              Đóng
            </button>
          </div>
        </div>

        {/* Body Container */}
        <div className="p-3 sidebar-content d-flex flex-column gap-4" style={{ overflowY: 'auto' }}>
          
          {/* ================= PHẦN 1: DANH SÁCH YÊU CẦU CHỜ DUYỆT ================= */}
          {pendingRequests.length > 0 && (
            <div>
              <div className="d-flex align-items-center gap-2 mb-2 text-warning fw-bold small text-uppercase">
                <AlertCircle size={16} />
                <span>Yêu cầu mở khóa đang chờ xét duyệt ({pendingRequests.length})</span>
              </div>
              
              <div className="d-flex flex-column gap-2">
                {pendingRequests.map((req) => {
                  const busInfo = buses.find((b) => Number(b.id) === Number(req.busId));
                  const busName = busInfo?.busCode || busInfo?.registrationNumber || `Xe ${req.busId}`;

                  return (
                    <div
                      key={req.id}
                      className="p-3 border border-warning rounded-3"
                      style={{ backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.05)' : '#fffbeb' }}
                    >
                      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                        <div>
                          <div className="fw-bold text-warning" style={{ fontSize: '14px' }}>
                            {busName} xin mở khóa
                          </div>
                          {req.reason && (
                            <div className="small mt-1 italic text-muted">
                              "Lý do: {req.reason}"
                            </div>
                          )}
                        </div>

                        {/* Khối nút hành động điều hướng */}
                        <div className="d-flex align-items-center gap-2">
                          <button
                            className="btn btn-sm btn-success d-flex align-items-center gap-1"
                            disabled={isSubmittingHandle}
                            onClick={() => handleApproveQuick(req.id)}
                          >
                            <Check size={14} /> Duyệt
                          </button>
                          
                          <button
                            className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1"
                            disabled={isSubmittingHandle}
                            onClick={() => {
                              setRejectingRequestId(req.id);
                              setRejectReasonText('');
                            }}
                          >
                            <X size={14} /> Từ chối
                          </button>
                        </div>
                      </div>

                      {/* Khung form điền lý do từ chối (Chỉ hiện khi bấm Từ chối) */}
                      {rejectingRequestId === req.id && (
                        <div className="mt-3 pt-3 border-top border-warning-subtle">
                          <label className="form-label small fw-bold text-danger">Lý do từ chối yêu cầu:</label>
                          <div className="d-flex gap-2">
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              placeholder="Nhập lý do viết gửi tài xế..."
                              value={rejectReasonText}
                              onChange={(e) => setRejectReasonText(e.target.value)}
                              disabled={isSubmittingHandle}
                            />
                            <button
                              className="btn btn-sm btn-danger text-nowrap"
                              disabled={isSubmittingHandle}
                              onClick={() => handleRejectSubmit(req.id)}
                            >
                              Gửi từ chối
                            </button>
                            <button
                              className="btn btn-sm btn-light"
                              onClick={() => setRejectingRequestId(null)}
                            >
                              Hủy
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================= PHẦN 2: TRẠNG THÁI KHÓA XE THỰC TẾ ================= */}
          <div>
            <div className="text-muted small fw-bold text-uppercase mb-2">
              Danh sách trạng thái các xe vận hành
            </div>

            {filteredLocks.length === 0 ? (
              <div className="text-center py-5" style={{ color: colors.textSecondary }}>
                <Lock size={32} className="opacity-40 mb-2" />
                <div className="fw-semibold">Không có xe nào đang khóa trong hệ thống</div>
              </div>
            ) : (
              <div className="d-grid gap-2">
                {filteredLocks.map((s) => {
                  const busInfo = buses.find((b) => Number(b.id) === Number(s.busId));
                  const busName = busInfo?.busCode || busInfo?.registrationNumber || `Xe ${s.busId}`;
                  const key = `${s.busId}_${s.roundId}_${lockType}`;
                  const isLocked = lockType === 'check_in' ? Boolean(s.checkInLocked) : Boolean(s.checkOutLocked);

                  return (
                    <div
                      key={key}
                      className="lock-item-card d-flex align-items-center justify-content-between p-3"
                      style={{
                        background: isDarkMode ? 'rgba(255,255,255,0.03)' : '#ffffff',
                        border: `1px solid ${colors.border}`,
                        borderRadius: 12,
                      }}
                    >
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
                            onChange={() => onToggleLock(s.busId, s.roundId, !isLocked, lockType)}
                            disabled={Boolean(toggling[key])}
                          />
                          <span className={`slider-custom ${toggling[key] ? 'loading' : ''}`}>
                            {toggling[key] && (
                              <span className="spinner-border spinner-border-sm switch-loader"></span>
                            )}
                          </span>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>

      <style>
        {`
        .form-switch-custom { position: relative; display: inline-block; width: 44px; height: 22px; }
        .form-switch-custom input { opacity: 0; width: 0; height: 0; }
        .slider-custom { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 34px; }
        .slider-custom:before { position: absolute; content: ""; height: 16px; width: 16px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; }
        input:checked + .slider-custom { background-color: ${colors.primary}; }
        input:checked + .slider-custom:before { transform: translateX(22px); }
        .slider-custom.loading { opacity: 0.7; cursor: not-allowed; }
        .switch-loader { position: absolute; top: 3px; left: 13px; width: 14px; height: 14px; }
        
        .icon-circle { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .icon-circle.locked { background: rgba(239, 68, 68, 0.12); color: #ef4444; }
        .icon-circle.unlocked { background: rgba(34, 197, 94, 0.12); color: #22c55e; }
        
        .badge-status { padding: 6px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
        .badge-status.locked { background: rgba(239, 68, 68, 0.12); color: #ef4444; }
        .badge-status.unlocked { background: rgba(34, 197, 94, 0.12); color: #22c55e; }
        `}
      </style>
    </div>
  );
};

export default LockRoundModal;