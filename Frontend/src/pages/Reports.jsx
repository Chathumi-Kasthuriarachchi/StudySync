import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Download,
  Calendar,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Users,
  FolderKanban,
  CheckSquare,
  RefreshCw,
  Layers,
  Shield,
  FileSpreadsheet,
  FileType,
  Sparkles,
} from 'lucide-react';
import {
  getPersonalReport,
  getProjectReport,
  getTeamReport,
  getTaskDetailReport,
  downloadReportExport,
} from '../services/reportService';
import { getProjects } from '../services/projectService';
import toast from 'react-hot-toast';

const REPORT_TYPES = [
  { id: 'personal', label: 'Personal Productivity', icon: CheckSquare, desc: 'Your completion rates, subtasks, and focus time' },
  { id: 'project', label: 'Project Report', icon: FolderKanban, desc: 'Project milestones, task velocity, and timeline status' },
  { id: 'team', label: 'Team Report', icon: Users, desc: 'Team member workload distribution and contribution' },
  { id: 'tasks', label: 'Task Details', icon: Layers, desc: 'Detailed task audit with priorities, dates, and tracked time' },
];

const PERIOD_OPTIONS = [
  { key: 'this_month', label: 'This Month' },
  { key: 'this_week', label: 'This Week' },
  { key: 'last_30_days', label: 'Last 30 Days' },
  { key: 'all', label: 'All Time' },
];

const Reports = () => {
  const [activeReport, setActiveReport] = useState('personal');
  const [period, setPeriod] = useState('this_month');
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [viewerForbidden, setViewerForbidden] = useState(false);

  // Fetch projects for dropdown
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const res = await getProjects();
        if (res.success && res.data) {
          setProjects(res.data);
          if (res.data.length > 0 && !selectedProject) {
            setSelectedProject(res.data[0]._id);
          }
        }
      } catch (err) {
        console.error('Failed to load projects for reports:', err);
      }
    };
    loadProjects();
  }, []);

  // Fetch report data
  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setViewerForbidden(false);

      if (activeReport === 'personal') {
        const res = await getPersonalReport({ period });
        if (res.success) setReportData(res.data);
      } else if (activeReport === 'project') {
        if (!selectedProject) {
          setReportData(null);
          setLoading(false);
          return;
        }
        const res = await getProjectReport(selectedProject, { period });
        if (res.success) setReportData(res.data);
      } else if (activeReport === 'team') {
        if (!selectedProject) {
          setReportData(null);
          setLoading(false);
          return;
        }
        try {
          const res = await getTeamReport(selectedProject, { period });
          if (res.success) setReportData(res.data);
        } catch (teamErr) {
          if (teamErr.response?.status === 403) {
            setViewerForbidden(true);
            setReportData(null);
          } else {
            throw teamErr;
          }
        }
      } else if (activeReport === 'tasks') {
        const params = {
          period,
          scope: selectedProject || 'all',
          status: statusFilter === 'ALL' ? undefined : statusFilter,
          priority: priorityFilter === 'ALL' ? undefined : priorityFilter,
        };
        const res = await getTaskDetailReport(params);
        if (res.success) setReportData(res.data);
      }
    } catch (err) {
      console.error('fetchReport error:', err);
      setError(err.response?.data?.message || 'Failed to generate report preview');
      setReportData(null);
    } finally {
      setLoading(false);
    }
  }, [activeReport, period, selectedProject, statusFilter, priorityFilter]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Export handlers
  const handleExport = async (format) => {
    try {
      setExporting(true);
      const params = {
        period,
        projectId: selectedProject,
        scope: selectedProject || 'all',
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        priority: priorityFilter === 'ALL' ? undefined : priorityFilter,
      };

      await downloadReportExport(activeReport, format, params);
      toast.success(`${format.toUpperCase()} report downloaded successfully!`);
    } catch (err) {
      console.error('Export error:', err);
      toast.error(err.response?.data?.message || `Failed to export ${format.toUpperCase()}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-16">
      {/* ── 1. Page Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-powder-50 dark:bg-powder-950/60 text-powder-600 dark:text-powder-400 flex items-center justify-center border border-powder-100 dark:border-powder-900/60 shadow-2xs">
              <FileText className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Reports & Exports
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Generate and export customized productivity, project, team, and task reports.
          </p>
        </div>

        {/* Action Buttons: Export CSV & PDF */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleExport('csv')}
            disabled={loading || exporting || !reportData}
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-40"
          >
            <FileSpreadsheet className="w-4 h-4 text-mint-600" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => handleExport('pdf')}
            disabled={loading || exporting || !reportData}
            className="px-3.5 py-2 rounded-xl bg-powder-600 hover:bg-powder-700 text-white text-xs font-semibold shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-40"
          >
            <FileType className="w-4 h-4 text-white" />
            <span>Export PDF</span>
          </button>

          <button
            type="button"
            onClick={fetchReport}
            disabled={loading}
            title="Refresh Report"
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-powder-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── 2. Report Type Selector Grid ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {REPORT_TYPES.map((type) => {
          const Icon = type.icon;
          const isSelected = activeReport === type.id;
          return (
            <button
              key={type.id}
              type="button"
              onClick={() => setActiveReport(type.id)}
              className={`p-4 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'border-powder-500 bg-powder-50/40 dark:bg-powder-950/20 shadow-xs'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    isSelected
                      ? 'bg-powder-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                {isSelected && (
                  <span className="w-2 h-2 rounded-full bg-powder-500 animate-pulse" />
                )}
              </div>
              <div>
                <h3
                  className={`text-sm font-bold ${
                    isSelected
                      ? 'text-powder-900 dark:text-powder-200'
                      : 'text-slate-900 dark:text-white'
                  }`}
                >
                  {type.label}
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 line-clamp-2">
                  {type.desc}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── 3. Filters Toolbar ───────────────────────────────────────────── */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold text-slate-500 uppercase tracking-wider text-[11px]">
            <Filter className="w-3.5 h-3.5" />
            <span>Filters:</span>
          </div>

          {/* Project selector (shown for project, team, and task reports) */}
          {(activeReport === 'project' || activeReport === 'team' || activeReport === 'tasks') && (
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Project:</span>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold text-slate-700 dark:text-slate-200 focus:outline-powder-500"
              >
                {activeReport === 'tasks' && <option value="">All Projects & Personal</option>}
                {projects.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Period dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Period:</span>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold text-slate-700 dark:text-slate-200 focus:outline-powder-500"
            >
              {PERIOD_OPTIONS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status & Priority filters (for Task Details report) */}
          {activeReport === 'tasks' && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold text-slate-700 dark:text-slate-200 focus:outline-powder-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="TODO">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-500">Priority:</span>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold text-slate-700 dark:text-slate-200 focus:outline-powder-500"
                >
                  <option value="ALL">All Priorities</option>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
            </>
          )}
        </div>

        <span className="text-slate-400 text-[11px]">
          Live preview updates automatically
        </span>
      </div>

      {/* ── 4. Error / Permissions Alert ─────────────────────────────────── */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {viewerForbidden && (
        <div className="p-5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-3">
          <Shield className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <span className="font-bold block text-sm mb-0.5">Permission Notice</span>
            Detailed Team Workload & individual performance metrics are reserved for Project Members, Managers, and Owners.
          </div>
        </div>
      )}

      {/* ── 5. Live Report Preview Area ──────────────────────────────────── */}
      {loading ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-3">
          <RefreshCw className="w-6 h-6 text-powder-600 animate-spin mx-auto" />
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
            Aggregating report data and calculating statistics...
          </p>
        </div>
      ) : reportData ? (
        <div className="space-y-6">
          {/* Executive Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {activeReport === 'personal' && (
              <>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-xs">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Completion</span>
                  <p className="text-xl font-extrabold text-mint-600 mt-1">{reportData.summary.completionPercentage}%</p>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-xs">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Total Tasks</span>
                  <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">{reportData.summary.totalTasks}</p>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-xs">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Completed</span>
                  <p className="text-xl font-extrabold text-powder-600 mt-1">{reportData.summary.completedTasks}</p>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-xs">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Overdue</span>
                  <p className={`text-xl font-extrabold mt-1 ${reportData.summary.overdueTasks > 0 ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`}>
                    {reportData.summary.overdueTasks}
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-xs">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Subtasks Done</span>
                  <p className="text-xl font-extrabold text-indigo-600 mt-1">{reportData.summary.subtaskCompletionRate}%</p>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-xs">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Focus Time</span>
                  <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">{reportData.summary.totalTrackedHours}h</p>
                </div>
              </>
            )}

            {activeReport === 'project' && (
              <>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-xs">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Progress</span>
                  <p className="text-xl font-extrabold text-mint-600 mt-1">{reportData.summary.completionPercentage}%</p>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-xs">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Status</span>
                  <p className="text-sm font-bold text-powder-600 mt-2 truncate">{reportData.project.status}</p>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-xs">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Total Tasks</span>
                  <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">{reportData.summary.totalTasks}</p>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-xs">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Completed</span>
                  <p className="text-xl font-extrabold text-powder-600 mt-1">{reportData.summary.completedTasks}</p>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-xs">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Members</span>
                  <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">{reportData.summary.totalMembers}</p>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-xs">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Time Logged</span>
                  <p className="text-xl font-extrabold text-indigo-600 mt-1">{reportData.summary.totalProjectTrackedHours}h</p>
                </div>
              </>
            )}

            {activeReport === 'team' && (
              <>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-xs">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Team Members</span>
                  <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">{reportData.summary.totalMembers}</p>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-xs">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Project Tasks</span>
                  <p className="text-xl font-extrabold text-powder-600 mt-1">{reportData.summary.totalProjectTasks}</p>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-xs">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Unassigned</span>
                  <p className={`text-xl font-extrabold mt-1 ${reportData.summary.unassignedTasks > 0 ? 'text-amber-600' : 'text-slate-900 dark:text-white'}`}>
                    {reportData.summary.unassignedTasks}
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-xs col-span-3 sm:col-span-1 lg:col-span-3">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Team Hours Spent</span>
                  <p className="text-xl font-extrabold text-mint-600 mt-1">{reportData.summary.totalProjectTrackedHours}h</p>
                </div>
              </>
            )}

            {activeReport === 'tasks' && (
              <>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-xs">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Total Tasks</span>
                  <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">{reportData.summary.totalTasks}</p>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-xs">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Completed</span>
                  <p className="text-xl font-extrabold text-mint-600 mt-1">{reportData.summary.completedCount}</p>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-xs">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">In Progress</span>
                  <p className="text-xl font-extrabold text-powder-600 mt-1">{reportData.summary.inProgressCount}</p>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-xs">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">To Do</span>
                  <p className="text-xl font-extrabold text-slate-500 mt-1">{reportData.summary.todoCount}</p>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-xs">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Overdue</span>
                  <p className={`text-xl font-extrabold mt-1 ${reportData.summary.overdueCount > 0 ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`}>
                    {reportData.summary.overdueCount}
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-xs">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Time Tracked</span>
                  <p className="text-xl font-extrabold text-indigo-600 mt-1">{reportData.summary.totalTrackedHours}h</p>
                </div>
              </>
            )}
          </div>

          {/* Detailed Preview Table */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  {reportData.title}
                </span>
                <span className="text-xs text-slate-400">
                  ({reportData.tasks?.length || reportData.members?.length || 0} records)
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              {activeReport === 'team' ? (
                /* Team Workload Table */
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Member</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Active Tasks</th>
                      <th className="py-3 px-4">Assigned</th>
                      <th className="py-3 px-4">Completed</th>
                      <th className="py-3 px-4">Overdue</th>
                      <th className="py-3 px-4">Completion %</th>
                      <th className="py-3 px-4">Workload Signal</th>
                      <th className="py-3 px-4">Time Spent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {reportData.members?.map((m) => (
                      <tr key={m.member._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                          {m.member.name}
                          <span className="block text-[11px] text-slate-400 font-normal">{m.member.email}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-500">{m.member.role}</td>
                        <td className="py-3 px-4 font-bold text-powder-600">{m.activeTasks}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{m.assignedTasks}</td>
                        <td className="py-3 px-4 text-mint-600 font-semibold">{m.completedTasks}</td>
                        <td className={`py-3 px-4 font-semibold ${m.overdueTasks > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                          {m.overdueTasks}
                        </td>
                        <td className="py-3 px-4 font-bold">{m.completionRate}%</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            m.workloadSignal === 'HIGH' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' :
                            m.workloadSignal === 'MODERATE' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' :
                            'bg-mint-50 text-mint-700 dark:bg-mint-950/60 dark:text-mint-300'
                          }`}>
                            {m.workloadLabel}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{m.trackedMinutes}m</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                /* Task Level Table for Personal, Project, and Task reports */
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Task</th>
                      {activeReport !== 'personal' && <th className="py-3 px-4">Assignee</th>}
                      {activeReport === 'personal' && <th className="py-3 px-4">Context</th>}
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Priority</th>
                      <th className="py-3 px-4">Due Date</th>
                      <th className="py-3 px-4">Subtasks</th>
                      <th className="py-3 px-4">Time Spent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {reportData.tasks?.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                          No tasks match the selected report filter.
                        </td>
                      </tr>
                    ) : (
                      reportData.tasks?.map((t) => (
                        <tr key={t._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white max-w-xs truncate">
                            {t.title}
                          </td>
                          {activeReport !== 'personal' && (
                            <td className="py-3 px-4 text-slate-500">{t.assigneeName || 'Unassigned'}</td>
                          )}
                          {activeReport === 'personal' && (
                            <td className="py-3 px-4 text-slate-500">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                t.type === 'PROJECT' ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                              }`}>
                                {t.type}
                              </span>
                            </td>
                          )}
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              t.status === 'COMPLETED' ? 'bg-mint-50 text-mint-700 dark:bg-mint-950/60 dark:text-mint-300' :
                              t.status === 'IN_PROGRESS' ? 'bg-powder-50 text-powder-700 dark:bg-powder-950/60 dark:text-powder-300' :
                              'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            }`}>
                              {t.status}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`font-semibold ${
                              t.priority === 'URGENT' ? 'text-rose-600' :
                              t.priority === 'HIGH' ? 'text-amber-600' :
                              t.priority === 'MEDIUM' ? 'text-sky-600' : 'text-slate-400'
                            }`}>
                              {t.priority}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {t.dueDate ? (
                              <span className={t.isOverdue ? 'text-rose-600 font-bold' : 'text-slate-500'}>
                                {new Date(t.dueDate).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-500">
                            {t.subtasksCount ? `${t.subtasksCompleted}/${t.subtasksCount}` : '—'}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                            {t.trackedMinutes ? `${t.trackedMinutes}m` : '0m'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center">
          <p className="text-xs text-slate-400">Select a report and filter to view data.</p>
        </div>
      )}
    </div>
  );
};

export default Reports;
