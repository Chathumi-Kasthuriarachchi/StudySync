import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import {
  Bell,
  CheckCheck,
  Trash2,
  RefreshCw,
  Inbox,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  MessageSquare,
  AtSign,
  Target,
  Unlock,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import {
  getNotifications as apiGetNotifications,
  markAsRead as apiMarkAsRead,
  deleteNotification as apiDeleteNotification,
} from '../services/notificationService';
import { getNotificationVisuals } from '../components/notifications/NotificationBell';

const FILTER_TABS = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'tasks', label: 'Tasks & Deadlines' },
  { id: 'goals', label: 'Goals' },
  { id: 'comments', label: 'Comments & Mentions' },
];

const Notifications = () => {
  const navigate = useNavigate();
  const {
    unreadCount,
    fetchUnreadCount,
    markAllAsRead,
    clearAllNotifications,
  } = useNotifications();

  const [activeTab, setActiveTab] = useState('all');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ totalPages: 1, total: 0 });
  const [error, setError] = useState(null);

  // Fetch notifications with current tab filter
  const fetchPageNotifications = useCallback(
    async (currentPage = 1, isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        const params = { page: currentPage, limit: 20 };

        if (activeTab === 'unread') {
          params.isRead = false;
        }

        const res = await apiGetNotifications(params);
        if (res.success) {
          setNotifications(res.notifications || []);
          setPagination(res.pagination || { totalPages: 1, total: res.notifications?.length || 0 });
          setPage(currentPage);
          fetchUnreadCount();
        }
      } catch (err) {
        console.error('Failed to load notifications:', err);
        setError('Failed to load notifications. Please try again.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeTab, fetchUnreadCount]
  );

  useEffect(() => {
    fetchPageNotifications(1);
  }, [fetchPageNotifications]);

  // Client-side filtering for category tabs (tasks, goals, comments)
  const filteredNotifications = useMemo(() => {
    if (activeTab === 'all' || activeTab === 'unread') {
      return notifications;
    }
    if (activeTab === 'tasks') {
      return notifications.filter((n) =>
        [
          'TASK_ASSIGNED',
          'TASK_COMPLETED',
          'TASK_DEADLINE_APPROACHING',
          'TASK_OVERDUE',
          'TASK_UNBLOCKED',
          'DEPENDENCY_COMPLETED',
        ].includes(n.type)
      );
    }
    if (activeTab === 'goals') {
      return notifications.filter((n) =>
        [
          'GOAL_PROGRESS',
          'GOAL_COMPLETED',
          'GOAL_DEADLINE_APPROACHING',
        ].includes(n.type)
      );
    }
    if (activeTab === 'comments') {
      return notifications.filter((n) =>
        ['COMMENT_ADDED', 'MENTIONED'].includes(n.type)
      );
    }
    return notifications;
  }, [notifications, activeTab]);

  // Group notifications by timeline: Today, Yesterday, Earlier
  const groupedNotifications = useMemo(() => {
    const today = moment().startOf('day');
    const yesterday = moment().subtract(1, 'day').startOf('day');

    const groups = {
      Today: [],
      Yesterday: [],
      Earlier: [],
    };

    filteredNotifications.forEach((n) => {
      const createdAt = moment(n.createdAt);
      if (createdAt.isSameOrAfter(today)) {
        groups.Today.push(n);
      } else if (createdAt.isSameOrAfter(yesterday)) {
        groups.Yesterday.push(n);
      } else {
        groups.Earlier.push(n);
      }
    });

    return groups;
  }, [filteredNotifications]);

  const handleMarkAsRead = async (id, e) => {
    e.stopPropagation();
    try {
      await apiMarkAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true, readAt: new Date() } : n))
      );
      fetchUnreadCount();
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    try {
      await apiDeleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      fetchUnreadCount();
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const handleCardClick = async (notif) => {
    if (!notif.isRead) {
      try {
        await apiMarkAsRead(notif._id);
        setNotifications((prev) =>
          prev.map((n) => (n._id === notif._id ? { ...n, isRead: true, readAt: new Date() } : n))
        );
        fetchUnreadCount();
      } catch (err) {
        console.error('Failed to mark read on click:', err);
      }
    }

    // Source navigation
    if (notif.sourceType === 'TASK') {
      if (notif.project) {
        navigate(`/projects/${notif.project._id || notif.project}`);
      } else {
        navigate('/tasks');
      }
    } else if (notif.sourceType === 'GOAL') {
      navigate('/goals');
    } else if (notif.sourceType === 'PROJECT') {
      navigate(`/projects/${notif.sourceId}`);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, readAt: new Date() }))
      );
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to clear all your notifications?')) return;
    try {
      await clearAllNotifications();
      setNotifications([]);
    } catch (err) {
      console.error('Failed to clear all:', err);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-powder-100 dark:bg-powder-950/60 text-powder-600 dark:text-powder-300 border border-powder-200/80 dark:border-powder-900/50 shadow-2xs">
              <Bell className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              Notification Center
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time updates on your assignments, deadlines, comments, and milestones.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchPageNotifications(page, true)}
            disabled={refreshing || loading}
            aria-label="Refresh notifications"
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-powder-50 dark:bg-powder-950/50 text-powder-700 dark:text-powder-300 hover:bg-powder-100 dark:hover:bg-powder-900/50 border border-powder-200 dark:border-powder-800/60 text-xs font-semibold transition"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Mark all read</span>
            </button>
          )}

          {notifications.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-slate-200 dark:border-slate-800 text-xs font-semibold transition"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear all</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs Filter Bar */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800">
        {FILTER_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setPage(1);
              }}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition whitespace-nowrap flex items-center gap-2 ${
                isActive
                  ? 'bg-powder-100 text-powder-800 dark:bg-powder-900/60 dark:text-powder-300 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <span>{tab.label}</span>
              {tab.id === 'unread' && unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-powder-500 text-white">
                  {unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400">
          <div className="w-8 h-8 border-3 border-powder-500 border-t-transparent rounded-full animate-spin mb-3" />
          <span className="text-sm font-medium">Loading notifications...</span>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="py-20 px-4 rounded-3xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-powder-50 dark:bg-powder-950/50 border border-powder-100 dark:border-powder-900/50 flex items-center justify-center text-powder-500 mb-3 shadow-2xs">
            <Inbox className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
            No notifications found
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
            {activeTab === 'unread'
              ? "You're all caught up! You don't have any unread notifications."
              : 'Notifications about task assignments, comments, and milestones will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedNotifications).map(([groupTitle, items]) => {
            if (items.length === 0) return null;
            return (
              <div key={groupTitle} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {groupTitle}
                  </span>
                  <div className="flex-1 h-px bg-slate-200 dark:border-slate-800" />
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800/80 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                  {items.map((notif) => {
                    const { icon: Icon, iconBg } = getNotificationVisuals(notif.type);
                    return (
                      <div
                        key={notif._id}
                        onClick={() => handleCardClick(notif)}
                        className={`p-4 flex items-start gap-4 cursor-pointer transition ${
                          !notif.isRead
                            ? 'bg-powder-50/40 dark:bg-powder-950/20 hover:bg-powder-100/50 dark:hover:bg-powder-900/30'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        {/* Type Icon Badge */}
                        <div
                          className={`w-10 h-10 rounded-2xl shrink-0 flex items-center justify-center border shadow-2xs ${iconBg}`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>

                        {/* Text Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {notif.title}
                            </span>
                            {!notif.isRead && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-powder-500 text-white">
                                New
                              </span>
                            )}
                            <span className="text-xs text-slate-400 ml-auto shrink-0">
                              {moment(notif.createdAt).fromNow()}
                            </span>
                          </div>

                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                            {notif.message}
                          </p>

                          {/* Source Tag if Project or Goal */}
                          {notif.project && (
                            <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-slate-400">
                              <span>Project:</span>
                              <span className="text-powder-600 dark:text-powder-400">
                                {typeof notif.project === 'object' && notif.project.name
                                  ? notif.project.name
                                  : 'Workspace'}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                          {!notif.isRead && (
                            <button
                              type="button"
                              onClick={(e) => handleMarkAsRead(notif._id, e)}
                              aria-label="Mark as read"
                              title="Mark as read"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-powder-600 dark:hover:text-powder-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => handleDelete(notif._id, e)}
                            aria-label="Delete notification"
                            title="Delete"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Page {page} of {pagination.totalPages} ({pagination.total} total)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fetchPageNotifications(page - 1)}
                  disabled={page <= 1}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>
                <button
                  type="button"
                  onClick={() => fetchPageNotifications(page + 1)}
                  disabled={page >= pagination.totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Notifications;
