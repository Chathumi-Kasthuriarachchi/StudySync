import React from 'react';

/**
 * Connection Status Badge — Phase 16 & 17
 * Displays real-time Socket.IO connection state with subtle, accessible styling.
 */
const ConnectionBadge = ({ status, className = '' }) => {
  const configs = {
    connected: {
      dot: 'bg-emerald-500',
      label: 'Connected',
      className: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40',
    },
    connecting: {
      dot: 'bg-amber-500 animate-pulse',
      label: 'Reconnecting...',
      className: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/40',
    },
    disconnected: {
      dot: 'bg-rose-500',
      label: 'Offline',
      className: 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/40',
    },
  };

  const config = configs[status] || configs.disconnected;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${config.className} transition-all duration-200 shrink-0 ${className}`}
      title={`Connection: ${config.label}`}
      role="status"
      aria-label={`Socket status: ${config.label}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  );
};

export default ConnectionBadge;
