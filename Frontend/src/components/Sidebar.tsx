import React, { useState } from 'react';
import {
  LayoutDashboard, Users, ShieldCheck, UserCircle,
  MapPin, Route, Bus, Repeat, Info, ChevronDown, Menu, X
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

interface SidebarProps {
  isCollapsed?: boolean;
  onToggle?: (collapsed: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed = false, onToggle }) => {
  const location = useLocation();
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

  const MenuItem = ({ to, icon: Icon, label, badge }: any) => {
    const active = isActive(to);
    return (
      <li className="nav-item">
        <Link
          to={to}
          className={`nav-link d-flex align-items-center rounded transition-all ${
            active ? 'bg-primary text-white shadow' : 'text-light hover-bg-light'
          }`}
          title={label}
        >
          <Icon size={18} className={collapsed ? 'm-0' : 'me-2'} />
          {!collapsed && (
            <>
              <span className="flex-grow-1">{label}</span>
              {badge && <span className="badge bg-info rounded-pill ms-auto">{badge}</span>}
            </>
          )}
        </Link>
      </li>
    );
  };

  return (
    <div
      className="vh-100 shadow position-fixed top-0 start-0 border-end"
      style={{
        backgroundColor: '#0f172a',
        color: '#e5e7eb',
        borderColor: '#1e293b',
        width: collapsed ? '70px' : '250px',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        zIndex: 1000,
        overflowY: 'auto'
      }}
    >
      <div
        className="p-2 d-flex justify-content-between align-items-center"
        style={{ borderBottom: '1px solid #1e293b', background: '#111827' }}
      >
        {!collapsed && <h5 className="m-0 fw-bold">PANEL</h5>}
        <button
          className="btn btn-sm text-light p-0 border-0 shadow-none"
          onClick={() => {
            setCollapsed(!collapsed);
            onToggle?.(!collapsed);
          }}
        >
          {collapsed ? <Menu size={20} /> : <X size={20} />}
        </button>
      </div>

      <div className="p-2 pt-3">
        <ul className="nav flex-column gap-1">
          <MenuItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
          <MenuItem to="/users" icon={Users} label="User Management" badge="4" />
          <MenuItem to="/roles" icon={ShieldCheck} label="Role Management" />
          <MenuItem to="/passengers" icon={UserCircle} label="Passengers" />

          <li className="nav-item">
            <div
              className={`nav-link d-flex justify-content-between align-items-center cursor-pointer rounded ${isActive('/trips') ? 'text-info fw-bold' : 'text-light'}`}
              onClick={() => !collapsed && toggleExpanded('trips')}
              style={{ cursor: 'pointer' }}
            >
              <div className="d-flex align-items-center">
                <MapPin size={18} className={collapsed ? 'm-0' : 'me-2'} />
                {!collapsed && <span>Trips Management</span>}
              </div>
              {!collapsed && (
                <ChevronDown
                  size={14}
                  style={{
                    transform: expandedItems.includes('trips') ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: '0.2s'
                  }}
                />
              )}
            </div>

            {!collapsed && expandedItems.includes('trips') && (
              <ul className="nav flex-column ps-3 small mt-1 gap-1">
                <li className="nav-item">
                  <Link to="/trips" className={`nav-link py-1 ${location.pathname === '/trips' ? 'text-info fw-semibold' : 'text-white-50'}`}>
                    • Danh sách Trip
                  </Link>
                </li>

                {currentTripId ? (
                  <>
                    <li className="nav-item">
                      <Link to={`/trips/${currentTripId}/rounds`} className={`nav-link py-1 ${isActive(`/trips/${currentTripId}/rounds`) ? 'text-info fw-bold' : 'text-white-50'}`}>
                        <Route size={14} className="me-2" /> Rounds (Trip #{currentTripId})
                      </Link>
                    </li>
                    <li className="nav-item">
                      <Link to={`/trips/${currentTripId}/buses`} className={`nav-link py-1 ${isActive(`/trips/${currentTripId}/buses`) ? 'text-info fw-bold' : 'text-white-50'}`}>
                        <Bus size={14} className="me-2" /> Buses (Trip #{currentTripId})
                      </Link>
                    </li>
                  </>
                ) : (
                  <li className="nav-item ps-2 mt-1">
                    <small className="text-muted" style={{ fontSize: '11px' }}><i>Chọn 1 trip để xem chi tiết</i></small>
                  </li>
                )}
              </ul>
            )}
          </li>

          <MenuItem to="/transactions" icon={Repeat} label="Transaction" />
          <MenuItem to="/about" icon={Info} label="About us" />
        </ul>
      </div>

      <style>{`
        .hover-bg-light:hover { background: rgba(148, 163, 184, 0.14); }
        .transition-all { transition: all 0.2s ease-in-out; }
        .cursor-pointer { cursor: pointer; }
        .nav-link { padding: 0.6rem 0.8rem; }
      `}</style>
    </div>
  );
};

export default Sidebar;
