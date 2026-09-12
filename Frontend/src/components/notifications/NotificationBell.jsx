import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import {
  Bell,
  CheckCircle2,
  Clock,
  AlertTriangle,
  MessageSquare,
  AtSign,
  Target,
  Unlock,
  CheckCheck,
  ChevronRight,
  Inbox,
  UserCheck,
} from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';

/**
 * Returns icon and color styling for each notification type
 */
export const getNotificationVisuals = (type) => {
  switch (type) {
    case 'TASK_ASSIGNED':
      return {
        icon: UserCheck,
        iconBg: 'bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/50',
      };
    case 'TASK_COMPLETED':
      return {
        icon: CheckCircle2,
        iconBg: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50',
      };
    case 'TASK_DEADLINE_APPROACHING':
      return {
        icon: Clock,
        iconBg: 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/50',
      };
    case 'TASK_OVERDUE':
      return {
        icon: AlertTriangle,
        iconBg: 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/50',
      };
    case 'COMMENT_ADDED':
      return {
        icon: MessageSquare,
        iconBg: 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/50',
      };
    case 'MENTIONED':
      return {
        icon: AtSign,
        iconBg: 'bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-900/50',
      };
    case 'TASK_UNBLOCKED':
    case 'DEPENDENCY_COMPLETED':
      return {
        icon: Unlock,
        iconBg: 'bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-900/50',
      };
    case 'GOAL_PROGRESS':
    case 'GOAL_COMPLETED':
    case 'GOAL_DEADLINE_APPROACHING':
      return {
        icon: Target,
        iconBg: 'bg-cyan-100 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-900/50',
      };
    default:
      return {
        icon: Bell,
        iconBg: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
      };
  }
};

const NotificationBell = () => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const navigate = useNavigate();

  const {
    unreadCount,
    recentNotifications,
    loading,
    fetchRecentNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  // Close popover on click outside or Escape
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (!isOpen) {
      fetchRecentNotifications();
    }
    setIsOpen((prev) => !prev);
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.isRead) {
      try {
        await markAsRead(notif._id);
      } catch (err) {
        console.error('Failed to mark read on click:', err);
      }
    }

    setIsOpen(false);

    // Deep navigation based on sourceType and metadata
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
    } else {
      navigate('/notifications');
    }
  };

  const handleMarkAll = async (e) => {
    e.stopPropagation();
    try {
      await markAllAsRead();
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        aria-label="Notifications"
        title="View notifications"
        className={`relative p-2 rounded-xl transition ${
          isOpen
            ? 'bg-powder-100 text-powder-800 dark:bg-powder-900/50 dark:text-powder-300'
            : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
      >
        <Bell className="w-5 h-5" />

        {/* Unread Count Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-powder-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-slate-900 animate-in zoom-in-50 duration-200">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 shadow-2xl z-50 overflow-hidden animate-in fade-in-50 slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="p-3.5 px-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Notifications
              </h2>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-powder-100 dark:bg-powder-950/60 text-powder-700 dark:text-powder-300 border border-powder-200/60 dark:border-powder-900/50">
                  {unreadCount} unread
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                className="flex items-center gap-1 text-xs font-semibold text-powder-600 hover:text-powder-700 dark:text-powder-400 dark:hover:text-powder-300 transition"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
            {loading && recentNotifications.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                <div className="w-6 h-6 border-2 border-powder-500 border-t-transparent rounded-full animate-spin mb-2" />
                <span className="text-xs">Loading notifications...</span>
              </div>
            ) : recentNotifications.length === 0 ? (
              <div className="py-12 px-4 flex flex-col items-center justify-center text-center">
                <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-2">
                  <Inbox className="w-5 h-5" />
                </div>
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  All caught up!
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                  No new notifications to show.
                </p>
              </div>
            ) : (
              recentNotifications.map((notif) => {
                const { icon: Icon, iconBg } = getNotificationVisuals(notif.type);
                return (
                  <button
                    key={notif._id}
                    type="button"
                    onClick={() => handleNotificationClick(notif)}
                    className={`w-full text-left p-3 px-4 flex items-start gap-3 transition ${
                      !notif.isRead
                        ? 'bg-powder-50/50 dark:bg-powder-950/20 hover:bg-powder-100/60 dark:hover:bg-powder-900/30'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    {/* Icon */}
                    <div
                      className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center border shadow-2xs ${iconBg}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {notif.title}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {moment(notif.createdAt).fromNow(true)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                        {notif.message}
                      </p>
                    </div>

                    {/* Unread indicator dot */}
                    {!notif.isRead && (
                      <span className="w-2 h-2 rounded-full bg-powder-500 shrink-0 mt-1.5 ring-2 ring-powder-200 dark:ring-powder-900/50" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer Link */}
          <div className="p-2.5 px-4 bg-slate-50/80 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate('/notifications');
              }}
              className="w-full py-1.5 rounded-xl text-xs font-semibold text-center text-powder-700 dark:text-powder-300 hover:text-powder-800 dark:hover:text-powder-200 hover:bg-powder-100/60 dark:hover:bg-powder-950/40 transition flex items-center justify-center gap-1.5"
            >
              <span>View all notifications</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
