import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Login Page (Placeholder for Phase 0)
 * 
 * Why this file exists:
 * Verifies that client-side route "/login" is registered and works without activating
 * complex authentication logic prematurely. Real authentication (JWT, bcrypt, session)
 * will be integrated in Phase 1.
 */
const Login = () => {
  return (
    <div className="max-w-md mx-auto my-12 bg-white rounded-xl border border-slate-200 shadow-sm p-8">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Sign in to StudyFlow</h1>
        <p className="text-sm text-slate-500 mt-1">
          Authentication features will be activated in Phase 1
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
            Email Address (Mock)
          </label>
          <input
            type="email"
            disabled
            placeholder="user@example.com"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-400 cursor-not-allowed text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
            Password (Mock)
          </label>
          <input
            type="password"
            disabled
            placeholder="••••••••"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-400 cursor-not-allowed text-sm"
          />
        </div>

        <button
          disabled
          className="w-full py-2.5 px-4 rounded-lg bg-slate-200 text-slate-400 font-medium text-sm cursor-not-allowed mt-2"
        >
          Sign In (Disabled in Phase 0)
        </button>

        <div className="pt-4 border-t border-slate-100 text-center">
          <Link
            to="/dashboard"
            className="text-sm font-medium text-blue-600 hover:text-blue-700 transition"
          >
            &larr; Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;