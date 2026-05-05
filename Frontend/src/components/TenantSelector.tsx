import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { type RootState } from '../redux/store';
import { setCurrentTenant } from '../redux/slice/authSlice';
import { Check, Building2, Plus, X, Globe } from 'lucide-react';
import api from '../services/api';
import type { Tenant } from '../types/auth';
import { useTheme } from '../theme/ThemeContext';

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
  const { colors } = useTheme();
  const { currentTenant, tenants: stateTenants } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { data: status, isLoading } = useQuery<{ tenants: Tenant[] }>({
    queryKey: ['userStatus'],
    queryFn: async () => (await api.getMyStatus()) as unknown as { tenants: Tenant[] },
    enabled: isOpen,
    staleTime: 30000,
  });

  const tenants = status?.tenants?.length ? status.tenants : stateTenants;

  const handleSelectTenant = (tenant: any) => {
    dispatch(setCurrentTenant(tenant));
    sessionStorage.setItem(SETUP_ORG_COMPLETE_KEY, 'true');
    onClose();
    navigate('/dashboard');
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
                <h5 className="m-0 fw-bold text-white">Không gian làm việc</h5>
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
            <div className="text-center py-5 bg-dark-subtle rounded-4 border border-dashed border-gray-700">
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
                          Vai trò: <span className="text-uppercase fw-bold" style={{fontSize: '10px'}}>{typeof tenant.role === 'string' ? tenant.role : tenant.role?.name ?? 'Member'}</span>
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
                className="btn btn-primary d-flex align-items-center justify-content-center gap-2 py-2.5 rounded-3 fw-semibold"
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
          background: rgba(2, 6, 23, 0.85); backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center; z-index: 2000;
        }
        .modal-container {
          background: ${colors.surface}; width: 100%; max-width: 480px;
          border-radius: 20px; border: 1px solid ${colors.border}; overflow: hidden;
        }
        .tenant-card {
          padding: 1rem; border-radius: 12px; background: transparent;
          border: 1px solid ${colors.border}; color: ${colors.textSecondary}; transition: 0.3s;
          display: flex; align-items: center; width: 100%;
        }
        .tenant-card:hover:not(.active) {
          background: rgba(255, 255, 255, 0.03); border-color: ${colors.borderLight}; transform: translateX(5px);
        }
        .tenant-card.active {
          background: linear-gradient(135deg, ${colors.info} 0%, ${colors.primary} 100%);
          border-color: ${colors.info}; box-shadow: 0 10px 20px ${colors.primaryGlow};
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
          background: ${colors.border}; border: none; color: ${colors.textSecondary}; width: 32px; height: 32px;
          border-radius: 50%; display: flex; align-items: center; justify-content: center;
          transition: 0.2s;
        }
        .btn-close-dark:hover { background: ${colors.danger}; color: ${colors.textPrimary}; }

        .shadow-primary-sm { box-shadow: 0 0 15px ${colors.primaryGlow}; }

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