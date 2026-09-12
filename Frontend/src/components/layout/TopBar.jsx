import React from 'react';
import { useLocation } from 'react-router-dom';
import {
  Menu,
  Sun,
  Moon,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../notifications/NotificationBell';

/**
 * Page titles map based on current pathname
 */
const ROUTE_TITLES = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Overview & daily focus' },
  '/tasks': { title: 'My Tasks', subtitle: 'Organize and track your action items' },
  '/projects': { title: 'Projects', subtitle: 'Workspaces and team deliverables' },
  '/goals': { title: 'Goals & Milestones', subtitle: 'Outcomes, progress metrics & deliverables' },
  '/calendar': { title: 'Calendar', subtitle: 'Schedule and upcoming deadlines' },
  '/focus': { title: 'Focus Mode', subtitle: 'Deep work & distraction-free sessions' },
  '/analytics': { title: 'Analytics', subtitle: 'Productivity metrics & progress trends' },
  '/notifications': { title: 'Notifications', subtitle: 'Alerts, updates, assignments & mentions' },
  '/profile': { title: 'Profile', subtitle: 'Personal information & account credentials' },
  '/settings': { title: 'Settings', subtitle: 'Preferences, workspace & theme settings' },
};

/**
 * TopBar
 * 
 * Top navigation bar for authenticated pages.
 * Displays:
 * 1. Mobile menu toggle button (☰).
 * 2. Desktop collapse toggle shortcut.
 * 3. Dynamic current page title & context.
 * 4. Actions cluster: Notification placeholder, theme toggle, and user avatar.
 */
const TopBar = ({
  onOpenMobile,
  isCollapsed,
  onToggleCollapse,
  darkMode,
  onToggleTheme,
}) => {
  const { user } = useAuth();
  const location = useLocation();

  const currentRoute = ROUTE_TITLES[location.pathname] || {
    title: 'Workspace',
    subtitle: 'StudySync platform',
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header className="h-16 sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
        {/* Left Side: Navigation Triggers & Page Title */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile Hamburger Toggle Button */}
          <button
            onClick={onOpenMobile}
            className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition focus-visible:ring-2 focus-visible:ring-powder-400"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Desktop Quick Toggle Icon */}
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="w-5 h-5" />
            ) : (
              <PanelLeftClose className="w-5 h-5" />
            )}
          </button>

          {/* Current Page Title & Subtitle */}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                {currentRoute.title}
              </h1>
              {location.pathname === '/focus' && (
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-mint-100 dark:bg-mint-950/60 text-mint-700 dark:text-mint-300">
                  <Sparkles className="w-3 h-3 text-mint-500" />
                  Zen
                </span>
              )}
            </div>
            <p className="hidden md:block text-xs text-slate-500 dark:text-slate-400 truncate">
              {currentRoute.subtitle}
            </p>
          </div>
        </div>

        {/* Right Side: Quick Actions, Theme Toggle, Notification Placeholder & Avatar */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Theme Toggle Button */}
          <button
            onClick={onToggleTheme}
            aria-label="Toggle dark theme"
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            {darkMode ? (
              <Sun className="w-5 h-5 text-amber-400" />
            ) : (
              <Moon className="w-5 h-5 text-slate-600" />
            )}
          </button>

          {/* Notifications Bell with Popover Dropdown */}
          <NotificationBell />

          {/* User Quick Info */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
            <div className="w-8 h-8 rounded-xl bg-powder-100 dark:bg-powder-900/60 text-powder-700 dark:text-powder-300 font-bold flex items-center justify-center text-xs border border-powder-200 dark:border-powder-800/60 shadow-xs">
              {getInitials(user?.name)}
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-semibold text-slate-900 dark:text-white leading-tight">
                {user?.name || 'User'}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 capitalize">
                {user?.systemRole?.toLowerCase() || 'member'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
