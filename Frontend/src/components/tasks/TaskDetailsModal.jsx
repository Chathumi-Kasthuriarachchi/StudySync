import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Sparkles,
  FolderKanban,
  MessageSquare,
  Send,
  History,
  Pencil,
  Check,
  Play,
  Square,
  Target,
  ChevronDown,
  ChevronUp,
  Timer,
} from 'lucide-react';
import {
  updateTask,
  updateTaskStatus,
  deleteTask,
  addSubtask,
  toggleSubtask,
  updateSubtask,
  deleteSubtask,
} from '../../services/taskService';
import {
  getTaskComments,
  createTaskComment,
  updateTaskComment,
  deleteTaskComment,
  getTaskActivities,
} from '../../services/commentService';
import { getProjectMembers } from '../../services/projectService';
import { getTaskTimeSummary } from '../../services/timeService';
import { useAuth } from '../../context/AuthContext';
import { useTimeTracking, formatHumanTime } from '../../context/TimeTrackingContext';
import { getRoleBadge } from '../../pages/Projects';
import TaskProgressBar from './TaskProgressBar';

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
        bg: 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
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
        dot: 'bg-mint-500',
      };
    case 'IN_PROGRESS':
      return {
        label: 'In Progress',
        bg: 'bg-powder-50 dark:bg-powder-950/60 text-powder-700 dark:text-powder-300 border-powder-200 dark:border-powder-800',
        dot: 'bg-powder-500',
      };
    case 'TODO':
    default:
      return {
        label: 'To Do',
        bg: 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
        dot: 'bg-slate-400',
      };
  }
};

const formatDateInput = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
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
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const {
    activeSession,
    isTracking,
    formattedElapsed,
    startTimer: contextStartTimer,
    stopTimer: contextStopTimer,
  } = useTimeTracking();

  const [task, setTask] = useState(initialTask);
  const [isEditing, setIsEditing] = useState(false);
  const [internalMembers, setInternalMembers] = useState(members);

  // Time tracking states
  const [timeSummary, setTimeSummary] = useState(null);
  const [showTimeHistory, setShowTimeHistory] = useState(false);
  const [timerActionLoading, setTimerActionLoading] = useState(false);

  useEffect(() => {
    setInternalMembers(members);
  }, [members]);

  useEffect(() => {
    if (task?.project && (!members || members.length === 0)) {
      const pId = task.project._id || task.project;
      getProjectMembers(pId)
        .then((res) => {
          if (res.success) setInternalMembers(res.data || []);
        })
        .catch(() => {});
    }
  }, [task?.project, members]);

  // Edit form states
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState('MEDIUM');
  const [editAssignee, setEditAssignee] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editEstimatedMinutes, setEditEstimatedMinutes] = useState('');

  // Subtask creation state
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [subtaskLoading, setSubtaskLoading] = useState(false);

  // Subtask inline editing state
  const [editingSubtaskId, setEditingSubtaskId] = useState(null);
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState('');
  const [editingSubtaskLoading, setEditingSubtaskLoading] = useState(false);

  // Status & error
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Auto-dismiss warning after 5 seconds
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(''), 5000);
    return () => clearTimeout(timer);
  }, [error]);

  // Collaboration states (Comments & Activity)
  const [comments, setComments] = useState([]);
  const [activities, setActivities] = useState([]);
  const [activeCollabTab, setActiveCollabTab] = useState('comments');
  const [commentContent, setCommentContent] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  const fetchCollaborationData = useCallback(async (taskId) => {
    if (!taskId) return;
    try {
      setCommentsLoading(true);
      setActivitiesLoading(true);
      const [comRes, actRes] = await Promise.all([
        getTaskComments(taskId).catch(() => ({ data: [] })),
        getTaskActivities(taskId).catch(() => ({ data: [] })),
      ]);
      if (comRes.success) setComments(comRes.data || []);
      if (actRes.success) setActivities(actRes.data || []);
    } catch (err) {
      console.error('Failed to load comments/activities:', err);
    } finally {
      setCommentsLoading(false);
      setActivitiesLoading(false);
    }
  }, []);

  const fetchTimeSummary = useCallback(async (taskId) => {
    if (!taskId) return;
    try {
      const res = await getTaskTimeSummary(taskId);
      if (res.success && res.data) {
        setTimeSummary(res.data);
      }
    } catch (err) {
      console.error('Failed to load task time summary:', err);
    }
  }, []);

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
      setEditEstimatedMinutes(
        initialTask.estimatedMinutes !== null && initialTask.estimatedMinutes !== undefined
          ? String(initialTask.estimatedMinutes)
          : ''
      );
      setIsEditing(false);
      setError('');

      fetchTimeSummary(initialTask._id);

      if (initialTask.project) {
        fetchCollaborationData(initialTask._id);
      } else {
        setComments([]);
        setActivities([]);
      }
    }
  }, [initialTask, fetchCollaborationData, fetchTimeSummary]);

  if (!isOpen || !task) return null;

  const isPersonal = !task.project;
  const isOwner = isPersonal || projectRole === 'OWNER';
  const isManager = projectRole === 'MANAGER';
  const isViewer = !isPersonal && projectRole === 'VIEWER';
  const isCreator = task.createdBy?._id === currentUser?._id;
  const isAssignee = task.assignee?._id === currentUser?._id;

  const canEdit = isPersonal || (!isViewer && (isOwner || isManager || isCreator || isAssignee));
  const canDelete = isPersonal || (!isViewer && (isOwner || isManager || isCreator));

  // Active timer relation to this task
  const isActiveOnThisTask =
    isTracking &&
    (activeSession?.task?._id?.toString() === task._id?.toString() ||
      activeSession?.task?.toString() === task._id?.toString());
  const isActiveOnOtherTask = isTracking && !isActiveOnThisTask;

  const handleStartTimer = async () => {
    if (isViewer) return;
    setError('');
    try {
      setTimerActionLoading(true);
      await contextStartTimer(task._id);
      await fetchTimeSummary(task._id);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to start timer');
    } finally {
      setTimerActionLoading(false);
    }
  };

  const handleStopTimer = async () => {
    setError('');
    try {
      setTimerActionLoading(true);
      await contextStopTimer();
      await fetchTimeSummary(task._id);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to stop timer');
    } finally {
      setTimerActionLoading(false);
    }
  };

  // ── Quick Status Toggle ─────────────────────────────────────────────────────
  const handleStatusChange = async (newStatus) => {
    if (isViewer || newStatus === task.status) return;

    if (newStatus === 'COMPLETED' && task.subtasks && task.subtasks.length > 0) {
      const hasIncomplete = task.subtasks.some((st) => !st.completed);
      if (hasIncomplete) {
        setError('Cannot mark task as completed until all subtasks are completed.');
        return;
      }
    }

    try {
      const res = await updateTaskStatus(task._id, newStatus);
      if (res.success && res.data) {
        setTask(res.data);
        setError('');
        if (onTaskUpdated) onTaskUpdated(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update status');
    }
  };

  // ── Subtask Toggle & Edit ───────────────────────────────────────────────────
  const handleToggleSubtask = async (subtaskId, currentCompleted) => {
    if (isViewer) return;

    try {
      const res = await toggleSubtask(task._id, subtaskId, {
        completed: !currentCompleted,
      });
      if (res.success && res.data) {
        setTask(res.data);
        setError('');
        if (onTaskUpdated) onTaskUpdated(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update subtask');
    }
  };

  const handleStartEditSubtask = (st) => {
    if (isViewer) return;
    setEditingSubtaskId(st._id);
    setEditingSubtaskTitle(st.title);
    setError('');
  };

  const handleCancelEditSubtask = () => {
    setEditingSubtaskId(null);
    setEditingSubtaskTitle('');
  };

  const handleSaveSubtask = async (subtaskId) => {
    if (isViewer || !editingSubtaskTitle.trim()) return;

    try {
      setEditingSubtaskLoading(true);
      const res = await updateSubtask(task._id, subtaskId, {
        title: editingSubtaskTitle.trim(),
      });
      if (res.success && res.data) {
        setTask(res.data);
        setEditingSubtaskId(null);
        setEditingSubtaskTitle('');
        setError('');
        if (onTaskUpdated) onTaskUpdated(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update subtask title');
    } finally {
      setEditingSubtaskLoading(false);
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

  // ── Comment Handlers ────────────────────────────────────────────────────────
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentContent.trim() || isViewer) return;

    try {
      setSubmittingComment(true);
      const res = await createTaskComment(task._id, commentContent.trim());
      if (res.success && res.data) {
        setComments((prev) => [...prev, res.data]);
        setCommentContent('');
        getTaskActivities(task._id).then((actRes) => {
          if (actRes.success) setActivities(actRes.data || []);
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleUpdateComment = async (commentId) => {
    if (!editingCommentText.trim()) return;

    try {
      const res = await updateTaskComment(task._id, commentId, editingCommentText.trim());
      if (res.success && res.data) {
        setComments((prev) =>
          prev.map((c) => (c._id === commentId ? res.data : c))
        );
        setEditingCommentId(null);
        setEditingCommentText('');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update comment');
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;

    try {
      const res = await deleteTaskComment(task._id, commentId);
      if (res.success) {
        setComments((prev) => prev.filter((c) => c._id !== commentId));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete comment');
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
      const updatePayload = {
        title: editTitle.trim(),
        description: editDescription.trim(),
        priority: editPriority,
        startDate: editStartDate || null,
        dueDate: editDueDate || null,
        tags,
        estimatedMinutes:
          editEstimatedMinutes !== '' && editEstimatedMinutes !== null
            ? Math.max(0, Number(editEstimatedMinutes))
            : null,
      };

      if (!isPersonal) {
        updatePayload.assignee = editAssignee || null;
      }

      const res = await updateTask(task._id, updatePayload);

      if (res.success && res.data) {
        setTask(res.data);
        setIsEditing(false);
        setSuccessMsg('Task updated successfully');
        setTimeout(() => setSuccessMsg(''), 2500);
        fetchTimeSummary(task._id);
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

  // Assignee project role badge
  const assigneeMembership = !isPersonal && internalMembers?.length > 0 && task.assignee
    ? internalMembers.find((m) => {
        const mUserId = m.user?._id || m.user;
        const taskAssigneeId = task.assignee?._id || task.assignee;
        return mUserId && taskAssigneeId && mUserId.toString() === taskAssigneeId.toString();
      })
    : null;
  const assigneeRoleBadge = assigneeMembership ? getRoleBadge(assigneeMembership.role) : null;

  // Subtask completion metric
  const subtasksList = Array.isArray(task.subtasks) ? task.subtasks : [];
  const completedSubtasksCount = subtasksList.filter((s) => s.completed).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-scaleIn">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-950/30">
          <div className="flex items-center gap-2 flex-wrap">
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
            {task.status !== 'COMPLETED' && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border bg-powder-50/90 dark:bg-powder-950/70 text-powder-700 dark:text-powder-300 border-powder-200 dark:border-powder-800 flex items-center gap-1">
                <span className="text-[10px] text-powder-500 uppercase tracking-wider font-semibold">Urgency:</span>
                <span className="font-extrabold">{(() => {
                  if (typeof task.urgencyScore === 'number') return task.urgencyScore;
                  let prio = 15;
                  if (task.priority === 'URGENT') prio = 35;
                  else if (task.priority === 'HIGH') prio = 25;
                  else if (task.priority === 'LOW') prio = 5;
                  let dead = 0;
                  if (task.dueDate) {
                    const now = new Date();
                    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
                    const endToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
                    const dueT = new Date(task.dueDate).getTime();
                    if (dueT < startToday.getTime()) dead = 45;
                    else if (dueT <= endToday.getTime()) dead = 38;
                    else {
                      const diffD = Math.ceil((dueT - endToday.getTime()) / (24 * 60 * 60 * 1000));
                      if (diffD <= 1) dead = 30;
                      else if (diffD <= 2) dead = 24;
                      else if (diffD <= 3) dead = 18;
                      else if (diffD <= 7) dead = 10;
                      else dead = 5;
                    }
                  }
                  const subList = Array.isArray(task.subtasks) ? task.subtasks : [];
                  let progVal = 0;
                  if (subList.length > 0) progVal = Math.round((subList.filter(s => s.completed).length / subList.length) * 100);
                  else if (task.status === 'IN_PROGRESS') progVal = 50;
                  const incomp = Math.round(((100 - progVal) / 100) * 15);
                  const statW = task.status === 'IN_PROGRESS' ? 5 : 0;
                  return Math.min(100, Math.max(0, prio + dead + incomp + statW));
                })()}/100</span>
              </span>
            )}
            {isPersonal ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Personal Task
              </span>
            ) : task.project ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border bg-powder-50 dark:bg-powder-950/60 text-powder-700 dark:text-powder-300 border-powder-200 dark:border-powder-800 flex items-center gap-1">
                <FolderKanban className="w-3 h-3" />
                {task.project.name || 'Project Task'}
              </span>
            ) : null}

            {task.goal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate(`/goals/${task.goal._id || task.goal}`);
                }}
                className="px-2.5 py-0.5 rounded-full text-xs font-bold border bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 flex items-center gap-1 hover:bg-blue-100 transition cursor-pointer"
                title="View Goal Details"
              >
                <Target className="w-3 h-3" />
                <span>{task.goal.title || 'Linked Goal'}</span>
              </button>
            )}

            {task.isMilestone && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 flex items-center gap-1">
                <Flag className="w-3 h-3" />
                Milestone
              </span>
            )}
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
          <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/90 dark:border-amber-900/60 flex items-center justify-between gap-3 text-amber-800 dark:text-amber-200 text-xs shrink-0 shadow-2xs animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="font-semibold">{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError('')}
              className="text-amber-600 hover:text-amber-800 dark:hover:text-amber-100 font-bold px-1.5 py-0.5 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 transition"
              title="Dismiss"
            >
              ✕
            </button>
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

              <div className={`grid grid-cols-1 ${isPersonal ? '' : 'sm:grid-cols-2'} gap-4`}>
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

                {!isPersonal && (
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
                )}
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    <span>Estimated Time (minutes)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editEstimatedMinutes}
                    onChange={(e) => setEditEstimatedMinutes(e.target.value)}
                    placeholder="e.g. 60, 120"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:ring-2 focus:ring-powder-500/30 transition"
                  />
                </div>
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
                      const isCompleteBlocked =
                        st === 'COMPLETED' &&
                        subtasksList.length > 0 &&
                        subtasksList.some((s) => !s.completed);
                      return (
                        <button
                          key={st}
                          type="button"
                          disabled={isCompleteBlocked}
                          title={
                            isCompleteBlocked
                              ? 'Complete all subtasks first before marking completed'
                              : undefined
                          }
                          onClick={() => handleStatusChange(st)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                            isActive
                              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                              : isCompleteBlocked
                              ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-60'
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="w-6 h-6 rounded-full bg-mint-100 dark:bg-mint-950/60 text-mint-700 dark:text-mint-300 font-bold flex items-center justify-center text-[10px]">
                      {isPersonal
                        ? 'Me'
                        : task.assignee?.name
                        ? task.assignee.name.charAt(0).toUpperCase()
                        : 'U'}
                    </div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {isPersonal ? 'Self (Personal Task)' : task.assignee?.name || 'Unassigned'}
                    </span>
                    {assigneeRoleBadge && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${assigneeRoleBadge.bg}`}>
                        {assigneeRoleBadge.label}
                      </span>
                    )}
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
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {isPersonal ? 'Self' : task.createdBy?.name || 'Teammate'}
                  </p>
                </div>

                {/* Project Context */}
                {!isPersonal && task.project && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <FolderKanban className="w-3 h-3 text-indigo-500" /> Project
                    </span>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {task.project.name || 'Project'}
                    </p>
                  </div>
                )}

                {/* Goal Context */}
                {task.goal && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Target className="w-3 h-3 text-blue-500" /> Goal
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        navigate(`/goals/${task.goal._id || task.goal}`);
                      }}
                      className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 truncate text-left cursor-pointer"
                    >
                      <span>{task.goal.title || 'View Goal'}</span>
                    </button>
                  </div>
                )}

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

              {/* ── TIME TRACKING SECTION (Phase 9) ── */}
              <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800/70 space-y-3.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Timer className="w-4 h-4 text-powder-500" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Time Tracking
                    </span>
                    {isActiveOnThisTask && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        Running: {formattedElapsed}
                      </span>
                    )}
                  </div>

                  {/* Timer Control Buttons */}
                  <div className="flex items-center gap-2">
                    {isActiveOnThisTask ? (
                      <button
                        type="button"
                        onClick={handleStopTimer}
                        disabled={timerActionLoading}
                        className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
                      >
                        <Square className="w-3.5 h-3.5 fill-current" />
                        <span>Stop Timer</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={isActiveOnOtherTask || timerActionLoading || task.status === 'COMPLETED'}
                          onClick={handleStartTimer}
                          title={
                            task.status === 'COMPLETED'
                              ? 'Cannot track time on completed task'
                              : isActiveOnOtherTask
                              ? `Active timer on "${activeSession?.task?.title || 'another task'}"`
                              : 'Start tracking time'
                          }
                          className="px-3 py-1.5 rounded-xl bg-powder-600 hover:bg-powder-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Start Timer</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            navigate(`/focus?taskId=${task._id}`);
                          }}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 transition"
                          title="Open in dedicated Focus Mode"
                        >
                          <Target className="w-3.5 h-3.5 text-mint-500" />
                          <span>Focus Mode</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Active on another task banner */}
                {isActiveOnOtherTask && (
                  <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Active timer running on <strong>"{activeSession?.task?.title || 'another task'}"</strong></span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        navigate('/focus');
                      }}
                      className="text-[11px] font-bold text-amber-700 dark:text-amber-300 underline hover:no-underline"
                    >
                      View
                    </button>
                  </div>
                )}

                {/* Time comparison grid */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Estimated</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      {timeSummary?.estimatedMinutes ? formatHumanTime(timeSummary.estimatedMinutes) : 'None'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tracked</span>
                    <span className="text-sm font-bold text-powder-600 dark:text-powder-400">
                      {formatHumanTime(timeSummary?.totalTrackedMinutes || 0)}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60">
                    {timeSummary?.isOverEstimate ? (
                      <>
                        <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block">Over by</span>
                        <span className="text-sm font-bold text-rose-600 dark:text-rose-400">
                          +{formatHumanTime(timeSummary.overMinutes)}
                        </span>
                      </>
                    ) : timeSummary?.estimatedMinutes ? (
                      <>
                        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider block">Remaining</span>
                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                          {formatHumanTime(timeSummary.remainingMinutes)}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Remaining</span>
                        <span className="text-sm font-bold text-slate-500 dark:text-slate-400">—</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Progress bar comparing tracked to estimated */}
                {timeSummary?.estimatedMinutes > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>Estimated vs. Actual</span>
                      <span>
                        {Math.round(
                          ((timeSummary?.totalTrackedMinutes || 0) / timeSummary.estimatedMinutes) * 100
                        )}%
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 rounded-full ${
                          timeSummary?.isOverEstimate
                            ? 'bg-rose-500'
                            : (timeSummary?.totalTrackedMinutes || 0) / timeSummary.estimatedMinutes > 0.85
                            ? 'bg-amber-500'
                            : 'bg-powder-500'
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              ((timeSummary?.totalTrackedMinutes || 0) / timeSummary.estimatedMinutes) * 100
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Historical sessions collapsible */}
                <div className="pt-1 border-t border-slate-200/50 dark:border-slate-800/50">
                  <button
                    type="button"
                    onClick={() => setShowTimeHistory(!showTimeHistory)}
                    className="w-full flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white py-1 transition"
                  >
                    <span className="flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5" />
                      <span>Session History ({timeSummary?.sessions?.length || 0})</span>
                    </span>
                    {showTimeHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {showTimeHistory && (
                    <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto scrollbar-thin pr-1">
                      {timeSummary?.sessions && timeSummary.sessions.length > 0 ? (
                        timeSummary.sessions.map((session) => (
                          <div
                            key={session._id}
                            className="p-2 rounded-lg bg-white dark:bg-slate-900/90 border border-slate-200/50 dark:border-slate-800 flex items-center justify-between text-xs"
                          >
                            <div>
                              <span className="font-medium text-slate-800 dark:text-slate-200">
                                {new Date(session.startedAt).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                              <span className="text-slate-400 mx-1.5">•</span>
                              <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                                {new Date(session.startedAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}{' '}
                                –{' '}
                                {session.endedAt
                                  ? new Date(session.endedAt).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })
                                  : 'Active'}
                              </span>
                            </div>
                            <span className="font-bold text-powder-600 dark:text-powder-400">
                              {formatHumanTime(Math.round((session.durationSeconds || 0) / 60))}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400 text-center py-2">No completed sessions yet.</p>
                      )}
                    </div>
                  )}
                </div>
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
                </div>

                {/* Reusable Progress Bar */}
                {subtasksList.length > 0 && (
                  <TaskProgressBar
                    subtasks={subtasksList}
                    status={task.status}
                    size="sm"
                    showPercentage={true}
                    showSubtaskCount={false}
                  />
                )}

                {/* Subtask Items */}
                <div className="space-y-1.5">
                  {subtasksList.map((st) => (
                    <div
                      key={st._id}
                      className="group p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-950 flex items-center justify-between gap-3 text-xs transition hover:border-powder-200 dark:hover:border-powder-800"
                    >
                      {editingSubtaskId === st._id ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleSaveSubtask(st._id);
                          }}
                          className="flex items-center gap-2 flex-1 min-w-0"
                        >
                          <input
                            type="text"
                            autoFocus
                            value={editingSubtaskTitle}
                            onChange={(e) => setEditingSubtaskTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') handleCancelEditSubtask();
                            }}
                            className="flex-1 px-2.5 py-1 rounded-lg border border-powder-300 dark:border-powder-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:ring-2 focus:ring-powder-500/30 transition"
                          />
                          <button
                            type="submit"
                            disabled={editingSubtaskLoading || !editingSubtaskTitle.trim()}
                            className="p-1 rounded-md text-mint-600 dark:text-mint-400 hover:bg-mint-50 dark:hover:bg-mint-950/60 transition disabled:opacity-50"
                            title="Save subtask"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEditSubtask}
                            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </form>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={isViewer}
                            onClick={() => handleToggleSubtask(st._id, st.completed)}
                            className="flex items-center gap-2.5 flex-1 text-left min-w-0"
                          >
                            {st.completed ? (
                              <CheckCircle2 className="w-4 h-4 text-mint-500 shrink-0" />
                            ) : (
                              <Circle className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                            )}
                            <span
                              className={`truncate transition ${
                                st.completed
                                  ? 'line-through text-slate-400 dark:text-slate-500'
                                  : 'text-slate-800 dark:text-slate-200 font-medium'
                              }`}
                            >
                              {st.title}
                            </span>
                          </button>

                          {!isViewer && (
                            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition">
                              <button
                                type="button"
                                onClick={() => handleStartEditSubtask(st)}
                                className="p-1 rounded text-slate-400 hover:text-powder-600 dark:hover:text-powder-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                                title="Edit subtask"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSubtask(st._id)}
                                className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                                title="Delete subtask"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </>
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

              {/* ── Collaboration Section (Comments & Activity) ── Only for Project Tasks */}
              {!isPersonal && (
                <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800 space-y-4">
                  {/* Tab switcher */}
                  <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                    <button
                      type="button"
                      onClick={() => setActiveCollabTab('comments')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        activeCollabTab === 'comments'
                          ? 'bg-powder-50 dark:bg-powder-950/60 text-powder-600 dark:text-powder-300'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Comments ({comments.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveCollabTab('activity')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        activeCollabTab === 'activity'
                          ? 'bg-powder-50 dark:bg-powder-950/60 text-powder-600 dark:text-powder-300'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>Activity Log ({activities.length})</span>
                    </button>
                  </div>

                  {/* COMMENTS TAB */}
                  {activeCollabTab === 'comments' && (
                    <div className="space-y-3">
                      {/* Comment list */}
                      {commentsLoading ? (
                        <div className="py-4 text-center text-xs text-slate-400">Loading comments...</div>
                      ) : comments.length === 0 ? (
                        <div className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/50 border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                          No comments yet. Start the collaboration!
                        </div>
                      ) : (
                        <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                          {comments.map((c) => {
                            const isAuthor = c.author?._id === currentUser?._id;
                            const canModerate = isOwner || isManager;
                            const isEditingThis = editingCommentId === c._id;

                            return (
                              <div
                                key={c._id}
                                className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1.5 text-xs"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full bg-powder-100 dark:bg-powder-900/60 text-powder-600 dark:text-powder-300 font-bold flex items-center justify-center text-[10px]">
                                      {c.author?.name ? c.author.name.charAt(0).toUpperCase() : 'U'}
                                    </div>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">
                                      {c.author?.name || 'Member'}
                                    </span>
                                    {isAuthor && (
                                      <span className="text-[9px] px-1 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                        You
                                      </span>
                                    )}
                                    <span className="text-[10px] text-slate-400">
                                      {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>

                                  {/* Actions */}
                                  <div className="flex items-center gap-1.5">
                                    {isAuthor && !isEditingThis && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingCommentId(c._id);
                                          setEditingCommentText(c.content);
                                        }}
                                        className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
                                        title="Edit comment"
                                      >
                                        <Edit3 className="w-3 h-3" />
                                      </button>
                                    )}
                                    {(isAuthor || canModerate) && !isEditingThis && (
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteComment(c._id)}
                                        className="p-1 rounded text-slate-400 hover:text-rose-500 transition"
                                        title="Delete comment"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {isEditingThis ? (
                                  <div className="space-y-2 pt-1">
                                    <textarea
                                      value={editingCommentText}
                                      onChange={(e) => setEditingCommentText(e.target.value)}
                                      rows={2}
                                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white resize-none focus:outline-hidden focus:ring-1 focus:ring-powder-500"
                                    />
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => setEditingCommentId(null)}
                                        className="px-2 py-1 rounded text-[11px] text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateComment(c._id)}
                                        className="px-2.5 py-1 rounded bg-powder-600 text-white text-[11px] font-semibold hover:bg-powder-700"
                                      >
                                        Save
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                                    {c.content}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Add comment input (unless VIEWER) */}
                      {!isViewer ? (
                        <form onSubmit={handleAddComment} className="flex items-start gap-2 pt-1">
                          <textarea
                            value={commentContent}
                            onChange={(e) => setCommentContent(e.target.value)}
                            placeholder="Write a comment or note..."
                            rows={2}
                            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:ring-2 focus:ring-powder-500/30 transition resize-none"
                          />
                          <button
                            type="submit"
                            disabled={submittingComment || !commentContent.trim()}
                            className="px-3.5 py-2 mt-1 rounded-xl bg-powder-600 hover:bg-powder-700 text-white text-xs font-semibold shadow-xs transition disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Post</span>
                          </button>
                        </form>
                      ) : (
                        <p className="text-[11px] text-slate-400 italic">Viewers have read-only access to comments.</p>
                      )}
                    </div>
                  )}

                  {/* ACTIVITY LOG TAB */}
                  {activeCollabTab === 'activity' && (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {activitiesLoading ? (
                        <div className="py-4 text-center text-xs text-slate-400">Loading activity...</div>
                      ) : activities.length === 0 ? (
                        <div className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/50 border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                          No activity records logged yet.
                        </div>
                      ) : (
                        activities.map((a) => (
                          <div
                            key={a._id}
                            className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-start gap-2.5 text-xs"
                          >
                            <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center text-[9px] shrink-0 mt-0.5">
                              {a.actor?.name ? a.actor.name.charAt(0).toUpperCase() : 'A'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-slate-800 dark:text-slate-200 leading-snug">
                                {a.details}
                              </p>
                              <span className="text-[10px] text-slate-400">
                                {new Date(a.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskDetailsModal;
