import api from './api';

/**
 * taskService
 * Centralized API helper methods for Phase 4 Core Task Management.
 */

// ── Project Scoped Tasks ──────────────────────────────────────────────────────
export const getProjectTasks = async (projectId, params = {}) => {
  const res = await api.get(`/api/projects/${projectId}/tasks`, { params });
  return res.data;
};

export const createTask = async (projectId, taskData) => {
  const res = await api.post(`/api/projects/${projectId}/tasks`, taskData);
  return res.data;
};

// ── User Assigned Tasks ───────────────────────────────────────────────────────
export const getMyTasks = async (params = {}) => {
  const res = await api.get('/api/tasks/my', { params });
  return res.data;
};

// ── Single Task CRUD ──────────────────────────────────────────────────────────
export const getTaskById = async (taskId) => {
  const res = await api.get(`/api/tasks/${taskId}`);
  return res.data;
};

export const updateTask = async (taskId, taskData) => {
  const res = await api.put(`/api/tasks/${taskId}`, taskData);
  return res.data;
};

export const updateTaskStatus = async (taskId, status) => {
  const res = await api.patch(`/api/tasks/${taskId}/status`, { status });
  return res.data;
};

export const deleteTask = async (taskId) => {
  const res = await api.delete(`/api/tasks/${taskId}`);
  return res.data;
};

// ── Subtasks Management ───────────────────────────────────────────────────────
export const addSubtask = async (taskId, title) => {
  const res = await api.post(`/api/tasks/${taskId}/subtasks`, { title });
  return res.data;
};

export const toggleSubtask = async (taskId, subtaskId, data) => {
  const res = await api.patch(`/api/tasks/${taskId}/subtasks/${subtaskId}`, data);
  return res.data;
};

export const deleteSubtask = async (taskId, subtaskId) => {
  const res = await api.delete(`/api/tasks/${taskId}/subtasks/${subtaskId}`);
  return res.data;
};
