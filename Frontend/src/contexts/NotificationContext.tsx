import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from 'react';
import { useSelector } from 'react-redux';
import { useSnackbar } from 'notistack'; 
import api from '../services/api';
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
  deleteNotification : (id: number) => Promise<void>;
  deleteAllNotifications : () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const { user, currentTenant, token, loading: authLoading } = useSelector((state: RootState) => state.auth);
  const [notifications, setNotifications] = useState<StoredNotification[]>([]);
  const { enqueueSnackbar } = useSnackbar(); // Lấy hàm gọi Toast của notistack
  
  const userId = user?.id ?? null;
  const tenantId = currentTenant?.id ?? null;

  const refreshNotifications = useCallback(async () => {
    if (!userId || !tenantId || !token || authLoading) {
      return;
    }
      const response = await api.getNotifications({ limit: 100 });
      setNotifications(Array.isArray(response) ? response : []);
  }, [authLoading, tenantId, token, userId]);

  useEffect(() => {
    if (!userId || !tenantId) {
      setNotifications([]);
    }
  }, [tenantId, userId]);

  useEffect(() => {
    if (userId && tenantId) {
      refreshNotifications();
    }
  }, [refreshNotifications, tenantId, userId]);

  const markNotificationAsRead = useCallback(async (id: number) => {
      await api.markNotificationAsRead(id);
      setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
  }, []);

  const markAllNotificationsAsRead = useCallback(async () => {
    
      await api.markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
  }, []);

  const addNotification = useCallback(
    (
      message: string,
      type: 'success' | 'error' | 'info' | 'warning' = 'info',
      duration = 2000,
      options?: { showToast?: boolean }
    ) => {
      if (options?.showToast === false) {
        return;
      }
      enqueueSnackbar(message, { variant: type, autoHideDuration: duration });
    },
    [enqueueSnackbar]
  );

  const deleteNotification = useCallback(async (id: number) => {
      await api.deleteNotification(id);
      setNotifications((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const deleteAllNotifications = useCallback(async () => {
      await api.deleteAllNotifications();
      setNotifications([]);
    
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, refreshNotifications, markNotificationAsRead, markAllNotificationsAsRead, deleteNotification, deleteAllNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotification must be used within NotificationProvider');
  return context;
};