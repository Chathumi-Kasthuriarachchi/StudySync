import api from './api';

/**
 * Goal Service — Phase 10
 * Handles all Goal CRUD, derived progress metrics, and task linking.
 */

export const getGoals = async (params = {}) => {
  const response = await api.get('/api/goals', { params });
  return response.data;
};

export const getGoalById = async (id) => {
  const response = await api.get(`/api/goals/${id}`);
  return response.data;
};

export const createGoal = async (goalData) => {
  const response = await api.post('/api/goals', goalData);
  return response.data;
};

export const updateGoal = async (id, goalData) => {
  const response = await api.put(`/api/goals/${id}`, goalData);
  return response.data;
};

export const deleteGoal = async (id) => {
  const response = await api.delete(`/api/goals/${id}`);
  return response.data;
};

export const linkTaskToGoal = async (goalId, taskId) => {
  const response = await api.post(`/api/goals/${goalId}/tasks`, { taskId });
  return response.data;
};

export const unlinkTaskFromGoal = async (goalId, taskId) => {
  const response = await api.delete(`/api/goals/${goalId}/tasks/${taskId}`);
  return response.data;
};

export default {
  getGoals,
  getGoalById,
  createGoal,
  updateGoal,
  deleteGoal,
  linkTaskToGoal,
  unlinkTaskFromGoal,
};
