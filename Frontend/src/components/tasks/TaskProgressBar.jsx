import React from 'react';
import { CheckCircle2 } from 'lucide-react';

/**
 * TaskProgressBar
 *
 * Visual progress bar component with automatic subtask completion counting,
 * percentage display, and dynamic gradient styling.
 *
 * @param {Object} props
 * @param {number} [props.progress] - Optional direct progress percentage (0-100)
 * @param {Array} [props.subtasks] - Optional array of subtasks [{ completed: boolean, ... }]
 * @param {string} [props.status] - Optional task status ('TODO', 'IN_PROGRESS', 'COMPLETED')
 * @param {'xs' | 'sm' | 'md' | 'lg'} [props.size='md'] - Bar height/size
 * @param {boolean} [props.showPercentage=true] - Whether to show the percentage badge/label
 * @param {boolean} [props.showSubtaskCount=true] - Whether to display "X/Y subtasks" if subtasks exist
 * @param {string} [props.className=''] - Additional container classes
 */
const TaskProgressBar = ({
  progress,
  subtasks = [],
  status,
  size = 'md',
  showPercentage = true,
  showSubtaskCount = true,
  className = '',
}) => {
  // Calculate percentage
  let pct = 0;
  const hasSubtasks = Array.isArray(subtasks) && subtasks.length > 0;
  const totalSubtasks = hasSubtasks ? subtasks.length : 0;
  const completedSubtasks = hasSubtasks
    ? subtasks.filter((st) => st.completed).length
    : 0;

  if (typeof progress === 'number') {
    pct = Math.min(100, Math.max(0, Math.round(progress)));
  } else if (hasSubtasks) {
    pct = Math.round((completedSubtasks / totalSubtasks) * 100);
  } else if (status === 'COMPLETED') {
    pct = 100;
  } else if (status === 'IN_PROGRESS') {
    pct = 50;
  } else {
    pct = 0;
  }

  // Height definitions
  const sizeClasses = {
    xs: 'h-1.5',
    sm: 'h-2',
    md: 'h-2.5',
    lg: 'h-3.5',
  };

  // Gradient styles based on progress
  let fillGradient = 'from-powder-500 to-powder-600';
  let badgeColor = 'text-powder-700 dark:text-powder-300 bg-powder-50 dark:bg-powder-950/60 border-powder-200 dark:border-powder-800';

  if (pct === 100) {
    fillGradient = 'from-mint-500 to-emerald-500';
    badgeColor = 'text-mint-700 dark:text-mint-300 bg-mint-50 dark:bg-mint-950/60 border-mint-200 dark:border-mint-800';
  } else if (pct >= 50) {
    fillGradient = 'from-powder-500 to-mint-400';
    badgeColor = 'text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 border-sky-200 dark:border-sky-800';
  } else if (pct > 0) {
    fillGradient = 'from-indigo-500 to-powder-500';
    badgeColor = 'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800';
  }

  return (
    <div className={`w-full ${className}`}>
      {/* Header Info */}
      {(showPercentage || (showSubtaskCount && hasSubtasks)) && (
        <div className="flex items-center justify-between mb-1.5 text-xs">
          {showSubtaskCount && hasSubtasks ? (
            <span className="font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1">
              {pct === 100 ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-mint-500" />
              ) : null}
              {completedSubtasks} of {totalSubtasks} subtasks completed
            </span>
          ) : (
            <span className="font-medium text-slate-500 dark:text-slate-400">Progress</span>
          )}

          {showPercentage && (
            <span
              className={`px-1.5 py-0.5 rounded-md text-[11px] font-semibold border ${badgeColor}`}
            >
              {pct}%
            </span>
          )}
        </div>
      )}

      {/* Progress Track */}
      <div
        className={`w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200/60 dark:border-slate-700/60 shadow-inner`}
      >
        <div
          className={`rounded-full bg-gradient-to-r ${fillGradient} ${
            sizeClasses[size] || sizeClasses.md
          } transition-all duration-500 ease-out shadow-sm`}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin="0"
          aria-valuemax="100"
        />
      </div>
    </div>
  );
};

export default TaskProgressBar;
