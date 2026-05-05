import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { type RootState } from '../redux/store';
import { 
  TrendingUp, Users, MapPinned, Route, 
  Copy, RefreshCw, LayoutDashboard, Calendar
} from 'lucide-react';
import StatCard from '../components/StatCard';
import TenantSelector from '../components/TenantSelector';
import { useTheme } from '../theme/ThemeContext';
import { useSnackbar } from 'notistack';

const Dashboard: React.FC = () => {
  const { colors } = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const [showTenantSelector, setShowTenantSelector] = useState(false);
  const { currentTenant, roleId } = useSelector((state: RootState) => state.auth);
  const canViewJoinCode = [1, 2].includes(roleId || 0);

  const copyJoinCode = () => {
    if (currentTenant?.joinCode) {
      navigator.clipboard.writeText(currentTenant.joinCode);
      enqueueSnackbar('Đã sao chép mã mời!', { variant: 'success' });
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-5">
        <div>
          <div className="d-flex align-items-center gap-2 text-primary mb-2">
            <LayoutDashboard size={20} />
            <span className="fw-bold small text-uppercase tracking-wider">Tổng quan hệ thống</span>
          </div>
          <h1 className="h2 fw-bold text-white mb-1">Chào mừng quay lại!</h1>
          <div className="d-flex align-items-center gap-2 text-gray-500">
            <Calendar size={14} />
            <span className="small">Hôm nay, {new Date().toLocaleDateString('vi-VN')}</span>
          </div>
        </div>

        <div className="d-flex gap-2">
          <button 
            className="btn-glass d-flex align-items-center gap-2" 
            onClick={() => setShowTenantSelector(true)}
          >
            <RefreshCw size={16} /> Chuyển tổ chức
          </button>
        </div>
      </div>

      {/* Join Code Banner (Nếu có quyền) */}
      {canViewJoinCode && currentTenant?.joinCode && (
        <div className="join-code-banner mb-4 d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-3">
            <div className="icon-badge">
              <Users size={20} className="text-primary" />
            </div>
            <div>
              <h6 className="m-0 text-white fw-bold">Mã mời tổ chức</h6>
              <p className="m-0 text-gray-500 small">Chia sẻ mã này để thành viên khác tham gia vào {currentTenant?.name}</p>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2 bg-dark p-1 ps-3 rounded-pill border border-gray-800">
            <code className="text-info fw-bold fs-5 tracking-widest">{currentTenant.joinCode}</code>
            <button onClick={copyJoinCode} className="btn btn-primary btn-sm rounded-circle p-2 ms-2 shadow-primary">
              <Copy size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="row g-4 mb-5">
        <div className="col-12 col-md-4">
          <StatCard 
            title="Tổng số Trip" 
            value={12} 
            icon={<MapPinned size={24} />}
            trend="+2 tháng này"
            color="var(--bs-primary)" 
          />
        </div>
        <div className="col-12 col-md-4">
          <StatCard 
            title="Tổng số Round" 
            value={45} 
            icon={<Route size={24} />}
            trend="+12% so với tuần trước"
            color="var(--bs-success)" 
          />
        </div>
        <div className="col-12 col-md-4">
          <StatCard 
            title="Hành khách" 
            value="1,250" 
            icon={<Users size={24} />}
            trend={<TrendingUp size={16} />}
            color="var(--bs-info)" 
          />
        </div>
      </div>

      {/* Placeholder for Charts/Tables */}
      <div className="row g-4">
        <div className="col-lg-8">
          <div className="card-glass h-100 p-4">
            <h5 className="text-white fw-bold mb-4">Lưu lượng chuyến đi</h5>
            <div className="d-flex align-items-center justify-content-center border border-dashed border-gray-800 rounded-4" style={{ height: '300px' }}>
              <p className="text-gray-600">[ Biểu đồ sẽ hiển thị ở đây ]</p>
            </div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card-glass h-100 p-4">
            <h5 className="text-white fw-bold mb-4">Hoạt động gần đây</h5>
            <div className="timeline">
              {[1, 2, 3].map((item) => (
                <div key={item} className="d-flex gap-3 mb-4">
                  <div className="timeline-dot"></div>
                  <div>
                    <p className="text-white small mb-0 fw-bold">Chuyến đi #120{item} đã hoàn thành</p>
                    <p className="text-gray-500 extra-small">2 giờ trước</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <TenantSelector isOpen={showTenantSelector} onClose={() => setShowTenantSelector(false)} />

      <style>{`
        .text-gray-500 { color: ${colors.textMuted}; }
        .text-gray-600 { color: ${colors.textMuted}; }
        .extra-small { font-size: 11px; }
        
        .btn-glass {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: ${colors.textPrimary};
          padding: 8px 20px;
          border-radius: 12px;
          font-weight: 600;
          transition: 0.3s;
        }
        .btn-glass:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: var(--bs-primary);
        }

        .join-code-banner {
          background: linear-gradient(90deg, rgba(59, 130, 246, 0.1) 0%, rgba(15, 23, 42, 0) 100%);
          border: 1px solid rgba(59, 130, 246, 0.2);
          padding: 20px 30px;
          border-radius: 20px;
        }

        .icon-badge {
          width: 48px;
          height: 48px;
          background: rgba(59, 130, 246, 0.1);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .card-glass {
          background: ${colors.surface};
          border: 1px solid ${colors.border};
          border-radius: 24px;
        }

        .timeline-dot {
          width: 8px;
          height: 8px;
          background: var(--bs-primary);
          border-radius: 50%;
          margin-top: 6px;
          box-shadow: 0 0 10px var(--bs-primary);
        }

        .animate-fade-in {
          animation: fadeIn 0.8s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .shadow-primary {
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        }
      `}</style>
    </div>
  );
};

export default Dashboard;