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
  X,
  Layers,
  Edit3,
  LogOut,
  Mail,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import {
  getProjectById,
  updateProject,
  deleteProject,
  getProjectMembers,
  updateMemberRole,
  removeProjectMember,
  getProjectInvitations,
  cancelInvitation,
} from '../services/projectService';
import { useAuth } from '../context/AuthContext';
import { getRoleBadge, getStatusBadge, calculateTimeline } from './Projects';
import InviteMemberModal from '../components/projects/InviteMemberModal';

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

const ProjectDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
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

  const fetchProjectData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [projectRes, membersRes] = await Promise.all([
        getProjectById(id),
        getProjectMembers(id),
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
          { id: 'timeline', label: 'Timeline', icon: Clock },
          { id: 'members', label: `Members (${members.length})`, icon: Users },
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

      {/* ── TAB 2: TIMELINE ─────────────────────────────────────────────────── */}
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
