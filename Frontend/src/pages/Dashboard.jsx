import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckSquare,
  Clock,
  CheckCircle2,
  Calendar,
  Flame,
  ArrowRight,
  Plus,
  Activity,
  Circle,
  AlertCircle,
  FolderKanban,
  User,
  MessageSquare,
  Sparkles,
  RefreshCw,
  Timer,
  Play,
  Target,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTimeTracking, formatHumanTime } from '../context/TimeTrackingContext';
import { getDashboardSummary, updateTaskStatus } from '../services/taskService';
import { getTodayFocusSummary } from '../services/timeService';
import { getGoals } from '../services/goalService';
import CreateTaskModal from '../components/tasks/CreateTaskModal';
import TaskDetailsModal from '../components/tasks/TaskDetailsModal';
import MiniCalendar from '../components/calendar/MiniCalendar';

/**
 * Priority badge styling helper
 */
const getPriorityBadge = (priority) => {
  switch (priority) {
    case 'URGENT':
      return {
        label: 'Urgent',
        badge: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
      };
    case 'HIGH':
      return {
        label: 'High',
        badge: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      };
    case 'MEDIUM':
      return {
        label: 'Medium',
        badge: 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800',
      };
    case 'LOW':
    default:
      return {
        label: 'Low',
        badge: 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
      };
  }
};

/**
 * Urgency Score styling helper (Phase 7 Task Intelligence)
 */
const getUrgencyBadge = (score) => {
  if (score >= 80) {
    return {
      badge: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
      bar: 'bg-rose-500',
      label: 'High Urgency',
    };
  }
  if (score >= 50) {
    return {
      badge: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      bar: 'bg-amber-500',
      label: 'Medium Urgency',
    };
  }
  return {
    badge: 'bg-mint-50 dark:bg-mint-950/60 text-mint-700 dark:text-mint-300 border-mint-200 dark:border-mint-800',
    bar: 'bg-mint-500',
    label: 'Low Urgency',
  };
};

/**
 * Deadline status badge helper (Phase 7 Task Intelligence)
 */
const getDeadlineStatusBadge = (status) => {
  switch (status) {
    case 'OVERDUE':
      return {
        text: 'Overdue',
        className: 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 font-bold',
      };
    case 'DUE_TODAY':
      return {
        text: 'Due Today',
        className: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 font-bold',
      };
    case 'DUE_SOON':
      return {
        text: 'Due Soon',
        className: 'text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 border-sky-200 dark:border-sky-800 font-semibold',
      };
    case 'UPCOMING':
      return {
        text: 'Upcoming',
        className: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
      };
    case 'NO_DEADLINE':
    default:
      return {
        text: 'No Deadline',
        className: 'text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800',
      };
  }
};

/**
 * Due date badge helper
 */
const formatDueLabel = (dateStr) => {
  if (!dateStr) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target - now) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return {
      text: 'Today',
      className: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800',
    };
  }
  if (diffDays === 1) {
    return {
      text: 'Tomorrow',
      className: 'text-powder-700 dark:text-powder-300 bg-powder-50 dark:bg-powder-950/60 border-powder-200 dark:border-powder-800',
    };
  }
  if (diffDays === -1) {
    return {
      text: 'Yesterday',
      className: 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 font-bold',
    };
  }
  if (diffDays < -1) {
    return {
      text: `${Math.abs(diffDays)}d overdue`,
      className: 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 font-bold',
    };
  }
  return {
    text: new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    className: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
  };
};

/**
 * Relative time helper for activity feed
 */
const formatRelativeTime = (dateStr) => {
  if (!dateStr) return '';
  const now = new Date();
  const past = new Date(dateStr);
  const diffSec = Math.floor((now - past) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return past.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

/**
 * Activity action dot and label
 */
const getActivityMeta = (action) => {
  switch (action) {
    case 'CREATED':
      return { dot: 'bg-mint-500', label: 'Created' };
    case 'STATUS_CHANGED':
      return { dot: 'bg-powder-500', label: 'Status' };
    case 'PRIORITY_CHANGED':
      return { dot: 'bg-amber-500', label: 'Priority' };
    case 'COMMENT_ADDED':
      return { dot: 'bg-indigo-500', label: 'Comment' };
    case 'SUBTASK_TOGGLED':
    case 'SUBTASK_ADDED':
    case 'SUBTASK_UPDATED':
    case 'SUBTASK_DELETED':
      return { dot: 'bg-purple-500', label: 'Subtask' };
    default:
      return { dot: 'bg-slate-400', label: 'Updated' };
  }
};

/**
 * Dashboard
 * Main productivity overview integrating real backend task metrics, due today tasks,
 * upcoming tasks, recent activity feeds, and quick actions.
 */
const Dashboard = () => {
  const { user } = useAuth();
  const { activeSession, isTracking, formattedElapsed, stopTimer } = useTimeTracking();

  // Dashboard API data state
  const [dashboardData, setDashboardData] = useState(null);
  const [todayFocus, setTodayFocus] = useState(null);
  const [recentGoals, setRecentGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [warningToast, setWarningToast] = useState(null);

  const fetchTodaySummary = useCallback(async () => {
    try {
      const res = await getTodayFocusSummary();
      if (res.success && res.data) {
        setTodayFocus(res.data);
      }
    } catch (err) {
      console.error('Failed to load today focus summary:', err);
    }
  }, []);

  useEffect(() => {
    fetchTodaySummary();
  }, [fetchTodaySummary, isTracking]);

  // Active tab in main tasks card: 'dueToday' | 'upcoming'
  const [activeTaskTab, setActiveTaskTab] = useState('dueToday');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Auto-dismiss warning toast after 5 seconds
  useEffect(() => {
    if (!warningToast) return;
    const timer = setTimeout(() => setWarningToast(null), 5000);
    return () => clearTimeout(timer);
  }, [warningToast]);

  // ── Fetch Dashboard Summary ─────────────────────────────────────────────────
  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [summaryRes, goalsRes] = await Promise.allSettled([
        getDashboardSummary(),
        getGoals({ status: 'IN_PROGRESS' }),
      ]);

      if (summaryRes.status === 'fulfilled' && summaryRes.value?.success && summaryRes.value?.data) {
        setDashboardData(summaryRes.value.data);
      }

      if (goalsRes.status === 'fulfilled' && goalsRes.value?.goals) {
        setRecentGoals(goalsRes.value.goals);
      }
    } catch (err) {
      console.error('getDashboardSummary error:', err);
      setError(err.response?.data?.message || 'Failed to load dashboard statistics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // ── Quick Status Toggle on Dashboard ────────────────────────────────────────
  const handleQuickStatusToggle = async (e, task) => {
    e.stopPropagation();

    let nextStatus = 'TODO';
    if (task.status === 'TODO') nextStatus = 'IN_PROGRESS';
    else if (task.status === 'IN_PROGRESS') nextStatus = 'COMPLETED';
    else if (task.status === 'COMPLETED') nextStatus = 'TODO';

    // Subtask completion guard
    if (nextStatus === 'COMPLETED' && task.subtasks?.length > 0 && task.subtasks.some((s) => !s.completed)) {
      setWarningToast(`Cannot mark "${task.title}" as completed: all subtasks must be completed first.`);
      return;
    }

    try {
      await updateTaskStatus(task._id, nextStatus);
      fetchDashboard();
    } catch (err) {
      setWarningToast(err.response?.data?.message || 'Failed to update task status');
    }
  };

  // Time-aware greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const isAdmin = user?.systemRole === 'ADMIN';
  const metrics = dashboardData?.metrics || {
    totalTasks: 0,
    todoCount: 0,
    inProgressCount: 0,
    completedCount: 0,
    dueTodayCount: 0,
    overdueCount: 0,
    completedThisWeek: 0,
  };

  const dueTodayTasks = dashboardData?.dueTodayTasks || [];
  const upcomingTasks = dashboardData?.upcomingTasks || [];
  const recommendedTasks = dashboardData?.recommendedTasks || [];
  const activeTaskList = activeTaskTab === 'dueToday' ? dueTodayTasks : upcomingTasks;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* ── Top Warning Card (5s dismiss) ─────────────────────────────────── */}
      {warningToast && (
        <div className="p-3.5 rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/90 dark:border-amber-900/60 flex items-center justify-between gap-3 text-amber-800 dark:text-amber-200 text-xs shadow-2xs animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="font-semibold">{warningToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setWarningToast(null)}
            className="text-amber-600 hover:text-amber-800 dark:hover:text-amber-100 font-bold px-1.5 py-0.5 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 transition"
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. Header Banner & Greeting */}
      <div className="bg-gradient-to-r from-powder-600 via-powder-700 to-powder-900 rounded-3xl p-6 sm:p-8 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        {/* Soft Background Accents */}
        <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-mint-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute right-1/3 -top-12 w-36 h-36 bg-powder-400/20 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-white/15 backdrop-blur-md text-white border border-white/20">
            <span className="w-2 h-2 rounded-full bg-mint-400 animate-pulse"></span>
            <span>Workspace Active</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {getGreeting()}, {user?.name || 'User'}!
          </h1>
          <p className="text-powder-100 text-sm max-w-xl">
            Here's your productivity overview for today. Stay focused, track your deadlines, and collaborate seamlessly.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-white text-powder-800 hover:bg-powder-50 text-sm font-semibold transition shadow-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4 text-powder-600" />
            <span>New Task</span>
          </button>
          <Link
            to="/focus"
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-medium transition backdrop-blur-sm flex items-center gap-2"
          >
            <Flame className="w-4 h-4 text-mint-300" />
            <span>Start Focus</span>
          </Link>
        </div>
      </div>

      {/* Overdue Alert Banner (if any) */}
      {metrics.overdueCount > 0 && (
        <div className="p-4 rounded-2xl bg-rose-50/90 dark:bg-rose-950/40 border border-rose-200/90 dark:border-rose-900/60 flex items-center justify-between gap-4 text-rose-800 dark:text-rose-200 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold">
                You have {metrics.overdueCount} overdue task{metrics.overdueCount > 1 ? 's' : ''}!
              </p>
              <p className="text-[11px] text-rose-600 dark:text-rose-300">
                Action required to keep your projects and deadlines on schedule.
              </p>
            </div>
          </div>
          <Link
            to="/tasks?due=overdue"
            className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-xs"
          >
            <span>Review Overdue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* 2. Productivity Metric Stat Cards (Live API Data) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Card 1: My Tasks */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs hover:border-powder-300 dark:hover:border-powder-800 transition group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              My Tasks
            </span>
            <div className="w-9 h-9 rounded-2xl bg-powder-50 dark:bg-powder-950/60 text-powder-600 dark:text-powder-400 flex items-center justify-center">
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {loading ? '—' : metrics.totalTasks}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {loading ? 'loading...' : `${metrics.todoCount} to do · ${metrics.inProgressCount} in progress`}
            </span>
          </div>
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 group-hover:text-powder-600 dark:group-hover:text-powder-400 transition">
            <Link to="/tasks" className="flex items-center gap-1 font-semibold">
              <span>View all tasks</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Card 2: Due Today */}
        <div
          className={`bg-white dark:bg-slate-900 rounded-3xl border p-5 shadow-xs transition group ${
            metrics.dueTodayCount > 0
              ? 'border-amber-300/80 dark:border-amber-800/80 bg-amber-50/20 dark:bg-amber-950/10'
              : 'border-slate-200 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Due Today
              </span>
              {metrics.dueTodayCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              )}
            </div>
            <div className="w-9 h-9 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {loading ? '—' : metrics.dueTodayCount}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {loading ? 'loading...' : `${metrics.dueTodayCount === 1 ? '1 item' : `${metrics.dueTodayCount} items`} scheduled`}
            </span>
          </div>
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition">
            <Link to="/tasks?due=today" className="flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300">
              <span>View due today tasks</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Card 3: Completed */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs hover:border-mint-300 dark:hover:border-mint-800 transition group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Completed
            </span>
            <div className="w-9 h-9 rounded-2xl bg-mint-50 dark:bg-mint-950/60 text-mint-600 dark:text-mint-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {loading ? '—' : metrics.completedCount}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {loading ? 'loading...' : `${metrics.completedThisWeek} finished this week`}
            </span>
          </div>
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 group-hover:text-mint-600 dark:group-hover:text-mint-400 transition">
            <Link to="/tasks?status=COMPLETED" className="flex items-center gap-1 font-semibold">
              <span>View completed tasks</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Task Intelligence: What Should I Work on Next? ─────────────────── */}
      <div className="bg-gradient-to-br from-powder-50/40 via-white to-mint-50/30 dark:from-slate-900 dark:via-slate-900/95 dark:to-slate-800/60 rounded-3xl border border-powder-200/70 dark:border-slate-800 p-6 sm:p-7 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-powder-100/80 dark:border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-powder-500 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  What should I work on?
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-powder-100 dark:bg-powder-900/70 text-powder-700 dark:text-powder-300 border border-powder-200 dark:border-powder-800">
                  Task Intelligence
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Rule-based recommendations prioritized by urgency score, upcoming deadlines, and remaining work.
              </p>
            </div>
          </div>

          <Link
            to="/tasks"
            className="text-xs font-bold text-powder-600 dark:text-powder-400 hover:text-powder-700 dark:hover:text-powder-300 flex items-center gap-1 self-start sm:self-center"
          >
            <span>View all tasks</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400">
            Analyzing task urgency and ranking actionable tasks...
          </div>
        ) : recommendedTasks.length === 0 ? (
          <div className="py-8 px-4 text-center rounded-2xl bg-white/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 space-y-2">
            <CheckCircle2 className="w-8 h-8 text-mint-500 mx-auto" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              All caught up!
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              You have no pending urgent tasks right now. Create a new task or review ongoing projects.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {recommendedTasks.map((item) => {
              const task = item.task;
              const prio = getPriorityBadge(task.priority);
              const urgencyMeta = getUrgencyBadge(item.urgencyScore);
              const deadlineMeta = getDeadlineStatusBadge(item.deadlineStatus);

              return (
                <div
                  key={task._id}
                  onClick={() => {
                    setSelectedTask(task);
                    setIsDetailsOpen(true);
                  }}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 hover:border-powder-300 dark:hover:border-powder-700/60 shadow-2xs hover:shadow-xs transition cursor-pointer flex flex-col justify-between group relative overflow-hidden"
                >
                  {item.isAtRisk && (
                    <div className="absolute top-0 right-0 w-2.5 h-2.5 rounded-bl-lg bg-rose-500" title="At-Risk Task" />
                  )}

                  <div className="space-y-3">
                    {/* Header Chips: Project/Personal + Priority */}
                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                      {task.project ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-powder-50 dark:bg-powder-950/60 text-powder-700 dark:text-powder-300 border border-powder-200/60 dark:border-powder-800/60 flex items-center gap-1 shrink-0">
                          <FolderKanban className="w-2.5 h-2.5" />
                          <span className="truncate max-w-[85px]">{task.project.name}</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60 shrink-0">
                          Personal
                        </span>
                      )}

                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border shrink-0 ${prio.badge}`}>
                        {prio.label}
                      </span>
                    </div>

                    {/* Task Title */}
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-powder-600 dark:group-hover:text-powder-400 transition line-clamp-2">
                        {task.title}
                      </h3>
                    </div>

                    {/* Urgency Score Indicator */}
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          Urgency
                        </span>
                        <span className={`text-xs font-extrabold px-1.5 py-0.2 rounded border ${urgencyMeta.badge}`}>
                          {item.urgencyScore}/100
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${urgencyMeta.bar}`}
                          style={{ width: `${Math.min(100, Math.max(8, item.urgencyScore))}%` }}
                        />
                      </div>
                    </div>

                    {/* Deadline Status Badge */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[11px] text-slate-400 font-medium">Deadline:</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${deadlineMeta.className}`}>
                        {deadlineMeta.text}
                      </span>
                    </div>

                    {/* Explainable Reasons ("Why?") */}
                    {item.reasons && item.reasons.length > 0 && (
                      <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Why this task?
                        </span>
                        <ul className="space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                          {item.reasons.slice(0, 3).map((reason, idx) => (
                            <li key={idx} className="flex items-start gap-1.5 leading-tight">
                              <span className="w-1 h-1 rounded-full bg-powder-500 mt-1.5 shrink-0" />
                              <span className="line-clamp-1">{reason}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Card Bottom Action */}
                  <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-powder-600 dark:text-powder-400 font-semibold group-hover:translate-x-0.5 transition-transform">
                    <span>Open Task</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Main Workspace Grid: Tasks Tabbed View & Live Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Dynamic Due Today / Upcoming Tasks & Live Feed */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Tasks Card */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            {/* Header & Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="flex items-center p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80">
                  <button
                    type="button"
                    onClick={() => setActiveTaskTab('dueToday')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                      activeTaskTab === 'dueToday'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    <span>Due Today</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        dueTodayTasks.length > 0
                          ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {dueTodayTasks.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTaskTab('upcoming')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                      activeTaskTab === 'upcoming'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    <span>Upcoming</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                      {upcomingTasks.length}
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Link
                  to={activeTaskTab === 'dueToday' ? '/tasks?due=today' : '/tasks?due=upcoming'}
                  className="text-xs font-semibold text-powder-600 dark:text-powder-400 hover:underline flex items-center gap-1"
                >
                  <span>View in Tasks</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-powder-600 hover:bg-powder-700 text-white text-xs font-semibold transition flex items-center gap-1 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New</span>
                </button>
              </div>
            </div>

            {/* Task Items List */}
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin text-powder-600" />
                <span className="text-xs">Loading tasks...</span>
              </div>
            ) : activeTaskList.length === 0 ? (
              <div className="py-10 px-4 text-center rounded-2xl bg-slate-50/70 dark:bg-slate-950/40 border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
                <div className="w-10 h-10 rounded-full bg-powder-50 dark:bg-powder-950/60 text-powder-600 dark:text-powder-400 flex items-center justify-center mx-auto">
                  <CheckSquare className="w-5 h-5" />
                </div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {activeTaskTab === 'dueToday'
                    ? "No tasks due today — You're all caught up! ✨"
                    : 'No upcoming tasks scheduled.'}
                </p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {activeTaskTab === 'dueToday'
                    ? 'Tasks scheduled with today as the deadline will show up here.'
                    : 'Create a personal task or assign a project deadline to keep track of upcoming work.'}
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold transition shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create a Task</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {activeTaskList.map((task) => {
                  const prio = getPriorityBadge(task.priority);
                  const dueBadge = formatDueLabel(task.dueDate);
                  const isCompleted = task.status === 'COMPLETED';
                  const totalSub = task.subtasks?.length || 0;
                  const compSub = task.subtasks?.filter((s) => s.completed).length || 0;

                  return (
                    <div
                      key={task._id}
                      onClick={() => {
                        setSelectedTask(task);
                        setIsDetailsOpen(true);
                      }}
                      className="py-3 px-2 -mx-2 rounded-2xl hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition flex items-center justify-between gap-3 cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Status Checkbox / Circle */}
                        <button
                          type="button"
                          onClick={(e) => handleQuickStatusToggle(e, task)}
                          className="shrink-0 p-0.5 rounded-lg text-slate-400 hover:text-powder-600 transition"
                          title={`Click to advance status (${task.status})`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-5 h-5 text-mint-500 fill-mint-50 dark:fill-mint-950" />
                          ) : task.status === 'IN_PROGRESS' ? (
                            <Circle className="w-5 h-5 text-powder-500 fill-powder-50 dark:fill-powder-950" />
                          ) : (
                            <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-slate-400" />
                          )}
                        </button>

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-xs font-bold truncate ${
                                isCompleted
                                  ? 'line-through text-slate-400 dark:text-slate-500'
                                  : 'text-slate-900 dark:text-white group-hover:text-powder-600 dark:group-hover:text-powder-400 transition'
                              }`}
                            >
                              {task.title}
                            </span>

                            {/* Project or Personal tag */}
                            {task.project ? (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-powder-50 dark:bg-powder-950/60 text-powder-700 dark:text-powder-300 border border-powder-200/60 dark:border-powder-800/60 flex items-center gap-1 shrink-0">
                                <FolderKanban className="w-2.5 h-2.5" />
                                <span>{task.project.name}</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60 shrink-0">
                                Personal
                              </span>
                            )}
                          </div>

                          {/* Secondary info: Subtasks & Tags */}
                          <div className="flex items-center gap-3 text-[11px] text-slate-400">
                            {totalSub > 0 && (
                              <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                                <CheckSquare className="w-3 h-3" />
                                <span>
                                  {compSub}/{totalSub} subtasks
                                </span>
                              </span>
                            )}
                            {task.tags && task.tags.length > 0 && (
                              <span className="hidden sm:inline-flex items-center gap-1 text-slate-400 truncate max-w-[150px]">
                                #{task.tags[0]}
                                {task.tags.length > 1 && ` +${task.tags.length - 1}`}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right chips: Priority & Due Date */}
                      <div className="flex items-center gap-2 shrink-0">
                        {prio && (
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border shrink-0 ${prio.badge}`}
                          >
                            {prio.label}
                          </span>
                        )}

                        {dueBadge && (
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border shrink-0 ${dueBadge.className}`}
                          >
                            {dueBadge.text}
                          </span>
                        )}

                        <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-powder-600 group-hover:translate-x-0.5 transition shrink-0 hidden sm:block" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Live Recent Activity Feed */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-mint-600 dark:text-mint-400" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Recent Activity
                </h2>
              </div>
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">Live feed</span>
            </div>

            {loading ? (
              <div className="py-6 flex items-center justify-center text-xs text-slate-400">
                Loading activity...
              </div>
            ) : !dashboardData?.recentActivities || dashboardData.recentActivities.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No recent activity recorded yet. Activity will appear as tasks and comments are updated.
              </div>
            ) : (
              <div className="space-y-3">
                {dashboardData.recentActivities.map((act) => {
                  const meta = getActivityMeta(act.action);
                  return (
                    <div
                      key={act._id}
                      className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60"
                    >
                      <div className={`w-2 h-2 rounded-full ${meta.dot} mt-1.5 shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {act.actor?.name || 'User'}
                          </span>
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-slate-200/70 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300">
                            {meta.label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed break-words">
                          {act.details}
                        </p>
                        {act.task?.title && (
                          <p className="text-[11px] font-semibold text-powder-600 dark:text-powder-400 mt-0.5 truncate">
                            Task: {act.task.title}
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0 mt-0.5">
                        {formatRelativeTime(act.createdAt)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Column: Quick Actions & Account Info */}
        <div className="space-y-6">
          {/* Today's Focus Card (Phase 9) */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Timer className="w-4 h-4 text-powder-500" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Today's Focus
                </h2>
              </div>
              {isTracking && (
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" title="Timer active" />
              )}
            </div>

            {/* Currently focusing state */}
            {isTracking ? (
              <div className="p-3.5 rounded-2xl bg-powder-50/80 dark:bg-powder-950/60 border border-powder-200/80 dark:border-powder-800/80 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-powder-600 dark:text-powder-400 block">
                  Currently focusing on
                </span>
                <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                  {activeSession?.task?.title || 'Active Task'}
                </p>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm font-mono font-bold text-powder-700 dark:text-powder-300">
                    {formattedElapsed}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Link
                      to="/focus"
                      className="px-2.5 py-1 rounded-lg bg-powder-600 hover:bg-powder-700 text-white text-[11px] font-bold shadow-2xs transition"
                    >
                      Focus
                    </Link>
                    <button
                      type="button"
                      onClick={async () => {
                        await stopTimer();
                        fetchTodaySummary();
                      }}
                      className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-bold transition"
                      title="Stop timer"
                    >
                      Stop
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Compact daily statistics */
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tracked</span>
                  <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                    {formatHumanTime(todayFocus?.totalTrackedMinutes || 0)}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sessions</span>
                  <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                    {todayFocus?.sessionsCount || 0}
                  </span>
                </div>
              </div>
            )}

            {!isTracking && (
              <Link
                to="/focus"
                className="w-full py-2 px-4 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-powder-50 dark:hover:bg-powder-950/40 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-powder-700 dark:hover:text-powder-300 text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-current text-powder-500" />
                <span>Start Focus</span>
              </Link>
            )}
          </div>

          {/* Mini Calendar Widget */}
          <MiniCalendar />

          {/* Goals in Progress Widget (Phase 10) */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Target className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">Active Goals</h2>
                  <span className="text-[10px] text-slate-400 font-medium">Outcome tracking</span>
                </div>
              </div>
              <Link
                to="/goals"
                className="text-[11px] font-bold text-powder-600 dark:text-powder-400 hover:underline flex items-center gap-0.5"
              >
                <span>View All</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {recentGoals.length === 0 ? (
              <div className="text-center py-3.5 px-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700">
                <p className="text-xs text-slate-500">No goals in progress</p>
                <Link
                  to="/goals"
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline mt-1 inline-block"
                >
                  Create a Goal
                </Link>
              </div>
            ) : (
              <div className="space-y-2.5">
                {recentGoals.slice(0, 3).map((goal) => (
                  <Link
                    key={goal._id}
                    to={`/goals/${goal._id}`}
                    className="block p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800 transition group"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                      <span className="truncate max-w-[160px] text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {goal.title}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold">{goal.progress || 0}%</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-300"
                        style={{ width: `${goal.progress || 0}%` }}
                      />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions Panel */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-3">
              Quick Actions
            </h2>
            <div className="grid grid-cols-1 gap-2.5">
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-powder-50 dark:hover:bg-powder-950/40 border border-slate-200/70 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 hover:text-powder-700 dark:hover:text-powder-300 transition group text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-powder-100 dark:bg-powder-900/60 text-powder-600 dark:text-powder-300 flex items-center justify-center">
                    <CheckSquare className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold">New Task</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <Link
                to="/projects"
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-powder-50 dark:hover:bg-powder-950/40 border border-slate-200/70 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 hover:text-powder-700 dark:hover:text-powder-300 transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-mint-100 dark:bg-mint-900/60 text-mint-600 dark:text-mint-300 flex items-center justify-center">
                    <Plus className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold">Create Project</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link
                to="/focus"
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-mint-50 dark:hover:bg-mint-950/40 border border-slate-200/70 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 hover:text-mint-700 dark:hover:text-mint-300 transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-mint-100 dark:bg-mint-900/60 text-mint-600 dark:text-mint-300 flex items-center justify-center">
                    <Flame className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold">Focus Timer</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>

          {/* User Account Overview Card */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
              Account Overview
            </h2>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">User</span>
                <span className="font-semibold text-slate-900 dark:text-white">{user?.name}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">System Role</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    isAdmin
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                      : 'bg-mint-100 text-mint-800 dark:bg-mint-950/60 dark:text-mint-300'
                  }`}
                >
                  {user?.systemRole}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Email</span>
                <span className="font-mono text-slate-700 dark:text-slate-300 truncate max-w-[150px]">
                  {user?.email}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {isCreateOpen && (
        <CreateTaskModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onTaskCreated={() => {
            setIsCreateOpen(false);
            fetchDashboard();
          }}
        />
      )}

      {isDetailsOpen && selectedTask && (
        <TaskDetailsModal
          isOpen={isDetailsOpen}
          onClose={() => {
            setIsDetailsOpen(false);
            setSelectedTask(null);
          }}
          task={selectedTask}
          projectRole="MEMBER"
          onTaskUpdated={(updated) => {
            setSelectedTask(updated);
            fetchDashboard();
          }}
          onTaskDeleted={() => {
            setIsDetailsOpen(false);
            setSelectedTask(null);
            fetchDashboard();
          }}
        />
      )}
    </div>
  );
};

export default Dashboard;
