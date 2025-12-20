import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { Notification } from '../types';
import { useAuth } from './AuthContext';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (notificationId: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: number) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await api.get('/admin/notifications');
      setNotifications(response.data || []);
    } catch (error: any) {
      // إخفاء خطأ 404 إذا كان API غير متوفر بعد
      if (error?.status === 404 || error?.message?.includes('404') || error?.message?.includes('Not Found')) {
        setNotifications([]);
        return;
      }
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const markAsRead = async (notificationId: number) => {
    try {
      await api.put(`/admin/notifications/${notificationId}/read`);
      setNotifications(prev =>
        prev.map(notif =>
          notif.id === notificationId ? { ...notif, read: true } : notif
        )
      );
    } catch (error) {
      // Handle error
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/admin/notifications/read-all');
      setNotifications(prev =>
        prev.map(notif => ({ ...notif, read: true }))
      );
    } catch (error) {
      // Handle error
    }
  };

  const deleteNotification = async (notificationId: number) => {
    try {
      await api.delete(`/admin/notifications/${notificationId}`);
      setNotifications(prev =>
        prev.filter(notif => notif.id !== notificationId)
      );
    } catch (error) {
      // Handle error
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  // جلب الإشعارات عند تحميل الصفحة
  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    fetchNotifications();
    // تحديث الإشعارات كل 30 ثانية
    const interval = setInterval(() => {
      fetchNotifications();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications, isAuthenticated]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

