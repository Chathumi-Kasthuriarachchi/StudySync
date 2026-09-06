import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * ProtectedRoute
 * 
 * Why this component exists:
 * Wraps routes that require authentication.
 * 1. While loading session from localStorage, displays a clean loading spinner.
 * 2. If unauthenticated, redirects to `/login` preserving the intended destination via `location.state`.
 * 3. If authenticated, renders child route components using `<Outlet />`.
 */
const ProtectedRoute = () => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <div className="w-8 h-8 border-4 border-powder-300 border-t-powder-600 rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-slate-500">Verifying session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
