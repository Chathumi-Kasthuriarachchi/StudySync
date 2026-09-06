import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Home Page (Phase 1)
 */
const Home = () => {
  const { isAuthenticated, user } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4 sm:px-6">
      <div className="max-w-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-powder-700 dark:text-powder-300 bg-powder-100 dark:bg-powder-950/60 rounded-full mb-6 border border-powder-200 dark:border-powder-800">
          <span className="w-1.5 h-1.5 rounded-full bg-mint-500"></span>
          Phase 1: Authentication &amp; System RBAC
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4 leading-tight">
          Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-powder-600 to-mint-500">StudyFlow</span>
        </h1>

        <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed mb-8">
          A smart productivity and task management platform built on the MERN stack.
          Secure JWT authentication with bcrypt hashing, system-level authorization
          (<code>ADMIN</code> vs <code>USER</code>), and client session restoration.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-powder-600 hover:bg-powder-700 text-white font-medium shadow-sm transition flex items-center justify-center gap-2"
            >
              <span>Go to Your Dashboard ({user?.name})</span>
              <span>&rarr;</span>
            </Link>
          ) : (
            <>
              <Link
                to="/signup"
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-powder-600 hover:bg-powder-700 text-white font-medium shadow-sm transition"
              >
                Create an Account &rarr;
              </Link>
              <Link
                to="/login"
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-sm"
              >
                Sign In to Existing Account
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;
