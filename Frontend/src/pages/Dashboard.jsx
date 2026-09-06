import React, { useState, useEffect } from 'react';
import api from '../services/api';

/**
 * Dashboard Page (Phase 0)
 * 
 * Why this file exists:
 * In Phase 0, the Dashboard acts as the primary integration verification point between
 * the React frontend and Express backend. It calls GET /api/health through the centralized
 * Axios instance (`services/api.js`) to verify end-to-end communication before complex features
 * are built.
 */
const Dashboard = () => {
  const [status, setStatus] = useState('loading'); // 'loading' | 'connected' | 'error'
  const [healthData, setHealthData] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [lastChecked, setLastChecked] = useState(null);

  const checkBackendHealth = async () => {
    setStatus('loading');
    setErrorMessage('');
    try {
      // React -> Axios -> GET /api/health -> Express
      const response = await api.get('/api/health');
      setHealthData(response.data);
      setStatus('connected');
      setLastChecked(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Backend health check failed:', err);
      setStatus('error');
      setErrorMessage(err.response?.data?.message || err.message || 'Unable to connect to backend server');
      setLastChecked(new Date().toLocaleTimeString());
    }
  };

  useEffect(() => {
    checkBackendHealth();
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            Phase 0 Foundation &amp; Architecture Verification
          </p>
        </div>

        <button
          onClick={checkBackendHealth}
          className="mt-3 sm:mt-0 inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition shadow-sm"
        >
          Re-test Connection
        </button>
      </div>

      {/* Backend Status Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3.5 w-3.5">
              {status === 'connected' && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-3.5 w-3.5 ${
                  status === 'connected'
                    ? 'bg-emerald-500'
                    : status === 'loading'
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-rose-500'
                }`}
              ></span>
            </span>
            <h2 className="text-lg font-semibold text-slate-800">Backend Status:</h2>
          </div>

          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
              status === 'connected'
                ? 'bg-emerald-100 text-emerald-800'
                : status === 'loading'
                ? 'bg-amber-100 text-amber-800'
                : 'bg-rose-100 text-rose-800'
            }`}
          >
            {status === 'connected' ? 'Connected' : status === 'loading' ? 'Checking...' : 'Disconnected'}
          </span>
        </div>

        {/* Live response details */}
        <div className="mt-6 pt-4 border-t border-slate-100">
          {status === 'loading' && (
            <p className="text-sm text-slate-500 italic">Testing connection to backend API via Axios...</p>
          )}

          {status === 'connected' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Response received from <code>GET /api/health</code></span>
                <span>Last tested: {lastChecked}</span>
              </div>
              <pre className="p-3 bg-slate-900 text-emerald-400 text-xs rounded-lg overflow-x-auto font-mono">
                {JSON.stringify(healthData, null, 2)}
              </pre>
            </div>
          )}

          {status === 'error' && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
              <p className="font-medium">Connection Error</p>
              <p className="text-xs mt-1">{errorMessage}</p>
              <p className="text-xs mt-2 text-rose-600">
                Verify that the Express server is running on <code>http://localhost:5000</code>.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Architecture Data Flow Explanation Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-base font-semibold text-slate-900 mb-3">How this request traveled through the system</h3>
        <ol className="space-y-2 text-sm text-slate-600 list-decimal list-inside">
          <li><strong>React Component:</strong> <code>Dashboard.jsx</code> mounts and triggers <code>checkBackendHealth()</code>.</li>
          <li><strong>Axios Instance:</strong> <code>services/api.js</code> formats a <code>GET</code> request with configured base URL.</li>
          <li><strong>Network / CORS:</strong> The request targets <code>http://localhost:5000/api/health</code>. Express CORS middleware verifies the origin.</li>
          <li><strong>Express Route:</strong> The endpoint executes <code>app.get('/api/health')</code>.</li>
          <li><strong>Response:</strong> Express returns JSON with HTTP status <code>200 OK</code>.</li>
          <li><strong>State &amp; UI:</strong> React updates local state (<code>setStatus('connected')</code>), re-rendering this green indicator badge.</li>
        </ol>
      </div>
    </div>
  );
};

export default Dashboard;
