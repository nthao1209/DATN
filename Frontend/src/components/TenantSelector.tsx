import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { type RootState } from '../redux/store';
import { setCurrentTenant } from '../redux/slice/authSlice';
import { Check, X, Building2, Plus } from 'lucide-react';
import api from '../services/api';
import type { Tenant } from '../types/auth';

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
  const { currentTenant, tenants: stateTenants } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Fetch danh sách tenant từ API status
  const { data: status, isLoading } = useQuery<{ tenants: Tenant[] }>({
    queryKey: ['userStatus'],
    queryFn: async () => (await api.getMyStatus()) as unknown as { tenants: Tenant[] },
    enabled: isOpen,
    staleTime: 30000,
  });

  const tenants = status?.tenants?.length ? status.tenants : stateTenants;

  const handleSelectTenant = (tenant: any) => {
    dispatch(setCurrentTenant(tenant));
    onClose();
    navigate('/dashboard');
  };

  if (!isOpen) return null;

  return (
    <div className="modal d-block" role="dialog" aria-modal="true" style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 shadow">
          <div className="modal-header">
            <div>
              <h5 className="modal-title d-flex align-items-center gap-2">
                <Building2 size={18} /> Chọn tổ chức làm việc
              </h5>
              <small className="text-muted">Bạn đang tham gia {tenants?.length || 0} tổ chức</small>
            </div>
            <button type="button" className="btn btn-sm btn-light" onClick={onClose}>
              <X size={16} />
            </button>
          </div>

          <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {isLoading ? (
              <div className="text-center py-4">
                <div className="spinner-border text-primary" role="status" />
                <p className="text-muted small mt-2 mb-0">Đang tải danh sách...</p>
              </div>
            ) : tenants?.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-muted mb-0">Bạn chưa tham gia tổ chức nào.</p>
              </div>
            ) : (
              <div className="d-grid gap-2">
                {tenants.map((tenant: any) => (
                  <button
                    key={tenant.id}
                    onClick={() => handleSelectTenant(tenant)}
                    className={`btn text-start d-flex justify-content-between align-items-center border ${
                      currentTenant?.id === tenant.id 
                      ? 'btn-primary' 
                      : 'btn-light'
                    }`}
                  >
                    <div className="d-flex align-items-center gap-3">
                      <div className={`rounded p-2 ${currentTenant?.id === tenant.id ? 'bg-white text-primary' : 'bg-secondary-subtle text-secondary'}`}>
                        <Building2 size={20} />
                      </div>
                      <div>
                        <div className="fw-semibold">{tenant.name}</div>
                        <small className={currentTenant?.id === tenant.id ? 'text-white-50' : 'text-muted'}>
                          Vai trò: {tenant.role || 'member'}
                        </small>
                      </div>
                    </div>

                    {currentTenant?.id === tenant.id ? (
                      <Check size={18} />
                    ) : (
                      <span className="small text-muted">Chọn</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="modal-footer">
            {showCreateJoin && (
              <button 
                onClick={() => { onClose(); navigate('/setup-org'); }}
                className="btn btn-outline-primary me-auto d-flex align-items-center gap-2"
              >
                <Plus size={20} /> Tham gia hoặc Tạo tổ chức mới
              </button>
            )}
            <button 
              onClick={onClose}
              className="btn btn-secondary"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TenantSelector;