import React from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';

/**
 * MainLayout
 * 
 * Why this file exists:
 * Provides a unified structure (Navbar, container, and footer) across the application.
 * Using React Router's <Outlet />, pages are rendered inside this layout shell without
 * duplicating navigation and layout logic on every screen.
 */
const MainLayout = () => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* Navigation Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-sm">
              SF
            </div>
            <Link to="/" className="text-xl font-bold tracking-tight text-slate-900 hover:text-blue-600 transition">
              StudyFlow
            </Link>
            <span className="ml-2 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-blue-700 bg-blue-100 rounded-full">
              Phase 0
            </span>
          </div>

          <nav className="flex items-center gap-1 sm:gap-4">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  isActive ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`
              }
            >
              Home
            </NavLink>
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  isActive ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`
              }
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/login"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  isActive ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`
              }
            >
              Login
            </NavLink>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-sm text-slate-500">
        <p>StudyFlow &copy; {new Date().getFullYear()} &mdash; Phase 0: MERN Foundation & Architecture</p>
      </footer>
    </div>
  );
};

export default MainLayout;
