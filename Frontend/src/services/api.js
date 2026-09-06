import axios from 'axios';

/**
 * Centralized Axios Instance with Request & Response Interceptors
 * 
 * Why this file exists:
 * 1. Request Interceptor: Automatically reads the JWT token from localStorage and attaches
 *    the standard `Authorization: Bearer <token>` header to all outgoing requests.
 * 2. Response Interceptor: Catches 401 Unauthorized responses globally, clearing the stale
 *    token and preventing broken application states.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Inject JWT Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('studyflow_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle Global Token Expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Token is invalid or expired
      const token = localStorage.getItem('studyflow_token');
      if (token && window.location.pathname !== '/login') {
        localStorage.removeItem('studyflow_token');
        // Let the AuthContext or page state respond gracefully
      }
    }
    return Promise.reject(error);
  }
);

export default api;
