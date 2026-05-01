import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { type RootState } from '../redux/store';
import { logout } from '../redux/slice/authSlice';
import { 
  LogOut, Building, Settings, Briefcase,
  Bell, LayoutGrid, Map, ChevronDown
} from 'lucide-react';
import { useMqttBrokerStatus } from '../hooks/useMqttBrokerStatus';
import { useTheme } from '../theme/ThemeContext';

const TopBar: React.FC = () => {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { currentTenant } = useSelector((state: RootState) => state.auth);
  const mqttStatus = useMqttBrokerStatus();

  const statusMeta = {
    connecting: { label: 'Connecting', color: colors.warning, bg: 'rgba(245, 158, 11, 0.1)' },
    connected: { label: 'Connected', color: colors.success, bg: 'rgba(16, 185, 129, 0.1)' },
    reconnecting: { label: 'Reconnecting', color: colors.info, bg: 'rgba(59, 130, 246, 0.1)' },
    disconnected: { label: 'Disconnected', color: colors.danger, bg: 'rgba(239, 68, 68, 0.1)' },
    error: { label: 'Error', color: colors.warning, bg: 'rgba(249, 115, 22, 0.1)' },
  }[mqttStatus] || { label: 'Unknown', color: colors.textSecondary, bg: 'rgba(148, 163, 184, 0.1)' };

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  return (
    <>
      <nav className="navbar navbar-expand px-4 sticky-top transition-all" 
        style={{ 
          borderBottom: `1px solid ${colors.border}`,
          background: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(12px)',
          height: '64px',
          zIndex: 999
        }}>
        <div className="d-flex align-items-center justify-content-between w-100">
          
          {/* Left Side: Tenant Info & Status */}
          <div className="d-flex align-items-center gap-3">
            <div className="d-flex align-items-center gap-2 px-2 py-1 rounded-2 bg-dark-subtle border border-gray-800">
              <Building size={16} className="text-info" />
              <span className="text-white fw-semibold small tracking-tight">
                {currentTenant?.name || 'Hệ thống'}
              </span>
            </div>

            <div className="d-flex align-items-center gap-2 px-3 py-1 rounded-pill" 
              style={{ 
                border: `1px solid ${statusMeta.color}44`, 
                background: statusMeta.bg,
                transition: 'all 0.3s'
              }}>
              <span className={`status-dot ${mqttStatus === 'connected' ? 'pulse' : ''}`} 
                    style={{ backgroundColor: statusMeta.color }}></span>
              <span style={{ color: statusMeta.color, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
                {statusMeta.label}
              </span>
            </div>
          </div>

          {/* Right Side: Tools & Profile */}
          <div className="d-flex align-items-center gap-2">
            
            {/* Quick Actions Group */}
            <div className="d-flex align-items-center gap-1 border-end border-gray-800 pe-3 me-2">
              {[
                { icon: Briefcase, label: 'Projects' },
                { icon: Bell, label: 'Notifications' },
                { icon: Map, label: 'Tracking' },
                { icon: LayoutGrid, label: 'Apps' }
              ].map((item, idx) => (
                <button key={idx} className="btn-icon-topbar" title={item.label}>
                  <item.icon size={18} />
                </button>
              ))}
            </div>

            {/* User Profile Dropdown */}
            <div className="dropdown">
              <div 
                className="d-flex align-items-center gap-2 cursor-pointer p-1 rounded-pill border border-gray-800 hover-bg-gray"
                data-bs-toggle="dropdown"
                aria-expanded="false"
              >
                <div className="bg-gradient-primary rounded-circle d-flex align-items-center justify-content-center" 
                     style={{ width: '32px', height: '32px' }}>
                  <span className="text-white fw-bold small">T</span>
                </div>
                <ChevronDown size={14} className="text-gray-500 me-1" />
              </div>

              <ul className="dropdown-menu dropdown-menu-end shadow-lg border-gray-800 animate-slide-up" 
                  style={{ backgroundColor: colors.surfaceLight, minWidth: '220px', borderRadius: '12px', marginTop: '10px' }}>
                <li className="px-3 py-3 border-bottom border-gray-700">
                  <p className="text-gray-400 small mb-0">Tài khoản quản trị</p>
                  <p className="text-white fw-bold mb-0">{currentTenant?.name}</p>
                </li>
                
                <li>
                  <button className="dropdown-item d-flex align-items-center gap-2 py-2 mt-2" onClick={() => navigate('/select-tenant')}>
                    <Building size={16} className="text-info" /> <span>Quản lý tổ chức</span>
                  </button>
                </li>
                <li>
                  <button className="dropdown-item d-flex align-items-center gap-2 py-2" onClick={() => navigate('/settings')}>
                    <Settings size={16} className="text-secondary" /> <span>Cài đặt hệ thống</span>
                  </button>
                </li>
                
                <li className="my-2 border-top border-gray-700"></li>
                
                <li>
                  <button className="dropdown-item d-flex align-items-center gap-2 py-2 mb-2 text-danger-emphasis" onClick={handleLogout}>
                    <LogOut size={16} /> <span className="fw-semibold">Đăng xuất</span>
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </nav>

      <style>{`
        .border-gray-700 { border-color: ${colors.borderLight} !important; }
        .border-gray-800 { border-color: ${colors.border} !important; }
        .text-gray-400 { color: ${colors.textSecondary}; }
        .text-gray-500 { color: ${colors.textMuted}; }
        
        .bg-gradient-primary {
          background: linear-gradient(135deg, ${colors.info} 0%, ${colors.primary} 100%);
        }

        .btn-icon-topbar {
          background: transparent;
          border: none;
          color: ${colors.textSecondary};
          padding: 8px;
          border-radius: 8px;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .btn-icon-topbar:hover {
          background: rgba(255, 255, 255, 0.05);
          color: ${colors.textPrimary};
          transform: translateY(-1px);
        }

        .hover-bg-gray:hover {
          background: rgba(255, 255, 255, 0.03);
          transition: 0.2s;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          display: inline-block;
        }

        .pulse {
          animation: pulse-animation 2s infinite;
        }

        @keyframes pulse-animation {
          0% { box-shadow: 0 0 0 0px rgba(16, 185, 129, 0.7); }
          70% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0px rgba(16, 185, 129, 0); }
        }

        .dropdown-item {
          color: ${colors.textSecondary};
          transition: 0.2s;
          margin: 0 8px;
          width: calc(100% - 16px);
          border-radius: 6px;
        }

        .dropdown-item:hover {
          background-color: rgba(255, 255, 255, 0.05);
          color: ${colors.textPrimary};
        }

        .animate-slide-up {
          animation: slideUp 0.3s ease-out;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .cursor-pointer { cursor: pointer; }
      `}</style>
    </>
  );
};

export default TopBar;