import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * Registration Page (Phase 1)
 * 
 * Why this file exists:
 * Allows new users to create an account.
 * Key Architectural Constraints:
 * 1. No role selection field is exposed (systemRole strictly defaults to 'USER').
 * 2. Frontend input validation (passwords match, minimum 6 characters) enhances UX,
 *    while the backend enforces strict independent validation.
 */
const Signup = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Frontend validation checks
    if (!name.trim() || !email.trim() || !password) {
      setError('Please fill in all required fields');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setIsSubmitting(true);
      await register(name.trim(), email.trim(), password);
      navigate('/dashboard');
    } catch (err) {
      console.error('Registration failed:', err);
      setError(
        err.response?.data?.message ||
        err.message ||
        'Registration failed. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-8 transition-colors">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-powder-100 dark:bg-powder-900/40 text-powder-700 dark:text-powder-300 mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-powder-500"></span>
          Create Your Account
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          Join StudySync
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Start organizing your productivity journey
        </p>
      </div>

      {/* Role Notice */}
      <div className="mb-6 p-3 rounded-lg bg-mint-50 dark:bg-mint-950/40 border border-mint-200 dark:border-mint-800/50 text-xs text-mint-800 dark:text-mint-300 flex items-start gap-2">
        <svg className="w-4 h-4 mt-0.5 shrink-0 text-mint-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>
          <strong>Role Assignment:</strong> All accounts register with default standard <code>USER</code> privileges.
        </span>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm flex items-center gap-2 animate-shake">
          <svg className="w-4 h-4 shrink-0 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
            Full Name
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Alex Rivera"
            className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-powder-500 transition"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
            Email Address
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="alex@example.com"
            className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-powder-500 transition"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
            Password (min. 6 characters)
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-powder-500 transition"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
            Confirm Password
          </label>
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-powder-500 transition"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full mt-2 py-3 px-4 rounded-xl bg-powder-600 hover:bg-powder-700 active:bg-powder-800 text-white font-medium text-sm transition shadow-sm hover:shadow flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Creating Account...</span>
            </>
          ) : (
            <span>Create Account</span>
          )}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 text-center text-sm text-slate-500 dark:text-slate-400">
        Already have an account?{' '}
        <Link
          to="/login"
          className="font-semibold text-powder-600 hover:text-powder-700 dark:text-powder-400 dark:hover:text-powder-300 transition"
        >
          Sign In &rarr;
        </Link>
      </div>
    </div>
  );
};

export default Signup;