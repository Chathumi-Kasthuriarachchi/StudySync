import api from './api';

/**
 * calendarService
 * API client for the unified calendar endpoint (Phase 8).
 */

/**
 * Get calendar events within a date range.
 * @param {Object} params - Query parameters
 * @param {string} params.start - ISO8601 start date
 * @param {string} params.end - ISO8601 end date
 * @param {string} [params.type] - ALL | TASKS | MEETINGS | DEADLINES
 * @param {string} [params.scope] - ALL | PERSONAL | PROJECT
 * @param {string} [params.projectId] - Filter to specific project
 */
export const getCalendarEvents = async (params = {}) => {
  const res = await api.get('/api/calendar', { params });
  return res.data;
};
