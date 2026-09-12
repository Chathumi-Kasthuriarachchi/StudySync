import api from './api';

/**
 * meetingService
 * API client for meeting CRUD operations (Phase 8).
 */

export const createMeeting = async (data) => {
  const res = await api.post('/api/meetings', data);
  return res.data;
};

export const getMeetings = async (params = {}) => {
  const res = await api.get('/api/meetings', { params });
  return res.data;
};

export const getMeetingById = async (id) => {
  const res = await api.get(`/api/meetings/${id}`);
  return res.data;
};

export const updateMeeting = async (id, data) => {
  const res = await api.put(`/api/meetings/${id}`, data);
  return res.data;
};

export const deleteMeeting = async (id) => {
  const res = await api.delete(`/api/meetings/${id}`);
  return res.data;
};
