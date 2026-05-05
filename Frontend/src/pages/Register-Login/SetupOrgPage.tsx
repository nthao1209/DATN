import React, { useEffect, useState } from 'react';
import { PlusCircle, LogIn, Rocket, ArrowRight, ShieldCheck } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDispatch, useSelector } from 'react-redux';
import { auth as fbAuth } from '../../config/firebase';
import { authSuccess } from '../../redux/slice/authSlice';
import api from '../../services/api';
import { type RootState } from '../../redux/store';
import TenantSelector from '../../components/TenantSelector';
import { useTheme } from '../../theme/ThemeContext';
import { useSnackbar } from 'notistack';

const SetupOrgPage: React.FC = () => {
  const { colors, effects, isDarkMode } = useTheme(); 
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
    <div className="min-vh-100 d-flex align-items-center justify-content-center p-4 transition-all" 
         style={{ 
           backgroundColor: colors.background, // Dùng màu nền hệ thống
           backgroundImage: isDarkMode 
            ? `radial-gradient(circle at top right, ${colors.surfaceLight}, ${colors.surface})` 
            : `radial-gradient(circle at top right, #f0f4ff, ${colors.background})` 
         }}>
      
      <div className="container" style={{ maxWidth: '900px' }}>
        <div className="text-center mb-5 animate-fade-down">
          <div className="d-flex align-items-center justify-content-center gap-3 mb-3">
            <div className="p-2 rounded-circle shadow-sm" 
                 style={{ 
                   backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.1)' : '#fff',
                   border: `1px solid ${colors.border}` 
                 }}>
              <img src="/favicon.svg" alt="logo" width="50" height="50" />
            </div>

            <h1 className="display-6 fw-bold mb-0" style={{ color: colors.textPrimary, letterSpacing: '-0.03em' }}>
              Bắt đầu với BusTrack
            </h1>
          </div>
          <p style={{ color: colors.textSecondary }}>Chọn một tổ chức hiện có hoặc tạo không gian làm việc mới cho đội ngũ của bạn</p>
        </div>

        {/* Continue Session Card */}
        {tenants.length > 0 && (
          <div className="card border-0 mb-5 overflow-hidden animate-fade-up shadow-sm" 
               style={{ 
                 background: isDarkMode ? colors.surfaceLight : '#fff', 
                 border: `1px solid ${colors.border}`,
                 borderRadius: effects.borderRadius.lg 
               }}>
            <div className="card-body p-4 d-flex flex-column flex-md-row justify-content-between align-items-center gap-3">
              <div className="d-flex align-items-center gap-3">
                <div className="p-2 rounded-3" style={{ backgroundColor: `${colors.info}15`, border: `1px solid ${colors.info}33` }}>
                  <ShieldCheck className="text-info" size={24} />
                </div>
                <div>
                  <h6 className="mb-0 fw-bold" style={{ color: colors.textPrimary }}>Tiếp tục phiên làm việc</h6>
                  <p className="small mb-0" style={{ color: colors.textMuted }}>Bạn đang là thành viên của {tenants.length} tổ chức.</p>
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
            <div className="setup-card h-100 p-4 rounded-4 shadow-sm transition-all" 
                 style={{ 
                   background: isDarkMode ? colors.surface : '#fff',
                   border: `1px solid ${colors.border}` 
                 }}>
              <div className="icon-box mb-4" style={{ backgroundColor: `${colors.success}15`, color: colors.success }}>
                <PlusCircle size={28} />
              </div>
              <h3 className="h5 fw-bold mb-2" style={{ color: colors.textPrimary }}>Tạo tổ chức mới</h3>
              <p className="small mb-4" style={{ color: colors.textMuted }}>Khởi tạo hệ thống quản lý riêng cho doanh nghiệp của bạn chỉ trong vài giây.</p>
              
              <div className="mt-auto">
                <label className="small mb-2 ps-1 fw-medium" style={{ color: colors.textSecondary }}>Tên tổ chức</label>
                <input
                  className="form-control custom-input mb-3"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  style={{ 
                    backgroundColor: isDarkMode ? colors.surfaceLight : '#f8fafc',
                    color: colors.textPrimary,
                    border: `1px solid ${colors.border}`
                  }}
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
            <div className="setup-card h-100 p-4 rounded-4 shadow-sm transition-all"
                 style={{ 
                   background: isDarkMode ? colors.surface : '#fff',
                   border: `1px solid ${colors.border}` 
                 }}>
              <div className="icon-box mb-4" style={{ backgroundColor: `${colors.primary}15`, color: colors.primary }}>
                <LogIn size={28} />
              </div>
              <h3 className="h5 fw-bold mb-2" style={{ color: colors.textPrimary }}>Tham gia tổ chức</h3>
              <p className="small mb-4" style={{ color: colors.textMuted }}>Sử dụng mã mời được cung cấp bởi quản lý của bạn.</p>
              
              <div className="mt-auto">
                <label className="small mb-2 ps-1 fw-medium" style={{ color: colors.textSecondary }}>Mã tham gia</label>
                <input
                  className="form-control custom-input mb-3 tracking-widest"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  style={{ 
                    backgroundColor: isDarkMode ? colors.surfaceLight : '#f8fafc',
                    color: colors.textPrimary,
                    border: `1px solid ${colors.border}`
                  }}
                />
                <button
                  className="btn btn-outline-primary w-100 py-2.5 fw-bold d-flex align-items-center justify-content-center gap-2"
                  onClick={() => joinMutation.mutate(joinCode)}
                  disabled={!joinCode || joinMutation.isPending}
                  style={{ borderColor: colors.primary, color: colors.primary }}
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

      <style>{`
        .btn-access {
          background: linear-gradient(135deg, ${colors.primary}, ${colors.info});
          transition: all 0.25s ease;
        }
        .btn-access:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px ${colors.primary}44;
        }
        .icon-box {
          width: 56px; height: 56px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 14px;
        }
        .setup-card {
          display: flex; flex-direction: column;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .setup-card:hover {
          transform: translateY(-5px);
          border-color: ${colors.primary}66 !important;
          box-shadow: ${isDarkMode ? '0 10px 30px rgba(0,0,0,0.3)' : '0 10px 30px rgba(0,0,0,0.08)'} !important;
        }
        .custom-input {
          padding: 12px 16px;
          border-radius: 10px;
          transition: all 0.2s;
        }
        .custom-input:focus {
          border-color: ${colors.primary} !important;
          box-shadow: 0 0 0 4px ${colors.primary}15 !important;
          background-color: ${isDarkMode ? colors.surfaceLight : '#fff'} !important;
        }
        .tracking-widest { letter-spacing: 0.15em; font-weight: 600; text-transform: uppercase; }
        
        @keyframes fadeInDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-down { animation: fadeInDown 0.6s ease-out; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-up { animation: fadeInUp 0.6s ease-out; }
      `}</style>
    </div>
  );
};

// ... giữ nguyên refreshAuthState
const refreshAuthState = async (dispatch: any) => {
  const currentUser = fbAuth.currentUser;
  if (!currentUser) return;
  await currentUser.reload();
  const token = await currentUser.getIdToken(true);
  const status: any = await api.getMyStatus();
  dispatch(authSuccess({ user: status.user, token, tenants: status.tenants || [], roleId: status.roleId }));
};

export default SetupOrgPage;