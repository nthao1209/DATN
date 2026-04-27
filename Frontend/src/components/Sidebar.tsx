import React, { useState } from 'react';
import {
  LayoutDashboard, Users, UserCircle,
  MapPin, Route, Bus, Info, ChevronDown, Menu, X, Clock
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { type RootState } from '../redux/store';
import { useTheme } from '../theme/ThemeContext';

interface SidebarProps {
  isCollapsed?: boolean;
  onToggle?: (collapsed: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed = false, onToggle }) => {
  const { colors } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const { roleId } = useSelector((state: RootState) => state.auth);
  const [collapsed, setCollapsed] = useState(isCollapsed);
  const [expandedItems, setExpandedItems] = useState<string[]>(['trips']);

  const pathParts = location.pathname.split('/');
  const currentTripId = pathParts[1] === 'trips' && pathParts[2] && !isNaN(Number(pathParts[2]))
    ? pathParts[2]
    : null;

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const toggleExpanded = (item: string) => {
    setExpandedItems((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  const menuConfig = {
    dashboard: true,
    userManagement: roleId === 1,
    roleManagement: roleId === 1,
    trips: roleId === 2,
    passengers: roleId === 2,
    transactions: roleId === 3,
    about: true,
  };

  const MenuItem = ({ to, icon: Icon, label, badge }: any) => {
    const active = isActive(to);
    return (
      <li className="nav-item mb-1">
        <Link
          to={to}
          className={`nav-link d-flex align-items-center py-2.5 px-3 rounded-3 transition-all ${
            active 
              ? 'bg-primary text-white shadow-lg active-glow' 
              : 'text-gray-400 hover-sidebar-dark'
          }`}
          title={label}
        >
          <Icon size={19} className={collapsed ? 'mx-auto' : 'me-3'} strokeWidth={active ? 2.5 : 2} />
          {!collapsed && (
            <>
              <span className="flex-grow-1" style={{ fontSize: '0.925rem' }}>{label}</span>
              {badge && <span className="badge rounded-pill bg-danger ms-2" style={{ fontSize: '10px' }}>{badge}</span>}
            </>
          )}
        </Link>
      </li>
    );
  };

  return (
    <div
      className="vh-100 position-fixed top-0 start-0 border-end border-dark-subtle"
      style={{
        backgroundColor: colors.surface,
        backgroundImage: `linear-gradient(180deg, ${colors.surfaceLight} 0%, ${colors.surface} 100%)`,
        color: colors.textPrimary,
        width: collapsed ? '75px' : '260px',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        zIndex: 1000,
        overflowY: 'auto'
      }}
    >
      {/* Header / Logo Section */}
      <div className="p-4 d-flex justify-content-between align-items-center">
        {!collapsed && (
          <div className="d-flex align-items-center gap-2">
            <div className="bg-primary rounded-circle p-1 d-flex align-items-center justify-content-center shadow-primary">
              <Bus size={20} color="white" />
            </div>
            <span className="fw-bold fs-5 tracking-tight text-white m-0">BusTrack</span>
          </div>
        )}
        <button
          className="btn btn-link text-gray-400 p-0 border-0 shadow-none hover-rotate"
          onClick={() => {
            setCollapsed(!collapsed);
            onToggle?.(!collapsed);
          }}
        >
          {collapsed ? <Menu size={22} /> : <X size={22} />}
        </button>
      </div>

      <div className="px-3 pt-2">
        {!collapsed && <small className="text-gray-500 fw-bold mb-2 d-block ps-2" style={{ fontSize: '11px', letterSpacing: '0.05rem' }}>HỆ THỐNG</small>}
        
        <ul className="nav flex-column list-unstyled">
          {menuConfig.dashboard && <MenuItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" />}
          
          {menuConfig.userManagement && <MenuItem to="/users" icon={Users} label="Quản lý User" />}

          {menuConfig.roleManagement && <MenuItem to="/roles" icon={UserCircle} label="Quản lý Vai trò" />}
          
          {menuConfig.passengers && <MenuItem to="/passengers" icon={UserCircle} label="Hành khách" />}

          {/* Trips Section */}
          {menuConfig.trips && (
            <li className="nav-item mb-1">
              <div
                className={`nav-link d-flex justify-content-between align-items-center py-2.5 px-3 rounded-3 cursor-pointer transition-all ${
                  isActive('/trips') ? 'text-info' : 'text-gray-400 hover-sidebar-dark'
                }`}
                onClick={() => !collapsed && toggleExpanded('trips')}
              >
                <div className="d-flex align-items-center" onClick={(e) => { e.stopPropagation(); navigate('/trips'); }}>
                  <MapPin size={19} className={collapsed ? 'mx-auto' : 'me-3'} />
                  {!collapsed && <span style={{ fontSize: '0.925rem' }}>Quản lý Trip</span>}
                </div>
                {!collapsed && (
                  <ChevronDown size={14} className={`transition-all ${expandedItems.includes('trips') ? 'rotate-180' : ''}`} />
                )}
              </div>

              {!collapsed && expandedItems.includes('trips') && (
                <ul className="nav flex-column ms-4 ps-3 border-start border-gray-700 mt-1 mb-2 gap-1">
                  <li>
                    <Link to="/trips" className={`nav-link py-1.5 small ${location.pathname === '/trips' ? 'text-info fw-bold' : 'text-gray-500 hover-text-white'}`}>
                       • Danh sách Trip
                    </Link>
                  </li>
                  {currentTripId && (
                    <>
                      <li>
                        <Link to={`/trips/${currentTripId}/rounds`} className={`nav-link py-1.5 small ${isActive(`/trips/${currentTripId}/rounds`) ? 'text-info fw-bold' : 'text-gray-500 hover-text-white'}`}>
                          <Route size={14} className="me-2" /> Rounds
                        </Link>
                      </li>
                      <li>
                        <Link to={`/trips/${currentTripId}/buses`} className={`nav-link py-1.5 small ${isActive(`/trips/${currentTripId}/buses`) ? 'text-info fw-bold' : 'text-gray-500 hover-text-white'}`}>
                          <Bus size={14} className="me-2" /> Buses
                        </Link>
                      </li>
                    </>
                  )}
                </ul>
              )}
            </li>
          )}
          {menuConfig.transactions && (
            <MenuItem to="/transactions" icon={Clock} label="Giao dịch" />
          )}
          
        </ul>

        <div className="mt-4 pt-4 border-top border-gray-800">
          {!collapsed && <small className="text-gray-500 fw-bold mb-2 d-block ps-2" style={{ fontSize: '11px' }}>KHÁC</small>}
          <MenuItem to="/about" icon={Info} label="Về chúng tôi" />
        </div>
      </div>

      <style>{`
        .text-gray-400 { color: ${colors.textSecondary}; }
        .text-gray-500 { color: ${colors.textMuted}; }
        .border-gray-700 { border-color: ${colors.borderLight} !important; }
        .border-gray-800 { border-color: ${colors.border} !important; }
        
        .hover-sidebar-dark:hover { 
          background-color: rgba(255, 255, 255, 0.05);
          color: ${colors.textPrimary} !important;
        }

        .hover-text-white:hover { color: ${colors.textPrimary} !important; }

        .active-glow {
          box-shadow: 0 4px 15px ${colors.primaryGlow};
        }

        .shadow-primary {
          box-shadow: 0 0 10px ${colors.primaryGlow};
        }

        .hover-rotate:hover {
          transform: rotate(90deg);
          color: ${colors.textPrimary} !important;
          transition: 0.3s;
        }

        .transition-all { transition: all 0.25s ease-in-out; }
        .rotate-180 { transform: rotate(180deg); }
        .cursor-pointer { cursor: pointer; }
        
        /* Custom Scrollbar */
        div::-webkit-scrollbar { width: 4px; }
        div::-webkit-scrollbar-track { background: transparent; }
        div::-webkit-scrollbar-thumb { background: ${colors.borderLight}; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default Sidebar;