import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Bell, Trash2, X } from 'lucide-react';
import { format } from 'date-fns';
import { type RootState } from '../redux/store';
import { useTheme } from '../theme/ThemeContext';
import { useNotification } from '../contexts/NotificationContext';

const NotificationBell: React.FC = () => {
  const { colors, isDarkMode } = useTheme();
  const { user } = useSelector((state: RootState) => state.auth);
  const { notifications, markNotificationAsRead, markAllNotificationsAsRead, refreshNotifications, deleteNotification, deleteAllNotifications } = useNotification();
  
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!notificationRef.current) return;
      if (!notificationRef.current.contains(event.target as Node)) {
        setIsNotificationOpen(false);
      }
    };

    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    if (!isNotificationOpen || !user?.id) {
      return;
    }
    void refreshNotifications();
  }, [isNotificationOpen, refreshNotifications, user?.id]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const recentNotifications = useMemo(() => [...notifications].slice(0, 15), [notifications]); 

  const shortenMessage = (message: string) => {
    const text = message.trim();
    if (!text) return 'Thông báo mới';
    if (text.length <= 72) return text;
    return `${text.slice(0, 72).trimEnd()}...`;
  };

  return (
    <div className="position-relative" ref={notificationRef}>
      <button
        type="button"
        className="btn-icon-topbar position-relative"
        title="Notifications"
        onClick={() => setIsNotificationOpen((prev) => !prev)}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {isNotificationOpen && (
        <div
          className="notification-dropdown shadow-lg"
          style={{
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            color: colors.textPrimary,
          }}
        >
          {/* HEADER DROPDOWN */}
          <div className="d-flex align-items-center justify-content-between px-3 py-2 border-bottom" style={{ borderColor: colors.border }}>
            <div>
              <div className="fw-bold">Thông báo</div>
              <div className="small" style={{ color: colors.textMuted }}>
                {unreadCount} chưa đọc / {notifications.length} tổng
              </div>
            </div>
            
            <div className="d-flex gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="btn btn-sm btn-link text-decoration-none p-0"
                  style={{ color: colors.primary, fontSize: '0.8rem' }}
                  onClick={() => markAllNotificationsAsRead()}
                >
                  Đánh dấu đã đọc
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  className="btn btn-sm btn-link text-decoration-none p-0 text-danger d-flex align-items-center gap-1"
                  style={{ fontSize: '0.8rem' }}
                  onClick={() => deleteAllNotifications()}
                >
                  <Trash2 size={12} /> Xóa tất cả
                </button>
              )}
            </div>
          </div>

          {/* LIST DROPDOWN */}
          <div className="notification-dropdown-list">
            {recentNotifications.length === 0 ? (
              <div className="px-3 py-4 text-center small" style={{ color: colors.textMuted }}>
                Chưa có thông báo mới
              </div>
            ) : (
              recentNotifications.map((item) => (
                <div
                  key={item.id}
                  className="notification-dropdown-item position-relative"
                  style={{ borderBottom: `1px solid ${colors.border}`, opacity: item.isRead ? 0.6 : 1 }}
                >
                  <div 
                    className="d-flex align-items-start gap-2 flex-grow-1 cursor-pointer"
                    onClick={() => markNotificationAsRead(item.id)}
                    style={{ paddingRight: '24px' }} /* Chừa khoảng trống cho nút X */
                  >
                    <span className={`notification-dot notification-${item.type}`} />
                    <div className="flex-grow-1 text-start">
                      <div className="small fw-bold notification-preview">
                        {item.title}
                      </div>
                      <div className="small notification-preview" style={{ color: colors.textSecondary }}>
                        {shortenMessage(item.content)}
                      </div>
                      <div className="tiny text-uppercase mt-1" style={{ color: colors.textMuted, fontSize: '0.7rem' }}>
                        {format(new Date(item.createdAt), 'dd/MM/yyyy HH:mm')}
                      </div>
                    </div>
                  </div>
                  
                  {/* NÚT XÓA 1 THÔNG BÁO */}
                  <button
                    className="btn-delete-notify"
                    onClick={(e) => {
                      e.stopPropagation(); // Ngăn sự kiện click sượt xuống báo 'Đã đọc'
                      deleteNotification(item.id);
                    }}
                    title="Xóa"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <style>{`
        .notification-badge {
          position: absolute;
          top: 1px;
          right: 1px;
          min-width: 18px;
          height: 18px;
          padding: 0 5px;
          border-radius: 999px;
          background: ${colors.danger};
          color: white;
          font-size: 10px;
          font-weight: 700;
          line-height: 18px;
          text-align: center;
          border: 2px solid ${isDarkMode ? colors.surface : '#fff'};
        }

        .notification-dropdown {
          position: absolute;
          top: calc(100% + 12px);
          right: 0;
          width: 360px;
          max-width: calc(100vw - 24px);
          border-radius: 16px;
          overflow: hidden;
          z-index: 2000;
        }

        .notification-dropdown-list {
          max-height: 380px;
          overflow-y: auto;
        }

        .notification-dropdown-item {
          width: 100%;
          display: flex;
          align-items: flex-start;
          padding: 12px 16px;
          background: transparent;
          color: inherit;
          transition: background 0.15s ease;
          gap: 8px;
        }

        .notification-dropdown-item:hover {
          background: ${colors.surfaceLight};
        }

        /* Nút xóa lẻ nằm đè ở góc phải */
        .btn-delete-notify {
          position: absolute;
          top: 12px;
          right: 12px;
          background: transparent;
          border: none;
          color: ${colors.textMuted};
          padding: 4px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          opacity: 0.5;
        }

        .notification-dropdown-item:hover .btn-delete-notify {
          opacity: 1;
        }

        .btn-delete-notify:hover {
          background: rgba(239, 68, 68, 0.1); /* Màu đỏ nhạt */
          color: #ef4444; /* Màu đỏ */
        }

        .notification-preview {
          line-height: 1.35;
        }

        .notification-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-top: 6px;
          flex-shrink: 0;
        }

        .notification-success { background: #22c55e; }
        .notification-error { background: #ef4444; }
        .notification-info { background: ${colors.primary}; }
        .notification-warning { background: #f59e0b; }
      `}</style>
    </div>
  );
};


export default NotificationBell;