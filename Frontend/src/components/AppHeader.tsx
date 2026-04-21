import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { type RootState } from '../redux/store';
import { logout } from '../redux/slice/authSlice';
import { 
  LogOut, Building, Settings, Briefcase, Tag, 
  Folder, Bell, Flag, LayoutGrid, Users as UsersIcon, Map 
} from 'lucide-react';
import TenantSelector from './TenantSelector';
import { useMqttBrokerStatus } from '../hooks/useMqttBrokerStatus';

const TopBar: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { currentTenant } = useSelector((state: RootState) => state.auth);
  const [showTenantSelector, setShowTenantSelector] = useState(false);
  const mqttStatus = useMqttBrokerStatus();

  const statusMeta = {
    connecting: { label: 'MQTT: Connecting', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
    connected: { label: 'MQTT: Connected', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)' },
    reconnecting: { label: 'MQTT: Reconnecting', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.15)' },
    disconnected: { label: 'MQTT: Disconnected', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
    error: { label: 'MQTT: Error', color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)' },
  }[mqttStatus];

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  return (
    <>
      <nav className="navbar navbar-expand px-3 sticky-top shadow-sm" style={{ borderBottom: '1px solid #1e293b', background: '#0f172a', padding:'10.5px' }}>
        <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
          <span style={{ color: '#e5e7eb', fontSize: '0.875rem', fontWeight: 'bold' }}>
            {currentTenant?.name || 'Dashboard'}
          </span>

          <span
            style={{
              marginLeft: '0.75rem',
              padding: '0.25rem 0.65rem',
              borderRadius: '999px',
              border: `1px solid ${statusMeta.color}`,
              color: statusMeta.color,
              background: statusMeta.bg,
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.02em',
            }}
          >
            {statusMeta.label}
          </span>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Function Icons */}
            <div style={{ display: 'flex', gap: '1rem', paddingRight: '1rem', borderRight: '1px solid #1e293b', alignItems: 'center' }}>
              <Briefcase size={18} className="text-light-emphasis cursor-pointer" />
              <Tag size={18} className="text-light-emphasis cursor-pointer" />
              <Folder size={18} className="text-light-emphasis cursor-pointer" />
              <Bell size={18} className="text-light-emphasis cursor-pointer" />
              <Flag size={18} className="text-light-emphasis cursor-pointer" />
              <LayoutGrid size={18} className="text-light-emphasis cursor-pointer" />
              <UsersIcon size={18} className="text-light-emphasis cursor-pointer" />
              <Map size={18} className="text-light-emphasis cursor-pointer" />
            </div>

            {/* User Dropdown */}
            <div className="dropdown">
              <button 
                className="btn btn-link text-white p-0 dropdown-toggle"
                data-bs-toggle="dropdown"
                style={{ textDecoration: 'none', color: '#cbd5e1' }}
              >
                <Building size={18} />
              </button>
              <ul className="dropdown-menu dropdown-menu-end shadow border-0" style={{ backgroundColor: '#111827', color: '#e5e7eb' }}>
                <li style={{ padding: '0.5rem', borderBottom: '1px solid #1e293b', fontWeight: 'bold', fontSize: '0.875rem', color: '#67e8f9', textAlign: 'center' }}>
                  <Building size={14} /> {currentTenant?.name || 'No Organization'}
                </li>
                <li>
                  <button 
                    className="dropdown-item py-2" 
                    onClick={() => setShowTenantSelector(true)}
                    style={{ color: '#e5e7eb', backgroundColor: 'transparent' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1f2937')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <Building size={16} className="me-2"/> Quản lý tổ chức
                  </button>
                </li>
                <li>
                  <button 
                    className="dropdown-item py-2" 
                    onClick={() => navigate('/settings')}
                    style={{ color: '#e5e7eb', backgroundColor: 'transparent' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1f2937')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <Settings size={16} className="me-2"/> Cài đặt
                  </button>
                </li>
                <li><hr style={{ margin: '0.5rem 0', borderColor: '#1e293b' }} /></li>
                <li>
                  <button 
                    className="dropdown-item py-2" 
                    onClick={handleLogout}
                    style={{ color: '#ef4444', backgroundColor: 'transparent' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1f2937')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <LogOut size={16} className="me-2"/> Đăng xuất
                  </button>
                </li>
              </ul>
            </div>

            <Settings size={18} className="text-light-emphasis cursor-pointer" />
          </div>
        </div>
      </nav>

      <TenantSelector isOpen={showTenantSelector} onClose={() => setShowTenantSelector(false)} />
    </>
  );
};

export default TopBar;