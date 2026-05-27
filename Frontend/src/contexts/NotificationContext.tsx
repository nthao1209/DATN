import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from 'react';
import { useSelector } from 'react-redux';
import { useSnackbar } from 'notistack'; // Dùng notistack thay cho giao diện tự chế
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

    try {
      const response = await api.getNotifications({ limit: 100 });
      setNotifications(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
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
    try {
      await api.deleteNotification(id);
      setNotifications((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  }, []);

  const deleteAllNotifications = useCallback(async () => {
    try {
      await api.deleteAllNotifications();
      setNotifications([]);
    } catch (error) {
      console.error('Failed to delete all notifications:', error);
    }
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