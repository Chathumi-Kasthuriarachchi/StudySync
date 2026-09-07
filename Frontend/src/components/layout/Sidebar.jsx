import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CheckSquare,
  FolderKanban,
  Calendar,
  Timer,
  BarChart3,
  User,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import NavItem from '../navigation/NavItem';

/**
 * Sidebar
 * 
 * Permanent workspace sidebar navigation for authenticated users.
 * Supports:
 * 1. Desktop expanded / collapsed modes with smooth CSS transitions.
 * 2. Mobile drawer mode with backdrop blur overlay and close button.
 * 3. Role-aware navigation indicators (ADMIN vs USER).
 * 4. User profile pill and Phase 1 logout integration.
 */
const Sidebar = ({
  isCollapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
    if (onCloseMobile) onCloseMobile();
  };

  const handleNavClick = () => {
    if (mobileOpen && onCloseMobile) {
      onCloseMobile();
    }
  };

  // Extract initials for the avatar
  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const isAdmin = user?.systemRole === 'ADMIN';

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 ease-in-out ${
          // Desktop sizing
          isCollapsed ? 'lg:w-20' : 'lg:w-64'
        } ${
          // Mobile slide-in positioning
          mobileOpen
            ? 'translate-x-0 w-72 shadow-2xl'
            : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Header / Brand Area */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100 dark:border-slate-800/80">
          <Link
            to="/dashboard"
            onClick={handleNavClick}
            className={`flex items-center gap-3 group overflow-hidden ${
              isCollapsed ? 'justify-center w-full' : ''
            }`}
          >
            {/* Brand Logo Icon */}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-powder-600 via-powder-500 to-mint-400 flex items-center justify-center text-white font-extrabold shadow-sm shrink-0 transition-transform group-hover:scale-105">
              <span className="text-sm tracking-tighter">SS</span>
            </div>

            {/* Brand Name (hidden when collapsed on desktop) */}
            <div
              className={`flex flex-col transition-opacity duration-200 ${
                isCollapsed ? 'lg:hidden' : 'block'
              }`}
            >
              <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
                Study<span className="text-powder-600 dark:text-powder-400">Sync</span>
              </span>
              <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Workspace
              </span>
            </div>
          </Link>

          {/* Mobile Close Button */}
          <button
            onClick={onCloseMobile}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
            aria-label="Close navigation drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin">
          {/* Main Workspace Section */}
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Workspace
              </div>
            )}
            <NavItem
              to="/dashboard"
              icon={LayoutDashboard}
              label="Dashboard"
              isCollapsed={isCollapsed}
              onClick={handleNavClick}
              end
            />
            <NavItem
              to="/tasks"
              icon={CheckSquare}
              label="My Tasks"
              isCollapsed={isCollapsed}
              onClick={handleNavClick}
            />
            <NavItem
              to="/projects"
              icon={FolderKanban}
              label="Projects"
              isCollapsed={isCollapsed}
              onClick={handleNavClick}
            />
            <NavItem
              to="/calendar"
              icon={Calendar}
              label="Calendar"
              isCollapsed={isCollapsed}
              onClick={handleNavClick}
            />
            <NavItem
              to="/focus"
              icon={Timer}
              label="Focus Mode"
              isCollapsed={isCollapsed}
              onClick={handleNavClick}
            />
          </div>

          {/* Insights Section */}
          <div className="space-y-1">
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80" />
            {!isCollapsed && (
              <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Insights
              </div>
            )}
            <NavItem
              to="/analytics"
              icon={BarChart3}
              label="Analytics"
              isCollapsed={isCollapsed}
              onClick={handleNavClick}
            />
          </div>

          {/* Account Section */}
          <div className="space-y-1">
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80" />
            {!isCollapsed && (
              <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Account & Preferences
              </div>
            )}
            <NavItem
              to="/profile"
              icon={User}
              label="Profile"
              isCollapsed={isCollapsed}
              onClick={handleNavClick}
            />
            <NavItem
              to="/settings"
              icon={Settings}
              label="Settings"
              isCollapsed={isCollapsed}
              onClick={handleNavClick}
            />
          </div>

          {/* Role Awareness: Admin Notice (clean visual badge) */}
          {isAdmin && !isCollapsed && (
            <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Admin Privileges Active</span>
            </div>
          )}
        </div>

        {/* Footer: User Profile Card & Desktop Collapse Toggle */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
          {/* User Profile Snippet */}
          <div
            className={`flex items-center gap-3 p-2 rounded-xl transition ${
              isCollapsed ? 'justify-center p-0 mb-3' : 'mb-2'
            }`}
          >
            {/* Avatar */}
            <div
              className="w-9 h-9 rounded-xl bg-powder-100 dark:bg-powder-900/60 text-powder-700 dark:text-powder-300 font-bold flex items-center justify-center text-xs shrink-0 border border-powder-200 dark:border-powder-800/60"
              title={user?.name || 'User'}
            >
              {getInitials(user?.name)}
            </div>

            {/* User Meta (hidden in collapsed mode on desktop) */}
            <div
              className={`flex-1 min-w-0 ${
                isCollapsed ? 'lg:hidden' : 'block'
              }`}
            >
              <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                {user?.name || 'Chathumi'}
              </p>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                  {user?.email || 'user@studysync.local'}
                </span>
                <span
                  className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded ${
                    isAdmin
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                      : 'bg-mint-100 text-mint-800 dark:bg-mint-900/50 dark:text-mint-300'
                  }`}
                >
                  {user?.systemRole || 'USER'}
                </span>
              </div>
            </div>
          </div>

          {/* Logout Action */}
          <button
            onClick={handleLogout}
            title={isCollapsed ? 'Logout' : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition ${
              isCollapsed ? 'justify-center px-0' : ''
            }`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span className={isCollapsed ? 'lg:hidden' : 'block'}>Logout</span>
          </button>

          {/* Desktop Collapse / Expand Toggle Button */}
          <div className="hidden lg:flex items-center justify-end mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
            <button
              onClick={onToggleCollapse}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="w-full flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/60 transition"
            >
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <>
                  <ChevronLeft className="w-4 h-4" />
                  <span className="text-[11px] font-medium">Collapse</span>
                </>
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
