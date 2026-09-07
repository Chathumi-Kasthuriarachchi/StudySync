import React from 'react';
import { BarChart3, TrendingUp } from 'lucide-react';

/**
 * Analytics Page (Phase 2 Navigation Placeholder)
 * 
 * Future Phase: Productivity statistics, completion rates, study velocity.
 */
const Analytics = () => {
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Productivity Analytics
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Review your weekly focus hours, task completion trends, and study metrics.
        </p>
      </div>

      {/* Main Empty State Placeholder */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center shadow-xs">
        <div className="w-16 h-16 rounded-2xl bg-powder-50 dark:bg-powder-950/60 text-powder-600 dark:text-powder-400 flex items-center justify-center mx-auto mb-4 border border-powder-100 dark:border-powder-900/60">
          <BarChart3 className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Metrics & Insights
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
          Productivity charts, task completion percentages, and study velocity metrics will be powered by real task and focus data in upcoming phases.
        </p>

        <div className="inline-flex items-center gap-2 mt-6 px-3 py-1.5 rounded-full text-xs font-semibold bg-powder-50 dark:bg-powder-950/60 text-powder-700 dark:text-powder-300 border border-powder-200 dark:border-powder-800">
          <TrendingUp className="w-3.5 h-3.5 text-powder-600" />
          Phase 2 Navigation Shell Active
        </div>
      </div>
    </div>
  );
};

export default Analytics;
