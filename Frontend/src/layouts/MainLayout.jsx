import React, { useState, useEffect } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * MainLayout (Phase 1)
 * 
 * Why this file exists:
 * Global shell with navigation header and responsive footer.
 * In Phase 1, it adapts navigation options based on AuthContext state:
 * - Logged-out: Shows Home, Login, Sign Up
 * - Logged-in:  Shows Dashboard, User Name, systemRole badge, and Logout
 * Includes Powder Blue + Mint theme accents and light/dark theme toggle.
 */
const MainLayout = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  // Dark mode state
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('studyflow_theme') === 'dark';
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('studyflow_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('studyflow_theme', 'light');
    }
  }, [darkMode]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-200">
      {/* Navigation Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-powder-500 to-powder-700 flex items-center justify-center text-white font-extrabold shadow-sm group-hover:scale-105 transition">
                SF
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Study<span className="text-powder-600 dark:text-powder-400">Flow</span>
              </span>
            </Link>
            <span className="hidden sm:inline-block px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-powder-700 dark:text-powder-300 bg-powder-100 dark:bg-powder-950/60 rounded-full border border-powder-200 dark:border-powder-800">
              Phase 1: Auth
            </span>
          </div>

          {/* Navigation Links & User Actions */}
          <nav className="flex items-center gap-2 sm:gap-4">
            {/* Theme Toggle Button */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              aria-label="Toggle dark theme"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              {darkMode ? (
                <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <NavLink
                  to="/dashboard"
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                      isActive
                        ? 'bg-powder-100 dark:bg-powder-900/60 text-powder-700 dark:text-powder-300'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`
                  }
                >
                  Dashboard
                </NavLink>

                {/* User Pill */}
                <div className="hidden md:flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {user?.name}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-powder-100 dark:bg-powder-900/60 text-powder-700 dark:text-powder-300">
                    {user?.systemRole}
                  </span>
                </div>

                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <NavLink
                  to="/"
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                      isActive
                        ? 'bg-powder-50 dark:bg-powder-900/60 text-powder-700 dark:text-powder-300'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`
                  }
                >
                  Home
                </NavLink>
                <NavLink
                  to="/login"
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                      isActive
                        ? 'bg-powder-50 dark:bg-powder-900/60 text-powder-700 dark:text-powder-300'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`
                  }
                >
                  Login
                </NavLink>
                <NavLink
                  to="/signup"
                  className="px-3.5 py-1.5 rounded-xl text-sm font-medium bg-powder-600 hover:bg-powder-700 text-white shadow-sm transition"
                >
                  Sign Up
                </NavLink>
              </div>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
        <p>StudyFlow &copy; {new Date().getFullYear()} &mdash; Phase 1: Authentication &amp; System Role Foundation</p>
      </footer>
    </div>
  );
};

export default MainLayout;
