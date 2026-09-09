import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckSquare,
  Search,
  Filter,
  Calendar,
  AlertCircle,
  Clock,
  User,
  CheckCircle2,
  Circle,
  Tag,
  ArrowUpDown,
  FolderKanban,
  ChevronRight,
  TrendingUp,
  RefreshCw,
  Sparkles,
  Plus,
} from 'lucide-react';
import { getMyTasks, updateTaskStatus } from '../services/taskService';
import CreateTaskModal from '../components/tasks/CreateTaskModal';
import TaskDetailsModal, {
  getPriorityBadge,
  getTaskStatusBadge,
} from '../components/tasks/TaskDetailsModal';
import TaskProgressBar from '../components/tasks/TaskProgressBar';

const Tasks = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Filters & sorting
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL' | 'PERSONAL' | 'PROJECT'
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'TODO' | 'IN_PROGRESS' | 'COMPLETED'
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('dueDate'); // 'dueDate' | 'priority' | 'createdAt'

  // ── Fetch Assigned & Personal Tasks ─────────────────────────────────────────
  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await getMyTasks();
      if (res.success) {
        setTasks(res.data || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load your tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // ── Quick Status Toggle ─────────────────────────────────────────────────────
  const handleQuickStatusToggle = async (e, task) => {
    e.stopPropagation();

    let nextStatus = 'TODO';
    if (task.status === 'TODO') nextStatus = 'IN_PROGRESS';
    else if (task.status === 'IN_PROGRESS') nextStatus = 'COMPLETED';
    else if (task.status === 'COMPLETED') nextStatus = 'TODO';

    // Subtask completion guard
    if (nextStatus === 'COMPLETED' && task.subtasks?.length > 0 && task.subtasks.some((s) => !s.completed)) {
      setError(`Cannot mark "${task.title}" as completed: all subtasks must be completed first.`);
      return;
    }

    try {
      // Optimistic local update
      setTasks((prev) =>
        prev.map((t) => (t._id === task._id ? { ...t, status: nextStatus } : t))
      );
      const res = await updateTaskStatus(task._id, nextStatus);
      if (res.success && res.data) {
        setTasks((prev) =>
          prev.map((t) => (t._id === task._id ? res.data : t))
        );
        setError('');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update task status');
      fetchTasks();
    }
  };

  // ── Modal Handlers ──────────────────────────────────────────────────────────
  const handleTaskCreated = (newTask) => {
    setTasks((prev) => [newTask, ...prev]);
  };

  const handleTaskUpdated = (updatedTask) => {
    setTasks((prev) =>
      prev.map((t) => (t._id === updatedTask._id ? updatedTask : t))
    );
    setSelectedTask(updatedTask);
  };

  const handleTaskDeleted = (deletedTaskId) => {
    setTasks((prev) => prev.filter((t) => t._id !== deletedTaskId));
    setIsDetailsOpen(false);
    setSelectedTask(null);
  };

  const openTaskDetails = (task) => {
    setSelectedTask(task);
    setIsDetailsOpen(true);
  };

  // ── Unique Projects list for dropdown ───────────────────────────────────────
  const uniqueProjects = useMemo(() => {
    const map = new Map();
    tasks.forEach((t) => {
      if (t.project?._id && !map.has(t.project._id)) {
        map.set(t.project._id, t.project.name || 'Untitled Project');
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [tasks]);

  // ── Metrics Calculation ─────────────────────────────────────────────────────
  const totalTasks = tasks.length;
  const personalTasksCount = tasks.filter((t) => !t.project).length;
  const projectTasksCount = tasks.filter((t) => Boolean(t.project)).length;

  const completedTasks = tasks.filter((t) => t.status === 'COMPLETED').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const todoTasks = tasks.filter((t) => t.status === 'TODO').length;
  const completionPercentage =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // ── Filtered and Sorted Tasks ───────────────────────────────────────────────
  const filteredTasks = useMemo(() => {
    return tasks
      .filter((task) => {
        // Type filter
        if (typeFilter === 'PERSONAL' && task.project) return false;
        if (typeFilter === 'PROJECT' && !task.project) return false;

        // Status filter
        if (statusFilter !== 'ALL' && task.status !== statusFilter) return false;

        // Priority filter
        if (priorityFilter !== 'ALL' && task.priority !== priorityFilter)
          return false;

        // Project filter
        if (projectFilter !== 'ALL') {
          if (projectFilter === 'PERSONAL') {
            if (task.project) return false;
          } else if (task.project?._id !== projectFilter) {
            return false;
          }
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = task.title?.toLowerCase().includes(q);
          const matchDesc = task.description?.toLowerCase().includes(q);
          const matchProj = task.project?.name?.toLowerCase().includes(q);
          const matchTag = task.tags?.some((t) => t.toLowerCase().includes(q));
          if (!matchTitle && !matchDesc && !matchProj && !matchTag) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'dueDate') {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate) - new Date(b.dueDate);
        }
        if (sortBy === 'priority') {
          const pOrder = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
          return (pOrder[b.priority] || 0) - (pOrder[a.priority] || 0);
        }
        if (sortBy === 'createdAt') {
          return new Date(b.createdAt) - new Date(a.createdAt);
        }
        return 0;
      });
  }, [tasks, typeFilter, statusFilter, priorityFilter, projectFilter, searchQuery, sortBy]);

  const isOverdue = (task) => {
    if (!task.dueDate || task.status === 'COMPLETED') return false;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = new Date(task.dueDate);
    due.setHours(0, 0, 0, 0);
    return due < now;
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            My Tasks
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track and complete all personal tasks and project assignments in one unified workspace.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/projects"
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs transition flex items-center gap-1.5"
          >
            <FolderKanban className="w-3.5 h-3.5 text-powder-600 dark:text-powder-400" />
            <span>Go to Projects</span>
          </Link>

          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2 rounded-xl bg-powder-600 hover:bg-powder-700 active:bg-powder-800 text-white text-xs font-semibold shadow-xs transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* ── Error Banner ────────────────────────────────────────────────────── */}
      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center justify-between gap-3 text-rose-700 dark:text-rose-300 text-xs shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError('')}
            className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-200 font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Metric Banner ───────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-powder-600 dark:text-powder-400">
                Productivity Overview
              </span>
              <span className="text-[11px] font-semibold px-2 py-0.2 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                {personalTasksCount} Personal
              </span>
              <span className="text-[11px] font-semibold px-2 py-0.2 rounded-md bg-powder-50 dark:bg-powder-950/60 text-powder-700 dark:text-powder-300 border border-powder-200/60 dark:border-powder-800/60">
                {projectTasksCount} Team
              </span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1 flex items-center gap-2">
              <span>Overall Completion</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {completedTasks} / {totalTasks} Tasks ({completionPercentage}%)
              </span>
            </h3>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 flex-wrap">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              {todoTasks} To Do
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-powder-50 dark:bg-powder-950/60 border border-powder-200/60 dark:border-powder-800 text-powder-700 dark:text-powder-300">
              <span className="w-2 h-2 rounded-full bg-powder-500" />
              {inProgressTasks} In Progress
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-mint-50 dark:bg-mint-950/60 border border-mint-200/60 dark:border-mint-800 text-mint-700 dark:text-mint-300">
              <span className="w-2 h-2 rounded-full bg-mint-500" />
              {completedTasks} Done
            </span>
          </div>
        </div>

        {/* Dynamic Progress Bar */}
        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
          <div
            className="bg-gradient-to-r from-powder-500 to-mint-500 h-2.5 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
      </div>

      {/* ── Filters & Controls Bar ─────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs space-y-3">
        {/* Top Filter Pills: Task Type and Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          {/* Type Pills */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl w-fit">
            {[
              { id: 'ALL', label: 'All', icon: CheckSquare, count: totalTasks },
              { id: 'PERSONAL', label: 'Personal', icon: Sparkles, count: personalTasksCount },
              { id: 'PROJECT', label: 'Project', icon: FolderKanban, count: projectTasksCount },
            ].map((tab) => {
              const active = typeFilter === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTypeFilter(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    active
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      active
                        ? 'bg-powder-100 dark:bg-powder-950 text-powder-600 dark:text-powder-300'
                        : 'bg-slate-200/60 dark:bg-slate-700/60 text-slate-500'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Status Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {[
              { id: 'ALL', label: 'All Statuses' },
              { id: 'TODO', label: 'To Do' },
              { id: 'IN_PROGRESS', label: 'In Progress' },
              { id: 'COMPLETED', label: 'Completed' },
            ].map((tab) => {
              const active = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 ${
                    active
                      ? 'bg-powder-50 dark:bg-powder-950/70 text-powder-600 dark:text-powder-400 border border-powder-200 dark:border-powder-800'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 border border-transparent'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Secondary Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
          {/* Search Box */}
          <div className="sm:col-span-5 relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by title, description or #tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-powder-500"
            />
          </div>

          {/* Project Filter */}
          <div className="sm:col-span-3">
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 focus:outline-hidden focus:ring-2 focus:ring-powder-500 truncate"
            >
              <option value="ALL">All Sources</option>
              <option value="PERSONAL">Only Personal Tasks</option>
              {uniqueProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  Project: {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Priority Dropdown */}
          <div className="sm:col-span-2">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 focus:outline-hidden focus:ring-2 focus:ring-powder-500"
            >
              <option value="ALL">All Priorities</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          {/* Sort By Dropdown */}
          <div className="sm:col-span-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 focus:outline-hidden focus:ring-2 focus:ring-powder-500"
            >
              <option value="dueDate">Due Date</option>
              <option value="priority">Priority</option>
              <option value="createdAt">Newest</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Tasks List ────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 bg-slate-100 dark:bg-slate-800/60 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      ) : error ? (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl p-6 text-center">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
          <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">
            {error}
          </p>
          <button
            type="button"
            onClick={fetchTasks}
            className="mt-3 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-medium hover:bg-rose-700 transition inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-12 text-center shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-powder-50 dark:bg-powder-950/60 text-powder-600 dark:text-powder-400 flex items-center justify-center mx-auto mb-3 border border-powder-100 dark:border-powder-900/60">
            <CheckSquare className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {totalTasks === 0 ? 'No tasks yet' : 'No matching tasks'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {totalTasks === 0
              ? 'Create a personal task to organize your studies or check your project assignments.'
              : 'Try clearing your type, priority, or search filters.'}
          </p>
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="mt-5 px-4 py-2 rounded-xl bg-powder-600 hover:bg-powder-700 text-white text-xs font-semibold shadow-xs transition inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create Task</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => {
            const pBadge = getPriorityBadge(task.priority);
            const overdue = isOverdue(task);
            const isCompleted = task.status === 'COMPLETED';
            const isPersonal = !task.project;

            const subtaskCount = task.subtasks?.length || 0;
            const completedSubtaskCount =
              task.subtasks?.filter((s) => s.completed)?.length || 0;

            return (
              <div
                key={task._id}
                onClick={() => openTaskDetails(task)}
                className={`group relative bg-white dark:bg-slate-900 rounded-2xl border p-4 sm:p-5 shadow-xs hover:shadow-md transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  isCompleted
                    ? 'border-slate-200/60 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50'
                    : overdue
                    ? 'border-rose-200 dark:border-rose-900/50 hover:border-rose-300'
                    : 'border-slate-200/80 dark:border-slate-800 hover:border-powder-300 dark:hover:border-powder-700'
                }`}
              >
                {/* Left: Checkbox + Title + Badges + Tags + Inline Subtask Bar */}
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  <button
                    type="button"
                    title={`Status: ${task.status}. Click to cycle.`}
                    onClick={(e) => handleQuickStatusToggle(e, task)}
                    className={`mt-0.5 transition shrink-0 rounded-full p-0.5 focus:outline-hidden ${
                      isCompleted
                        ? 'text-mint-600 dark:text-mint-400 hover:opacity-80'
                        : task.status === 'IN_PROGRESS'
                        ? 'text-powder-600 dark:text-powder-400 hover:opacity-80'
                        : 'text-slate-300 dark:text-slate-600 hover:text-powder-500'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 fill-mint-100 dark:fill-mint-950/60" />
                    ) : (
                      <Circle className="w-5 h-5" />
                    )}
                  </button>

                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-sm font-semibold truncate ${
                          isCompleted
                            ? 'line-through text-slate-400 dark:text-slate-500'
                            : 'text-slate-900 dark:text-white group-hover:text-powder-600 dark:group-hover:text-powder-400'
                        } transition`}
                      >
                        {task.title}
                      </span>

                      {/* Task Type Badge (Personal vs Project) */}
                      {isPersonal ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                          <Sparkles className="w-3 h-3" />
                          Personal
                        </span>
                      ) : task.project ? (
                        <Link
                          to={`/projects/${task.project._id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-powder-50 dark:bg-powder-950/60 text-powder-700 dark:text-powder-300 border border-powder-200 dark:border-powder-800 hover:bg-powder-100 dark:hover:bg-powder-900 transition"
                          title="View project workspace"
                        >
                          <FolderKanban className="w-3 h-3 text-powder-500" />
                          <span>{task.project.name}</span>
                        </Link>
                      ) : null}

                      {/* Priority Badge */}
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${pBadge.bg}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${pBadge.dot}`}
                        />
                        {pBadge.label}
                      </span>

                      {/* Overdue Alert */}
                      {overdue && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                          <AlertCircle className="w-3 h-3" />
                          Overdue
                        </span>
                      )}
                    </div>

                    {/* Description preview */}
                    {task.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                        {task.description}
                      </p>
                    )}

                    {/* Subtask Mini Progress Bar (if task has subtasks) */}
                    {subtaskCount > 0 && (
                      <div className="max-w-xs pt-1">
                        <TaskProgressBar
                          subtasks={task.subtasks}
                          status={task.status}
                          size="xs"
                          showPercentage={true}
                          showSubtaskCount={true}
                        />
                      </div>
                    )}

                    {/* Tags */}
                    {task.tags?.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                        {task.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                          >
                            <Tag className="w-2.5 h-2.5 text-slate-400" />
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Subtasks counter badge, Due Date, Arrow */}
                <div className="flex items-center gap-4 shrink-0 justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 dark:border-slate-800">
                  {/* Subtask counter badge */}
                  {subtaskCount > 0 && (
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg ${
                        completedSubtaskCount === subtaskCount
                          ? 'bg-mint-50 dark:bg-mint-950/60 text-mint-600 dark:text-mint-400 border border-mint-200 dark:border-mint-800'
                          : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60'
                      }`}
                      title={`${completedSubtaskCount} of ${subtaskCount} subtasks completed`}
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>
                        {completedSubtaskCount}/{subtaskCount}
                      </span>
                    </span>
                  )}

                  {/* Due Date */}
                  {task.dueDate && (
                    <div
                      className={`flex items-center gap-1.5 text-xs font-medium ${
                        overdue
                          ? 'text-rose-600 dark:text-rose-400 font-semibold'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        {new Date(task.dueDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  )}

                  <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 transition hidden sm:block" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create Task Modal ─────────────────────────────────────────────── */}
      <CreateTaskModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        projectId={null}
        onTaskCreated={handleTaskCreated}
      />

      {/* ── Task Details Modal ────────────────────────────────────────────── */}
      <TaskDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false);
          setSelectedTask(null);
        }}
        task={selectedTask}
        projectRole={selectedTask?.project ? 'MEMBER' : 'OWNER'}
        members={[]}
        onTaskUpdated={handleTaskUpdated}
        onTaskDeleted={handleTaskDeleted}
      />
    </div>
  );
};

export default Tasks;
