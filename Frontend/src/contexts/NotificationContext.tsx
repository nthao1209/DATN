import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from 'react';
import { useSelector } from 'react-redux';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import api from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import type { RootState } from '../redux/store';

export interface StoredNotification {
  id: number;
  userId: number;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  content: string;
  payload?: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
}

interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  createdAt: number;
  duration: number;
}

interface NotificationContextType {
  notifications: StoredNotification[];
  addNotification: (
    message: string,
    type?: 'success' | 'error' | 'info' | 'warning',
    duration?: number,
    options?: { showToast?: boolean }
  ) => void;
  refreshNotifications: () => Promise<void>;
  markNotificationAsRead: (id: number) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const { colors, isDarkMode } = useTheme();
  const { user, loading: authLoading } = useSelector((state: RootState) => state.auth);
  const [notifications, setNotifications] = useState<StoredNotification[]>([]);
  const [toastNotifications, setToastNotifications] = useState<ToastNotification[]>([]);
  const userId = user?.id ?? null;

  const refreshNotifications = useCallback(async () => {
    if (!userId || authLoading) {
      return;
    }

    try {
      const response = await api.getNotifications({ limit: 100 });
      setNotifications(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  }, [authLoading, userId]);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setToastNotifications([]);
    }
  }, [userId]);

  useEffect(() => {
    if (!toastNotifications.length) return;

    const timers = toastNotifications.map((toast) =>
      window.setTimeout(() => {
        setToastNotifications((prev) => prev.filter((item) => item.id !== toast.id));
      }, toast.duration),
    );

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [toastNotifications]);

  const markNotificationAsRead = useCallback(async (id: number) => {
    try {
      await api.markNotificationAsRead(id);
      setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }, []);

  const markAllNotificationsAsRead = useCallback(async () => {
    try {
      await api.markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  }, []);

  const addNotification = useCallback(
    (
      message: string,
      type: 'success' | 'error' | 'info' | 'warning' = 'info',
      duration = 3000,
      options?: { showToast?: boolean }
    ) => {
      if (options?.showToast === false) {
        return;
      }

      const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      setToastNotifications((prev) => [...prev, { id, type, message, createdAt: Date.now(), duration }]);
    },
    [],
  );

  // Icon tương ứng với từng loại thông báo
  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle size={18} color="#22c55e" />;
      case 'error': return <AlertCircle size={18} color="#ef4444" />;
      case 'warning': return <AlertTriangle size={18} color="#f59e0b" />;
      default: return <Info size={18} color={colors.primary} />;
    }
  };

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, refreshNotifications, markNotificationAsRead, markAllNotificationsAsRead }}>
      {children}

      {/* Container chứa các thông báo */}
      <div className="notification-container">
        {toastNotifications.map((n) => (
          <div 
            key={n.id} 
            className={`notification-item animate-slide-in shadow-lg`}
            style={{ 
              backgroundColor: isDarkMode ? colors.surfaceLight : '#fff',
              borderLeft: `4px solid ${
                n.type === 'success' ? '#22c55e' : 
                n.type === 'error' ? '#ef4444' : 
                n.type === 'warning' ? '#f59e0b' : colors.primary
              }`,
              color: colors.textPrimary,
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
              opacity: 1,
              cursor: 'default',
            }}
          >
            <div className="d-flex align-items-center gap-3 pe-4">
              <div className="flex-shrink-0">{getIcon(n.type)}</div>
              <div className="flex-grow-1 fw-medium" style={{ fontSize: '0.9rem' }}>
                {n.message}
              </div>
              <button 
                className="btn-close-notify" 
                onClick={() => {
                  setToastNotifications((prev) => prev.filter((item) => item.id !== n.id));
                }}
                style={{ color: colors.textMuted }}
                title="Xóa thông báo"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .notification-container {
          position: fixed;
          top: 24px;
          right: 24px;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-width: 380px;
          width: calc(100% - 48px);
        }

        .notification-item {
          padding: 16px;
          border-radius: 12px;
          position: relative;
          overflow: hidden;
          transition: all 0.3s ease;
        }

        .btn-close-notify {
          background: none;
          border: none;
          padding: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          transition: background 0.2s;
        }

        .btn-close-notify:hover {
          background-color: rgba(0,0,0,0.05);
        }

        .animate-slide-in {
          animation: slideInNotify 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes slideInNotify {
          from { opacity: 0; transform: translateX(50px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotification must be used within NotificationProvider');
  return context;
};