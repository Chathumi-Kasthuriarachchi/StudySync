import api from './api';

/**
 * timeService — Phase 9
 * API helper methods for time tracking, active sessions, and task time summaries.
 */

export const startTimer = async (taskId) => {
  const res = await api.post('/api/time/start', { taskId });
  return res.data;
};

export const stopTimer = async () => {
  const res = await api.post('/api/time/stop');
  return res.data;
};

export const cancelTimer = async () => {
  const res = await api.post('/api/time/cancel');
  return res.data;
};

export const getActiveTimer = async () => {
  const res = await api.get('/api/time/active');
  return res.data;
};

export const getTaskTimeSummary = async (taskId) => {
  const res = await api.get(`/api/time/tasks/${taskId}`);
  return res.data;
};

export const getTodayFocusSummary = async () => {
  const res = await api.get('/api/time/today');
  return res.data;
};
