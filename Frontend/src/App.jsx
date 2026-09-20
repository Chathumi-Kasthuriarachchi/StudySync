import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { TimeTrackingProvider } from './context/TimeTrackingContext';
import { NotificationProvider } from './context/NotificationContext';
import MainLayout from './layouts/MainLayout';
import AppLayout from './layouts/AppLayout';
import ProtectedRoute from './routes/ProtectedRoute';
import { Toaster } from 'react-hot-toast';

// Public Pages
import Home from './pages/Home';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import VerifyEmail from './pages/auth/VerifyEmail';
import ForgotPassword from './pages/auth/ForgotPassword';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';

// Authenticated Workspace Pages (Phase 2 - 11)
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import Projects from './pages/Projects';
import ProjectDetails from './pages/ProjectDetails';
import Calendar from './pages/Calendar';
import Focus from './pages/Focus';
import Goals from './pages/Goals';
import GoalDetails from './pages/GoalDetails';
import Analytics from './pages/Analytics';
import Reports from './pages/Reports';
import Notifications from './pages/Notifications';
import Chat from './pages/Chat';
import Profile from './pages/Profile';
import Settings from './pages/Settings';

/**
 * App (Phase 2: Workspace & Application Shell)
 * 
 * Architectural Hierarchy:
 * App
 *  ├── AuthProvider (Global auth state)
 *  └── Router
 *        ├── Public Routes (wrapped in MainLayout marketing shell)
 *        │     ├── /
 *        │     ├── /login
 *        │     └── /signup
 *        │
 *        └── Protected Routes (authenticated only)
 *              └── ProtectedRoute (checks JWT & authentication state)
 *                    └── AppLayout (permanent sidebar + topbar workspace shell)
 *                          ├── /dashboard
 *                          ├── /tasks
 *                          ├── /projects
 *                          ├── /calendar
 *                          ├── /focus
 *                          ├── /analytics
 *                          ├── /profile
 *                          └── /settings
 */
const App = () => {
  return (
    <AuthProvider>
      <ThemeProvider>
        <TimeTrackingProvider>
          <NotificationProvider>
            <Router>
              <Routes>
                {/* Public Routes (Marketing & Auth Shell) */}
                <Route element={<MainLayout />}>
                  <Route path="/" element={<Home />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/verify-email" element={<VerifyEmail />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/terms" element={<Terms />} />
                  <Route path="/privacy" element={<Privacy />} />
                </Route>

                {/* Protected Routes (Authenticated Workspace Shell) */}
                <Route element={<ProtectedRoute />}>
                  <Route element={<AppLayout />}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/tasks" element={<Tasks />} />
                    <Route path="/projects" element={<Projects />} />
                    <Route path="/projects/:id" element={<ProjectDetails />} />
                    <Route path="/goals" element={<Goals />} />
                    <Route path="/goals/:id" element={<GoalDetails />} />
                    <Route path="/calendar" element={<Calendar />} />
                    <Route path="/focus" element={<Focus />} />
                    <Route path="/analytics" element={<Analytics />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/notifications" element={<Notifications />} />
                    <Route path="/chat" element={<Chat />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/settings" element={<Settings />} />
                  </Route>
                </Route>

                {/* Catch-all redirect */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
            </Router>
          </NotificationProvider>
        </TimeTrackingProvider>
      </ThemeProvider>
    </AuthProvider>
  );
};

export default App;