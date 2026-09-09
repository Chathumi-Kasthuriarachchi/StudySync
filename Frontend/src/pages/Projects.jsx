import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FolderKanban,
  Plus,
  Search,
  Calendar,
  Users,
  Shield,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Layers,
  ArrowRight,
  Inbox,
  RefreshCw,
} from 'lucide-react';
import {
  getProjects,
  getMyInvitations,
  acceptInvitation,
  rejectInvitation,
} from '../services/projectService';
import CreateProjectModal from '../components/projects/CreateProjectModal';

/**
 * Role badge styling helper
 */
export const getRoleBadge = (role) => {
  switch (role) {
    case 'OWNER':
      return {
        label: 'Owner',
        bg: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
      };
    case 'MANAGER':
      return {
        label: 'Manager',
        bg: 'bg-powder-50 dark:bg-powder-950/60 text-powder-700 dark:text-powder-300 border-powder-200 dark:border-powder-800',
      };
    case 'MEMBER':
      return {
        label: 'Member',
        bg: 'bg-mint-50 dark:bg-mint-950/60 text-mint-700 dark:text-mint-300 border-mint-200 dark:border-mint-800',
      };
    case 'VIEWER':
    default:
      return {
        label: 'Viewer',
        bg: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
      };
  }
};

/**
 * Status badge styling helper
 */
export const getStatusBadge = (status) => {
  switch (status) {
    case 'ACTIVE':
      return {
        label: 'Active',
        dot: 'bg-mint-500',
        bg: 'bg-mint-50 dark:bg-mint-950/60 text-mint-700 dark:text-mint-300 border-mint-200 dark:border-mint-800',
      };
    case 'PLANNING':
      return {
        label: 'Planning',
        dot: 'bg-amber-400',
        bg: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      };
    case 'COMPLETED':
      return {
        label: 'Completed',
        dot: 'bg-powder-500',
        bg: 'bg-powder-50 dark:bg-powder-950/60 text-powder-700 dark:text-powder-300 border-powder-200 dark:border-powder-800',
      };
    case 'ARCHIVED':
    default:
      return {
        label: 'Archived',
        dot: 'bg-slate-400',
        bg: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
      };
  }
};

/**
 * Calculates timeline status (days remaining or overdue)
 */
export const calculateTimeline = (startDate, dueDate, status) => {
  if (!startDate || !dueDate) return null;

  const start = new Date(startDate);
  const due = new Date(dueDate);
  const now = new Date();

  // Strip time for clean day diffs
  start.setHours(0, 0, 0, 0);
  due.setHours(23, 59, 59, 999);
  now.setHours(12, 0, 0, 0);

  const isCompleted = status === 'COMPLETED';
  const totalDays = Math.max(1, Math.ceil((due - start) / (1000 * 60 * 60 * 24)));
  const daysRemaining = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
  const isOverdue = daysRemaining < 0 && !isCompleted;

  let progressPct = 0;
  if (isCompleted) {
    progressPct = 100;
  } else if (now < start) {
    progressPct = 0;
  } else {
    const elapsed = Math.max(0, Math.ceil((now - start) / (1000 * 60 * 60 * 24)));
    progressPct = Math.min(100, Math.round((elapsed / totalDays) * 100));
  }

  return {
    totalDays,
    daysRemaining,
    isOverdue,
    progressPct,
    formattedStart: new Date(startDate).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    formattedDue: new Date(dueDate).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
  };
};

const Projects = () => {
  const [projects, setProjects] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [processingInvId, setProcessingInvId] = useState(null);

  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [projectsRes, invitationsRes] = await Promise.all([
        getProjects(),
        getMyInvitations(),
      ]);

      if (projectsRes.success) setProjects(projectsRes.data);
      if (invitationsRes.success) setInvitations(invitationsRes.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load projects.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle invitation actions
  const handleAcceptInvitation = async (invitationId) => {
    try {
      setProcessingInvId(invitationId);
      const res = await acceptInvitation(invitationId);
      if (res.success) {
        // Refresh projects and invitations
        await fetchData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to accept invitation');
    } finally {
      setProcessingInvId(null);
    }
  };

  const handleRejectInvitation = async (invitationId) => {
    try {
      setProcessingInvId(invitationId);
      const res = await rejectInvitation(invitationId);
      if (res.success) {
        setInvitations((prev) => prev.filter((inv) => inv._id !== invitationId));
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to decline invitation');
    } finally {
      setProcessingInvId(null);
    }
  };

  const handleProjectCreated = (newProject) => {
    setProjects((prev) => [newProject, ...prev]);
    navigate(`/projects/${newProject._id}`);
  };

  // Filter projects by search query and status filter
  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      !search.trim() ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus =
      statusFilter === 'ALL' || p.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <FolderKanban className="w-6 h-6 text-powder-600 dark:text-powder-400" />
            <span>Projects & Workspaces</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Collaborate on academic sprints, module deliverables, and team projects.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-powder-600 hover:bg-powder-700 active:bg-powder-800 text-white text-sm font-semibold shadow-xs transition flex items-center gap-2 w-fit"
        >
          <Plus className="w-4 h-4" />
          <span>New Project</span>
        </button>
      </div>

      {/* Pending Invitations Banner */}
      {invitations.length > 0 && (
        <div className="bg-powder-50/80 dark:bg-powder-950/40 border border-powder-200 dark:border-powder-800/80 rounded-2xl p-5 shadow-xs animate-fadeIn">
          <div className="flex items-center gap-2 mb-3">
            <Inbox className="w-4 h-4 text-powder-600 dark:text-powder-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Pending Project Invitations ({invitations.length})
            </h2>
          </div>

          <div className="space-y-2.5">
            {invitations.map((inv) => (
              <div
                key={inv._id}
                className="bg-white dark:bg-slate-900 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {inv.project?.name || 'Untitled Project'}
                    </span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-powder-100 dark:bg-powder-900/60 text-powder-700 dark:text-powder-300">
                      Role: {inv.role}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Invited by <strong className="text-slate-700 dark:text-slate-300">{inv.invitedBy?.name || 'Project Manager'}</strong> &bull; Expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    disabled={processingInvId === inv._id}
                    onClick={() => handleAcceptInvitation(inv._id)}
                    className="px-3 py-1.5 rounded-lg bg-mint-600 hover:bg-mint-700 text-white text-xs font-semibold shadow-2xs transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Accept</span>
                  </button>
                  <button
                    type="button"
                    disabled={processingInvId === inv._id}
                    onClick={() => handleRejectInvitation(inv._id)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Decline</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {['ALL', 'PLANNING', 'ACTIVE', 'COMPLETED', 'ARCHIVED'].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 ${
                statusFilter === status
                  ? 'bg-powder-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {status.charAt(0) + status.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Search Box */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:ring-2 focus:ring-powder-500/30 focus:border-powder-500 transition"
          />
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 animate-pulse"
            >
              <div className="flex justify-between items-center">
                <div className="h-5 w-24 bg-slate-200 dark:bg-slate-800 rounded-md" />
                <div className="h-5 w-16 bg-slate-200 dark:bg-slate-800 rounded-md" />
              </div>
              <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-800 rounded-md" />
              <div className="h-3 w-full bg-slate-200 dark:bg-slate-800 rounded-md" />
              <div className="h-8 w-full bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-8 text-center">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">{error}</p>
          <button
            type="button"
            onClick={fetchData}
            className="mt-3 px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-rose-200 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Try Again
          </button>
        </div>
      ) : filteredProjects.length === 0 ? (
        /* Empty State */
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-powder-50 dark:bg-powder-950/60 text-powder-600 dark:text-powder-400 flex items-center justify-center mx-auto mb-4 border border-powder-100 dark:border-powder-900/60">
            <FolderKanban className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {search || statusFilter !== 'ALL' ? 'No matching projects' : 'No projects yet'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
            {search || statusFilter !== 'ALL'
              ? 'Try adjusting your search query or filter settings.'
              : 'Create a project to start organizing modules, setting due dates, and collaborating with team members.'}
          </p>
          {!search && statusFilter === 'ALL' && (
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="mt-6 px-4 py-2 rounded-xl bg-powder-600 hover:bg-powder-700 text-white text-sm font-semibold shadow-xs transition inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Create Your First Project</span>
            </button>
          )}
        </div>
      ) : (
        /* Project Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((project) => {
            const roleBadge = getRoleBadge(project.userRole);
            const statusBadge = getStatusBadge(project.status);
            const timeline = calculateTimeline(project.startDate, project.dueDate, project.status);

            return (
              <Link
                key={project._id}
                to={`/projects/${project._id}`}
                className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs hover:shadow-md hover:border-powder-300 dark:hover:border-powder-700 transition flex flex-col justify-between"
              >
                {/* Card Top: Badges */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    {/* Status Pill */}
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusBadge.bg}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
                      {statusBadge.label}
                    </span>

                    {/* Role Badge */}
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${roleBadge.bg}`}
                    >
                      <Shield className="w-3 h-3" />
                      {roleBadge.label}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-powder-600 dark:group-hover:text-powder-400 transition line-clamp-1">
                    {project.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed min-h-[32px]">
                    {project.description || 'No description provided.'}
                  </p>
                </div>

                {/* Card Bottom: Timeline & Members */}
                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
                  {/* Timeline Bar & Dates */}
                  {timeline && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {timeline.formattedDue}
                        </span>
                        <span
                          className={
                            timeline.isOverdue
                              ? 'text-rose-600 dark:text-rose-400 font-bold'
                              : 'text-slate-600 dark:text-slate-300 font-semibold'
                          }
                        >
                          {timeline.isOverdue
                            ? `Overdue (${Math.abs(timeline.daysRemaining)}d)`
                            : project.status === 'COMPLETED'
                            ? 'Completed'
                            : `${timeline.daysRemaining} days left`}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            timeline.isOverdue
                              ? 'bg-rose-500'
                              : project.status === 'COMPLETED'
                              ? 'bg-powder-500'
                              : 'bg-mint-500'
                          }`}
                          style={{ width: `${timeline.progressPct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Footer Stats & Open Button */}
                  <div className="flex items-center justify-between pt-1 text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      {project.memberCount || 1} {project.memberCount === 1 ? 'member' : 'members'}
                    </span>

                    <span className="font-semibold text-powder-600 dark:text-powder-400 group-hover:translate-x-0.5 transition inline-flex items-center gap-1">
                      Open <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Create Project Modal Dialog */}
      <CreateProjectModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onProjectCreated={handleProjectCreated}
      />
    </div>
  );
};

export default Projects;
