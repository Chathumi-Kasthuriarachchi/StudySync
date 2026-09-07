import React from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Calendar Page (Phase 2 Navigation Placeholder)
 * 
 * Future Phase: Interactive calendar view, study schedule, deadline milestones.
 */
const Calendar = () => {
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Calendar
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Visual calendar for assignments, exam dates, and study milestones.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 px-2">
            Today
          </span>
          <button
            type="button"
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Empty State Placeholder */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center shadow-xs">
        <div className="w-16 h-16 rounded-2xl bg-powder-50 dark:bg-powder-950/60 text-powder-600 dark:text-powder-400 flex items-center justify-center mx-auto mb-4 border border-powder-100 dark:border-powder-900/60">
          <CalendarIcon className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Calendar & Schedule
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
          Interactive calendar timelines, due date sync, and event integration will be implemented in future phases.
        </p>

        <div className="inline-flex items-center gap-2 mt-6 px-3 py-1.5 rounded-full text-xs font-semibold bg-powder-50 dark:bg-powder-950/60 text-powder-700 dark:text-powder-300 border border-powder-200 dark:border-powder-800">
          <span className="w-2 h-2 rounded-full bg-mint-500"></span>
          Phase 2 Navigation Shell Active
        </div>
      </div>
    </div>
  );
};

export default Calendar;
