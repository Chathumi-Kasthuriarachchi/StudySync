import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  AlertCircle,
  Plus,
  Trash2,
  Tag,
  User,
  Flag,
  CheckSquare,
  FolderKanban,
  Sparkles,
} from 'lucide-react';
import { createTask, createPersonalTask } from '../../services/taskService';
import { getProjects, getProjectMembers } from '../../services/projectService';

/**
 * CreateTaskModal
 *
 * Context-aware modal supporting both Project-scoped tasks and Personal tasks.
 * If projectId is passed, locks to that project.
 * If no projectId is passed, provides a segmented selector between Personal and Project task types.
 */
const CreateTaskModal = ({
  isOpen,
  onClose,
  projectId = null,
  members = [],
  onTaskCreated,
}) => {
  // Mode: if projectId is passed, forced to PROJECT mode. Otherwise default to PERSONAL.
  const isFixedProject = Boolean(projectId);
  const [taskType, setTaskType] = useState(projectId ? 'PROJECT' : 'PERSONAL');

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('TODO');
  const [priority, setPriority] = useState('MEDIUM');
  const [assignee, setAssignee] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [subtasks, setSubtasks] = useState([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // Project selector state (when taskType === 'PROJECT' and no fixed projectId)
  const [userProjects, setUserProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(projectId || '');
  const [projectMembers, setProjectMembers] = useState(members || []);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset or initialize state on open
  useEffect(() => {
    if (isOpen) {
      if (projectId) {
        setTaskType('PROJECT');
        setSelectedProjectId(projectId);
        setProjectMembers(members);
      } else {
        setTaskType('PERSONAL');
        setSelectedProjectId('');
      }
      setError('');
    }
  }, [isOpen, projectId, members]);

  // If user switches to PROJECT mode without a fixed projectId, fetch active projects
  useEffect(() => {
    if (isOpen && !isFixedProject && taskType === 'PROJECT') {
      const fetchProjects = async () => {
        try {
          setLoadingProjects(true);
          const res = await getProjects();
          if (res.success && res.data) {
            setUserProjects(res.data);
            if (res.data.length > 0 && !selectedProjectId) {
              setSelectedProjectId(res.data[0]._id);
            }
          }
        } catch (err) {
          console.error('Failed to load projects for task creation:', err);
        } finally {
          setLoadingProjects(false);
        }
      };
      fetchProjects();
    }
  }, [isOpen, isFixedProject, taskType, selectedProjectId]);

  // When selectedProjectId changes, load members for assignee options
  useEffect(() => {
    if (isOpen && !isFixedProject && taskType === 'PROJECT' && selectedProjectId) {
      const fetchMembers = async () => {
        try {
          const res = await getProjectMembers(selectedProjectId);
          if (res.success && res.data) {
            setProjectMembers(res.data);
          }
        } catch (err) {
          console.error('Failed to load project members:', err);
        }
      };
      fetchMembers();
    }
  }, [isOpen, isFixedProject, taskType, selectedProjectId]);

  if (!isOpen) return null;

  const handleAddSubtask = (e) => {
    e?.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    setSubtasks((prev) => [
      ...prev,
      { title: newSubtaskTitle.trim(), completed: false },
    ]);
    setNewSubtaskTitle('');
  };

  const handleRemoveSubtask = (index) => {
    setSubtasks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Task title is required.');
      return;
    }

    if (startDate && dueDate) {
      const start = new Date(startDate);
      const due = new Date(dueDate);
      if (due < start) {
        setError('Due date cannot be earlier than start date.');
        return;
      }
    }

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      setLoading(true);
      let res;

      if (taskType === 'PERSONAL') {
        res = await createPersonalTask({
          title: title.trim(),
          description: description.trim(),
          status,
          priority,
          startDate: startDate || null,
          dueDate: dueDate || null,
          tags,
          subtasks,
        });
      } else {
        const targetProjectId = isFixedProject ? projectId : selectedProjectId;
        if (!targetProjectId) {
          setError('Please select a project for this task.');
          setLoading(false);
          return;
        }

        res = await createTask(targetProjectId, {
          title: title.trim(),
          description: description.trim(),
          status,
          priority,
          assignee: assignee || null,
          startDate: startDate || null,
          dueDate: dueDate || null,
          tags,
          subtasks,
        });
      }

      if (res.success && res.data) {
        if (onTaskCreated) onTaskCreated(res.data);
        onClose();
        // Reset form
        setTitle('');
        setDescription('');
        setStatus('TODO');
        setPriority('MEDIUM');
        setAssignee('');
        setStartDate('');
        setDueDate('');
        setTagsInput('');
        setSubtasks([]);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-scaleIn">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-powder-100 dark:bg-powder-900/60 text-powder-600 dark:text-powder-400 flex items-center justify-center">
              <CheckSquare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {isFixedProject ? 'Create Project Task' : 'Create New Task'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isFixedProject
                  ? 'Define deliverables, assign teammates, and add subtasks.'
                  : 'Add a personal task or organize within a team project.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 flex items-center gap-2.5 text-rose-700 dark:text-rose-300 text-xs shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 scrollbar-thin">
          {/* Segmented Task Type Selector (Only shown if opened globally without fixed project) */}
          {!isFixedProject && (
            <div className="p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => {
                  setTaskType('PERSONAL');
                  setAssignee('');
                }}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition ${
                  taskType === 'PERSONAL'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Personal Task</span>
              </button>

              <button
                type="button"
                onClick={() => setTaskType('PROJECT')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition ${
                  taskType === 'PROJECT'
                    ? 'bg-white dark:bg-slate-900 text-powder-600 dark:text-powder-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <FolderKanban className="w-3.5 h-3.5" />
                <span>Project Task</span>
              </button>
            </div>
          )}

          {/* Project Selection Dropdown (When in PROJECT mode without fixed projectId) */}
          {!isFixedProject && taskType === 'PROJECT' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <FolderKanban className="w-3.5 h-3.5 text-powder-500" />
                <span>Target Project <span className="text-rose-500">*</span></span>
              </label>
              {loadingProjects ? (
                <div className="h-9 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
              ) : userProjects.length === 0 ? (
                <p className="text-xs text-amber-600 dark:text-amber-400 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50">
                  You are not a member of any projects yet. Create a personal task instead, or join/create a project first.
                </p>
              ) : (
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-powder-500/30 transition"
                >
                  {userProjects.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Task Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                taskType === 'PERSONAL'
                  ? 'e.g. Study Module 3 Distributed Systems notes'
                  : 'e.g. Implement Raft leader election algorithm'
              }
              maxLength={200}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-powder-500/30 focus:border-powder-500 transition"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Description <span className="text-slate-400 text-[10px] font-normal lowercase">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Details, acceptance criteria, or notes..."
              rows={3}
              maxLength={2000}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-powder-500/30 focus:border-powder-500 transition resize-none"
            />
          </div>

          {/* Priority & Assignee Grid */}
          <div className={`grid grid-cols-1 ${taskType === 'PROJECT' ? 'sm:grid-cols-2' : ''} gap-4`}>
            {/* Priority */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Flag className="w-3.5 h-3.5 text-powder-500" />
                <span>Priority</span>
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-powder-500/30 transition"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>

            {/* Assignee: Only displayed for Project Tasks */}
            {taskType === 'PROJECT' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-mint-500" />
                  <span>Assignee</span>
                </label>
                <select
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-powder-500/30 transition"
                >
                  <option value="">Unassigned</option>
                  {projectMembers.map((m) => (
                    <option key={m.user?._id || m._id} value={m.user?._id || m._id}>
                      {m.user?.name || 'Member'} ({m.role})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Dates Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-powder-500" />
                <span>Start Date</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:ring-2 focus:ring-powder-500/30 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-mint-500" />
                <span>Due Date</span>
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                min={startDate || undefined}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:ring-2 focus:ring-powder-500/30 transition"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-powder-500" />
              <span>Tags <span className="text-[10px] font-normal text-slate-400 lowercase">(comma separated)</span></span>
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. personal, revision, exam"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:ring-2 focus:ring-powder-500/30 transition"
            />
          </div>

          {/* Subtasks Checklist Builder */}
          <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Subtasks Checklist ({subtasks.length})
            </label>

            {/* Subtask Input */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSubtask();
                  }
                }}
                placeholder="Add checklist item..."
                className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:ring-2 focus:ring-powder-500/30 transition"
              />
              <button
                type="button"
                onClick={handleAddSubtask}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>

            {/* Subtasks List */}
            {subtasks.length > 0 && (
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {subtasks.map((st, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50 text-xs"
                  >
                    <span className="text-slate-700 dark:text-slate-300 truncate mr-2">
                      {st.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSubtask(idx)}
                      className="text-slate-400 hover:text-rose-500 transition p-0.5"
                      title="Remove subtask"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-powder-600 hover:bg-powder-700 active:bg-powder-800 text-white text-xs font-semibold shadow-xs transition disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create {taskType === 'PERSONAL' ? 'Personal Task' : 'Task'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTaskModal;
