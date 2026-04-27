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

const SetupOrgPage: React.FC = () => {
  const { colors } = useTheme();
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

  // Các hàm mutation giữ nguyên logic của bạn
  const createMutation = useMutation({
    mutationFn: (name: string) => api.createTenant({ name }),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['userStatus'] });
      await refreshAuthState(dispatch);
      setOpenTenantSelector(true);
    },
    onError: (err: any) => alert(err.message),
  });

  const joinMutation = useMutation({
    mutationFn: (code: string) => api.joinTenant(code),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['userStatus'] });
      await refreshAuthState(dispatch);
      setOpenTenantSelector(true);
    },
    onError: (err: any) => alert(err.message),
  });

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center p-4" 
         style={{ backgroundColor: colors.surface, backgroundImage: `radial-gradient(circle at top right, ${colors.surfaceLight}, ${colors.surface})` }}>
      
      <div className="container" style={{ maxWidth: '900px' }}>
        <div className="text-center mb-5 animate-fade-down">
          <div className="d-flex align-items-center justify-content-center gap-3 mb-3">
            <div className="p-2 rounded-circle bg-primary bg-opacity-10 border border-primary border-opacity-25 shadow-glow">
              <img
                src="/favicon.svg"
                alt="logo"
                width="50"
                height="50"
              />
            </div>

            <h1 className="display-6 fw-bold text-white mb-0">
              Bắt đầu với BusTrack
            </h1>
          </div>
          <p className="text-gray-400">Chọn một tổ chức hiện có hoặc tạo không gian làm việc mới cho đội ngũ của bạn</p>
        </div>

        {tenants.length > 0 && (
          <div className="card border-0 mb-5 overflow-hidden animate-fade-up" 
               style={{ background: 'rgba(30, 41, 59, 0.5)', backdropFilter: 'blur(10px)', border: `1px solid ${colors.borderLight}` }}>
            <div className="card-body p-4 d-flex justify-content-between align-items-center">
              <div className="d-flex align-items-center gap-3">
                <div className="p-2 bg-info bg-opacity-10 rounded-3 border border-info border-opacity-20">
                  <ShieldCheck className="text-info" size={24} />
                </div>
                <div>
                  <h6 className="text-white mb-0 font-bold">Tiếp tục phiên làm việc</h6>
                  <p className="text-gray-500 small mb-0">Bạn đang là thành viên của {tenants.length} tổ chức.</p>
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
            <div className="setup-card h-100 p-4 rounded-4 border border-gray-800 transition-all">
              <div className="icon-box bg-success bg-opacity-10 text-success mb-4">
                <PlusCircle size={28} />
              </div>
              <h3 className="h5 text-white fw-bold mb-2">Tạo tổ chức mới</h3>
              <p className="text-gray-500 small mb-4">Khởi tạo hệ thống quản lý riêng cho doanh nghiệp của bạn chỉ trong vài giây.</p>
              
              <div className="mt-auto">
                <label className="text-gray-400 small mb-2 ps-1">Tên tổ chức</label>
                <input
                  className="form-control custom-input mb-3"
                  placeholder="Ví dụ: Công ty Vận tải ABC"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                />
                <button
                  className="btn btn-success w-100 py-2.5 fw-bold d-flex align-items-center justify-content-center gap-2"
                  onClick={() => createMutation.mutate(orgName)}
                  disabled={!orgName || createMutation.isPending}
                >
                  {createMutation.isPending ? <span className="spinner-border spinner-border-sm" /> : <Rocket size={18} />}
                  Thiết lập tổ chức
                </button>
              </div>
            </div>
          </div>

          <div className="col-md-6 animate-fade-right">
            <div className="setup-card h-100 p-4 rounded-4 border border-gray-800 transition-all">
              <div className="icon-box bg-primary bg-opacity-10 text-primary mb-4">
                <LogIn size={28} />
              </div>
              <h3 className="h5 text-white fw-bold mb-2">Tham gia tổ chức</h3>
              <p className="text-gray-500 small mb-4">Sử dụng mã mời  được cung cấp bởi quản lý của bạn.</p>
              
              <div className="mt-auto">
                <label className="text-gray-400 small mb-2 ps-1">Mã tham gia</label>
                <input
                  className="form-control custom-input mb-3 tracking-widest"
                  placeholder="Nhập mã tham gia"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                />
                <button
                  className="btn btn-outline-primary w-100 py-2.5 fw-bold d-flex align-items-center justify-content-center gap-2"
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

      <TenantSelector
        isOpen={openTenantSelector}
        onClose={() => setOpenTenantSelector(false)}
        showCreateJoin={false}
      />

      <style>{`
        .text-gray-400 { color: ${colors.textSecondary}; }
        .text-gray-500 { color: ${colors.textMuted}; }
        .border-gray-800 { border: 1px solid ${colors.border} !important; }
        
        .btn-access {
          background: linear-gradient(135deg, ${colors.primary}, ${colors.info});
          transition: all 0.25s ease;
          letter-spacing: 0.3px;
        }

        .btn-access:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 28px ${colors.primaryGlow};
          background: linear-gradient(135deg, ${colors.info}, ${colors.primary});
        }

        .btn-access:active {
          transform: translateY(0);
        }

        .btn-access .icon-arrow {
          transition: transform 0.25s ease;
        }

        .btn-access:hover .icon-arrow {
          transform: translateX(4px);
        }
        .setup-card {
          background: rgba(30, 41, 59, 0.4);
          backdrop-filter: blur(8px);
          display: flex;
          flex-direction: column;
        }

        .setup-card:hover {
          background: rgba(30, 41, 59, 0.6);
          transform: translateY(-5px);
          border-color: ${colors.info} !important;
        }

        .icon-box {
          width: 56px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 16px;
        }

        .custom-input {
          background: ${colors.surface} !important;
          border: 1px solid ${colors.borderLight} !important;
          color: ${colors.textPrimary} !important;
          padding: 12px 16px;
          border-radius: 10px;
          transition: 0.3s;
        }
        .custom-input::placeholder {
          color: ${colors.textSecondary};
          opacity: 1;
        }

        .custom-input:focus {
          border-color: ${colors.info} !important;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
        }

        .shadow-glow {
          box-shadow: 0 0 20px rgba(59, 130, 246, 0.2);
        }

        .tracking-widest { letter-spacing: 0.2em; }

        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-down { animation: fadeInDown 0.6s ease-out; }
        
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-up { animation: fadeInUp 0.6s ease-out; }
      `}</style>
    </div>
  );
};

const refreshAuthState = async (dispatch: any) => {
  const currentUser = fbAuth.currentUser;
  if (!currentUser) return;
  await currentUser.reload();
  const token = await currentUser.getIdToken(true);
  const status: any = await api.getMyStatus();
  dispatch(authSuccess({ user: status.user, token, tenants: status.tenants || [], roleId: status.roleId }));
};

export default SetupOrgPage;