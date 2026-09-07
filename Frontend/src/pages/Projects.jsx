import React from 'react';
import { FolderKanban, Plus, Layers } from 'lucide-react';

/**
 * Projects Page (Phase 2 Navigation Placeholder)
 * 
 * Future Phase: Project workspaces, team collaboration, member roles.
 */
const Projects = () => {
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Projects
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Group your tasks into study modules, sprints, and group projects.
          </p>
        </div>

        <button
          type="button"
          className="px-4 py-2 rounded-xl bg-powder-600 hover:bg-powder-700 text-white text-sm font-semibold shadow-xs transition flex items-center gap-2 w-fit"
        >
          <Plus className="w-4 h-4" />
          <span>New Project</span>
        </button>
      </div>

      {/* Main Empty State Placeholder */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center shadow-xs">
        <div className="w-16 h-16 rounded-2xl bg-mint-50 dark:bg-mint-950/60 text-mint-600 dark:text-mint-400 flex items-center justify-center mx-auto mb-4 border border-mint-100 dark:border-mint-900/60">
          <FolderKanban className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Projects & Workspaces
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
          Project creation, project database models, and workspace permissions (Owner, Manager, Member, Viewer) will be developed in dedicated project phases.
        </p>

        <div className="inline-flex items-center gap-2 mt-6 px-3 py-1.5 rounded-full text-xs font-semibold bg-mint-50 dark:bg-mint-950/60 text-mint-700 dark:text-mint-300 border border-mint-200 dark:border-mint-800">
          <Layers className="w-3.5 h-3.5" />
          Phase 2 Navigation Shell Active
        </div>
      </div>
    </div>
  );
};

export default Projects;
