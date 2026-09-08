import axios from 'axios';

/**
 * Centralized Axios Instance — Phase 3
 *
 * Key changes from Phase 1:
 * 1. withCredentials: true — required to send the HttpOnly refresh token cookie
 *    on every request to the same origin (required for the /refresh endpoint).
 * 2. Request Interceptor: Injects the short-lived ACCESS token (not refresh token)
 *    into the Authorization header.
 * 3. Response Interceptor (401 handling):
 *    - On 401, silently calls POST /api/auth/refresh to get a new access token.
 *    - Updates localStorage with the new access token.
 *    - Retries the original failed request ONCE with the new token.
 *    - On second 401 (refresh failed), redirects to /login.
 *    This gives users a seamless experience — their session auto-renews without
 *    being forced to log in again after the 15-min access token expires.
 */

let isRefreshing = false;
let failedRequestsQueue = [];

const processQueue = (error, token = null) => {
  failedRequestsQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
  });
  failedRequestsQueue = [];
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Send HttpOnly cookies (refresh token) with every request
});

// ── Request Interceptor: Inject Access Token ──────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('studysync_access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response Interceptor: Silent Token Refresh on 401 ─────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only attempt refresh on 401 that isn't already a retry and isn't from
    // the auth endpoints themselves (to prevent infinite loops)
    const isAuthEndpoint = originalRequest.url?.includes('/api/auth/login') ||
      originalRequest.url?.includes('/api/auth/refresh') ||
      originalRequest.url?.includes('/api/auth/register');

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAuthEndpoint
    ) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedRequestsQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }).catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Attempt silent refresh using the HttpOnly cookie
        const response = await api.post('/api/auth/refresh');
        const { accessToken } = response.data.data;

        localStorage.setItem('studysync_access_token', accessToken);
        api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;

        processQueue(null, accessToken);
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed — clear auth state and redirect to login
        processQueue(refreshError, null);
        localStorage.removeItem('studysync_access_token');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
