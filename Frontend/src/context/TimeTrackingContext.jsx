import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import {
  startTimer as apiStartTimer,
  stopTimer as apiStopTimer,
  cancelTimer as apiCancelTimer,
  getActiveTimer as apiGetActiveTimer,
} from '../services/timeService';

const TimeTrackingContext = createContext(null);

export const formatDuration = (totalSeconds) => {
  if (typeof totalSeconds !== 'number' || isNaN(totalSeconds) || totalSeconds < 0) {
    return '00:00';
  }
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n) => String(n).padStart(2, '0');

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
};

export const formatHumanTime = (minutes) => {
  if (typeof minutes !== 'number' || isNaN(minutes) || minutes <= 0) {
    return '0m';
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
};

export const TimeTrackingProvider = ({ children }) => {
  const { user } = useAuth();
  const [activeSession, setActiveSession] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const intervalRef = useRef(null);

  // Sync active timer from server
  const refreshActiveTimer = useCallback(async () => {
    if (!user) {
      setActiveSession(null);
      setElapsedSeconds(0);
      return;
    }

    try {
      setLoading(true);
      const res = await apiGetActiveTimer();
      if (res.success && res.data?.active && res.data.session) {
        setActiveSession(res.data.session);
        const startedTime = new Date(res.data.session.startedAt).getTime();
        const initialElapsed = Math.max(
          0,
          Math.floor((Date.now() - startedTime) / 1000)
        );
        setElapsedSeconds(initialElapsed);
      } else {
        setActiveSession(null);
        setElapsedSeconds(0);
      }
    } catch (err) {
      console.error('Failed to sync active timer:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Check active timer on mount or when user changes
  useEffect(() => {
    refreshActiveTimer();
  }, [refreshActiveTimer]);

  // Active ticking timer loop
  useEffect(() => {
    if (activeSession && activeSession.startedAt) {
      const startedTime = new Date(activeSession.startedAt).getTime();

      // Tick every second using system clock diff to prevent drift
      intervalRef.current = setInterval(() => {
        const currentElapsed = Math.max(
          0,
          Math.floor((Date.now() - startedTime) / 1000)
        );
        setElapsedSeconds(currentElapsed);
      }, 1000);

      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }, [activeSession]);

  const startTimer = async (taskId) => {
    setError('');
    try {
      const res = await apiStartTimer(taskId);
      if (res.success && res.data) {
        setActiveSession(res.data);
        const startedTime = new Date(res.data.startedAt).getTime();
        setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedTime) / 1000)));
        return res.data;
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to start timer';
      setError(msg);
      throw err;
    }
  };

  const stopTimer = async () => {
    setError('');
    try {
      const res = await apiStopTimer();
      if (res.success && res.data) {
        setActiveSession(null);
        setElapsedSeconds(0);
        return res.data;
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to stop timer';
      setError(msg);
      throw err;
    }
  };

  const cancelTimer = async () => {
    setError('');
    try {
      const res = await apiCancelTimer();
      if (res.success) {
        setActiveSession(null);
        setElapsedSeconds(0);
        return res.data;
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to cancel timer';
      setError(msg);
      throw err;
    }
  };

  const value = {
    activeSession,
    isTracking: Boolean(activeSession),
    elapsedSeconds,
    formattedElapsed: formatDuration(elapsedSeconds),
    loading,
    error,
    setError,
    startTimer,
    stopTimer,
    cancelTimer,
    refreshActiveTimer,
  };

  return (
    <TimeTrackingContext.Provider value={value}>
      {children}
    </TimeTrackingContext.Provider>
  );
};

export const useTimeTracking = () => {
  const context = useContext(TimeTrackingContext);
  if (!context) {
    throw new Error('useTimeTracking must be used within a TimeTrackingProvider');
  }
  return context;
};
