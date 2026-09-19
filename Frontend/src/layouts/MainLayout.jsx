import { Outlet, useLocation, Link } from 'react-router-dom';
import PublicNavbar from '../components/layout/PublicNavbar';
import { useTheme } from '../context/ThemeContext';

/**
 * MainLayout
 * 
 * Layout shell for public and authentication pages (Home, Login, Signup, VerifyEmail, ForgotPassword, Terms, Privacy).
 * Features the dedicated PublicNavbar with 3-section layout, smooth scrolling,
 * theme toggle, and responsive mobile navigation.
 */
const MainLayout = () => {
  const location = useLocation();

  // Dark mode state synchronized through ThemeContext
  const { isDark, toggleTheme } = useTheme();

  const isFullWidthPage = ['/', '/login', '/signup', '/verify-email', '/forgot-password', '/terms', '/privacy'].includes(
    location.pathname
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-200">
      {/* Public Top Navigation Bar */}
      <PublicNavbar darkMode={isDark} onToggleTheme={toggleTheme} />

      {/* Main Content Viewport */}
      <main className={isFullWidthPage ? 'flex-1 w-full relative flex flex-col' : 'flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8'}>
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>StudySync &copy; {new Date().getFullYear()} &mdash; Smart Productivity &amp; Task Management</p>
          <div className="flex items-center gap-4 text-xs">
            <Link to="/terms" className="hover:text-powder-600 dark:hover:text-powder-400 transition">
              Terms &amp; Conditions
            </Link>
            <span>&bull;</span>
            <Link to="/privacy" className="hover:text-powder-600 dark:hover:text-powder-400 transition">
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default MainLayout;
