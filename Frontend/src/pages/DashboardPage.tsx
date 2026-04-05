import { useState } from 'react';
import { useSelector } from 'react-redux';
import { type RootState } from '../redux/store';
import StatCard from '../components/StatCard';
import TenantSelector from '../components/TenantSelector';

const Dashboard: React.FC = () => {
  const [showTenantSelector, setShowTenantSelector] = useState(false);
  const { currentTenant } = useSelector((state: RootState) => state.auth);
  const canViewJoinCode = ['owner', 'admin'].includes((currentTenant?.role || '').toLowerCase());

  return (
    <div>
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
        <div>
          <h1 className="h3 mb-1">Dashboard</h1>
          <p className="text-muted mb-0">Tổ chức hiện tại: <strong>{currentTenant?.name || 'Chưa chọn'}</strong></p>
          {canViewJoinCode && (
            <p className="mb-0 mt-1">
              Join code: <span className="badge text-bg-primary">{currentTenant?.joinCode || 'Chưa có'}</span>
            </p>
          )}
        </div>
        <button className="btn btn-outline-primary" onClick={() => setShowTenantSelector(true)}>
          Chuyển tổ chức
        </button>
      </div>

      <div className="row g-4">
        <div className="col-md-4">
          <StatCard title="Tổng số trip" value={12} color="bg-primary bg-opacity-10" />
        </div>
        <div className="col-md-4">
          <StatCard title="Tổng số round" value={45} color="bg-success bg-opacity-10" />
        </div>
        <div className="col-md-4">
          <StatCard title="Số lượng passengers" value={1250} color="bg-info bg-opacity-10" />
        </div>
      </div>

      <TenantSelector isOpen={showTenantSelector} onClose={() => setShowTenantSelector(false)} />
    </div>
  );
};

export default Dashboard