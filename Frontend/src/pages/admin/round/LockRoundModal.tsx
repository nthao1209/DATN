import React, { useState } from 'react';
import { Lock, Unlock, Check, X, AlertCircle, CheckCircle2 } from 'lucide-react';

interface LockStatus {
  busId: number;
  roundId: number;
  checkInLocked?: boolean;
  checkOutLocked?: boolean;
  driverConfirmedBy?: number | null;
  adminApprovedBy?: number | null;
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
  
  onToggleLock: (
    busId: number,
    roundId: number,
    isLocked: boolean,
    lockType: 'check_in' | 'check_out'
  ) => void;

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
  unlockRequests = [],
  onHandleUnlockRequest,
  colors,
  isDarkMode,
}) => {
  const [rejectingRequestId, setRejectingRequestId] = useState<number | null>(null);
  const [rejectReasonText, setRejectReasonText] = useState<string>('');
  const [isSubmittingHandle, setIsSubmittingHandle] = useState<boolean>(false);

  if (roundId === null || !lockType) return null;

  // ===== LỌC TRẠNG THÁI KHÓA =====
  const filteredLocks = lockStatuses.filter((s) => {
    if (Number(s.roundId) !== Number(roundId)) return false;
    return lockType === 'check_in' ? s.checkInLocked === true : s.checkOutLocked === true;
  });

  const completedBuses = lockStatuses.filter(
    (s) => Number(s.roundId) === Number(roundId) && Boolean(s.driverConfirmedBy)
  );

  // ===== LỌC YÊU CẦU ĐANG CHỜ PHÊ DUYỆT (PENDING) =====
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
        background: isDarkMode ? 'rgba(8, 13, 28, 0.8)' : 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(6px)',
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
          maxWidth: 960, // Tăng nhẹ kích thước ngang để chia 2 bên cân đối, đẹp mắt
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          background: colors.surface,
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          border: `1px solid ${colors.border}`,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          className="p-3 d-flex justify-content-between align-items-center border-bottom"
          style={{
            backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : '#f8fafc',
            borderColor: colors.border
          }}
        >
          <div>
            <h6 className="m-0 fw-bold fs-5" style={{ color: colors.textPrimary }}>
              Quản lý khóa {lockType === 'check_in' ? 'lượt đi (Check-in)' : 'lượt về (Check-out)'} — Chặng {roundId}
            </h6>
          </div>
          <div>
            <button 
              className="btn btn-sm rounded-pill px-3 fw-medium transition-all"
              style={{
                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
                color: colors.textPrimary,
                border: 'none'
              }}
              onClick={onClose}
            >
              Đóng
            </button>
          </div>
        </div>

        {/* Body Container được chia làm 2 Cột sử dụng Bootstrap Grid */}
        <div className="p-4 sidebar-content overflow-auto" style={{ maxHeight: 'calc(85vh - 70px)' }}>
          <div className="row g-4">
            
            {/* ================= CỘT TRÁI: KHU VỰC XỬ LÝ YÊU CẦU XIN MỞ KHÓA ================= */}
            <div className="col-12 col-lg-6 border-end-lg" style={{ borderColor: colors.border }}>
              <div className="d-flex align-items-center gap-2 mb-3 text-warning fw-bold small text-uppercase tracking-wider">
                <AlertCircle size={16} />
                <span>Yêu cầu đang chờ xét duyệt ({pendingRequests.length})</span>
              </div>
              
              {pendingRequests.length > 0 ? (
                <div className="d-flex flex-column gap-3">
                  {pendingRequests.map((req) => {
                    const busInfo = buses.find((b) => Number(b.id) === Number(req.busId));
                    const busName = busInfo?.busCode || busInfo?.registrationNumber || `Xe ${req.busId}`;

                    return (
                      <div
                        key={req.id}
                        className="p-3 border rounded-3 transition-all shadow-sm"
                        style={{ 
                          backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.04)' : '#fffbeb',
                          borderColor: isDarkMode ? 'rgba(245, 158, 11, 0.3)' : '#fde68a'
                        }}
                      >
                        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                          <div>
                            <div className="fw-bold text-warning" style={{ fontSize: '14px' }}>
                              {busName} gửi yêu cầu mở khóa
                            </div>
                            {req.reason && (
                              <div className="small mt-1 text-muted fst-italic" style={{ opacity: 0.9 }}>
                                "Lý do: {req.reason}"
                              </div>
                            )}
                          </div>

                          <div className="d-flex align-items-center gap-2">
                            <button
                              className="btn btn-sm btn-success d-flex align-items-center gap-1 shadow-sm px-2 py-1"
                              disabled={isSubmittingHandle}
                              onClick={() => handleApproveQuick(req.id)}
                            >
                              <Check size={14} /> Duyệt
                            </button>
                            
                            <button
                              className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1 px-2 py-1"
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

                        {/* Form phản hồi lý do từ chối */}
                        {rejectingRequestId === req.id && (
                          <div className="mt-3 pt-3 border-top" style={{ borderColor: isDarkMode ? 'rgba(245, 158, 11, 0.15)' : '#fcd34d' }}>
                            <label className="form-label small fw-bold text-danger mb-1">Lý do từ chối yêu cầu:</label>
                            <div className="d-flex gap-2">
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                placeholder="Nhập lý do gửi tài xế..."
                                value={rejectReasonText}
                                onChange={(e) => setRejectReasonText(e.target.value)}
                                disabled={isSubmittingHandle}
                                style={{
                                  backgroundColor: isDarkMode ? colors.background : '#fff',
                                  color: colors.textPrimary,
                                  borderColor: colors.border
                                }}
                              />
                              <button
                                className="btn btn-sm btn-danger text-nowrap"
                                disabled={isSubmittingHandle}
                                onClick={() => handleRejectSubmit(req.id)}
                              >
                                Gửi đi
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
              ) : (
                /* Trạng thái trống bên cột trái */
                <div 
                  className="text-center py-5 rounded-3 border" 
                  style={{ 
                    color: colors.textSecondary, 
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.01)' : '#f8fafc',
                    borderStyle: 'dashed',
                    borderColor: colors.border
                  }}
                >
                  <AlertCircle size={24} className="opacity-30 mb-2 text-muted" />
                  <div className="small opacity-70">Không có yêu cầu mở điểm danh nào đang chờ.</div>
                </div>
              )}
            </div>

            {/* ================= CỘT PHẢI: TRẠNG THÁI HIỂN THỊ XE ĐÃ KHÓA & HOÀN THÀNH ================= */}
            <div className="col-12 col-lg-6">
              
              {/* KHỐI 1: DANH SÁCH XE ĐÃ KHÓA (CHỈ HIỂN THỊ TĨNH, KHÔNG CÓ CÔNG CỤ ĐỔI TRẠNG THÁI) */}
              <div className="mb-4">
                <div className="small fw-bold text-uppercase tracking-wider mb-3">
                  Danh sách xe đang bị khóa hệ thống ({filteredLocks.length})
                </div>

                {filteredLocks.length === 0 ? (
                  <div 
                    className="text-center py-4 rounded-3 border" 
                    style={{ 
                      color: colors.textSecondary,
                      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.01)' : '#f8fafc',
                      borderStyle: 'dashed',
                      borderColor: colors.border
                    }}
                  >
                    <Unlock size={20} className="opacity-40 mb-1 text-success" />
                    <div className="small fw-medium text-success">Tất cả các xe đã được mở khóa vận hành</div>
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-2">
                    {filteredLocks.map((s) => {
                      const busInfo = buses.find((b) => Number(b.id) === Number(s.busId));
                      const busName = busInfo?.busCode || busInfo?.registrationNumber || `Xe ${s.busId}`;
                      const key = `locked-list-${s.busId}_${s.roundId}`;

                      return (
                        <div
                          key={key}
                          className="d-flex align-items-center justify-content-between p-2 px-3 border"
                          style={{
                            background: isDarkMode ? 'rgba(239, 68, 68, 0.02)' : '#fef2f2',
                            borderColor: isDarkMode ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2',
                            borderRadius: 12,
                          }}
                        >
                          <div className="d-flex align-items-center gap-3">
                            <div className="icon-circle locked">
                              <Lock size={15} />
                            </div>
                            <div>
                              <div className="fw-bold" style={{ color: colors.textPrimary, fontSize: '14px' }}>{busName}</div>
                            </div>
                          </div>

                          <span className="badge-status locked">
                            Đã khóa điểm danh
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* KHỐI 2: DANH SÁCH XE ĐÃ HOÀN THÀNH CHẶNG */}
              <div>
                <div className="text-success small fw-bold text-uppercase tracking-wider mb-3">
                  Xe đã hoàn thành chặng ({completedBuses.length})
                </div>

                {completedBuses.length === 0 ? (
                  <div className="text-center py-4 border rounded-3" style={{ color: colors.textSecondary, borderColor: colors.border }}>
                    <CheckCircle2 size={20} className="opacity-30 mb-1" />
                    <div className="small opacity-60">Chưa có xe nào xác nhận hoàn thành chặng</div>
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-2">
                    {completedBuses.map((s) => {
                      const busInfo = buses.find((b) => Number(b.id) === Number(s.busId));
                      const busName = busInfo?.busCode || busInfo?.registrationNumber || `Xe ${s.busId}`;

                      return (
                        <div
                          key={`completed-list-${s.busId}-${s.roundId}`}
                          className="d-flex align-items-center justify-content-between p-2 px-3 border"
                          style={{
                            background: isDarkMode ? 'rgba(16, 185, 129, 0.02)' : '#f0fdf4',
                            borderColor: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : '#dcfce7',
                            borderRadius: 12,
                          }}
                        >
                          <div className="d-flex align-items-center gap-3">
                            <div className="icon-circle" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
                              <CheckCircle2 size={15} />
                            </div>
                            <div>
                              <div className="fw-bold" style={{ color: colors.textPrimary, fontSize: '14px' }}>{busName}</div>
                              <div style={{ fontSize: '11px', color: colors.textSecondary }}>Đã ký xác nhận vận hành</div>
                            </div>
                          </div>

                          <span className="badge-status" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
                            Hoàn thành
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div> {/* Kết thúc cột phải */}
          </div>
        </div>
      </div>

      {/* CSS Styles nội bộ giữ nguyên và dọn dẹp các class switch thừa */}
      <style>
        {`
        .icon-circle { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .icon-circle.locked { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        
        .badge-status { padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.02em; }
        .badge-status.locked { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        
        .transition-all { transition: all 0.2s ease-in-out; }
        .tracking-wider { letter-spacing: 0.05em; }
        
        @media (min-width: 992px) {
          .border-end-lg { border-right: 1px solid var(--bs-border-color) !important; padding-right: 1.5rem !important; }
        }
        `}
      </style>
    </div>
  );
};

export default LockRoundModal;