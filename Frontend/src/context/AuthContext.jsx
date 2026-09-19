import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

const ACCESS_TOKEN_KEY = 'studysync_access_token';

/**
 * AuthProvider — Phase 3
 *
 * Key changes from Phase 1:
 * 1. Tokens: Access token (15 min) stored in localStorage.
 *    Refresh token (7 days) lives in HttpOnly cookie — never touched by JS.
 * 2. register() no longer logs the user in. It returns { pendingVerification, email }
 *    so the UI can redirect to the email verification page.
 * 3. refreshSession() silently renews the access token using the cookie-based
 *    refresh token. Called on startup and automatically by api.js interceptors.
 * 4. Session restoration: tries /me with current token → if 401, tries refresh →
 *    if that fails, clears state. This prevents flashing the workspace to users
 *    whose session has fully expired.
 * 5. logout() calls the backend to revoke the refresh session before clearing state.
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Session Refresh ─────────────────────────────────────────────────────────
  const refreshSession = useCallback(async () => {
    try {
      const response = await api.post('/api/auth/refresh');
      if (response.data?.success && response.data?.data) {
        const { accessToken, user: userData } = response.data.data;
        localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
        setUser(userData);
        return true;
      }
    } catch {
      // Refresh failed — session is truly expired
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      setUser(null);
    }
    return false;
  }, []);

  // ── Session Restoration on App Start ────────────────────────────────────────
  const checkAuth = useCallback(async () => {
    const savedToken = localStorage.getItem(ACCESS_TOKEN_KEY);

    if (!savedToken) {
      // No token at all — try refresh in case we have a valid refresh cookie
      const refreshed = await refreshSession();
      if (!refreshed) {
        setLoading(false);
        return;
      }
      setLoading(false);
      return;
    }

    try {
      // Try to fetch user with current access token
      const response = await api.get('/api/auth/me');
      if (response.data?.success && response.data?.data?.user) {
        setUser(response.data.data.user);
      } else {
        throw new Error('Invalid user payload');
      }
    } catch (err) {
      if (err.response?.status === 401) {
        // Access token expired — attempt silent refresh
        await refreshSession();
      } else {
        console.warn('Session restoration failed:', err.message);
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, [refreshSession]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // ── Login ───────────────────────────────────────────────────────────────────
  const login = async (email, password) => {
    const response = await api.post('/api/auth/login', { email, password });
    if (response.data?.success && response.data?.data) {
      const { user: userData, accessToken } = response.data.data;
      localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
      setUser(userData);
      return userData;
    }
    throw new Error(response.data?.message || 'Login failed');
  };

  // ── Register (Phase 3: No auto-login — requires email verification) ──────────
  const register = async (name, email, password, confirmPassword, termsAccepted) => {
    const response = await api.post('/api/auth/register', {
      name,
      email,
      password,
      confirmPassword,
      termsAccepted,
    });
    if (response.data?.success && response.data?.data) {
      // Returns { pendingVerification: true, email } — NOT an access token
      return response.data.data;
    }
    throw new Error(response.data?.message || 'Registration failed');
  };

  // ── Logout ──────────────────────────────────────────────────────────────────
  const logout = async () => {
    try {
      // Server-side: revokes refresh session and clears cookie
      await api.post('/api/auth/logout');
    } catch {
      // Even if server request fails, clear client state
    } finally {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      setUser(null);
    }
  };

  // ── Update User State (e.g. Profile Image or Info changes) ──────────────────
  const updateUser = useCallback((updatedData) => {
    setUser((prev) => (prev ? { ...prev, ...updatedData } : null));
  }, []);

  const value = {
    user,
    isAuthenticated: !!user,
    loading,
    login,
    register,
    logout,
    updateUser,
    refreshSession,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
