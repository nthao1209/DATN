import React, { useState } from 'react';
import {
  LayoutDashboard, Users, UserCircle,
  MapPin, Route, Bus, ChevronDown, Menu, X, Clock, ShieldAlert,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { type RootState } from '../redux/store';
import { useTheme } from '../theme/ThemeContext';
import { ROLE_IDS } from '../auth/rbac';

interface SidebarProps {
  isCollapsed?: boolean;
  onToggle?: (collapsed: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed = false, onToggle }) => {
  const { colors, isDarkMode } = useTheme();
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
    dashboard: roleId === ROLE_IDS.ADMIN,
    userManagement: roleId === ROLE_IDS.SYSTEM_ADMIN,
    roleManagement: roleId === ROLE_IDS.SYSTEM_ADMIN,
    trips: roleId === ROLE_IDS.ADMIN,
    passengers:  roleId === ROLE_IDS.ADMIN,
    transactions: roleId === ROLE_IDS.BUS_MANAGEMENT,
    unlockRequests: roleId === ROLE_IDS.BUS_MANAGEMENT,
    about: true,
  };

  const MenuItem = ({ to, icon: Icon, label, badge }: any) => {
    const active = isActive(to);
    return (
      <li className="nav-item mb-1 px-2">
        <Link
          to={to}
          className={`nav-link d-flex align-items-center py-2 px-3 rounded-3 transition-all ${
            active 
              ? 'active-item text-white' 
              : 'text-sidebar hover-sidebar'
          }`}
          title={collapsed ? label : ""}
          style={{ 
            backgroundColor: active ? colors.primary : 'transparent',
            boxShadow: active ? `0 8px 16px -4px ${colors.primary}66` : 'none'
          }}
        >
          <Icon 
            size={19} 
            className={collapsed ? 'mx-auto' : 'me-3'} 
            strokeWidth={active ? 2.5 : 2}
            style={{ color: active ? '#fff' : 'inherit' }}
          />
          {!collapsed && (
            <>
              <span className="flex-grow-1 fw-medium" style={{ fontSize: '0.875rem' }}>{label}</span>
              {badge && <span className="badge rounded-pill bg-danger ms-2" style={{ fontSize: '10px' }}>{badge}</span>}
            </>
          )}
        </Link>
      </li>
    );
  };

  return (
    <div
      className="vh-100 position-fixed top-0 start-0 border-end border-sidebar d-flex flex-column"
      style={{
        backgroundColor: colors.surface,
        backgroundImage: isDarkMode 
          ? `linear-gradient(180deg, ${colors.surfaceLight} 0%, ${colors.surface} 100%)` 
          : 'none',
        color: colors.textPrimary,
        width: collapsed ? '78px' : '260px',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        zIndex: 1050,
      }}
    >
      {/* 1. Header / Logo Section */}
      <div className="p-4 d-flex justify-content-between align-items-center">
        {!collapsed && (
          <div className="d-flex align-items-center gap-2 animate-fade-in">
            <div className="logo-box">
              <Bus size={18} color="white" />
            </div>
            <span className="logo-text">BusTrack</span>
          </div>
        )}
        <button
          className="btn-toggle-sidebar"
          onClick={() => {
            setCollapsed(!collapsed);
            onToggle?.(!collapsed);
          }}
        >
          {collapsed ? <Menu size={20} /> : <X size={20} />}
        </button>
      </div>

      {/* 2. Menu Section */}
      <div className="px-2 pt-2 flex-grow-1 sidebar-content" style={{ overflowY: 'auto', overflowX: 'hidden' }}>
        {!collapsed && <small className="fw-bold mb-2 d-block ps-4 group-label">HỆ THỐNG</small>}
        
        <ul className="nav flex-column list-unstyled">
          {menuConfig.dashboard && <MenuItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" />}
          {menuConfig.userManagement && <MenuItem to="/users" icon={Users} label="Quản lý User" />}
          {menuConfig.roleManagement && <MenuItem to="/roles" icon={UserCircle} label="Quản lý Vai trò" />}
          {menuConfig.passengers && <MenuItem to="/passengers" icon={Users} label="Hành khách" />}

          {/* Trips Section */}
{menuConfig.trips && (
  <li className="nav-item mb-1 px-2">
    {/* Mục Quản lý Trip chính */}
    <div
      className={`nav-link d-flex justify-content-between align-items-center py-2 px-3 rounded-3 cursor-pointer transition-all ${
        isActive('/trips') && !currentTripId ? 'active-item text-white' : 'text-sidebar hover-sidebar'
      }`}
      onClick={() => !collapsed ? toggleExpanded('trips') : navigate('/trips')}
      style={{ 
        backgroundColor: (isActive('/trips') && !currentTripId) ? colors.primary : 'transparent',
      }}
    >
      <div className="d-flex align-items-center" onClick={(e) => { e.stopPropagation(); navigate('/trips'); }}>
        <MapPin size={19} className={collapsed ? 'mx-auto' : 'me-3'} />
        {!collapsed && <span className="fw-medium" style={{ fontSize: '0.875rem' }}>Quản lý Trip</span>}
      </div>
      {!collapsed && (
        <ChevronDown size={14} className={`transition-all ${expandedItems.includes('trips') ? 'rotate-180' : ''}`} />
      )}
    </div>

    {( (collapsed && currentTripId) || (!collapsed && expandedItems.includes('trips')) ) && (
      <ul className={`nav flex-column ${collapsed ? 'mt-2 gap-2' : 'ms-4 ps-3 border-start border-sub-menu mt-1 mb-2 gap-1'} animate-slide-down`}>
        {!collapsed && (
          <li>
            <Link 
              to="/trips" 
              className={`nav-link py-2 px-3 small rounded-3 transition-all ${
                location.pathname === '/trips' ? 'bg-primary text-white shadow-sm fw-bold' : 'hover-text-primary'
              }`}
              style={{ 
                color: location.pathname === '/trips' ? '#fff' : colors.textMuted,
                backgroundColor: location.pathname === '/trips' ? colors.primary : 'transparent'
              }}
            >
               • Danh sách Trip
            </Link>
          </li>
        )}

        {/* Hiện icon Chặng đi và Đội xe khi có currentTripId */}
            {currentTripId && (
              <>
                <li>
                  <Link 
                    to={`/trips/${currentTripId}/rounds`} 
                    title={collapsed ? "Chặng đi" : ""}
                    className={`nav-link py-2 rounded-3 transition-all d-flex align-items-center ${collapsed ? 'justify-content-center' : 'px-3 small'} ${
                      isActive(`/trips/${currentTripId}/rounds`) 
                        ? 'bg-primary text-white shadow-sm fw-bold' 
                        : 'text-sidebar hover-sidebar'
                    }`}
                    style={{ 
                      color: isActive(`/trips/${currentTripId}/rounds`) ? '#fff' : (collapsed ? colors.textSecondary : colors.textMuted),
                      backgroundColor: isActive(`/trips/${currentTripId}/rounds`) ? colors.primary : 'transparent'
                    }}
                  >
                    <Route size={collapsed ? 18 : 14} className={collapsed ? "" : "me-2"} /> 
                    {!collapsed && "Chặng đi"}
                  </Link>
                </li>
                <li>
                  <Link 
                    to={`/trips/${currentTripId}/buses`} 
                    title={collapsed ? "Đội xe" : ""}
                    className={`nav-link py-2 rounded-3 transition-all d-flex align-items-center ${collapsed ? 'justify-content-center' : 'px-3 small'} ${
                      isActive(`/trips/${currentTripId}/buses`) 
                        ? 'bg-primary text-white shadow-sm fw-bold' 
                        : 'text-sidebar hover-sidebar'
                    }`}
                    style={{ 
                      color: isActive(`/trips/${currentTripId}/buses`) ? '#fff' : (collapsed ? colors.textSecondary : colors.textMuted),
                      backgroundColor: isActive(`/trips/${currentTripId}/buses`) ? colors.primary : 'transparent'
                    }}
                  >
                    <Bus size={collapsed ? 18 : 14} className={collapsed ? "" : "me-2"} /> 
                    {!collapsed && "Đội xe"}
                  </Link>
                </li>
              </>
            )}
          </ul>
        )}
      </li>
    )}
          
          {menuConfig.transactions && <MenuItem to="/transactions" icon={Clock} label="Điểm danh" />}
          {menuConfig.unlockRequests && <MenuItem to="/unlock-requests" icon={ShieldAlert} label="Mở điểm danh" />}
        </ul>
      </div>


      <style>{`
        /* Sidebar Typography & Elements */
        .text-sidebar { color: ${colors.textSecondary}; }
        .text-primary-custom { color: ${colors.primary} !important; }
        .border-sidebar { border-color: ${isDarkMode ? colors.border : '#e2e8f0'} !important; }
        .border-sub-menu { border-color: ${colors.primary}22 !important; }
        .group-label { fontSize: 10px; letter-spacing: 0.08rem; opacity: 0.7; }
        
        /* Logo Styling */
        .logo-box {
          background: linear-gradient(135deg, ${colors.primary} 0%, ${colors.info} 100%);
          width: 32px; height: 32px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 10px ${colors.primary}44;
        }
        .logo-text {
          font-weight: 800; font-size: 1.25rem; letter-spacing: -0.5px;
          background: linear-gradient(to right, ${colors.textPrimary}, ${colors.textSecondary});
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }

        /* Hover & Active Effects */
        .hover-sidebar:hover { 
          background-color: ${isDarkMode ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)'};
          color: ${colors.primary} !important;
          transform: translateX(4px);
        }
        .bg-sub-active { background-color: ${colors.primary}11; }
        .hover-text-primary:hover { color: ${colors.primary} !important; background-color: ${colors.primary}08; }
        .hover-text-danger:hover { color: #ef4444 !important; }
        
        .active-item { transition: all 0.3s ease; }

        /* Buttons */
        .btn-toggle-sidebar {
          background: none; border: none; color: ${colors.textMuted};
          padding: 6px; border-radius: 8px; transition: 0.2s;
        }
        .btn-toggle-sidebar:hover {
          background: ${colors.surfaceLight}; color: ${colors.primary};
        }

        /* User Avatar */
        .avatar-mini {
          width: 34px; height: 34px; border-radius: 10px;
          background: ${isDarkMode ? colors.primaryGlow : colors.primary};
          color: ${isDarkMode ? colors.primary : '#fff'};
          display: flex; align-items: center; justify-content: center; 
          font-weight: 800; font-size: 14px;
        }
        .hover-sidebar-light:hover { background-color: ${isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'}; }

        /* Animations */
        .animate-slide-down { animation: slideDown 0.3s ease-out; }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        .rotate-180 { transform: rotate(180deg); }
        .transition-all { transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); }

        /* Custom Scrollbar */
        .sidebar-content::-webkit-scrollbar { width: 4px; }
        .sidebar-content::-webkit-scrollbar-track { background: transparent; }
        .sidebar-content::-webkit-scrollbar-thumb { background: ${colors.primary}22; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default Sidebar;