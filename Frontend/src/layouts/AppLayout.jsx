import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import TopBar from '../components/layout/TopBar';

/**
 * AppLayout
 * 
 * Reusable layout shell for all authenticated pages in StudySync.
 * Structure:
 * Authenticated User -> ProtectedRoute -> AppLayout
 *   ├── Sidebar (permanent, responsive, collapsible)
 *   └── Main Area
 *         ├── TopBar (sticky page title, notifications, avatar, theme toggle)
 *         └── Main Content Area (<Outlet />)
 * 
 * Why this layout exists:
 * Prevents duplicating sidebar and topbar inside individual pages.
 * Ensures the workspace structure remains persistent while only the main content re-renders during navigation.
 */
const AppLayout = () => {
  // Desktop sidebar collapsed state
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('studysync_sidebar_collapsed') === 'true';
  });

  // Mobile drawer open state
  const [mobileOpen, setMobileOpen] = useState(false);

  // Dark mode state
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

  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('studysync_sidebar_collapsed', String(next));
      return next;
    });
  };

  const handleToggleTheme = () => {
    setDarkMode((prev) => !prev);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col overflow-x-hidden transition-colors duration-200">
      {/* Permanent Workspace Sidebar */}
      <Sidebar
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Main Workspace Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'lg:pl-20' : 'lg:pl-64'
        }`}
      >
        {/* Top Navigation Bar */}
        <TopBar
          onOpenMobile={() => setMobileOpen(true)}
          isCollapsed={isCollapsed}
          onToggleCollapse={handleToggleCollapse}
          darkMode={darkMode}
          onToggleTheme={handleToggleTheme}
        />

        {/* Dynamic Page Viewport */}
        <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
