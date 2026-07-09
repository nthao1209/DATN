import React, { useState } from 'react';
import { Lock, Unlock, Check, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  getBusName,
  getCompletedBuses,
  getFilteredLocks,
  getLockModalVars,
  getPendingUnlockRequests,
} from './lockRoundModalHelpers';
import './LockRoundModal.css';

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

  const filteredLocks = getFilteredLocks({ lockStatuses, roundId, lockType });
  const completedBuses = getCompletedBuses(lockStatuses, roundId);
  const pendingRequests = getPendingUnlockRequests({ unlockRequests, roundId, lockType });

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
    } finally {
      setIsSubmittingHandle(false);
    }
  };

  const modalVars = getLockModalVars({ colors, isDarkMode });

  return (
    <div
      className="lock-round-modal"
      style={modalVars}
    >
      <div className="lock-modal-shell animate-fade-in">
        {/* Header */}
        <div className="lock-modal-header p-3 d-flex justify-content-between align-items-center border-bottom">
          <div>
            <h6 className="lock-modal-title m-0 fw-bold fs-5">
              Quản lý khóa {lockType === 'check_in' ? 'lượt đi (Check-in)' : 'lượt về (Check-out)'} — Chặng {roundId}
            </h6>
          </div>
          <div>
            <button 
              className="lock-modal-close btn btn-sm rounded-pill px-3 fw-medium transition-all"
              onClick={onClose}
            >
              Đóng
            </button>
          </div>
        </div>

        {/* Body Container được chia làm 2 Cột sử dụng Bootstrap Grid */}
        <div className="lock-modal-body p-4 sidebar-content overflow-auto">
          <div className="row g-4">
            
            {/* ================= CỘT TRÁI: KHU VỰC XỬ LÝ YÊU CẦU XIN MỞ KHÓA ================= */}
            <div className="lock-modal-left-column col-12 col-lg-6 border-end-lg">
              <div className="d-flex align-items-center gap-2 mb-3 text-warning fw-bold small text-uppercase tracking-wider">
                <AlertCircle size={16} />
                <span>Yêu cầu đang chờ xét duyệt ({pendingRequests.length})</span>
              </div>
              
              {pendingRequests.length > 0 ? (
                <div className="d-flex flex-column gap-3">
                  {pendingRequests.map((req) => {
                    const busName = getBusName(buses, req.busId);

                    return (
                      <div
                        key={req.id}
                        className="unlock-request-card p-3 border rounded-3 transition-all shadow-sm"
                      >
                        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                          <div>
                            <div className="unlock-request-title fw-bold text-warning">
                              {busName} gửi yêu cầu mở khóa
                            </div>
                            {req.reason && (
                              <div
                                className="unlock-reason mt-2"
                              >
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
                          <div className="unlock-reject-panel mt-3 pt-3 border-top">
                            <label className="form-label small fw-bold text-danger mb-1">Lý do từ chối yêu cầu:</label>
                            <div className="d-flex gap-2">
                              <input
                                type="text"
                                className="unlock-reject-input form-control form-control-sm"
                                placeholder="Nhập lý do gửi tài xế..."
                                value={rejectReasonText}
                                onChange={(e) => setRejectReasonText(e.target.value)}
                                disabled={isSubmittingHandle}
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
                  className="lock-empty-state text-center py-5 rounded-3 border" 
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
                    className="lock-empty-state text-center py-4 rounded-3 border" 
                  >
                    <Unlock size={20} className="opacity-40 mb-1 text-success" />
                    <div className="small fw-medium text-success">Tất cả các xe đã được mở khóa vận hành</div>
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-2">
                    {filteredLocks.map((s) => {
                      const busName = getBusName(buses, s.busId);
                      const key = `locked-list-${s.busId}_${s.roundId}`;

                      return (
                        <div
                          key={key}
                          className="locked-bus-row d-flex align-items-center justify-content-between p-2 px-3 border"
                        >
                          <div className="d-flex align-items-center gap-3">
                            <div className="icon-circle locked">
                              <Lock size={15} />
                            </div>
                            <div>
                              <div className="lock-bus-name fw-bold">{busName}</div>
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
                  <div className="completed-empty-state text-center py-4 border rounded-3">
                    <CheckCircle2 size={20} className="opacity-30 mb-1" />
                    <div className="small opacity-60">Chưa có xe nào xác nhận hoàn thành chặng</div>
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-2">
                    {completedBuses.map((s) => {
                      const busName = getBusName(buses, s.busId);

                      return (
                        <div
                          key={`completed-list-${s.busId}-${s.roundId}`}
                          className="completed-bus-row d-flex align-items-center justify-content-between p-2 px-3 border"
                        >
                          <div className="d-flex align-items-center gap-3">
                            <div className="icon-circle completed">
                              <CheckCircle2 size={15} />
                            </div>
                            <div>
                              <div className="lock-bus-name fw-bold">{busName}</div>
                              <div className="completed-bus-note">Đã ký xác nhận vận hành</div>
                            </div>
                          </div>

                          <span className="badge-status completed">
                            Hoàn thành
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default LockRoundModal;



