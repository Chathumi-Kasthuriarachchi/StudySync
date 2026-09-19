import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import {
  getNotifications as apiGetNotifications,
  getUnreadCount as apiGetUnreadCount,
  markAsRead as apiMarkAsRead,
  markAllAsRead as apiMarkAllAsRead,
  deleteNotification as apiDeleteNotification,
  clearAllNotifications as apiClearAllNotifications,
  triggerDeadlineCheck as apiTriggerDeadlineCheck,
} from '../services/notificationService';
import socketService from '../services/socketService';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const deadlineCheckedRef = useRef(false);

  // Fetch unread notification count
  const fetchUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    try {
      const data = await apiGetUnreadCount();
      if (data.success && typeof data.unreadCount === 'number') {
        setUnreadCount(data.unreadCount);
      }
    } catch (err) {
      console.error('fetchUnreadCount error:', err);
    }
  }, [user]);

  // Fetch recent notifications for topbar popover dropdown
  const fetchRecentNotifications = useCallback(async () => {
    if (!user) {
      setRecentNotifications([]);
      return;
    }
    try {
      setLoading(true);
      const data = await apiGetNotifications({ limit: 10, page: 1 });
      if (data.success) {
        setRecentNotifications(data.notifications || []);
        if (typeof data.unreadCount === 'number') {
          setUnreadCount(data.unreadCount);
        }
      }
    } catch (err) {
      console.error('fetchRecentNotifications error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Mark single notification as read
  const markAsRead = useCallback(async (id) => {
    try {
      const data = await apiMarkAsRead(id);
      if (data.success) {
        setRecentNotifications((prev) =>
          prev.map((n) => (n._id === id ? { ...n, isRead: true, readAt: new Date() } : n))
        );
        setUnreadCount((count) => Math.max(0, count - 1));
      }
      return data;
    } catch (err) {
      console.error('markAsRead error:', err);
      throw err;
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      const data = await apiMarkAllAsRead();
      if (data.success) {
        setRecentNotifications((prev) =>
          prev.map((n) => ({ ...n, isRead: true, readAt: new Date() }))
        );
        setUnreadCount(0);
      }
      return data;
    } catch (err) {
      console.error('markAllAsRead error:', err);
      throw err;
    }
  }, []);

  // Delete single notification
  const deleteNotification = useCallback(async (id) => {
    try {
      const target = recentNotifications.find((n) => n._id === id);
      const data = await apiDeleteNotification(id);
      if (data.success) {
        setRecentNotifications((prev) => prev.filter((n) => n._id !== id));
        if (target && !target.isRead) {
          setUnreadCount((count) => Math.max(0, count - 1));
        }
      }
      return data;
    } catch (err) {
      console.error('deleteNotification error:', err);
      throw err;
    }
  }, [recentNotifications]);

  // Clear all notifications
  const clearAllNotifications = useCallback(async () => {
    try {
      const data = await apiClearAllNotifications();
      if (data.success) {
        setRecentNotifications([]);
        setUnreadCount(0);
      }
      return data;
    } catch (err) {
      console.error('clearAllNotifications error:', err);
      throw err;
    }
  }, []);

  // Trigger deadline and overdue scan once on login
  useEffect(() => {
    if (user && !deadlineCheckedRef.current) {
      deadlineCheckedRef.current = true;
      apiTriggerDeadlineCheck()
        .then(() => {
          fetchUnreadCount();
        })
        .catch(() => {});
    }
    if (!user) {
      deadlineCheckedRef.current = false;
      setUnreadCount(0);
      setRecentNotifications([]);
    }
  }, [user, fetchUnreadCount]);

  // Initial fetch and periodic poll (every 60s) + window focus listener
  useEffect(() => {
    if (!user) return;

    fetchUnreadCount();

    const interval = setInterval(() => {
      fetchUnreadCount();
    }, 60000);

    const onFocus = () => {
      fetchUnreadCount();
    };
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [user, fetchUnreadCount]);

  // Real-time Socket.IO notification listener
  useEffect(() => {
    if (!user) return;

    socketService.connect();
    const unsub = socketService.onNotificationNew((newNotif) => {
      setUnreadCount((count) => count + 1);
      setRecentNotifications((prev) => {
        if (prev.some((n) => n._id === newNotif._id)) return prev;
        return [newNotif, ...prev.slice(0, 9)];
      });
    });

    return () => {
      unsub();
    };
  }, [user]);

  const value = {
    unreadCount,
    recentNotifications,
    loading,
    error,
    fetchUnreadCount,
    fetchRecentNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export default NotificationContext;
