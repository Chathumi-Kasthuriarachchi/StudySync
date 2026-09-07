import React from 'react';
import { CheckSquare, Plus, Filter, Search } from 'lucide-react';

/**
 * Tasks Page (Phase 2 Navigation Placeholder)
 * 
 * Future Phase: Task CRUD, subtasks, priorities, and filtering.
 */
const Tasks = () => {
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            My Tasks
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Organize, prioritize, and track your action items.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-4 py-2 rounded-xl bg-powder-600 hover:bg-powder-700 text-white text-sm font-semibold shadow-xs transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar Placeholder */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 px-3 py-1.5 w-full sm:w-72 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60 text-slate-400">
          <Search className="w-4 h-4" />
          <span className="text-xs">Search tasks...</span>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filter</span>
          </button>
        </div>
      </div>

      {/* Main Empty State Placeholder */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center shadow-xs">
        <div className="w-16 h-16 rounded-2xl bg-powder-50 dark:bg-powder-950/60 text-powder-600 dark:text-powder-400 flex items-center justify-center mx-auto mb-4 border border-powder-100 dark:border-powder-900/60">
          <CheckSquare className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Task Management Workspace
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
          This page is a navigation shell placeholder for Phase 2. Task creation, subtasks, deadline scheduling, and smart prioritization will be introduced in subsequent phases.
        </p>

        <div className="inline-flex items-center gap-2 mt-6 px-3 py-1.5 rounded-full text-xs font-semibold bg-powder-50 dark:bg-powder-950/60 text-powder-700 dark:text-powder-300 border border-powder-200 dark:border-powder-800">
          <span className="w-2 h-2 rounded-full bg-mint-500"></span>
          Phase 2 Navigation Shell Active
        </div>
      </div>
    </div>
  );
};

export default Tasks;
