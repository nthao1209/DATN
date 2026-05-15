import { createContext, useContext, useCallback, useState,type  ReactNode } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';

interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
  createdAt: number;
  showToast?: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (
    message: string,
    type?: 'success' | 'error' | 'info' | 'warning',
    duration?: number,
    options?: { showToast?: boolean; persist?: boolean }
  ) => void;
  removeNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const { colors, isDarkMode } = useTheme();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const addNotification = useCallback(
    (
      message: string,
      type: 'success' | 'error' | 'info' | 'warning' = 'info',
      duration = 4000,
      options?: { showToast?: boolean; persist?: boolean }
    ) => {
      const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      setNotifications((prev) => [...prev, { id, type, message, duration, createdAt: Date.now(), showToast: options?.showToast ?? true }]);

      if (!options?.persist) {
        // Tự động đóng
        setTimeout(() => {
          removeNotification(id);
        }, duration);
      }
    },
    [removeNotification]
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
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification }}>
      {children}

      {/* Container chứa các thông báo */}
      <div className="notification-container">
        {notifications.filter((n) => n.showToast !== false).map((n) => (
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
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)'
            }}
          >
            <div className="d-flex align-items-center gap-3 pe-4">
              <div className="flex-shrink-0">{getIcon(n.type)}</div>
              <div className="flex-grow-1 fw-medium" style={{ fontSize: '0.9rem' }}>
                {n.message}
              </div>
              <button 
                className="btn-close-notify" 
                onClick={() => removeNotification(n.id)}
                style={{ color: colors.textMuted }}
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