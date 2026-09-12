import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Users,
  Shield,
  Settings as SettingsIcon,
  UserPlus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  X,
  Layers,
  Edit3,
  LogOut,
  Mail,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  BarChart3,
  Timer,
  Target,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
} from 'recharts';
import {
  getProjectById,
  updateProject,
  deleteProject,
  getProjectMembers,
  updateMemberRole,
  removeProjectMember,
  getProjectInvitations,
  cancelInvitation,
  getProjectWorkload,
} from '../services/projectService';
import {
  getProjectAnalytics,
  getTeamAnalytics,
} from '../services/analyticsService';
import { useAuth } from '../context/AuthContext';
import { getRoleBadge, getStatusBadge, calculateTimeline } from './Projects';
import InviteMemberModal from '../components/projects/InviteMemberModal';
import ProjectTasksTab from '../components/projects/ProjectTasksTab';

/**
 * Format date helper for input fields (YYYY-MM-DD)
 */
const formatDateInput = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
};

/**
 * Workload signal badge helper (Phase 7 Task Intelligence)
 */
const getWorkloadSignalBadge = (signal) => {
  switch (signal) {
    case 'HIGH':
      return {
        label: 'High Workload',
        badge: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
      };
    case 'MODERATE':
      return {
        label: 'Moderate Workload',
        badge: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      };
    case 'LOW':
    default:
      return {
        label: 'Low Workload',
        badge: 'bg-mint-50 dark:bg-mint-950/60 text-mint-700 dark:text-mint-300 border-mint-200 dark:border-mint-800',
      };
  }
};

const ProjectDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [workloadData, setWorkloadData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'timeline' | 'members' | 'settings'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  // Settings Edit State
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editStatus, setEditStatus] = useState('PLANNING');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');
  const [settingsError, setSettingsError] = useState('');

  // Delete & Leave state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Analytics State (Phase 12)
  const [projectAnalytics, setProjectAnalytics] = useState(null);
  const [teamAnalytics, setTeamAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsPeriod, setAnalyticsPeriod] = useState('all');
  const [teamForbidden, setTeamForbidden] = useState(false);

  const fetchProjectAnalyticsData = useCallback(async (period = analyticsPeriod) => {
    try {
      setAnalyticsLoading(true);
      const [projRes, teamRes] = await Promise.allSettled([
        getProjectAnalytics(id, { period }),
        getTeamAnalytics(id, { period }),
      ]);

      if (projRes.status === 'fulfilled' && projRes.value?.success) {
        setProjectAnalytics(projRes.value.data);
      }

      if (teamRes.status === 'fulfilled' && teamRes.value?.success) {
        setTeamAnalytics(teamRes.value.data);
        setTeamForbidden(false);
      } else if (teamRes.status === 'rejected' && teamRes.reason?.response?.status === 403) {
        setTeamForbidden(true);
      }
    } catch (err) {
      console.error('fetchProjectAnalyticsData error:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [id, analyticsPeriod]);

  useEffect(() => {
    if (activeTab === 'analytics') {
      fetchProjectAnalyticsData(analyticsPeriod);
    }
  }, [activeTab, analyticsPeriod, fetchProjectAnalyticsData]);

  const fetchProjectData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [projectRes, membersRes, workloadRes] = await Promise.all([
        getProjectById(id),
        getProjectMembers(id),
        getProjectWorkload(id).catch(() => null),
      ]);

      if (projectRes.success) {
        const p = projectRes.data;
        setProject(p);
        setEditName(p.name);
        setEditDescription(p.description || '');
        setEditStartDate(formatDateInput(p.startDate));
        setEditDueDate(formatDateInput(p.dueDate));
        setEditStatus(p.status);
      }

      if (membersRes.success) {
        setMembers(membersRes.data);
      }

      if (workloadRes && workloadRes.success) {
        setWorkloadData(workloadRes.data);
      }

      // Fetch pending project invitations if user is Owner or Manager
      if (['OWNER', 'MANAGER'].includes(projectRes.data?.userRole)) {
        const invRes = await getProjectInvitations(id);
        if (invRes.success) {
          setInvitations(invRes.data);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load project details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProjectData();
  }, [fetchProjectData]);

  const isOwner = project?.userRole === 'OWNER';
  const isManager = project?.userRole === 'MANAGER';
  const canManage = isOwner || isManager;

  // ── Member Role Change Handler ──────────────────────────────────────────────
  const handleRoleChange = async (userId, newRole) => {
    try {
      const res = await updateMemberRole(id, userId, newRole);
      if (res.success) {
        // Refresh project and members data
        await fetchProjectData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update member role');
    }
  };

  // ── Member Removal Handler ──────────────────────────────────────────────────
  const handleRemoveMember = async (userId, memberName) => {
    const isSelf = userId === currentUser?._id;
    const confirmPrompt = isSelf
      ? 'Are you sure you want to leave this project?'
      : `Are you sure you want to remove ${memberName || 'this member'} from the project?`;

    if (!window.confirm(confirmPrompt)) return;

    try {
      const res = await removeProjectMember(id, userId);
      if (res.success) {
        if (isSelf) {
          navigate('/projects');
        } else {
          setMembers((prev) => prev.filter((m) => m.user._id !== userId));
        }
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove member');
    }
  };

  // ── Cancel Invitation Handler ───────────────────────────────────────────────
  const handleCancelInvitation = async (invitationId) => {
    try {
      const res = await cancelInvitation(id, invitationId);
      if (res.success) {
        setInvitations((prev) => prev.filter((inv) => inv._id !== invitationId));
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel invitation');
    }
  };

  // ── Save Settings Handler ───────────────────────────────────────────────────
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSettingsError('');
    setSettingsMsg('');

    if (!editName.trim()) {
      setSettingsError('Project name cannot be empty');
      return;
    }

    const start = new Date(editStartDate);
    const due = new Date(editDueDate);
    if (due < start) {
      setSettingsError('Due date cannot be earlier than start date');
      return;
    }

    try {
      setSavingSettings(true);
      const res = await updateProject(id, {
        name: editName.trim(),
        description: editDescription.trim(),
        startDate: editStartDate,
        dueDate: editDueDate,
        status: editStatus,
      });

      if (res.success) {
        setProject((prev) => ({
          ...prev,
          ...res.data,
        }));
        setSettingsMsg('Project settings saved successfully');
        setTimeout(() => setSettingsMsg(''), 3000);
      }
    } catch (err) {
      setSettingsError(err.response?.data?.message || 'Failed to update project settings');
    } finally {
      setSavingSettings(false);
    }
  };

  // ── Delete Project Handler ──────────────────────────────────────────────────
  const handleDeleteProject = async () => {
    try {
      setDeleting(true);
      const res = await deleteProject(id);
      if (res.success) {
        navigate('/projects');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete project');
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse p-4">
        <div className="h-6 w-32 bg-slate-200 dark:bg-slate-800 rounded-md" />
        <div className="h-10 w-3/4 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div className="h-64 bg-slate-100 dark:bg-slate-800/60 rounded-3xl" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center max-w-lg mx-auto shadow-xs">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
          {error || 'Project Not Found'}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
          You may not have permission to view this project or it may have been deleted.
        </p>
        <Link
          to="/projects"
          className="px-4 py-2 rounded-xl bg-powder-600 text-white text-xs font-semibold hover:bg-powder-700 transition inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Projects</span>
        </Link>
      </div>
    );
  }

  const roleBadge = getRoleBadge(project.userRole);
  const statusBadge = getStatusBadge(project.status);
  const timeline = calculateTimeline(project.startDate, project.dueDate, project.status);

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <Link
            to="/projects"
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-powder-600 dark:hover:text-powder-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            title="Back to projects"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                {project.name}
              </h1>
              {/* Status & Role Badges */}
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusBadge.bg}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
                {statusBadge.label}
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${roleBadge.bg}`}
              >
                <Shield className="w-3 h-3" />
                Your Role: {roleBadge.label}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Top Actions */}
        {canManage && (
          <button
            type="button"
            onClick={() => setIsInviteOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-powder-600 hover:bg-powder-700 text-white text-xs font-semibold shadow-xs transition flex items-center gap-1.5 w-fit self-end sm:self-center"
          >
            <UserPlus className="w-4 h-4" />
            <span>Invite Member</span>
          </button>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-px overflow-x-auto scrollbar-none">
        {[
          { id: 'overview', label: 'Overview', icon: Layers },
          { id: 'tasks', label: 'Tasks', icon: CheckSquare },
          { id: 'timeline', label: 'Timeline', icon: Clock },
          { id: 'members', label: `Members (${members.length})`, icon: Users },
          { id: 'analytics', label: 'Analytics', icon: BarChart3 },
          { id: 'settings', label: 'Settings', icon: SettingsIcon },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition shrink-0 ${
                isActive
                  ? 'border-powder-600 text-powder-600 dark:text-powder-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: OVERVIEW ─────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          {/* Main Summary Section */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs space-y-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Project Summary
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {project.description || 'No description has been provided for this project.'}
              </p>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Start Date
                </span>
                <p className="text-base font-bold text-slate-900 dark:text-white mt-1">
                  {timeline?.formattedStart}
                </p>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Due Date
                </span>
                <p className="text-base font-bold text-slate-900 dark:text-white mt-1">
                  {timeline?.formattedDue}
                </p>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Timeline Status
                </span>
                <p
                  className={`text-base font-bold mt-1 ${
                    timeline?.isOverdue
                      ? 'text-rose-600 dark:text-rose-400'
                      : project.status === 'COMPLETED'
                      ? 'text-powder-600 dark:text-powder-400'
                      : 'text-mint-600 dark:text-mint-400'
                  }`}
                >
                  {timeline?.isOverdue
                    ? `Overdue by ${Math.abs(timeline.daysRemaining)}d`
                    : project.status === 'COMPLETED'
                    ? 'Finished'
                    : `${timeline?.daysRemaining} days left`}
                </p>
              </div>
            </div>

            {/* Recent Members Preview Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Team Members ({members.length})
                </h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('members')}
                  className="text-xs font-semibold text-powder-600 dark:text-powder-400 hover:underline flex items-center gap-1"
                >
                  <span>View All</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {members.slice(0, 4).map((m) => {
                  const mRole = getRoleBadge(m.role);
                  return (
                    <div
                      key={m._id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-powder-100 dark:bg-powder-900/60 text-powder-600 dark:text-powder-400 flex items-center justify-center font-bold text-xs shrink-0">
                          {m.user?.name ? m.user.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {m.user?.name}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {m.user?.email}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${mRole.bg} shrink-0 ml-2`}
                      >
                        {mRole.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Sidebar Info Card */}
          <div className="space-y-6">
            {/* Owner Details Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Project Owner
              </span>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-extrabold flex items-center justify-center text-sm">
                  {project.owner?.name ? project.owner.name.charAt(0).toUpperCase() : 'O'}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {project.owner?.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {project.owner?.email}
                  </p>
                </div>
              </div>
            </div>

            {/* Role Permissions Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-2">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Your Permissions
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                As a project <strong>{project.userRole}</strong>:
              </p>
              <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 pt-1">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-mint-500" />
                  <span>View overview, timeline, and member list</span>
                </li>
                {canManage && (
                  <>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-mint-500" />
                      <span>Invite new members &amp; manage roles</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-mint-500" />
                      <span>Edit project dates, status &amp; description</span>
                    </li>
                  </>
                )}
                {isOwner && (
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-purple-500" />
                    <span>Transfer ownership &amp; delete project</span>
                  </li>
                )}
                {!canManage && (
                  <li className="flex items-center gap-2 text-slate-400">
                    <span>Read-only workspace access</span>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: TASKS ─────────────────────────────────────────────────────── */}
      {activeTab === 'tasks' && (
        <ProjectTasksTab
          projectId={id}
          projectRole={project.userRole}
          members={members}
        />
      )}

      {/* ── TAB 3: TIMELINE ─────────────────────────────────────────────────── */}
      {activeTab === 'timeline' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-xs space-y-8 animate-fadeIn">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Project Timeline &amp; Progress
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Visual timeline tracking elapsed days, milestone deadlines, and sprint status.
            </p>
          </div>

          {/* Timeline Bar Display */}
          <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-4">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-powder-500" />
                Start: {timeline?.formattedStart}
              </span>
              <span
                className={`font-bold flex items-center gap-1.5 ${
                  timeline?.isOverdue
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-900 dark:text-white'
                }`}
              >
                <Clock className="w-4 h-4 text-mint-500" />
                Due: {timeline?.formattedDue}
              </span>
            </div>

            {/* Giant Progress Bar */}
            <div className="space-y-1.5">
              <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    timeline?.isOverdue
                      ? 'bg-rose-500'
                      : project.status === 'COMPLETED'
                      ? 'bg-powder-500'
                      : 'bg-mint-500'
                  }`}
                  style={{ width: `${timeline?.progressPct}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] font-medium text-slate-400">
                <span>0%</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {timeline?.progressPct}% of duration elapsed
                </span>
                <span>100%</span>
              </div>
            </div>
          </div>

          {/* Timeline Breakdown Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-center">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Total Duration
              </span>
              <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                {timeline?.totalDays} Days
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-center">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Days Remaining
              </span>
              <p
                className={`text-xl font-extrabold mt-1 ${
                  timeline?.daysRemaining < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-mint-600 dark:text-mint-400'
                }`}
              >
                {timeline?.daysRemaining >= 0 ? timeline.daysRemaining : 0} Days
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-center">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Overdue Days
              </span>
              <p
                className={`text-xl font-extrabold mt-1 ${
                  timeline?.isOverdue
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-400'
                }`}
              >
                {timeline?.isOverdue ? Math.abs(timeline.daysRemaining) : 0}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-center">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Current Status
              </span>
              <p className="text-base font-bold text-slate-900 dark:text-white mt-1">
                {project.status}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: MEMBERS ──────────────────────────────────────────────────── */}
      {activeTab === 'members' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Member Workload Section */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Team Workload & Assignment Distribution</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Real-time visibility into who is working on what across the project.
                </p>
              </div>

              {workloadData && (
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                    Total: {workloadData.totalProjectTasks} tasks
                  </span>
                  {workloadData.unassignedTasks > 0 && (
                    <span className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60 font-semibold">
                      {workloadData.unassignedTasks} unassigned
                    </span>
                  )}
                </div>
              )}
            </div>

            {workloadData?.workload && workloadData.workload.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                {workloadData.workload.map((w) => {
                  const mRole = getRoleBadge(w.member.role);
                  return (
                    <div
                      key={w.member._id}
                      className="p-4 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-powder-100 dark:bg-powder-900/60 text-powder-600 dark:text-powder-300 font-bold flex items-center justify-center text-xs">
                            {w.member.name ? w.member.name.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {w.member.name}
                            </h4>
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${mRole.bg}`}>
                              {mRole.label}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                            {w.totalAssigned} {w.totalAssigned === 1 ? 'task' : 'tasks'}
                          </span>
                          {w.workloadSignal && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${getWorkloadSignalBadge(w.workloadSignal).badge}`}>
                              {w.workloadSignal}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1">
                        <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-mint-500 rounded-full transition-all duration-300"
                            style={{ width: `${w.completionPct}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>Progress</span>
                          <span className="font-bold text-slate-700 dark:text-slate-300">
                            {w.completionPct}% completed
                          </span>
                        </div>
                      </div>

                      {/* Breakdown pills */}
                      <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                        <div className="p-1.5 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800">
                          <span className="block font-bold text-mint-600 dark:text-mint-400">{w.completed}</span>
                          <span className="text-slate-400">Done</span>
                        </div>
                        <div className="p-1.5 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800">
                          <span className="block font-bold text-powder-600 dark:text-powder-400">{w.inProgress}</span>
                          <span className="text-slate-400">Active</span>
                        </div>
                        <div className="p-1.5 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800">
                          <span className="block font-bold text-slate-600 dark:text-slate-300">{w.todo}</span>
                          <span className="text-slate-400">To Do</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-4 text-center text-xs text-slate-400">
                No member workload data available.
              </div>
            )}
          </div>

          {/* Members Table Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Project Members ({members.length})
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Manage collaborators, assign roles, and configure project permissions.
                </p>
              </div>

              {canManage && (
                <button
                  type="button"
                  onClick={() => setIsInviteOpen(true)}
                  className="px-4 py-2 rounded-xl bg-powder-600 hover:bg-powder-700 text-white text-xs font-semibold shadow-xs transition flex items-center gap-1.5 w-fit"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Invite Member</span>
                </button>
              )}
            </div>

            {/* Members Roster */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {members.map((m) => {
                const isMemberSelf = m.user?._id === currentUser?._id;
                const isTargetOwner = m.role === 'OWNER';
                const isTargetManager = m.role === 'MANAGER';
                const mRole = getRoleBadge(m.role);

                // Can the current user change this member's role?
                const canChangeRole =
                  !isMemberSelf &&
                  ((isOwner && !isTargetOwner) || (isManager && !isTargetOwner && !isTargetManager));

                // Can the current user remove this member?
                const canRemove =
                  isMemberSelf
                    ? !isTargetOwner // Can leave if not owner
                    : (isOwner && !isTargetOwner) || (isManager && !isTargetOwner && !isTargetManager);

                return (
                  <div
                    key={m._id}
                    className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition"
                  >
                    {/* User Profile Info */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-powder-100 dark:bg-powder-900/60 text-powder-600 dark:text-powder-400 font-bold flex items-center justify-center text-sm shrink-0">
                        {m.user?.name ? m.user.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            {m.user?.name}
                          </h3>
                          {isMemberSelf && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                              You
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span>{m.user?.email}</span>
                          <span>&bull;</span>
                          <span>Joined {new Date(m.joinedAt).toLocaleDateString()}</span>
                        </p>
                      </div>
                    </div>

                    {/* Role & Actions */}
                    <div className="flex items-center gap-3 self-end sm:self-center">
                      {/* Workload Signal Pill */}
                      {(() => {
                        const mWorkload = workloadData?.workload?.find((w) => w.member._id === m.user?._id);
                        if (!mWorkload || !mWorkload.workloadSignal) return null;
                        const sigBadge = getWorkloadSignalBadge(mWorkload.workloadSignal);
                        return (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border hidden md:inline-flex items-center gap-1 ${sigBadge.badge}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                            <span>{mWorkload.workloadSignal} ({mWorkload.activeAssigned ?? (mWorkload.todo + mWorkload.inProgress)} active)</span>
                          </span>
                        );
                      })()}

                      {/* Role Selector or Badge */}
                      {canChangeRole ? (
                        <select
                          value={m.role}
                          onChange={(e) => handleRoleChange(m.user._id, e.target.value)}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-powder-500/30 transition"
                        >
                          {isOwner && <option value="OWNER">Transfer Ownership</option>}
                          <option value="MANAGER">Manager</option>
                          <option value="MEMBER">Member</option>
                          <option value="VIEWER">Viewer</option>
                        </select>
                      ) : (
                        <span
                          className={`text-xs font-bold px-3 py-1 rounded-full border ${mRole.bg}`}
                        >
                          {mRole.label}
                        </span>
                      )}

                      {/* Remove / Leave Button */}
                      {canRemove && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(m.user._id, m.user?.name)}
                          className={`p-1.5 rounded-lg text-xs font-semibold transition ${
                            isMemberSelf
                              ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                              : 'text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                          title={isMemberSelf ? 'Leave Project' : 'Remove Member'}
                        >
                          {isMemberSelf ? (
                            <span className="flex items-center gap-1 text-xs">
                              <LogOut className="w-3.5 h-3.5" />
                              Leave
                            </span>
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pending Invitations Section (Managers/Owners) */}
          {canManage && invitations.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Sent Invitations Pending Acceptance ({invitations.length})
              </h3>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {invitations.map((inv) => (
                  <div
                    key={inv._id}
                    className="py-3 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">
                        {inv.invitedUser?.name || 'Invited User'} ({inv.invitedUser?.email})
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Role: <strong>{inv.role}</strong> &bull; Sent by {inv.invitedBy?.name || 'You'} &bull; Expires {new Date(inv.expiresAt).toLocaleDateString()}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCancelInvitation(inv._id)}
                      className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-semibold hover:bg-slate-50 transition"
                    >
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 4: SETTINGS ─────────────────────────────────────────────────── */}
      {activeTab === 'settings' && (
        <div className="space-y-6 max-w-2xl animate-fadeIn">
          {/* General Settings Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Project Settings
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {canManage
                ? 'Update module title, description, milestones, or current lifecycle status.'
                : 'Project settings can only be modified by project Owners or Managers.'}
            </p>

            {settingsError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{settingsError}</span>
              </div>
            )}

            {settingsMsg && (
              <div className="p-3 rounded-xl bg-mint-50 dark:bg-mint-950/50 border border-mint-200 dark:border-mint-900/60 flex items-center gap-2 text-mint-700 dark:text-mint-300 text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{settingsMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Project Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={!canManage}
                  required
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-powder-500/30 disabled:opacity-60 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  disabled={!canManage}
                  rows={3}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-powder-500/30 disabled:opacity-60 transition resize-none"
                />
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
                    disabled={!canManage}
                    required
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-powder-500/30 disabled:opacity-60 transition"
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
                    disabled={!canManage}
                    required
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-powder-500/30 disabled:opacity-60 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  disabled={!canManage}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-powder-500/30 disabled:opacity-60 transition"
                >
                  <option value="PLANNING">Planning</option>
                  <option value="ACTIVE">Active</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </div>

              {canManage && (
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="px-4 py-2 rounded-xl bg-powder-600 hover:bg-powder-700 text-white text-xs font-semibold shadow-xs transition disabled:opacity-50"
                  >
                    {savingSettings ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* Danger Zone */}
          <div className="bg-rose-50/50 dark:bg-rose-950/20 rounded-2xl border border-rose-200/80 dark:border-rose-900/40 p-6 space-y-4">
            <h3 className="text-sm font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              Danger Zone
            </h3>

            {isOwner ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Delete Project
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Permanently deletes this project and revokes all memberships. This action cannot be undone.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition shrink-0"
                >
                  Delete Project
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Leave Project
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Revoke your membership from this project. You will need a new invitation to re-join.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveMember(currentUser?._id, currentUser?.name)}
                  className="px-4 py-2 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-100/50 text-xs font-semibold transition shrink-0"
                >
                  Leave Project
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 5: ANALYTICS (Phase 12) ────────────────────────────────────── */}
      {activeTab === 'analytics' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header & Period Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-powder-600 dark:text-powder-400" />
                <span>Project & Team Analytics</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Detailed metrics on project completion, time spent, and member contribution.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
                {[
                  { key: 'all', label: 'All Time' },
                  { key: 'this_month', label: 'This Month' },
                  { key: 'this_week', label: 'This Week' },
                  { key: 'last_30_days', label: '30 Days' },
                ].map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setAnalyticsPeriod(p.key)}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                      analyticsPeriod === p.key
                        ? 'bg-white dark:bg-slate-900 text-powder-600 dark:text-powder-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => fetchProjectAnalyticsData(analyticsPeriod)}
                disabled={analyticsLoading}
                title="Refresh analytics"
                className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${analyticsLoading ? 'animate-spin text-powder-600' : ''}`} />
              </button>
            </div>
          </div>

          {/* Project KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {/* 1. Completion Rate */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Completion Rate
              </span>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                {analyticsLoading ? '—' : `${projectAnalytics?.taskMetrics?.completionPercentage ?? 0}%`}
              </p>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-powder-500 to-mint-400 h-full rounded-full transition-all"
                  style={{ width: `${projectAnalytics?.taskMetrics?.completionPercentage ?? 0}%` }}
                />
              </div>
            </div>

            {/* 2. Tasks Completed */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Completed Tasks
              </span>
              <p className="text-2xl font-extrabold text-mint-600 dark:text-mint-400 mt-1">
                {analyticsLoading ? '—' : projectAnalytics?.taskMetrics?.completed ?? 0}
              </p>
              <span className="text-[11px] text-slate-400 mt-1 block">
                of {projectAnalytics?.taskMetrics?.total ?? 0} total tasks
              </span>
            </div>

            {/* 3. In Progress */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Active Workload
              </span>
              <p className="text-2xl font-extrabold text-powder-600 dark:text-powder-400 mt-1">
                {analyticsLoading ? '—' : (projectAnalytics?.taskMetrics?.inProgress ?? 0) + (projectAnalytics?.taskMetrics?.todo ?? 0)}
              </p>
              <span className="text-[11px] text-slate-400 mt-1 block">
                {projectAnalytics?.taskMetrics?.inProgress ?? 0} in progress · {projectAnalytics?.taskMetrics?.todo ?? 0} to do
              </span>
            </div>

            {/* 4. Overdue Tasks */}
            <div className={`bg-white dark:bg-slate-900 rounded-2xl border p-4 shadow-xs ${
              (projectAnalytics?.taskMetrics?.overdue ?? 0) > 0
                ? 'border-rose-300 dark:border-rose-800 bg-rose-50/10'
                : 'border-slate-200 dark:border-slate-800'
            }`}>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Overdue
              </span>
              <p className={`text-2xl font-extrabold mt-1 ${
                (projectAnalytics?.taskMetrics?.overdue ?? 0) > 0 ? 'text-rose-600' : 'text-slate-900 dark:text-white'
              }`}>
                {analyticsLoading ? '—' : projectAnalytics?.taskMetrics?.overdue ?? 0}
              </p>
              <span className="text-[11px] text-slate-400 mt-1 block">
                {(projectAnalytics?.taskMetrics?.overdue ?? 0) > 0 ? 'Action required' : 'On schedule'}
              </span>
            </div>

            {/* 5. Time Tracked */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs col-span-2 sm:col-span-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Time Spent
              </span>
              <p className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">
                {analyticsLoading
                  ? '—'
                  : `${Math.round(((projectAnalytics?.timeMetrics?.totalTrackedSeconds ?? 0) / 3600) * 10) / 10}h`}
              </p>
              <span className="text-[11px] text-slate-400 mt-1 block">
                {projectAnalytics?.timeMetrics?.totalTrackedMinutes ?? 0} mins logged
              </span>
            </div>
          </div>

          {/* Project Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Status Distribution */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">
                Task Status Breakdown
              </h3>
              <div className="h-48 w-full">
                {projectAnalytics?.taskMetrics?.total > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'To Do', value: projectAnalytics.taskMetrics.byStatus.TODO || 0, color: '#94a3b8' },
                          { name: 'In Progress', value: projectAnalytics.taskMetrics.byStatus.IN_PROGRESS || 0, color: '#0ea5e9' },
                          { name: 'Completed', value: projectAnalytics.taskMetrics.byStatus.COMPLETED || 0, color: '#10b981' },
                        ].filter((i) => i.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {[
                          { color: '#94a3b8' },
                          { color: '#0ea5e9' },
                          { color: '#10b981' },
                        ].map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs shadow-md">
                                <span className="font-semibold">{payload[0].name}: </span>
                                <span>{payload[0].value} tasks</span>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">
                    No task data recorded
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-400">To Do</span>
                  <p className="font-bold">{projectAnalytics?.taskMetrics?.byStatus?.TODO ?? 0}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400">In Progress</span>
                  <p className="font-bold text-powder-600">{projectAnalytics?.taskMetrics?.byStatus?.IN_PROGRESS ?? 0}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400">Completed</span>
                  <p className="font-bold text-mint-600">{projectAnalytics?.taskMetrics?.byStatus?.COMPLETED ?? 0}</p>
                </div>
              </div>
            </div>

            {/* Priority Distribution */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">
                Priority Distribution
              </h3>
              <div className="h-48 w-full">
                {projectAnalytics?.taskMetrics?.total > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { name: 'Low', count: projectAnalytics.taskMetrics.byPriority.LOW || 0, fill: '#94a3b8' },
                        { name: 'Medium', count: projectAnalytics.taskMetrics.byPriority.MEDIUM || 0, fill: '#38bdf8' },
                        { name: 'High', count: projectAnalytics.taskMetrics.byPriority.HIGH || 0, fill: '#f59e0b' },
                        { name: 'Urgent', count: projectAnalytics.taskMetrics.byPriority.URGENT || 0, fill: '#f43f5e' },
                      ]}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} allowDecimals={false} />
                      <RechartsTooltip
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs shadow-md">
                                <span className="font-semibold">{label}: </span>
                                <span>{payload[0].value} tasks</span>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">
                    No task data recorded
                  </div>
                )}
              </div>
              <div className="grid grid-cols-4 gap-1 text-center text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-400">Low</span>
                  <p className="font-bold">{projectAnalytics?.taskMetrics?.byPriority?.LOW ?? 0}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400">Med</span>
                  <p className="font-bold text-sky-600">{projectAnalytics?.taskMetrics?.byPriority?.MEDIUM ?? 0}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400">High</span>
                  <p className="font-bold text-amber-600">{projectAnalytics?.taskMetrics?.byPriority?.HIGH ?? 0}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400">Urgent</span>
                  <p className="font-bold text-rose-600">{projectAnalytics?.taskMetrics?.byPriority?.URGENT ?? 0}</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Team Workload & Contribution Section ──────────────────────── */}
          {teamForbidden ? (
            <div className="bg-amber-50/60 dark:bg-amber-950/20 rounded-2xl border border-amber-200 dark:border-amber-900/60 p-5 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-3">
              <Shield className="w-5 h-5 text-amber-600 shrink-0" />
              <span>
                Detailed team workload and individual member contribution metrics are accessible to Project Members, Managers, and Owners.
              </span>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-powder-600" />
                    <span>Team Workload & Contribution</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Fair, transparent view of active tasks, completion rate, and logged time per member.
                  </p>
                </div>
                {teamAnalytics?.summary?.unassignedTasks > 0 && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 w-fit">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    {teamAnalytics.summary.unassignedTasks} unassigned task{teamAnalytics.summary.unassignedTasks === 1 ? '' : 's'}
                  </span>
                )}
              </div>

              {/* Members Workload List */}
              <div className="space-y-4">
                {teamAnalytics?.members?.map((m) => {
                  const signal = m.workloadSignal;
                  let signalBadge = 'bg-mint-50 dark:bg-mint-950/60 text-mint-700 dark:text-mint-300 border-mint-200 dark:border-mint-800';
                  if (signal === 'HIGH') {
                    signalBadge = 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800';
                  } else if (signal === 'MODERATE') {
                    signalBadge = 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
                  }

                  // Max task reference for visual bar:
                  const maxTasks = Math.max(1, ...teamAnalytics.members.map((x) => x.assignedTasks));
                  const workloadBarPct = Math.round((m.assignedTasks / maxTasks) * 100);

                  return (
                    <div
                      key={m.member._id}
                      className="p-4 rounded-xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          {m.member.profileImageURL ? (
                            <img
                              src={m.member.profileImageURL}
                              alt={m.member.name}
                              className="w-9 h-9 rounded-full object-cover border border-slate-200"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-powder-500 text-white flex items-center justify-center font-bold text-xs">
                              {m.member.name?.slice(0, 2).toUpperCase() || 'U'}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-900 dark:text-white">
                                {m.member.name}
                              </span>
                              <span className="text-[10px] font-semibold text-slate-400">
                                ({m.member.role})
                              </span>
                            </div>
                            <span className="text-xs text-slate-400">{m.member.email}</span>
                          </div>
                        </div>

                        {/* Workload Signal Pill */}
                        <div className="flex items-center gap-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${signalBadge}`}>
                            {m.workloadLabel} ({m.activeTasks} active)
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                            {m.timeSpentMinutes}m logged
                          </span>
                        </div>
                      </div>

                      {/* Workload Distribution Visual Bar */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                          <span>
                            {m.completedTasks} completed · {m.inProgressTasks} in progress · {m.todoTasks} to do
                          </span>
                          <span className="font-semibold">{m.completionRate}% completion</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-powder-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${workloadBarPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-center space-y-4 animate-scaleIn">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Delete "{project.name}"?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                This will permanently delete the project and remove all {members.length} members.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-semibold hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteProject}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      <InviteMemberModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        projectId={id}
        onInvitationSent={() => fetchProjectData()}
      />
    </div>
  );
};

export default ProjectDetails;
