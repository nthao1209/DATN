import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { type RootState } from '../redux/store';
import { setCurrentTenant } from '../redux/slice/authSlice';
import { Check, Building2, Plus, X, Globe } from 'lucide-react';
import { auth as fbAuth } from '../config/firebase';
import api from '../services/api';
import type { Tenant } from '../types/auth';
import { useTheme } from '../theme/ThemeContext';
import { getFallbackPathForRole, getRoleDisplayName } from '../auth/rbac';

interface TenantSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  showCreateJoin?: boolean; 
}

const TenantSelector: React.FC<TenantSelectorProps> = ({ 
  isOpen, 
  onClose, 
  showCreateJoin = true 
}) => {
  const SETUP_ORG_COMPLETE_KEY = 'bustrack-setup-org-complete';
  const { colors, isDarkMode } = useTheme();
  const { currentTenant, tenants: stateTenants } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useQuery<{ tenants: Tenant[] }>({
    queryKey: ['userStatus'],
    queryFn: async () => {
      const currentUser = fbAuth.currentUser ?? (await new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(fbAuth, (user) => {
          unsubscribe();
          resolve(user);
        });
      }));

      const token = currentUser ? await currentUser.getIdToken(true) : undefined;
      return ((await api.getMyStatus(token)) || { tenants: [] }) as unknown as { tenants: Tenant[] };
    },
    enabled: isOpen,
    staleTime: 30000,
  });

  const tenants = status?.tenants?.length ? status.tenants : stateTenants;

  const handleSelectTenant = (tenant: any) => {
    dispatch(setCurrentTenant(tenant));
    queryClient.clear();
    sessionStorage.setItem(SETUP_ORG_COMPLETE_KEY, 'true');
    onClose();
    navigate(getFallbackPathForRole(tenant.roleId ?? tenant.role?.id));
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay animate-fade-in" onClick={onClose}>
      <div className="modal-container shadow-2xl animate-zoom-in" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="modal-header-dark border-bottom border-gray-800 p-4">
          <div className="d-flex align-items-center justify-content-between w-100">
            <div className="d-flex align-items-center gap-3">
              <div className="p-2 bg-primary bg-opacity-10 rounded-3 text-primary shadow-primary-sm">
                <Globe size={24} />
              </div>
              <div>
                <h5 className="m-0 fw-bold" style={{ color: colors.textPrimary }}>Không gian làm việc</h5>
                <p className="text-gray-500 small mb-0">Bạn đang tham gia {tenants?.length || 0} tổ chức</p>
              </div>
            </div>
            <button onClick={onClose} className="btn-close-dark">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="modal-body-dark p-3" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {isLoading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status" />
              <p className="text-gray-500 small mt-3">Đang đồng bộ dữ liệu...</p>
            </div>
          ) : tenants?.length === 0 ? (
            <div className="text-center py-5 rounded-4 border border-dashed border-gray-700" style={{ backgroundColor: colors.surfaceLight }}>
              <Building2 size={48} className="text-gray-700 mb-3" />
              <p className="text-gray-400 mb-0 px-4">Chúng tôi không tìm thấy tổ chức nào liên kết với tài khoản của bạn.</p>
            </div>
          ) : (
            <div className="d-grid gap-2">
              {tenants.map((tenant: any) => {
                const isSelected = currentTenant?.id === tenant.id;
                return (
                  <button
                    key={tenant.id}
                    onClick={() => handleSelectTenant(tenant)}
                    className={`tenant-card transition-all ${isSelected ? 'active' : ''}`}
                  >
                    <div className="d-flex align-items-center gap-3 w-100">
                      <div className={`tenant-icon ${isSelected ? 'bg-white text-primary' : 'bg-gray-800 text-gray-400'}`}>
                        <Building2 size={22} />
                      </div>
                      <div className="text-start flex-grow-1">
                        <div className={`fw-bold ${isSelected ? 'text-white' : 'text-gray-200'}`}>
                          {tenant.name}
                        </div>
                        <div className={`small ${isSelected ? 'text-primary-light' : 'text-gray-500'}`}>
                          Vai trò: <span className="text-uppercase fw-bold" style={{fontSize: '10px'}}>{getRoleDisplayName(typeof tenant.role === 'string' ? tenant.role : tenant.role?.name)}</span>
                        </div>
                      </div>
                      {isSelected ? (
                        <div className="p-1 bg-white rounded-circle text-primary animate-bounce-in">
                          <Check size={16} strokeWidth={3} />
                        </div>
                      ) : (
                        <ArrowIcon />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer-dark p-3 border-top border-gray-800">
          <div className="d-flex flex-column gap-2 w-100">
            {showCreateJoin && (
              <button 
                onClick={() => { onClose(); navigate('/setup-org'); }}
                className="btn tenant-primary-action d-flex align-items-center justify-content-center gap-2 py-2.5 rounded-3 fw-semibold"
              >
                <Plus size={18} /> Thêm tổ chức mới
              </button>
            )}
            <button 
              onClick={onClose}
              className="btn btn-link text-gray-500 text-decoration-none py-2"
            >
              Hủy bỏ
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .modal-overlay {
          position: fixed; top: 0; left: 0; width: 100%; height: 100%;
          background: ${isDarkMode ? 'rgba(2, 6, 23, 0.72)' : 'rgba(15, 23, 42, 0.36)'};
          backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center; z-index: 2000;
        }
        .modal-container {
          background: ${colors.surface}; width: 100%; max-width: 480px;
          border-radius: 20px; border: 1px solid ${colors.border}; overflow: hidden;
          box-shadow: ${isDarkMode ? '0 24px 70px rgba(0, 0, 0, 0.38)' : '0 24px 70px rgba(15, 23, 42, 0.18)'};
        }
        .tenant-card {
          padding: 1rem; border-radius: 12px; background: transparent;
          border: 1px solid ${colors.border}; color: ${colors.textSecondary}; transition: 0.3s;
          display: flex; align-items: center; width: 100%;
        }
        .tenant-card:hover:not(.active) {
          background: ${colors.surfaceLight}; border-color: ${colors.borderLight}; transform: translateX(5px);
        }
        .tenant-card.active {
          background: ${isDarkMode ? 'rgba(37, 99, 235, 0.18)' : 'rgba(37, 99, 235, 0.08)'};
          border-color: ${isDarkMode ? 'rgba(59, 130, 246, 0.38)' : 'rgba(37, 99, 235, 0.22)'};
          box-shadow: ${isDarkMode ? `0 10px 22px ${colors.primaryGlow}` : '0 10px 22px rgba(37, 99, 235, 0.10)'};
        }
        .tenant-card.active .text-white {
          color: ${colors.textPrimary} !important;
        }
        .tenant-card.active .text-primary-light {
          color: ${colors.textSecondary} !important;
        }
        .tenant-card.active .tenant-icon,
        .tenant-card.active .animate-bounce-in {
          background: ${isDarkMode ? 'rgba(59, 130, 246, 0.18)' : 'rgba(37, 99, 235, 0.12)'} !important;
          color: ${colors.primary} !important;
        }
        .tenant-icon {
          width: 44px; height: 44px; display: flex; align-items: center;
          justify-content: center; border-radius: 10px;
        }
        .text-primary-light { color: ${colors.textPrimary}; }
        .text-gray-200 { color: ${colors.textPrimary}; }
        .text-gray-400 { color: ${colors.textSecondary}; }
        .text-gray-500 { color: ${colors.textMuted}; }
        .border-gray-800 { border-color: ${colors.border} !important; }
        .border-gray-700 { border-color: ${colors.borderLight} !important; }
        
        .btn-close-dark {
          background: ${colors.surfaceLight}; border: none; color: ${colors.textSecondary}; width: 32px; height: 32px;
          border-radius: 50%; display: flex; align-items: center; justify-content: center;
          transition: 0.2s;
        }
        .btn-close-dark:hover { background: rgba(239, 68, 68, 0.12); color: ${colors.danger}; }

        .tenant-primary-action {
          background: ${isDarkMode ? 'rgba(37, 99, 235, 0.22)' : 'rgba(37, 99, 235, 0.10)'} !important;
          border: 1px solid ${isDarkMode ? 'rgba(59, 130, 246, 0.42)' : 'rgba(37, 99, 235, 0.22)'} !important;
          color: ${colors.primary} !important;
        }
        .tenant-primary-action:hover {
          background: ${isDarkMode ? 'rgba(37, 99, 235, 0.32)' : 'rgba(37, 99, 235, 0.16)'} !important;
          border-color: ${colors.primary} !important;
          color: ${colors.primary} !important;
        }

        .shadow-primary-sm { box-shadow: ${isDarkMode ? `0 0 15px ${colors.primaryGlow}` : '0 8px 24px rgba(37, 99, 235, 0.12)'}; }

        /* Animations */
        .animate-fade-in { animation: fadeIn 0.3s ease-out; }
        .animate-zoom-in { animation: zoomIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes zoomIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
};

const ArrowIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-700">
    <path d="m9 18 6-6-6-6"/>
  </svg>
);

export default TenantSelector;
