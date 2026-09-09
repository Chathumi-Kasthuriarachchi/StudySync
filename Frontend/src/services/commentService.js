import api from './api';

/**
 * commentService
 * Centralized API helper methods for Phase 6 Collaboration, Task Comments, and Activity History.
 */

export const getTaskComments = async (taskId) => {
  const res = await api.get(`/api/tasks/${taskId}/comments`);
  return res.data;
};

export const createTaskComment = async (taskId, content) => {
  const res = await api.post(`/api/tasks/${taskId}/comments`, { content });
  return res.data;
};

export const updateTaskComment = async (taskId, commentId, content) => {
  const res = await api.put(`/api/tasks/${taskId}/comments/${commentId}`, { content });
  return res.data;
};

export const deleteTaskComment = async (taskId, commentId) => {
  const res = await api.delete(`/api/tasks/${taskId}/comments/${commentId}`);
  return res.data;
};

export const getTaskActivities = async (taskId) => {
  const res = await api.get(`/api/tasks/${taskId}/activities`);
  return res.data;
};
