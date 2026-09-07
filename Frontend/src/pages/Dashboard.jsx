import React, { useState, useEffect } from 'react';
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
  ShieldAlert,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

/**
 * Dashboard (Phase 2: Productivity Shell & Overview)
 * 
 * Establishes the visual and functional foundation for the StudySync workspace:
 * 1. User greeting personalized with dynamic time-of-day greeting.
 * 2. Productivity overview stat cards (My Tasks, Due Today, Completed).
 * 3. Structured placeholder sections for Recent Activity, Upcoming Tasks, and Quick Actions.
 * 4. Phase 1 System Role (RBAC) check test & Phase 0 health check preserved in a clean collapsible developer drawer.
 */
const Dashboard = () => {
  const { user } = useAuth();

  // Admin authorization check test state (Phase 1)
  const [adminCheckResult, setAdminCheckResult] = useState(null);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(false);
  const [showDevPanel, setShowDevPanel] = useState(false);

  // Backend health status state (Phase 0)
  const [healthStatus, setHealthStatus] = useState('loading');
  const [healthData, setHealthData] = useState(null);

  const checkHealth = async () => {
    try {
      const res = await api.get('/api/health');
      setHealthData(res.data);
      setHealthStatus('connected');
    } catch {
      setHealthStatus('error');
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const testAdminAccess = async () => {
    setIsCheckingAdmin(true);
    setAdminCheckResult(null);
    try {
      const response = await api.get('/api/auth/admin-check');
      setAdminCheckResult({
        status: 'success',
        statusCode: 200,
        message: response.data.message || 'Admin authorization granted',
        data: response.data.data,
      });
    } catch (err) {
      setAdminCheckResult({
        status: 'error',
        statusCode: err.response?.status || 500,
        message:
          err.response?.data?.message ||
          'Forbidden: You do not have system-level ADMIN privileges',
      });
    } finally {
      setIsCheckingAdmin(false);
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

  return (
    <div className="space-y-8 animate-fadeIn">
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
            Here's your productivity overview for today. Stay focused, track your goals, and manage your studies seamlessly.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <Link
            to="/tasks"
            className="px-4 py-2.5 rounded-xl bg-white text-powder-800 hover:bg-powder-50 text-sm font-semibold transition shadow-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4 text-powder-600" />
            <span>Go to Tasks</span>
          </Link>
          <Link
            to="/focus"
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-medium transition backdrop-blur-sm flex items-center gap-2"
          >
            <Flame className="w-4 h-4 text-mint-300" />
            <span>Start Focus</span>
          </Link>
        </div>
      </div>

      {/* 2. Productivity Metric Stat Cards (Placeholders as specified) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Card 1: My Tasks */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs hover:border-powder-300 dark:hover:border-powder-800 transition group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              My Tasks
            </span>
            <div className="w-9 h-9 rounded-xl bg-powder-50 dark:bg-powder-950/60 text-powder-600 dark:text-powder-400 flex items-center justify-center">
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              0
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              tasks assigned
            </span>
          </div>
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 group-hover:text-powder-600 dark:group-hover:text-powder-400 transition">
            <Link to="/tasks" className="flex items-center gap-1">
              <span>View all tasks</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Card 2: Due Today */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs hover:border-amber-300 dark:hover:border-amber-800 transition group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Due Today
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              0
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              items remaining
            </span>
          </div>
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition">
            <Link to="/calendar" className="flex items-center gap-1">
              <span>Check schedule</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Card 3: Completed */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs hover:border-mint-300 dark:hover:border-mint-800 transition group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Completed
            </span>
            <div className="w-9 h-9 rounded-xl bg-mint-50 dark:bg-mint-950/60 text-mint-600 dark:text-mint-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              0
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              finished this week
            </span>
          </div>
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 group-hover:text-mint-600 dark:group-hover:text-mint-400 transition">
            <Link to="/analytics" className="flex items-center gap-1">
              <span>View analytics</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* 3. Main Workspace Grid: Recent Activity, Upcoming Tasks, Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Upcoming Tasks & Recent Activity */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upcoming Tasks Section Placeholder */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-powder-600 dark:text-powder-400" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Upcoming Tasks
                </h2>
              </div>
              <Link
                to="/tasks"
                className="text-xs font-medium text-powder-600 dark:text-powder-400 hover:underline"
              >
                Go to Tasks
              </Link>
            </div>

            {/* Clean Placeholder Empty State */}
            <div className="py-8 px-4 text-center rounded-xl bg-slate-50/70 dark:bg-slate-950/40 border border-dashed border-slate-200 dark:border-slate-800">
              <div className="w-10 h-10 rounded-full bg-powder-50 dark:bg-powder-950/60 text-powder-600 dark:text-powder-400 flex items-center justify-center mx-auto mb-2">
                <CheckSquare className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No tasks scheduled for today
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                Task management and prioritization will be enabled in subsequent project phases.
              </p>
            </div>
          </div>

          {/* Recent Activity Section Placeholder */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-mint-600 dark:text-mint-400" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Recent Activity
                </h2>
              </div>
              <span className="text-xs text-slate-400 dark:text-slate-500">Live feed</span>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/60 dark:bg-slate-800/30">
                <div className="w-2 h-2 rounded-full bg-mint-500 mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                    Session authenticated successfully
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Authenticated with system role: <span className="font-semibold text-powder-600">{user?.systemRole || 'USER'}</span>
                  </p>
                </div>
                <span className="text-[10px] text-slate-400">Just now</span>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/60 dark:bg-slate-800/30">
                <div className="w-2 h-2 rounded-full bg-powder-500 mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                    Phase 2 Workspace shell activated
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Sidebar, TopBar and routing hierarchy established.
                  </p>
                </div>
                <span className="text-[10px] text-slate-400">Today</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Column: Quick Actions & Workspace Info */}
        <div className="space-y-6">
          {/* Quick Actions Panel */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-3">
              Quick Actions
            </h2>
            <div className="grid grid-cols-1 gap-2.5">
              <Link
                to="/tasks"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-powder-50 dark:hover:bg-powder-950/40 border border-slate-200/70 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 hover:text-powder-700 dark:hover:text-powder-300 transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-powder-100 dark:bg-powder-900/60 text-powder-600 dark:text-powder-300 flex items-center justify-center">
                    <CheckSquare className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold">New Task</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link
                to="/projects"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-powder-50 dark:hover:bg-powder-950/40 border border-slate-200/70 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 hover:text-powder-700 dark:hover:text-powder-300 transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-mint-100 dark:bg-mint-900/60 text-mint-600 dark:text-mint-300 flex items-center justify-center">
                    <Plus className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold">Create Project</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link
                to="/focus"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-mint-50 dark:hover:bg-mint-950/40 border border-slate-200/70 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 hover:text-mint-700 dark:hover:text-mint-300 transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-mint-100 dark:bg-mint-900/60 text-mint-600 dark:text-mint-300 flex items-center justify-center">
                    <Flame className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold">Focus Timer</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>

          {/* User Account Overview Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
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
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  isAdmin
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                    : 'bg-mint-100 text-mint-800 dark:bg-mint-950/60 dark:text-mint-300'
                }`}>
                  {user?.systemRole}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Email</span>
                <span className="font-mono text-slate-700 dark:text-slate-300 truncate max-w-[150px]">{user?.email}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Collapsible Developer & RBAC Check Panel (Preserving Phase 0 & Phase 1 tests cleanly) */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        <button
          onClick={() => setShowDevPanel((prev) => !prev)}
          className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
        >
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-4 h-4 text-powder-600 dark:text-powder-400" />
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              System Health & RBAC Diagnostics (Phases 0 & 1)
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <span className="text-xs">
              {showDevPanel ? 'Hide diagnostics' : 'Show diagnostics'}
            </span>
            {showDevPanel ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </div>
        </button>

        {showDevPanel && (
          <div className="p-6 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 dark:bg-slate-950/30">
            {/* RBAC Card */}
            <div className="space-y-3 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  System Role Authorization Test
                </h3>
                <span className="text-xs font-mono font-bold text-powder-600">
                  {user?.systemRole}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Tests the system-level protected route <code>GET /api/auth/admin-check</code>.
              </p>
              <button
                onClick={testAdminAccess}
                disabled={isCheckingAdmin}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold transition disabled:opacity-60"
              >
                {isCheckingAdmin ? 'Testing...' : 'Test GET /api/auth/admin-check'}
              </button>
              {adminCheckResult && (
                <div
                  className={`p-3 rounded-xl border text-xs ${
                    adminCheckResult.status === 'success'
                      ? 'bg-mint-50 dark:bg-mint-950/40 border-mint-200 dark:border-mint-800 text-mint-900 dark:text-mint-200'
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                  }`}
                >
                  <p className="font-semibold">
                    HTTP {adminCheckResult.statusCode}: {adminCheckResult.message}
                  </p>
                </div>
              )}
            </div>

            {/* Health Card */}
            <div className="space-y-3 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Backend API & Database (Phase 0)
                </h3>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    healthStatus === 'connected'
                      ? 'bg-mint-100 text-mint-800 dark:bg-mint-900/50 dark:text-mint-300'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {healthStatus}
                </span>
              </div>
              <pre className="p-2.5 bg-slate-900 text-mint-400 text-[11px] rounded-lg overflow-x-auto font-mono">
                {JSON.stringify(healthData || { status: 'checking...' }, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
