import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

/**
 * AuthProvider
 * 
 * Why React Context is used here:
 * Authentication is global state. Without Context, user profile and auth status
 * would have to be passed down through every component level ("prop drilling").
 * Context provides a single source of truth accessible from any component via `useAuth()`.
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('studysync_token'));
  const [loading, setLoading] = useState(true);

  // Restore authenticated session on initial mount
  const checkAuth = useCallback(async () => {
    const savedToken = localStorage.getItem('studysync_token');
    if (!savedToken) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const response = await api.get('/api/auth/me');
      if (response.data?.success && response.data?.data?.user) {
        setUser(response.data.data.user);
      } else {
        throw new Error('Invalid user payload');
      }
    } catch (err) {
      console.warn('Session restoration failed:', err.message);
      localStorage.removeItem('studysync_token');
      setUser(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  /**
   * Login User
   */
  const login = async (email, password) => {
    const response = await api.post('/api/auth/login', { email, password });
    if (response.data?.success && response.data?.data) {
      const { user: userData, token: jwtToken } = response.data.data;
      localStorage.setItem('studysync_token', jwtToken);
      setToken(jwtToken);
      setUser(userData);
      return userData;
    }
    throw new Error(response.data?.message || 'Login failed');
  };

  /**
   * Register User
   */
  const register = async (name, email, password) => {
    const response = await api.post('/api/auth/register', { name, email, password });
    if (response.data?.success && response.data?.data) {
      const { user: userData, token: jwtToken } = response.data.data;
      localStorage.setItem('studysync_token', jwtToken);
      setToken(jwtToken);
      setUser(userData);
      return userData;
    }
    throw new Error(response.data?.message || 'Registration failed');
  };

  /**
   * Logout User
   */
  const logout = () => {
    localStorage.removeItem('studysync_token');
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    isAuthenticated: !!user,
    loading,
    login,
    register,
    logout,
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
