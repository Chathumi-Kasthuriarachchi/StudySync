import api from './api';

/**
 * projectService
 * Centralized API calls for Phase 3 Project Management & Collaboration.
 */

// ── Project CRUD ──────────────────────────────────────────────────────────────
export const getProjects = async (params = {}) => {
  const res = await api.get('/api/projects', { params });
  return res.data;
};

export const getProjectById = async (id) => {
  const res = await api.get(`/api/projects/${id}`);
  return res.data;
};

export const createProject = async (projectData) => {
  const res = await api.post('/api/projects', projectData);
  return res.data;
};

export const updateProject = async (id, projectData) => {
  const res = await api.put(`/api/projects/${id}`, projectData);
  return res.data;
};

export const deleteProject = async (id) => {
  const res = await api.delete(`/api/projects/${id}`);
  return res.data;
};

// ── Members Management ────────────────────────────────────────────────────────
export const getProjectMembers = async (id) => {
  const res = await api.get(`/api/projects/${id}/members`);
  return res.data;
};

export const addProjectMember = async (id, { userId, role }) => {
  const res = await api.post(`/api/projects/${id}/members`, { userId, role });
  return res.data;
};

export const updateMemberRole = async (id, userId, role) => {
  const res = await api.put(`/api/projects/${id}/members/${userId}`, { role });
  return res.data;
};

export const removeProjectMember = async (id, userId) => {
  const res = await api.delete(`/api/projects/${id}/members/${userId}`);
  return res.data;
};

export const getProjectWorkload = async (id) => {
  const res = await api.get(`/api/projects/${id}/workload`);
  return res.data;
};

// ── Invitations ───────────────────────────────────────────────────────────────
export const inviteUser = async (id, { email, userId, role }) => {
  const res = await api.post(`/api/projects/${id}/invitations`, { email, userId, role });
  return res.data;
};

export const getProjectInvitations = async (id) => {
  const res = await api.get(`/api/projects/${id}/invitations`);
  return res.data;
};

export const cancelInvitation = async (id, invitationId) => {
  const res = await api.delete(`/api/projects/${id}/invitations/${invitationId}`);
  return res.data;
};

export const getMyInvitations = async () => {
  const res = await api.get('/api/projects/invitations/my');
  return res.data;
};

export const acceptInvitation = async (invitationId) => {
  const res = await api.post(`/api/projects/invitations/${invitationId}/accept`);
  return res.data;
};

export const rejectInvitation = async (invitationId) => {
  const res = await api.post(`/api/projects/invitations/${invitationId}/reject`);
  return res.data;
};

// ── User Search (for Member Picker) ───────────────────────────────────────────
export const searchUsers = async (query) => {
  const res = await api.get('/api/users/search', { params: { q: query } });
  return res.data;
};
