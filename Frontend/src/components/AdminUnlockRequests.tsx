import { useState, useEffect } from 'react';
import { useUnlockRequests, useApproveUnlockRequest, useRejectUnlockRequest } from '../hooks/useUnlockRequests';
import { format } from 'date-fns';
import { useTheme } from '../theme/ThemeContext';
import { Check, X, Clock, Loader2 } from 'lucide-react';

interface AdminUnlockRequestsProps {
  tripId?: number;
  refreshTrigger?: number;
}

export const AdminUnlockRequests = ({ tripId, refreshTrigger }: AdminUnlockRequestsProps) => {
  const { colors, isDarkMode } = useTheme();
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [rejectDialog, setRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  
  const { data: requests, isLoading, refetch } = useUnlockRequests(tripId, 'PENDING');
  const approveRequest = useApproveUnlockRequest();
  const rejectRequest = useRejectUnlockRequest();

  useEffect(() => {
    const interval = setInterval(() => { refetch(); }, 5000);
    return () => clearInterval(interval);
  }, [refetch]);

  useEffect(() => {
    if (refreshTrigger) refetch();
  }, [refreshTrigger, refetch]);

  const handleApprove = async (request: any) => {
    try {
      await approveRequest.mutateAsync(request.id);
      refetch();
    } catch (error) { }
  };

  const handleRejectSubmit = async () => {
    if (!selectedRequest) return;
    try {
      await rejectRequest.mutateAsync({ requestId: selectedRequest.id, rejectReason });
      setRejectDialog(false);
      setRejectReason('');
      setSelectedRequest(null);
      refetch();
    } catch (error) { }
  };

  const getLockTypeLabel = (type: string) => type === 'check_in' ? 'Vào' : 'Ra';

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center p-5">
        <Loader2 className="spin" size={32} color={colors.primary} />
      </div>
    );
  }

  const pendingCount = requests?.filter(r => r.status === 'PENDING').length || 0;

  return (
    <div className="card shadow-sm border-0 mb-4" style={{ backgroundColor: colors.surface, borderRadius: '16px' }}>
      <div className="card-header bg-transparent border-0 pt-4 px-4 d-flex justify-content-between align-items-center">
        <div>
          <h5 className="mb-1 fw-bold" style={{ color: colors.textPrimary }}>Yêu cầu mở khóa</h5>
          <span className="badge rounded-pill" style={{ backgroundColor: `${colors.warning}22`, color: colors.warning }}>
            {pendingCount} đang chờ
          </span>
        </div>
      </div>

      <div className="card-body p-0">
        {!requests || requests.length === 0 ? (
          <div className="p-5 text-center text-muted">
            <Clock size={40} className="mb-3 opacity-25" />
            <p>Không có yêu cầu nào cần xử lý</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0" style={{ color: colors.textPrimary }}>
              <thead style={{ backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : '#f8fafc' }}>
                <tr>
                  <th className="ps-4 border-0 py-3 small text-uppercase opacity-75">Xe</th>
                  <th className="border-0 py-3 small text-uppercase opacity-75">Tuyến/Loại</th>
                  <th className="border-0 py-3 small text-uppercase opacity-75">Lý do</th>
                  <th className="border-0 py-3 small text-uppercase opacity-75">Thời gian</th>
                  <th className="pe-4 border-0 py-3 small text-uppercase text-end opacity-75">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id} className="border-bottom" style={{ borderColor: colors.border }}>
                    <td className="ps-4 py-3 fw-bold">{request.bus?.busCode}</td>
                    <td className="py-3">
                      <div className="small">{request.round?.name}</div>
                      <span className="extra-small opacity-75">{getLockTypeLabel(request.type)}</span>
                    </td>
                    <td className="py-3">
                      <div className="text-truncate" style={{ maxWidth: '180px' }} title={request.reason}>
                        {request.reason || '-'}
                      </div>
                    </td>
                    <td className="py-3 small text-muted">
                      {format(new Date(request.createdAt), 'dd/MM/yyyy HH:mm')}
                    </td>
                    <td className="pe-4 py-3 text-end">
                      {request.status === 'PENDING' && (
                        <div className="d-flex gap-2 justify-content-end">
                          <button 
                            className="btn-action-custom btn-approve"
                            onClick={() => handleApprove(request)}
                            disabled={approveRequest.isPending}
                          >
                            <Check size={16} /> Duyệt
                          </button>
                          <button 
                            className="btn-action-custom btn-reject"
                            onClick={() => { setSelectedRequest(request); setRejectDialog(true); }}
                            disabled={rejectRequest.isPending}
                          >
                            <X size={16} /> Từ chối
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Từ chối (Bản thuần) */}
      {rejectDialog && (
        <div className="modal-custom-overlay animate-fade-in">
          <div className="modal-custom-content p-4 shadow-lg" style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}` }}>
            <h5 className="fw-bold mb-3" style={{ color: colors.textPrimary }}>Lý do từ chối</h5>
            <div className="small mb-3 p-2 rounded" style={{ backgroundColor: `${colors.border}33` }}>
              Xe: {selectedRequest?.bus?.busCode} - {selectedRequest?.round?.name}
            </div>
            
            <textarea
              className="form-control mb-3"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Nhập lý do (không bắt buộc)..."
              style={{ backgroundColor: isDarkMode ? colors.background : '#fff', color: colors.textPrimary, borderColor: colors.border }}
            />

            <div className="d-flex justify-content-end gap-2">
              <button className="btn btn-sm btn-link text-decoration-none" onClick={() => setRejectDialog(false)}>Hủy</button>
              <button className="btn btn-sm btn-danger px-3 rounded-pill" onClick={handleRejectSubmit} disabled={rejectRequest.isPending}>
                Xác nhận từ chối
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .btn-action-custom {
          border: none; padding: 6px 12px; border-radius: 8px; font-size: 13px; font-weight: 600;
          display: flex; align-items: center; gap: 6px; transition: all 0.2s;
        }
        .btn-approve { background-color: ${colors.success}15; color: ${colors.success}; }
        .btn-approve:hover { background-color: ${colors.success}; color: white; }
        
        .btn-reject { background-color: ${colors.danger}15; color: ${colors.danger}; }
        .btn-reject:hover { background-color: ${colors.danger}; color: white; }

        .modal-custom-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center; z-index: 2000;
        }
        .modal-custom-content { width: 400px; border-radius: 16px; }
        .extra-small { font-size: 10px; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};