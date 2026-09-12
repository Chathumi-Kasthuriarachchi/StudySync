import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Report Service — Phase 14: Reports Module
 */

/**
 * Fetch Personal Productivity Report Preview
 */
export const getPersonalReport = async (params = {}) => {
  const token = localStorage.getItem('token');
  const response = await axios.get(`${API_URL}/reports/personal`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
    withCredentials: true,
  });
  return response.data;
};

/**
 * Fetch Project Report Preview
 */
export const getProjectReport = async (projectId, params = {}) => {
  const token = localStorage.getItem('token');
  const response = await axios.get(`${API_URL}/reports/project/${projectId}`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
    withCredentials: true,
  });
  return response.data;
};

/**
 * Fetch Team Workload Report Preview
 */
export const getTeamReport = async (projectId, params = {}) => {
  const token = localStorage.getItem('token');
  const response = await axios.get(`${API_URL}/reports/team/${projectId}`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
    withCredentials: true,
  });
  return response.data;
};

/**
 * Fetch Task Details Report Preview
 */
export const getTaskDetailReport = async (params = {}) => {
  const token = localStorage.getItem('token');
  const response = await axios.get(`${API_URL}/reports/tasks`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
    withCredentials: true,
  });
  return response.data;
};

/**
 * Download exported report as CSV or PDF file.
 * Triggers native browser download.
 *
 * @param {string} type 'personal' | 'project' | 'team' | 'tasks'
 * @param {'csv'|'pdf'} format
 * @param {Object} params filters (projectId, period, scope, status, etc.)
 */
export const downloadReportExport = async (type, format = 'csv', params = {}) => {
  const token = localStorage.getItem('token');
  const response = await axios.get(`${API_URL}/reports/export`, {
    headers: { Authorization: `Bearer ${token}` },
    params: {
      type,
      format,
      ...params,
    },
    responseType: 'blob',
    withCredentials: true,
  });

  const mimeType = format === 'pdf' ? 'application/pdf' : 'text/csv;charset=utf-8;';
  const blob = new Blob([response.data], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;

  // Extract filename from header if available, or generate standard name
  const contentDisposition = response.headers['content-disposition'];
  let filename = `StudySync_${type}_report_${new Date().toISOString().split('T')[0]}.${format}`;
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?([^";]+)"?/);
    if (match && match[1]) {
      filename = match[1];
    }
  }

  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
