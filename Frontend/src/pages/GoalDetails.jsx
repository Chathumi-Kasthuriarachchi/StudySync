import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Target,
  Clock,
  CheckCircle2,
  Flag,
  Calendar,
  FolderKanban,
  User,
  Plus,
  Unlink,
  Edit2,
  Trash2,
  AlertCircle,
  Check,
  ExternalLink,
} from 'lucide-react';
import {
  getGoalById,
  deleteGoal,
  linkTaskToGoal,
  unlinkTaskFromGoal,
  updateGoal,
} from '../services/goalService';
import { getPersonalTasks, getProjectTasks } from '../services/taskService';
import CreateGoalModal from '../components/goals/CreateGoalModal';
import CreateTaskModal from '../components/tasks/CreateTaskModal';
import TaskDetailsModal from '../components/tasks/TaskDetailsModal';

const GoalDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [goal, setGoal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [selectedTaskForDetails, setSelectedTaskForDetails] = useState(null);

  // Available tasks to link
  const [availableTasks, setAvailableTasks] = useState([]);
  const [loadingAvailableTasks, setLoadingAvailableTasks] = useState(false);
  const [selectedTaskIdToLink, setSelectedTaskIdToLink] = useState('');
  const [linkingLoading, setLinkingLoading] = useState(false);

  useEffect(() => {
    fetchGoalDetails();
  }, [id]);

  const fetchGoalDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getGoalById(id);
      setGoal(res.goal);
    } catch (err) {
      console.error('Failed to load goal:', err);
      setError(err.response?.data?.message || 'Failed to load goal details');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      const res = await updateGoal(goal._id, { status: newStatus });
      setGoal((prev) => ({ ...prev, ...res.goal }));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update status');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this goal? Linked tasks will remain intact.')) {
      return;
    }

    try {
      await deleteGoal(goal._id);
      navigate('/goals');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete goal');
    }
  };

  const handleUnlinkTask = async (taskId) => {
    if (!window.confirm('Unlink this task from the goal? The task will not be deleted.')) {
      return;
    }

    try {
      const res = await unlinkTaskFromGoal(goal._id, taskId);
      // Refresh goal details to recompute derived progress
      await fetchGoalDetails();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to unlink task');
    }
  };

  const openLinkTaskModal = async () => {
    setIsLinkModalOpen(true);
    setSelectedTaskIdToLink('');
    setLoadingAvailableTasks(true);

    try {
      let tasks = [];
      if (!goal.project) {
        // Personal tasks
        const res = await getPersonalTasks();
        tasks = res.tasks || res.data || [];
      } else {
        // Project tasks
        const projId = goal.project._id || goal.project;
        const res = await getProjectTasks(projId);
        tasks = res.tasks || res.data || [];
      }

      // Filter out tasks already linked to THIS goal
      const existingTaskIds = new Set((goal.tasks || []).map((t) => t._id));
      const unlinked = tasks.filter((t) => !existingTaskIds.has(t._id));
      setAvailableTasks(unlinked);
    } catch (err) {
      console.error('Failed to load available tasks:', err);
    } finally {
      setLoadingAvailableTasks(false);
    }
  };

  const handleLinkTaskSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTaskIdToLink) return;

    setLinkingLoading(true);
    try {
      await linkTaskToGoal(goal._id, selectedTaskIdToLink);
      setIsLinkModalOpen(false);
      await fetchGoalDetails();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to link task');
    } finally {
      setLinkingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fadeIn p-6">
        <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
        <div className="h-64 bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse" />
        <div className="h-96 bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (error || !goal) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Unable to load goal</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">{error || 'Goal not found'}</p>
        <button
          onClick={() => navigate('/goals')}
          className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-xl"
        >
          Back to Goals
        </button>
      </div>
    );
  }

  const isPersonal = !goal.project;
  const progress = goal.progress || 0;
  const tasks = goal.tasks || [];

  return (
    <div className="space-y-6 animate-fadeIn pb-16 max-w-5xl mx-auto">
      {/* Back & Top Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/goals')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Goals</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 border border-slate-200 dark:border-slate-700 rounded-xl transition-all shadow-sm"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>
          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-900/40 rounded-xl transition-all shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Goal Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {isPersonal ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <User className="w-3.5 h-3.5" /> Personal Goal
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <FolderKanban className="w-3.5 h-3.5" /> {goal.project?.name || 'Project Goal'}
              </span>
            )}

            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400">
              {goal.measurementType === 'TIME' ? (
                <>
                  <Clock className="w-3.5 h-3.5" /> Focus Time
                </>
              ) : goal.measurementType === 'MILESTONE' ? (
                <>
                  <Flag className="w-3.5 h-3.5" /> Milestones
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Task Count
                </>
              )}
            </span>
          </div>

          {/* Status Changer */}
          <select
            value={goal.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none"
          >
            <option value="NOT_STARTED">Not Started</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="ON_HOLD">On Hold</option>
          </select>
        </div>

        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            {goal.title}
          </h1>
          {goal.description && (
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
              {goal.description}
            </p>
          )}
        </div>

        {/* Timeline */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>Started: {goal.startDate ? new Date(goal.startDate).toLocaleDateString() : 'N/A'}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Target className="w-4 h-4 text-blue-500" />
            <span>Target Deadline: {goal.targetDate ? new Date(goal.targetDate).toLocaleDateString() : 'No deadline'}</span>
          </div>
        </div>
      </div>

      {/* Hero Progress Banner */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-xl shadow-blue-500/15 relative overflow-hidden">
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div className="space-y-1">
            <span className="text-xs uppercase font-bold tracking-wider text-blue-200">Derived Progress</span>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black tracking-tight">{progress}%</span>
              <span className="text-sm text-blue-100 font-medium">calculated from linked work</span>
            </div>
            <p className="text-xs text-blue-100/80">
              {progress >= 100
                ? 'Goal target achieved!'
                : progress > 0
                ? 'Consistent progress across linked tasks'
                : 'Complete linked tasks to move this progress forward'}
            </p>
          </div>

          {/* Metric Details Column */}
          <div className="md:col-span-2 bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/15">
            <div className="flex items-center justify-between text-xs font-semibold mb-2">
              <span>Performance Breakdown</span>
              <span>
                {goal.measurementType === 'TIME'
                  ? `${goal.metrics?.trackedHours || 0} / ${goal.targetValue || 0} Hours`
                  : goal.measurementType === 'MILESTONE'
                  ? `${goal.metrics?.completedMilestones || 0} / ${goal.metrics?.totalMilestones || 0} Milestones`
                  : `${goal.completedTaskCount || 0} / ${goal.targetValue > 0 ? goal.targetValue : (goal.taskCount || 0)} Tasks`}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-black/25 h-3 rounded-full overflow-hidden p-0.5">
              <div
                className="h-full bg-white rounded-full transition-all duration-700 shadow-sm"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4 text-center">
              <div className="bg-black/20 rounded-lg p-2">
                <p className="text-[11px] text-blue-100 opacity-80">Linked Tasks</p>
                <p className="text-base font-bold">{goal.taskCount || tasks.length}</p>
              </div>

              <div className="bg-black/20 rounded-lg p-2">
                <p className="text-[11px] text-blue-100 opacity-80">Completed</p>
                <p className="text-base font-bold">{goal.completedTaskCount || 0}</p>
              </div>

              <div className="bg-black/20 rounded-lg p-2">
                <p className="text-[11px] text-blue-100 opacity-80">Remaining</p>
                <p className="text-base font-bold">
                  {Math.max(0, (goal.taskCount || tasks.length) - (goal.completedTaskCount || 0))}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Linked Tasks Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Linked Tasks</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                {tasks.length}
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Tasks contributing directly to this goal's completion
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={openLinkTaskModal}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Link Existing Task</span>
            </button>

            <button
              onClick={() => setIsCreateTaskModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Task</span>
            </button>
          </div>
        </div>

        {/* Task Cards List */}
        {tasks.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
            <CheckCircle2 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No tasks linked yet</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-4">
              Link existing tasks or create new ones to track progress toward this goal.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={openLinkTaskModal}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl"
              >
                Link Existing Task
              </button>
              <button
                onClick={() => setIsCreateTaskModalOpen(true)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl"
              >
                Create New Task
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {tasks.map((task) => {
              const isCompleted = task.status === 'COMPLETED';

              return (
                <div
                  key={task._id}
                  className="py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 px-2 rounded-xl transition-all group"
                >
                  <div
                    onClick={() => setSelectedTaskForDetails(task)}
                    className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
                  >
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                        isCompleted
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {isCompleted && <Check className="w-3.5 h-3.5" />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-medium transition-colors ${
                            isCompleted
                              ? 'line-through text-slate-400 dark:text-slate-500'
                              : 'text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                          }`}
                        >
                          {task.title}
                        </span>

                        {task.isMilestone && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400">
                            <Flag className="w-2.5 h-2.5" /> Milestone
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                        <span
                          className={`font-semibold ${
                            task.priority === 'URGENT'
                              ? 'text-red-500'
                              : task.priority === 'HIGH'
                              ? 'text-amber-500'
                              : 'text-slate-500'
                          }`}
                        >
                          {task.priority}
                        </span>

                        {task.dueDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                        )}

                        {task.assignee && (
                          <span>Assigned: {task.assignee.name || task.assignee.email}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleUnlinkTask(task._id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Unlink from Goal"
                    >
                      <Unlink className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Link Existing Task Modal */}
      {isLinkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
              Link Task to Goal
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Choose a task from this {isPersonal ? 'personal account' : 'project'} to connect.
            </p>

            {loadingAvailableTasks ? (
              <div className="py-8 text-center text-xs text-slate-500">Loading available tasks...</div>
            ) : availableTasks.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                No unlinked tasks available in this {isPersonal ? 'personal workspace' : 'project'}. Create a new task instead!
              </div>
            ) : (
              <form onSubmit={handleLinkTaskSubmit} className="space-y-4">
                <select
                  value={selectedTaskIdToLink}
                  onChange={(e) => setSelectedTaskIdToLink(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:outline-none"
                  required
                >
                  <option value="">Select a task...</option>
                  {availableTasks.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.title} ({t.status})
                    </option>
                  ))}
                </select>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsLinkModalOpen(false)}
                    className="px-3.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!selectedTaskIdToLink || linkingLoading}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow disabled:opacity-50"
                  >
                    {linkingLoading ? 'Linking...' : 'Link Task'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Edit Goal Modal */}
      <CreateGoalModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onGoalCreated={() => fetchGoalDetails()}
        editGoal={goal}
      />

      {/* Create Task Modal pre-linked to this goal */}
      <CreateTaskModal
        isOpen={isCreateTaskModalOpen}
        onClose={() => setIsCreateTaskModalOpen(false)}
        projectId={goal.project?._id || goal.project || null}
        onTaskCreated={async (newTask) => {
          if (newTask && newTask._id) {
            try {
              await linkTaskToGoal(goal._id, newTask._id);
            } catch (_) {}
          }
          await fetchGoalDetails();
        }}
      />

      {/* Task Details Modal */}
      {selectedTaskForDetails && (
        <TaskDetailsModal
          isOpen={Boolean(selectedTaskForDetails)}
          onClose={() => setSelectedTaskForDetails(null)}
          taskId={selectedTaskForDetails._id}
          onTaskUpdated={() => fetchGoalDetails()}
        />
      )}
    </div>
  );
};

export default GoalDetails;
