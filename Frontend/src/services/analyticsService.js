import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Analytics Service — Phase 12
 *
 * Provides API clients for:
 * 1. Personal Analytics
 * 2. Project Analytics
 * 3. Team Workload Analytics
 */

/**
 * Fetch Personal Analytics for the authenticated user.
 * @param {Object} [params] { period, startDate, endDate }
 */
export const getPersonalAnalytics = async (params = {}) => {
  const token = localStorage.getItem('token');
  const response = await axios.get(`${API_URL}/analytics/personal`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    params,
    withCredentials: true,
  });
  return response.data;
};

/**
 * Fetch Project Analytics for a specific project.
 * @param {string} projectId
 * @param {Object} [params] { period, startDate, endDate }
 */
export const getProjectAnalytics = async (projectId, params = {}) => {
  const token = localStorage.getItem('token');
  const response = await axios.get(`${API_URL}/analytics/project/${projectId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    params,
    withCredentials: true,
  });
  return response.data;
};

/**
 * Fetch Team Workload & Contribution Analytics for a project.
 * Enforces project RBAC (VIEWER rejected).
 * @param {string} projectId
 * @param {Object} [params] { period, startDate, endDate }
 */
export const getTeamAnalytics = async (projectId, params = {}) => {
  const token = localStorage.getItem('token');
  const response = await axios.get(`${API_URL}/analytics/project/${projectId}/team`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    params,
    withCredentials: true,
  });
  return response.data;
};
