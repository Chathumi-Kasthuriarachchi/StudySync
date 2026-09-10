import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Target,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Flag,
  FolderKanban,
  User,
  Calendar,
  MoreVertical,
  Edit2,
  Trash2,
  ArrowRight,
  TrendingUp,
  Award,
} from 'lucide-react';
import { getGoals, deleteGoal } from '../services/goalService';
import CreateGoalModal from '../components/goals/CreateGoalModal';

const Goals = () => {
  const navigate = useNavigate();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [scopeFilter, setScopeFilter] = useState('all'); // all | personal | project
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL | IN_PROGRESS | COMPLETED | NOT_STARTED | ON_HOLD
  const [searchQuery, setSearchQuery] = useState('');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);

  useEffect(() => {
    fetchGoals();
  }, [scopeFilter, statusFilter]);

  const fetchGoals = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (scopeFilter !== 'all') params.scope = scopeFilter;
      if (statusFilter !== 'ALL') params.status = statusFilter;

      const res = await getGoals(params);
      setGoals(res.goals || []);
    } catch (err) {
      console.error('Failed to load goals:', err);
      setError(err.response?.data?.message || 'Failed to load goals');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGoal = async (e, goalId) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this goal? Linked tasks will remain intact.')) {
      return;
    }

    try {
      await deleteGoal(goalId);
      setGoals((prev) => prev.filter((g) => g._id !== goalId));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete goal');
    }
  };

  const handleEditGoal = (e, goal) => {
    e.stopPropagation();
    setEditingGoal(goal);
    setIsModalOpen(true);
  };

  // Filtered goals by search
  const filteredGoals = goals.filter((g) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      g.title?.toLowerCase().includes(q) ||
      g.description?.toLowerCase().includes(q) ||
      g.project?.name?.toLowerCase().includes(q)
    );
  });

  // Analytics summary
  const totalGoals = goals.length;
  const completedGoals = goals.filter((g) => g.status === 'COMPLETED').length;
  const inProgressGoals = goals.filter((g) => g.status === 'IN_PROGRESS').length;
  const avgProgress = totalGoals > 0
    ? Math.round(goals.reduce((acc, g) => acc + (g.progress || 0), 0) / totalGoals)
    : 0;

  const getMeasurementBadge = (type) => {
    switch (type) {
      case 'TIME':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Clock className="w-3 h-3" /> Focus Time
          </span>
        );
      case 'MILESTONE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <Flag className="w-3 h-3" /> Milestone
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <CheckCircle2 className="w-3 h-3" /> Task Count
          </span>
        );
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            Completed
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            In Progress
          </span>
        );
      case 'ON_HOLD':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            On Hold
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
            Not Started
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Banner & Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Target className="w-4 h-4" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              Goals & Objectives
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Connect your high-level outcomes to daily tasks and real-time progress
          </p>
        </div>

        <button
          onClick={() => {
            setEditingGoal(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-semibold text-sm rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Goal</span>
        </button>
      </div>

      {/* Stats Ribbon */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Goals</span>
            <Target className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-2">{totalGoals}</p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">In Progress</span>
            <TrendingUp className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2">{inProgressGoals}</p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Completed</span>
            <Award className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">{completedGoals}</p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Avg Progress</span>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{avgProgress}%</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full mt-3 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${avgProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 bg-white/60 dark:bg-slate-900/60 backdrop-blur rounded-xl border border-slate-200 dark:border-slate-800">
        {/* Scope Tabs */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          {[
            { id: 'all', label: 'All Goals' },
            { id: 'personal', label: 'Personal' },
            { id: 'project', label: 'Project' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setScopeFilter(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                scopeFilter === tab.id
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Status Dropdown & Search */}
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="NOT_STARTED">Not Started</option>
            <option value="ON_HOLD">On Hold</option>
          </select>

          <div className="relative flex-1 md:w-56">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search goals..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Goals Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-48 rounded-2xl bg-slate-100 dark:bg-slate-800/50 animate-pulse border border-slate-200/50 dark:border-slate-800"
            />
          ))}
        </div>
      ) : filteredGoals.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white/50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-500 flex items-center justify-center mx-auto mb-3">
            <Target className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Goals Found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-4">
            {searchQuery
              ? 'No goals match your search filter. Try adjusting your search term.'
              : 'Create your first goal to organize related tasks and track real outcome progress.'}
          </p>
          <button
            onClick={() => {
              setEditingGoal(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Goal</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredGoals.map((goal) => {
            const isPersonal = !goal.project;
            const progress = goal.progress || 0;

            return (
              <div
                key={goal._id}
                onClick={() => navigate(`/goals/${goal._id}`)}
                className="group relative flex flex-col justify-between p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500/50 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer overflow-hidden"
              >
                {/* Card Top */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isPersonal ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          <User className="w-3 h-3" /> Personal
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 max-w-[130px] truncate">
                          <FolderKanban className="w-3 h-3 shrink-0" />
                          <span className="truncate">{goal.project?.name || 'Project'}</span>
                        </span>
                      )}

                      {getMeasurementBadge(goal.measurementType)}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {getStatusBadge(goal.status)}
                      <button
                        onClick={(e) => handleEditGoal(e, goal)}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Edit Goal"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteGoal(e, goal._id)}
                        className="p-1 text-slate-400 hover:text-red-500 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete Goal"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
                    {goal.title}
                  </h3>

                  {goal.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 line-clamp-2">
                      {goal.description}
                    </p>
                  )}
                </div>

                {/* Card Bottom: Progress & Details */}
                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
                  {/* Progress Header */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-600 dark:text-slate-400">Progress</span>
                    <span className="font-black text-slate-800 dark:text-slate-100">{progress}%</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        progress >= 100
                          ? 'bg-emerald-500'
                          : progress >= 50
                          ? 'bg-blue-500'
                          : 'bg-amber-500'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  {/* Metrics details & Target Date */}
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                    <div className="flex items-center gap-1">
                      {goal.measurementType === 'TIME' ? (
                        <span>
                          {goal.metrics?.trackedHours || 0} / {goal.targetValue || 0} hrs
                        </span>
                      ) : goal.measurementType === 'MILESTONE' ? (
                        <span>
                          {goal.metrics?.completedMilestones || 0} / {goal.metrics?.totalMilestones || 0} milestones
                        </span>
                      ) : (
                        <span>
                          {goal.completedTaskCount || 0} / {goal.targetValue > 0 ? goal.targetValue : (goal.taskCount || 0)} tasks
                        </span>
                      )}
                    </div>

                    {goal.targetDate && (
                      <div className="flex items-center gap-1 text-slate-400">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(goal.targetDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <CreateGoalModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingGoal(null);
        }}
        onGoalCreated={() => fetchGoals()}
        editGoal={editingGoal}
      />
    </div>
  );
};

export default Goals;
