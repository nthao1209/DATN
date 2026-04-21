import React, { useEffect, useState } from 'react';
import { PlusCircle, LogIn, Building2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDispatch, useSelector } from 'react-redux';
import { auth as fbAuth } from '../../config/firebase';
import { authSuccess } from '../../redux/slice/authSlice';
import api from '../../services/api';
import { type RootState } from '../../redux/store';
import TenantSelector from '../../components/TenantSelector';

const refreshAuthState = async (dispatch: any) => {
  const currentUser = fbAuth.currentUser;
  if (!currentUser) return;

  await currentUser.reload();
  const token = await currentUser.getIdToken(true);
  const status: any = await api.getMyStatus();

  dispatch(
    authSuccess({
      user: status.user,
      token,
      tenants: status.tenants || [],
      roleId: status.roleId,
    })
  );
};

const SetupOrgPage: React.FC = () => {
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
    onSuccess: async (res: any) => {
      alert(`Tạo thành công tổ chức: ${res.tenant.name}. Join code: ${res.joinCode}`);
      queryClient.invalidateQueries({ queryKey: ['userStatus'] });
      await refreshAuthState(dispatch);
      setOpenTenantSelector(true);
    },
    onError: (err: any) => alert(err.message),
  });

  const joinMutation = useMutation({
    mutationFn: (code: string) => api.joinTenant(code),
    onSuccess: async (res: any) => {
      alert(`Đã tham gia: ${res.tenant.name}`);
      queryClient.invalidateQueries({ queryKey: ['userStatus'] });
      await refreshAuthState(dispatch);
      setOpenTenantSelector(true);
    },
    onError: (err: any) => alert(err.message),
  });

  return (
    <div className="container py-5">
      <h1 className="h3 fw-bold text-center mb-4 d-flex align-items-center justify-content-center gap-2">
        <Building2 size={28} /> Cấu hình tổ chức của bạn
      </h1>

      {tenants.length > 0 && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body p-4 d-flex justify-content-between align-items-center">
            <div>
              <h2 className="h5 mb-1">Bạn đã tham gia {tenants.length} tổ chức</h2>
              <p className="text-secondary small mb-0">Bấm để chọn tổ chức làm việc.</p>
            </div>
            <button
              className="btn btn-outline-primary"
              onClick={() => setOpenTenantSelector(true)}
            >
              Chọn tổ chức
            </button>
          </div>
        </div>
      )}

      <div className="row g-4">
        <div className="col-12 col-lg-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body p-4">
              <div className="d-flex align-items-center mb-3 text-success">
                <PlusCircle size={24} />
                <h2 className="h5 mb-0 ms-2">Tạo tổ chức mới</h2>
              </div>
              <p className="text-secondary small">
                Dành cho quản trị viên muốn tạo hệ thống riêng.
              </p>
              <input
                className="form-control mt-3"
                placeholder="Tên công ty hoặc tổ chức"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
              <button
                className="btn btn-success w-100 mt-3"
                onClick={() => createMutation.mutate(orgName)}
                disabled={!orgName || createMutation.isPending}
              >
                {createMutation.isPending ? 'Đang tạo...' : 'Tạo tổ chức'}
              </button>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body p-4">
              <div className="d-flex align-items-center mb-3 text-primary">
                <LogIn size={24} />
                <h2 className="h5 mb-0 ms-2">Tham gia tổ chức</h2>
              </div>
              <p className="text-secondary small">Nhập join code do quản trị viên cung cấp.</p>
              <input
                className="form-control mt-3"
                placeholder="Ví dụ: A1B2C3"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
              />
              <button
                className="btn btn-primary w-100 mt-3"
                onClick={() => joinMutation.mutate(joinCode)}
                disabled={!joinCode || joinMutation.isPending}
              >
                {joinMutation.isPending ? 'Đang kiểm tra...' : 'Tham gia'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <TenantSelector
        isOpen={openTenantSelector}
        onClose={() => setOpenTenantSelector(false)}
        showCreateJoin={false}
      />
    </div>
  );
};

export default SetupOrgPage;