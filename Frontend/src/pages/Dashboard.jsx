import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

/**
 * Dashboard (Phase 1: Authenticated & Protected)
 * 
 * Why this file exists:
 * The primary workspace for authenticated users. In Phase 1, it demonstrates:
 * 1. User identification: greeting, email, and systemRole (USER vs ADMIN).
 * 2. System-Level RBAC test: an interactive button testing `GET /api/auth/admin-check`.
 *    Standard users receive a 403 Forbidden alert, while Admins receive a 200 OK alert.
 * 3. Logout action.
 * 4. System health check from Phase 0.
 */
const Dashboard = () => {
  const { user, logout } = useAuth();

  // Admin authorization check test state
  const [adminCheckResult, setAdminCheckResult] = useState(null);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(false);

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

  const isAdmin = user?.systemRole === 'ADMIN';

  return (
    <div className="space-y-6">
      {/* User Greeting & Header Banner */}
      <div className="bg-gradient-to-r from-powder-600 via-powder-700 to-powder-900 rounded-2xl p-6 sm:p-8 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-white/20 backdrop-blur-sm text-white mb-3">
            <span className="w-2 h-2 rounded-full bg-mint-400 animate-pulse"></span>
            Authenticated Session Active
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Welcome, {user?.name || 'User'}!
          </h1>
          <p className="text-powder-100 text-sm mt-1">
            Logged in as <span className="font-mono text-white underline">{user?.email}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={logout}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-medium transition backdrop-blur-sm"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Grid: Role & RBAC Card + System Health Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: System-Level Role & Authorization Foundation */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              System-Level Role (RBAC)
            </h2>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                isAdmin
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                  : 'bg-powder-100 text-powder-800 dark:bg-powder-950/60 dark:text-powder-300 border border-powder-300 dark:border-powder-700'
              }`}
            >
              {user?.systemRole || 'USER'}
            </span>
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Your account possesses the <code className="font-bold text-powder-600 dark:text-powder-400">{user?.systemRole}</code> system role.
            {isAdmin ? (
              <span> You have full system-level administrative access.</span>
            ) : (
              <span> Standard users cannot execute admin endpoints. This separation forms the foundation for project-level roles in later phases.</span>
            )}
          </p>

          {/* RBAC Live Test Button */}
          <div className="pt-2">
            <button
              onClick={testAdminAccess}
              disabled={isCheckingAdmin}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-60"
            >
              {isCheckingAdmin ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  <span>Testing Authorization...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span>Test Admin Endpoint (GET /api/auth/admin-check)</span>
                </>
              )}
            </button>
          </div>

          {/* Admin Check Result Banner */}
          {adminCheckResult && (
            <div
              className={`p-4 rounded-xl border text-sm animate-fadeIn ${
                adminCheckResult.status === 'success'
                  ? 'bg-mint-50 dark:bg-mint-950/40 border-mint-200 dark:border-mint-800 text-mint-900 dark:text-mint-200'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
              }`}
            >
              <div className="flex items-center justify-between font-semibold mb-1">
                <span>
                  {adminCheckResult.status === 'success' ? '✓ Access Granted' : '✕ Access Denied (Expected for USER)'}
                </span>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-black/10 dark:bg-white/10">
                  HTTP {adminCheckResult.statusCode}
                </span>
              </div>
              <p className="text-xs opacity-90">{adminCheckResult.message}</p>
            </div>
          )}
        </div>

        {/* Card 2: Backend Health & System Info (Phase 0) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Backend Health Status
            </h2>
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                healthStatus === 'connected'
                  ? 'bg-mint-100 text-mint-800 dark:bg-mint-950/60 dark:text-mint-300'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {healthStatus === 'connected' ? 'Connected' : 'Error'}
            </span>
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-400">
            MERN foundation check: MongoDB Atlas + Express REST API on <code>http://localhost:5000</code>.
          </p>

          <pre className="p-3 bg-slate-900 text-mint-400 text-xs rounded-xl overflow-x-auto font-mono">
            {JSON.stringify(healthData || { status: 'checking...' }, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
