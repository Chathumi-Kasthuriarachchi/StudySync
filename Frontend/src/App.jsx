import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Login from './pages/auth/Login';

/**
 * App Component (Phase 0)
 * 
 * Why this file exists:
 * The central client-side routing coordinator for StudyFlow.
 * In Phase 0, it wraps pages in MainLayout and provides base routes:
 *   - /          -> Home / Welcome
 *   - /dashboard -> Dashboard (with live backend connection test)
 *   - /login     -> Login placeholder
 * 
 * (Admin and User role-protected routes will be restored and wired in Phase 1)
 */
const App = () => {
  return (
    <Router>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/login" element={<Login />} />
          {/* Fallback for unmatched routes */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Router>
  );
};

export default App;