import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Flame,
  Target,
  Timer,
  FolderKanban,
  CheckSquare,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { getPersonalAnalytics } from '../services/analyticsService';

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'this_week', label: 'This Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'last_30_days', label: 'Last 30 Days' },
  { key: 'all', label: 'All Time' },
];

// StudySync Palette
const COLORS = {
  powder: '#0ea5e9',
  powderLight: '#38bdf8',
  mint: '#10b981',
  mintLight: '#34d399',
  amber: '#f59e0b',
  rose: '#f43f5e',
  indigo: '#6366f1',
  slate: '#94a3b8',
};

const STATUS_COLORS = [
  { name: 'To Do', color: '#94a3b8' },
  { name: 'In Progress', color: '#0ea5e9' },
  { name: 'Completed', color: '#10b981' },
];

const PRIORITY_COLORS = {
  LOW: '#94a3b8',
  MEDIUM: '#38bdf8',
  HIGH: '#f59e0b',
  URGENT: '#f43f5e',
};

/**
 * Custom Tooltip for Recharts
 */
const CustomTooltip = ({ active, payload, label, unit = '' }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 shadow-lg text-xs">
        <p className="font-bold text-slate-700 dark:text-slate-200 mb-1">{label}</p>
        {payload.map((entry, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: entry.color || entry.fill }}
            />
            <span className="text-slate-500 dark:text-slate-400 capitalize">
              {entry.name}:
            </span>
            <span className="font-semibold text-slate-900 dark:text-white">
              {entry.value} {unit}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

/**
 * Personal Analytics Page — Phase 12
 */
const Analytics = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('this_month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchAnalytics = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');

      const res = await getPersonalAnalytics({ period: selectedPeriod });
      if (res.success) {
        setData(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load analytics data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedPeriod]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const taskMetrics = data?.taskMetrics || {
    total: 0,
    completed: 0,
    inProgress: 0,
    todo: 0,
    overdue: 0,
    completionPercentage: 0,
    personalTasks: 0,
    projectTasks: 0,
    byPriority: { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0 },
    byStatus: { TODO: 0, IN_PROGRESS: 0, COMPLETED: 0 },
    completionTrend: [],
  };

  const timeMetrics = data?.timeMetrics || {
    totalTrackedSeconds: 0,
    totalTrackedMinutes: 0,
    totalTrackedHours: 0,
    focusSessionsCount: 0,
    avgTimePerTaskMinutes: 0,
    estimatedVsActual: {
      totalEstimatedMinutes: 0,
      totalActualMinutes: 0,
      differenceMinutes: 0,
      isOverEstimate: false,
    },
    dailyFocusTrend: [],
  };

  const productivityMetrics = data?.productivityMetrics || {
    tasksCompletedPerDay: 0,
    mostProductiveDay: 'Monday',
    productivityTrend: 'STABLE',
    overdueRate: 0,
    completionRate: 0,
  };

  const goalMetrics = data?.goalMetrics || {
    total: 0,
    active: 0,
    completed: 0,
    avgProgress: 0,
  };

  // Pie chart data for task status
  const statusPieData = [
    { name: 'To Do', value: taskMetrics.byStatus.TODO || 0, color: '#94a3b8' },
    { name: 'In Progress', value: taskMetrics.byStatus.IN_PROGRESS || 0, color: '#0ea5e9' },
    { name: 'Completed', value: taskMetrics.byStatus.COMPLETED || 0, color: '#10b981' },
  ].filter((item) => item.value > 0);

  // Bar chart data for priorities
  const priorityBarData = [
    { name: 'Low', count: taskMetrics.byPriority.LOW || 0, fill: PRIORITY_COLORS.LOW },
    { name: 'Medium', count: taskMetrics.byPriority.MEDIUM || 0, fill: PRIORITY_COLORS.MEDIUM },
    { name: 'High', count: taskMetrics.byPriority.HIGH || 0, fill: PRIORITY_COLORS.HIGH },
    { name: 'Urgent', count: taskMetrics.byPriority.URGENT || 0, fill: PRIORITY_COLORS.URGENT },
  ];

  // Productivity trend badge helper
  const renderTrendBadge = (trend) => {
    if (trend === 'INCREASING') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-mint-50 dark:bg-mint-950/60 text-mint-700 dark:text-mint-300 border border-mint-200 dark:border-mint-800">
          <ArrowUpRight className="w-3.5 h-3.5 text-mint-600" />
          Increasing Velocity
        </span>
      );
    }
    if (trend === 'DECREASING') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
          <ArrowDownRight className="w-3.5 h-3.5 text-rose-600" />
          Decreasing Velocity
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
        <Minus className="w-3.5 h-3.5 text-slate-500" />
        Stable Velocity
      </span>
    );
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      {/* ── Header & Period Filtering ───────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-powder-50 dark:bg-powder-950/60 text-powder-600 dark:text-powder-400 flex items-center justify-center border border-powder-100 dark:border-powder-900/60">
              <BarChart3 className="w-4 h-4" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Personal Analytics
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Review your task productivity, time tracking, completion velocity, and study habits.
          </p>
        </div>

        {/* Period Selector Tabs */}
        <div className="flex items-center gap-2">
          <div className="inline-flex p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-xs font-semibold">
            {PERIODS.map((period) => (
              <button
                key={period.key}
                onClick={() => setSelectedPeriod(period.key)}
                className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                  selectedPeriod === period.key
                    ? 'bg-white dark:bg-slate-900 text-powder-600 dark:text-powder-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchAnalytics(true)}
            disabled={refreshing || loading}
            title="Refresh analytics"
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-powder-600' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── 1. KPI Summary Stat Cards ───────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Completion Rate */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs hover:border-mint-300 dark:hover:border-mint-800 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Completion Rate
            </span>
            <div className="w-9 h-9 rounded-2xl bg-mint-50 dark:bg-mint-950/60 text-mint-600 dark:text-mint-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {loading ? '—' : `${taskMetrics.completionPercentage}%`}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {loading ? '' : `${taskMetrics.completed} of ${taskMetrics.total} tasks`}
            </span>
          </div>
          {/* Progress Bar */}
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-mint-500 to-mint-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${taskMetrics.completionPercentage}%` }}
            />
          </div>
        </div>

        {/* Card 2: Active Tasks */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs hover:border-powder-300 dark:hover:border-powder-800 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Active Tasks
            </span>
            <div className="w-9 h-9 rounded-2xl bg-powder-50 dark:bg-powder-950/60 text-powder-600 dark:text-powder-400 flex items-center justify-center">
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {loading ? '—' : taskMetrics.inProgress + taskMetrics.todo}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {loading ? '' : `${taskMetrics.inProgress} in progress · ${taskMetrics.todo} to do`}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span>Personal: <strong>{taskMetrics.personalTasks}</strong></span>
            <span>·</span>
            <span>Project: <strong>{taskMetrics.projectTasks}</strong></span>
          </div>
        </div>

        {/* Card 3: Overdue Tasks */}
        <div className={`bg-white dark:bg-slate-900 rounded-3xl border p-5 shadow-xs transition ${
          taskMetrics.overdue > 0
            ? 'border-rose-300/80 dark:border-rose-800/80 bg-rose-50/10 dark:bg-rose-950/10'
            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Overdue Work
              </span>
              {taskMetrics.overdue > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              )}
            </div>
            <div className="w-9 h-9 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {loading ? '—' : taskMetrics.overdue}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {loading ? '' : `${productivityMetrics.overdueRate}% overdue rate`}
            </span>
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            {taskMetrics.overdue > 0
              ? 'Requires prompt attention to protect project timelines.'
              : 'All scheduled deadlines are on track!'}
          </p>
        </div>

        {/* Card 4: Focus Time */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-800 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Focus Time
            </span>
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Timer className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {loading ? '—' : `${timeMetrics.totalTrackedHours}h`}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {loading ? '' : `(${timeMetrics.totalTrackedMinutes} mins)`}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{timeMetrics.focusSessionsCount} focus sessions</span>
            <span>Avg: {timeMetrics.avgTimePerTaskMinutes}m / task</span>
          </div>
        </div>
      </div>

      {/* ── 2. Interactive Charts Row 1: Task Completion & Focus Trends ─ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Completion Trend */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Task Completion Trend
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Tasks completed and added over time
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-powder-500" />
                <span className="text-slate-500 dark:text-slate-400">Completed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                <span className="text-slate-500 dark:text-slate-400">Created</span>
              </div>
            </div>
          </div>

          <div className="h-64 w-full">
            {taskMetrics.completionTrend.length === 0 || loading ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No activity data recorded in this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={taskMetrics.completionTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="powderGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.powder} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={COLORS.powder} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip unit="tasks" />} />
                  <Area
                    type="monotone"
                    dataKey="completedCount"
                    name="Completed"
                    stroke={COLORS.powder}
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#powderGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="createdCount"
                    name="Created"
                    stroke="#94a3b8"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    fill="none"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: Daily Focus Time Trend */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Focus Time Log
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Daily recorded focus and work timer sessions (minutes)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                {timeMetrics.totalTrackedHours} hrs logged
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            {timeMetrics.dailyFocusTrend.length === 0 || loading ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No focus timer sessions recorded in this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timeMetrics.dailyFocusTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip unit="mins" />} />
                  <Bar
                    dataKey="focusMinutes"
                    name="Focus Time"
                    fill={COLORS.indigo}
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ── 3. Interactive Charts Row 2: Status & Priority Distribution ─ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 3: Status Distribution Donut */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Status Breakdown
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Task distribution by completion stage
            </p>
          </div>

          <div className="h-52 w-full my-2">
            {statusPieData.length === 0 || loading ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No task data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {statusPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip unit="tasks" />} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Legend Table */}
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-center">
            <div>
              <span className="text-[11px] text-slate-400">To Do</span>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{taskMetrics.todo}</p>
            </div>
            <div>
              <span className="text-[11px] text-slate-400">In Progress</span>
              <p className="text-sm font-bold text-powder-600 dark:text-powder-400">{taskMetrics.inProgress}</p>
            </div>
            <div>
              <span className="text-[11px] text-slate-400">Completed</span>
              <p className="text-sm font-bold text-mint-600 dark:text-mint-400">{taskMetrics.completed}</p>
            </div>
          </div>
        </div>

        {/* Chart 4: Priority Breakdown Bar */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Tasks by Priority
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Workload density by urgency level
            </p>
          </div>

          <div className="h-52 w-full my-2">
            {taskMetrics.total === 0 || loading ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No task data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={priorityBarData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip unit="tasks" />} />
                  <Bar dataKey="count" name="Tasks" radius={[6, 6, 0, 0]}>
                    {priorityBarData.map((entry, index) => (
                      <Cell key={`p-cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-4 gap-1 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-center text-xs">
            <div>
              <span className="text-[10px] text-slate-400">Low</span>
              <p className="font-bold text-slate-600 dark:text-slate-400">{taskMetrics.byPriority.LOW || 0}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400">Medium</span>
              <p className="font-bold text-sky-600 dark:text-sky-400">{taskMetrics.byPriority.MEDIUM || 0}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400">High</span>
              <p className="font-bold text-amber-600 dark:text-amber-400">{taskMetrics.byPriority.HIGH || 0}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400">Urgent</span>
              <p className="font-bold text-rose-600 dark:text-rose-400">{taskMetrics.byPriority.URGENT || 0}</p>
            </div>
          </div>
        </div>

        {/* Card 5: Productivity Insights & Habits */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Productivity Insights
              </h2>
              <div className="w-8 h-8 rounded-xl bg-mint-50 dark:bg-mint-950/60 text-mint-600 dark:text-mint-400 flex items-center justify-center">
                <Flame className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              Calculated from your historical study cadence
            </p>
          </div>

          <div className="space-y-4 my-4">
            {/* Most Productive Day */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs">
              <div className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4 text-powder-600 dark:text-powder-400" />
                <span className="text-slate-600 dark:text-slate-400">Peak Day</span>
              </div>
              <span className="font-bold text-slate-900 dark:text-white">
                {productivityMetrics.mostProductiveDay}
              </span>
            </div>

            {/* Velocity Trend */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs">
              <div className="flex items-center gap-2.5">
                <TrendingUp className="w-4 h-4 text-mint-600 dark:text-mint-400" />
                <span className="text-slate-600 dark:text-slate-400">Momentum</span>
              </div>
              <div>{renderTrendBadge(productivityMetrics.productivityTrend)}</div>
            </div>

            {/* Velocity Average */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs">
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span className="text-slate-600 dark:text-slate-400">Completion Pace</span>
              </div>
              <span className="font-bold text-slate-900 dark:text-white">
                {productivityMetrics.tasksCompletedPerDay} tasks / day
              </span>
            </div>
          </div>

          {/* Goal Progress Pill */}
          <div className="p-3 rounded-2xl bg-powder-50/60 dark:bg-powder-950/40 border border-powder-200/80 dark:border-powder-900/60 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-powder-600 dark:text-powder-400" />
              <span className="font-semibold text-powder-900 dark:text-powder-200">
                {goalMetrics.active} Active Goal{goalMetrics.active === 1 ? '' : 's'}
              </span>
            </div>
            <span className="font-bold text-powder-700 dark:text-powder-300">
              {goalMetrics.avgProgress}% avg progress
            </span>
          </div>
        </div>
      </div>

      {/* ── 4. Estimated vs. Actual Time Section ─────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Estimation Accuracy (Time Estimations vs. Actuals)
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              Aggregated from tasks with specified estimates and completed time-tracking sessions
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-md bg-powder-500" />
              <span className="text-slate-500 dark:text-slate-400">
                Estimated: <strong>{timeMetrics.estimatedVsActual.totalEstimatedMinutes} mins</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-md bg-mint-500" />
              <span className="text-slate-500 dark:text-slate-400">
                Actual: <strong>{timeMetrics.estimatedVsActual.totalActualMinutes} mins</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Progress Comparison */}
        <div className="mt-5 space-y-3">
          {timeMetrics.estimatedVsActual.totalEstimatedMinutes === 0 &&
          timeMetrics.estimatedVsActual.totalActualMinutes === 0 ? (
            <p className="text-xs text-slate-400 italic py-2">
              No tasks with estimates have logged time yet. Add estimated minutes when creating tasks to see estimation accuracy.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
                <span>
                  {timeMetrics.estimatedVsActual.isOverEstimate
                    ? `Over estimate by ${Math.abs(timeMetrics.estimatedVsActual.differenceMinutes)} minutes`
                    : `Under estimate by ${Math.abs(timeMetrics.estimatedVsActual.differenceMinutes)} minutes remaining`}
                </span>
                <span>
                  {timeMetrics.estimatedVsActual.totalEstimatedMinutes > 0
                    ? `${Math.round(
                        (timeMetrics.estimatedVsActual.totalActualMinutes /
                          timeMetrics.estimatedVsActual.totalEstimatedMinutes) *
                          100
                      )}% of estimate spent`
                    : '100%'}
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden flex">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    timeMetrics.estimatedVsActual.isOverEstimate ? 'bg-amber-500' : 'bg-mint-500'
                  }`}
                  style={{
                    width: `${Math.min(
                      100,
                      timeMetrics.estimatedVsActual.totalEstimatedMinutes > 0
                        ? Math.round(
                            (timeMetrics.estimatedVsActual.totalActualMinutes /
                              timeMetrics.estimatedVsActual.totalEstimatedMinutes) *
                              100
                          )
                        : 100
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Analytics;
