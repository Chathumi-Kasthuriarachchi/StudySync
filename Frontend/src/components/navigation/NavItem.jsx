import React from 'react';
import { NavLink } from 'react-router-dom';

/**
 * NavItem
 * 
 * Reusable navigation link component for the StudySync workspace sidebar.
 * Uses react-router-dom's NavLink to automatically detect active route matching.
 * Handles both expanded and collapsed sidebar states with accessible tooltips.
 */
const NavItem = ({
  to,
  icon: Icon,
  label,
  badge,
  isCollapsed,
  onClick,
  end = false,
}) => {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      title={isCollapsed ? label : undefined}
      aria-label={label}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-powder-400 select-none ${
          isActive
            ? 'bg-powder-50 dark:bg-powder-950/50 text-powder-700 dark:text-powder-300 font-semibold shadow-xs'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
        } ${isCollapsed ? 'justify-center px-0 w-11 h-11 mx-auto' : ''}`
      }
    >
      {({ isActive }) => (
        <>
          {/* Active Accent Indicator Bar */}
          {isActive && (
            <span
              className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-powder-500 dark:bg-powder-400 transition-all ${
                isCollapsed ? 'hidden' : 'block'
              }`}
            />
          )}

          {/* Icon */}
          <div
            className={`flex items-center justify-center transition-colors ${
              isActive
                ? 'text-powder-600 dark:text-powder-400'
                : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200'
            }`}
          >
            {Icon && <Icon className="w-5 h-5 shrink-0" />}
          </div>

          {/* Label Text (hidden when sidebar is collapsed) */}
          {!isCollapsed && (
            <span className="flex-1 truncate tracking-tight">{label}</span>
          )}

          {/* Optional Badge */}
          {!isCollapsed && badge && (
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full transition ${
                isActive
                  ? 'bg-powder-200/80 dark:bg-powder-900 text-powder-800 dark:text-powder-300'
                  : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {badge}
            </span>
          )}

          {/* Collapsed Tooltip (shows on hover in collapsed mode) */}
          {isCollapsed && (
            <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-900 text-white text-xs font-medium rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-md">
              {label}
            </div>
          )}
        </>
      )}
    </NavLink>
  );
};

export default NavItem;
