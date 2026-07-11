import React, { useEffect, useState } from 'react';
import { PlusCircle, LogIn, Rocket, ArrowRight, ShieldCheck } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDispatch, useSelector } from 'react-redux';
import { auth as fbAuth } from '../../config/firebase';
import { authSuccess } from '../../redux/slice/authSlice';
import api from '../../services/api';
import { type RootState } from '../../redux/store';
import TenantSelector from '../../components/layout/TenantSelector';
import { useSnackbar } from 'notistack';
import { usePageThemeVars } from '../../hooks/usePageThemeVars';
import './SetupOrgPage.css';

const SetupOrgPage: React.FC = () => {
  const pageThemeVars = usePageThemeVars();
  const { enqueueSnackbar } = useSnackbar();
  const [orgName, setOrgName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [openTenantSelector, setOpenTenantSelector] = useState(false);

  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const tenants = useSelector((state: RootState) => state.auth.tenants);

  useEffect(() => {
    if (tenants.length > 0) {
      setOpenTenantSelector(true);
    }
  }, [tenants.length]);

  const createMutation = useMutation({
    mutationFn: (name: string) => api.createTenant({ name }),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['userStatus'] });
      await refreshAuthState(dispatch);
      setOpenTenantSelector(true);
    },
    onError: (err: any) => enqueueSnackbar(err.message, { variant: 'error' }),
  });

  const joinMutation = useMutation({
    mutationFn: (code: string) => api.joinTenant(code),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['userStatus'] });
      await refreshAuthState(dispatch);
      setOpenTenantSelector(true);
    },
    onError: (err: any) => enqueueSnackbar(err.message, { variant: 'error' }),
  });

  return (
    <div className="setup-org-page min-vh-100 d-flex align-items-center justify-content-center p-4 transition-all" style={pageThemeVars}>
      
      <div className="setup-org-container container">
        <div className="text-center mb-5 animate-fade-down">
          <div className="d-flex align-items-center justify-content-center gap-3 mb-3">
            <h1 className="setup-org-title display-6 fw-bold mb-0">
              Bắt đầu với BusTrack
            </h1>
          </div>
          <p className="setup-org-subtitle">Chọn một tổ chức hiện có hoặc tạo không gian làm việc mới cho đội ngũ của bạn</p>
        </div>

        {/* Continue Session Card */}
        {tenants.length > 0 && (
          <div className="setup-session-card card border-0 mb-5 overflow-hidden animate-fade-up shadow-sm">
            <div className="card-body p-4 d-flex flex-column flex-md-row justify-content-between align-items-center gap-3">
              <div className="d-flex align-items-center gap-3">
                <div className="setup-session-icon p-2 rounded-3">
                  <ShieldCheck className="text-info" size={24} />
                </div>
                <div>
                  <h6 className="setup-session-title mb-0 fw-bold">Tiếp tục phiên làm việc</h6>
                  <p className="setup-session-text small mb-0">Bạn đang là thành viên của {tenants.length} tổ chức.</p>
                </div>
              </div>
              <button
                className="btn btn-primary px-5 py-3 rounded-pill shadow-lg border-0 d-inline-flex align-items-center gap-2 fw-semibold btn-access"
                onClick={() => setOpenTenantSelector(true)}
              >
                <span>Truy cập ngay</span>
                <ArrowRight size={18} className="icon-arrow" />
              </button>
            </div>
          </div>
        )}

        <div className="row g-4 justify-content-center">
          {/* Create Organization Card */}
          <div className="col-md-6 animate-fade-left">
            <div className="setup-card h-100 p-4 rounded-4 shadow-sm transition-all">
              <div className="icon-box setup-icon-success mb-4">
                <PlusCircle size={28} />
              </div>
              <h3 className="setup-card-title h5 fw-bold mb-2">Tạo tổ chức mới</h3>
              <p className="setup-card-text small mb-4">Khởi tạo hệ thống quản lý riêng cho doanh nghiệp của bạn chỉ trong vài giây.</p>
              
              <div className="mt-auto">
                <label className="setup-form-label small mb-2 ps-1 fw-medium">Tên tổ chức</label>
                <input
                  className="form-control custom-input setup-input mb-3"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                />
                <button
                  className="btn btn-success w-100 py-2.5 fw-bold d-flex align-items-center justify-content-center gap-2 shadow-sm"
                  onClick={() => createMutation.mutate(orgName)}
                  disabled={!orgName || createMutation.isPending}
                >
                  {createMutation.isPending ? <span className="spinner-border spinner-border-sm" /> : <Rocket size={18} />}
                  Thiết lập tổ chức
                </button>
              </div>
            </div>
          </div>

          {/* Join Organization Card */}
          <div className="col-md-6 animate-fade-right">
            <div className="setup-card h-100 p-4 rounded-4 shadow-sm transition-all">
              <div className="icon-box setup-icon-primary mb-4">
                <LogIn size={28} />
              </div>
              <h3 className="setup-card-title h5 fw-bold mb-2">Tham gia tổ chức</h3>
              <p className="setup-card-text small mb-4">Sử dụng mã mời được cung cấp bởi quản lý của bạn.</p>
              
              <div className="mt-auto">
                <label className="setup-form-label small mb-2 ps-1 fw-medium">Mã tham gia</label>
                <input
                  className="form-control custom-input setup-input mb-3 tracking-widest"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                />
                <button
                  className="setup-join-button btn btn-outline-primary w-100 py-2.5 fw-bold d-flex align-items-center justify-content-center gap-2"
                  onClick={() => joinMutation.mutate(joinCode)}
                  disabled={!joinCode || joinMutation.isPending}
                >
                  {joinMutation.isPending ? <span className="spinner-border spinner-border-sm" /> : <ArrowRight size={18} />}
                  Vào tổ chức
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <TenantSelector isOpen={openTenantSelector} onClose={() => setOpenTenantSelector(false)} showCreateJoin={false} />

    </div>
  );
};

// ... giữ nguyên refreshAuthState
const refreshAuthState = async (dispatch: any) => {
  const currentUser = fbAuth.currentUser;
  if (!currentUser) return;
  await currentUser.reload();
  const token = await currentUser.getIdToken(true);
  const status: any = await api.getMyStatus(token);
  if (!status) return;
  dispatch(authSuccess({ user: status.user, token, tenants: status.tenants || [], roleId: status.roleId }));
};

export default SetupOrgPage;

