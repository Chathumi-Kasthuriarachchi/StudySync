import React from 'react';
import { Timer, Sparkles, Play } from 'lucide-react';

/**
 * Focus Mode Page (Phase 2 Navigation Placeholder)
 * 
 * Future Phase: Pomodoro timer, ambient sounds, deep-work session logging.
 */
const Focus = () => {
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Focus Mode
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-mint-100 dark:bg-mint-950/60 text-mint-700 dark:text-mint-300">
              <Sparkles className="w-3.5 h-3.5" />
              Zen Space
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Eliminate distractions with timed study intervals and deep work sessions.
          </p>
        </div>
      </div>

      {/* Main Empty State Placeholder */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center shadow-xs">
        <div className="w-16 h-16 rounded-2xl bg-mint-50 dark:bg-mint-950/60 text-mint-600 dark:text-mint-400 flex items-center justify-center mx-auto mb-4 border border-mint-100 dark:border-mint-900/60">
          <Timer className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Deep Work & Focus Timer
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
          The customizable Pomodoro timer, ambient soundscapes, and focus streak tracker will be introduced in subsequent phases.
        </p>

        <div className="inline-flex items-center gap-2 mt-6 px-3 py-1.5 rounded-full text-xs font-semibold bg-mint-50 dark:bg-mint-950/60 text-mint-700 dark:text-mint-300 border border-mint-200 dark:border-mint-800">
          <Play className="w-3.5 h-3.5 text-mint-600" />
          Phase 2 Navigation Shell Active
        </div>
      </div>
    </div>
  );
};

export default Focus;
