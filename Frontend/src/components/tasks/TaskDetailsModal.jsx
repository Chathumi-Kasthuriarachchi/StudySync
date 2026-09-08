import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Clock,
  User,
  Flag,
  Tag,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Edit3,
  AlertCircle,
  Shield,
  Layers,
  CheckSquare,
} from 'lucide-react';
import {
  updateTask,
  updateTaskStatus,
  deleteTask,
  addSubtask,
  toggleSubtask,
  deleteSubtask,
} from '../../services/taskService';
import { useAuth } from '../../context/AuthContext';

/**
 * Priority badge helper
 */
export const getPriorityBadge = (priority) => {
  switch (priority) {
    case 'URGENT':
      return {
        label: 'Urgent',
        bg: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
        dot: 'bg-rose-500',
      };
    case 'HIGH':
      return {
        label: 'High',
        bg: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        dot: 'bg-amber-500',
      };
    case 'MEDIUM':
      return {
        label: 'Medium',
        bg: 'bg-powder-50 dark:bg-powder-950/60 text-powder-700 dark:text-powder-300 border-powder-200 dark:border-powder-800',
        dot: 'bg-powder-500',
      };
    case 'LOW':
    default:
      return {
        label: 'Low',
        bg: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
        dot: 'bg-slate-400',
      };
  }
};

/**
 * Status badge helper
 */
export const getTaskStatusBadge = (status) => {
  switch (status) {
    case 'COMPLETED':
      return {
        label: 'Completed',
        bg: 'bg-mint-50 dark:bg-mint-950/60 text-mint-700 dark:text-mint-300 border-mint-200 dark:border-mint-800',
        color: 'text-mint-600 dark:text-mint-400',
      };
    case 'IN_PROGRESS':
      return {
        label: 'In Progress',
        bg: 'bg-powder-50 dark:bg-powder-950/60 text-powder-700 dark:text-powder-300 border-powder-200 dark:border-powder-800',
        color: 'text-powder-600 dark:text-powder-400',
      };
    case 'TODO':
    default:
      return {
        label: 'To Do',
        bg: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
        color: 'text-slate-500 dark:text-slate-400',
      };
  }
};

const formatDateInput = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
};

const TaskDetailsModal = ({
  isOpen,
  onClose,
  task: initialTask,
  projectRole = 'MEMBER',
  members = [],
  onTaskUpdated,
  onTaskDeleted,
}) => {
  const { user: currentUser } = useAuth();
  const [task, setTask] = useState(initialTask);
  const [isEditing, setIsEditing] = useState(false);

  // Edit fields state
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState('MEDIUM');
  const [editAssignee, setEditAssignee] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editTags, setEditTags] = useState('');

  // Subtask creation
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [subtaskLoading, setSubtaskLoading] = useState(false);

  // Status & error
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (initialTask) {
      setTask(initialTask);
      setEditTitle(initialTask.title || '');
      setEditDescription(initialTask.description || '');
      setEditPriority(initialTask.priority || 'MEDIUM');
      setEditAssignee(initialTask.assignee?._id || initialTask.assignee || '');
      setEditStartDate(formatDateInput(initialTask.startDate));
      setEditDueDate(formatDateInput(initialTask.dueDate));
      setEditTags(Array.isArray(initialTask.tags) ? initialTask.tags.join(', ') : '');
      setIsEditing(false);
      setError('');
    }
  }, [initialTask]);

  if (!isOpen || !task) return null;

  const isOwner = projectRole === 'OWNER';
  const isManager = projectRole === 'MANAGER';
  const isViewer = projectRole === 'VIEWER';
  const isCreator = task.createdBy?._id === currentUser?._id;
  const isAssignee = task.assignee?._id === currentUser?._id;

  const canEdit = !isViewer && (isOwner || isManager || isCreator || isAssignee);
  const canDelete = !isViewer && (isOwner || isManager || isCreator);

  // ── Quick Status Toggle ─────────────────────────────────────────────────────
  const handleStatusChange = async (newStatus) => {
    if (isViewer || newStatus === task.status) return;

    try {
      const res = await updateTaskStatus(task._id, newStatus);
      if (res.success && res.data) {
        setTask(res.data);
        if (onTaskUpdated) onTaskUpdated(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update status');
    }
  };

  // ── Subtask Toggle ──────────────────────────────────────────────────────────
  const handleToggleSubtask = async (subtaskId, currentCompleted) => {
    if (isViewer) return;

    try {
      const res = await toggleSubtask(task._id, subtaskId, {
        completed: !currentCompleted,
      });
      if (res.success && res.data) {
        setTask(res.data);
        if (onTaskUpdated) onTaskUpdated(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update subtask');
    }
  };

  // ── Add Subtask ─────────────────────────────────────────────────────────────
  const handleAddSubtask = async (e) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim() || isViewer) return;

    try {
      setSubtaskLoading(true);
      const res = await addSubtask(task._id, newSubtaskTitle.trim());
      if (res.success && res.data) {
        setTask(res.data);
        setNewSubtaskTitle('');
        if (onTaskUpdated) onTaskUpdated(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add subtask');
    } finally {
      setSubtaskLoading(false);
    }
  };

  // ── Delete Subtask ──────────────────────────────────────────────────────────
  const handleDeleteSubtask = async (subtaskId) => {
    if (isViewer) return;

    try {
      const res = await deleteSubtask(task._id, subtaskId);
      if (res.success && res.data) {
        setTask(res.data);
        if (onTaskUpdated) onTaskUpdated(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete subtask');
    }
  };

  // ── Save Full Edit ──────────────────────────────────────────────────────────
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setError('');

    if (!editTitle.trim()) {
      setError('Task title is required');
      return;
    }

    if (editStartDate && editDueDate) {
      if (new Date(editDueDate) < new Date(editStartDate)) {
        setError('Due date cannot be earlier than start date');
        return;
      }
    }

    const tags = editTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      setLoading(true);
      const res = await updateTask(task._id, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        priority: editPriority,
        assignee: editAssignee || null,
        startDate: editStartDate || null,
        dueDate: editDueDate || null,
        tags,
      });

      if (res.success && res.data) {
        setTask(res.data);
        setIsEditing(false);
        setSuccessMsg('Task updated successfully');
        setTimeout(() => setSuccessMsg(''), 2500);
        if (onTaskUpdated) onTaskUpdated(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update task');
    } finally {
      setLoading(false);
    }
  };

  // ── Delete Task ─────────────────────────────────────────────────────────────
  const handleDeleteTask = async () => {
    if (!window.confirm('Are you sure you want to permanently delete this task?')) return;

    try {
      setLoading(true);
      const res = await deleteTask(task._id);
      if (res.success) {
        if (onTaskDeleted) onTaskDeleted(task._id);
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete task');
      setLoading(false);
    }
  };

  const priorityBadge = getPriorityBadge(task.priority);
  const statusBadge = getTaskStatusBadge(task.status);

  // Subtask completion metric
  const subtasksList = Array.isArray(task.subtasks) ? task.subtasks : [];
  const completedSubtasksCount = subtasksList.filter((s) => s.completed).length;
  const subtasksPct =
    subtasksList.length > 0
      ? Math.round((completedSubtasksCount / subtasksList.length) * 100)
      : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-scaleIn">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-950/30">
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusBadge.bg}`}
            >
              {statusBadge.label}
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${priorityBadge.bg}`}
            >
              {priorityBadge.label}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {canEdit && !isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-powder-600 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition flex items-center gap-1"
                title="Edit task"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            )}

            {canDelete && (
              <button
                type="button"
                onClick={handleDeleteTask}
                className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition"
                title="Delete task"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-mint-50 dark:bg-mint-950/50 border border-mint-200 dark:border-mint-900/60 flex items-center gap-2 text-mint-700 dark:text-mint-300 text-xs shrink-0">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 scrollbar-thin">
          {/* EDIT MODE */}
          {isEditing ? (
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Task Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-powder-500/30 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-powder-500/30 transition resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Priority
                  </label>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-powder-500/30 transition"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Assignee
                  </label>
                  <select
                    value={editAssignee}
                    onChange={(e) => setEditAssignee(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-powder-500/30 transition"
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.user?._id || m._id} value={m.user?._id || m._id}>
                        {m.user?.name || 'Member'} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:ring-2 focus:ring-powder-500/30 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    min={editStartDate || undefined}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:ring-2 focus:ring-powder-500/30 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  placeholder="e.g. frontend, auth, bug"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:ring-2 focus:ring-powder-500/30 transition"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-powder-600 hover:bg-powder-700 text-white text-xs font-semibold shadow-xs transition disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : (
            /* VIEW MODE */
            <>
              {/* Title & Status Toggle Bar */}
              <div className="space-y-3">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white leading-snug">
                  {task.title}
                </h1>

                {/* Status Toggle Pills */}
                {!isViewer && (
                  <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl w-fit">
                    {['TODO', 'IN_PROGRESS', 'COMPLETED'].map((st) => {
                      const isActive = task.status === st;
                      const badge = getTaskStatusBadge(st);
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => handleStatusChange(st)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                            isActive
                              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                          }`}
                        >
                          {badge.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Description */}
              {task.description && (
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {task.description}
                </p>
              )}

              {/* Key Attributes Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800/60 text-xs">
                {/* Assignee */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <User className="w-3 h-3 text-mint-500" /> Assignee
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-mint-100 dark:bg-mint-950/60 text-mint-700 dark:text-mint-300 font-bold flex items-center justify-center text-[10px]">
                      {task.assignee?.name ? task.assignee.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {task.assignee?.name || 'Unassigned'}
                    </span>
                  </div>
                </div>

                {/* Due Date */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-powder-500" /> Due Date
                  </span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {task.dueDate
                      ? new Date(task.dueDate).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : 'No deadline set'}
                  </p>
                </div>

                {/* Created By */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Created By
                  </span>
                  <p className="text-slate-600 dark:text-slate-400">
                    {task.createdBy?.name || 'Teammate'}
                  </p>
                </div>

                {/* Tags */}
                {task.tags && task.tags.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Tag className="w-3 h-3 text-slate-400" /> Tags
                    </span>
                    <div className="flex items-center gap-1 flex-wrap">
                      {task.tags.map((t, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-powder-50 dark:bg-powder-950/60 text-powder-700 dark:text-powder-300 text-[10px] font-semibold border border-powder-200/60 dark:border-powder-800/60"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Subtasks Checklist Section ──────────────────────────────── */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <CheckSquare className="w-4 h-4 text-powder-500" />
                    <span>Subtasks Checklist</span>
                    <span className="text-slate-400 font-normal lowercase">
                      ({completedSubtasksCount}/{subtasksList.length})
                    </span>
                  </h3>
                  <span className="text-[11px] font-bold text-mint-600 dark:text-mint-400">
                    {subtasksPct}%
                  </span>
                </div>

                {/* Progress bar */}
                {subtasksList.length > 0 && (
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-mint-500 rounded-full transition-all duration-300"
                      style={{ width: `${subtasksPct}%` }}
                    />
                  </div>
                )}

                {/* Subtask Items */}
                <div className="space-y-1.5">
                  {subtasksList.map((st) => (
                    <div
                      key={st._id}
                      className="group p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-950 flex items-center justify-between gap-3 text-xs transition hover:border-powder-200 dark:hover:border-powder-800"
                    >
                      <button
                        type="button"
                        disabled={isViewer}
                        onClick={() => handleToggleSubtask(st._id, st.completed)}
                        className="flex items-center gap-2.5 flex-1 text-left"
                      >
                        {st.completed ? (
                          <CheckCircle2 className="w-4 h-4 text-mint-500 shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                        )}
                        <span
                          className={`transition ${
                            st.completed
                              ? 'line-through text-slate-400 dark:text-slate-500'
                              : 'text-slate-800 dark:text-slate-200 font-medium'
                          }`}
                        >
                          {st.title}
                        </span>
                      </button>

                      {!isViewer && (
                        <button
                          type="button"
                          onClick={() => handleDeleteSubtask(st._id)}
                          className="text-slate-300 dark:text-slate-600 hover:text-rose-500 transition opacity-0 group-hover:opacity-100"
                          title="Delete subtask"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add Subtask Input */}
                {!isViewer && (
                  <form onSubmit={handleAddSubtask} className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      placeholder="Add a new checklist item..."
                      className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:ring-2 focus:ring-powder-500/30 transition"
                    />
                    <button
                      type="submit"
                      disabled={subtaskLoading || !newSubtaskTitle.trim()}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition disabled:opacity-50 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </form>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskDetailsModal;
