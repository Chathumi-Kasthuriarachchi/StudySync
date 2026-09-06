import axios from 'axios';

/**
 * Centralized Axios Instance for StudyFlow
 * 
 * Why this file exists:
 * Instead of hardcoding API URLs or duplicating HTTP headers across every component,
 * this single instance configures the base URL, timeouts, and default headers in one place.
 * In future phases, request/response interceptors (e.g. attaching JWT tokens or handling 401 errors)
 * will be cleanly attached here without modifying individual components.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
