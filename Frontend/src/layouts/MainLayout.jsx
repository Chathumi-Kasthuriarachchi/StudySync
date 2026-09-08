import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import PublicNavbar from '../components/layout/PublicNavbar';

/**
 * MainLayout
 * 
 * Layout shell for public and authentication pages (Home, Login, Signup).
 * Features the dedicated PublicNavbar with 3-section layout, smooth scrolling,
 * theme toggle, and responsive mobile navigation.
 */
const MainLayout = () => {
  const location = useLocation();

  // Dark mode state synchronized with localStorage
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('studysync_theme') === 'dark';
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('studysync_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('studysync_theme', 'light');
    }
  }, [darkMode]);

  const handleToggleTheme = () => {
    setDarkMode((prev) => !prev);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-200">
      {/* Public Top Navigation Bar */}
      <PublicNavbar darkMode={darkMode} onToggleTheme={handleToggleTheme} />

      {/* Main Content Viewport */}
      <main
        className={
          ['/', '/login', '/signup'].includes(location.pathname)
            ? 'flex-1 w-full relative flex flex-col'
            : 'flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8'
        }
      >
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
        <p>StudySync &copy; {new Date().getFullYear()} &mdash; Smart Productivity &amp; Task Management</p>
      </footer>
    </div>
  );
};

export default MainLayout;
