import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Sun, Moon, Menu, X } from 'lucide-react';
import logoImg from '../../assets/logo.png';

/**
 * Navigation links for the public landing page.
 * Includes sections matching the visual layout and design specification.
 */
const NAV_LINKS = [
  { label: 'Home', href: '#home', id: 'home' },
  { label: 'Features', href: '#features', id: 'features' },
  { label: 'How This Works', href: '#how-it-works', id: 'how-it-works' },
  { label: 'About', href: '#about', id: 'about' },
];

/**
 * PublicNavbar
 * 
 * Top navigation bar for StudySync's public / marketing pages.
 * 
 * Layout:
 * - Top Accent Stripe: Vibrant StudySync accent line along the top edge
 * - Left: StudySync brand logo and text (clickable, navigates/scrolls to #home)
 * - Center: Centered section links with active underline tab indicator
 * - Right: Theme toggle, Login (secondary), Signup (primary)
 * - Responsive: Hamburger drawer menu for mobile viewports
 */
const PublicNavbar = ({ darkMode, onToggleTheme }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('home');
  const location = useLocation();
  const navigate = useNavigate();

  // Track active section via IntersectionObserver when on the home page
  useEffect(() => {
    if (location.pathname !== '/') return;

    const sectionIds = NAV_LINKS.map((link) => link.id);
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries.filter((entry) => entry.isIntersecting);
        if (visibleEntries.length > 0) {
          const topVisible = visibleEntries.reduce((prev, current) =>
            prev.intersectionRatio > current.intersectionRatio ? prev : current
          );
          setActiveSection(topVisible.target.id);
        }
      },
      {
        rootMargin: '-80px 0px -50% 0px',
        threshold: [0.1, 0.3, 0.6],
      }
    );

    elements.forEach((el) => observer.observe(el));

    return () => {
      elements.forEach((el) => observer.unobserve(el));
    };
  }, [location.pathname]);

  // Handle smooth navigation to sections
  const handleNavClick = (e, href) => {
    e.preventDefault();
    setMobileMenuOpen(false);

    const targetId = href.replace('#', '');

    if (location.pathname === '/') {
      const element = document.getElementById(targetId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
        setActiveSection(targetId);
      } else if (targetId === 'home') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setActiveSection('home');
      }
    } else {
      navigate(`/${href}`);
      setTimeout(() => {
        const element = document.getElementById(targetId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors duration-200">
      {/* Top Accent Stripe */}
      <div className="h-[3px] w-full bg-gradient-to-r from-powder-600 via-powder-500 to-mint-400" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left Section: Logo and Project Name */}
        <div className="flex items-center flex-1 justify-start">
          <a
            href="#home"
            onClick={(e) => handleNavClick(e, '#home')}
            className="flex items-center gap-2.5 group focus:outline-hidden focus-visible:ring-2 focus-visible:ring-powder-500 rounded-xl py-1 px-1 transition"
            aria-label="StudySync - Back to top"
          >
            <img
              src={logoImg}
              alt="StudySync Logo"
              className="h-9 w-auto max-h-10 object-contain transition-transform duration-200 group-hover:scale-105"
            />
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Study<span className="text-powder-600 dark:text-powder-400">Sync</span>
            </span>
          </a>
        </div>

        {/* Center Section: Navigation Links with Underline Tab Indicator (Desktop) */}
        <nav
          className="hidden md:flex items-center justify-center gap-6 lg:gap-8 h-16"
          aria-label="Main public navigation"
        >
          {NAV_LINKS.map((link) => {
            const isActive = location.pathname === '/' && activeSection === link.id;
            return (
              <a
                key={link.id}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                className={`relative h-full flex items-center text-sm transition-colors duration-150 px-1 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-powder-500 ${
                  isActive
                    ? 'font-semibold text-powder-600 dark:text-powder-400'
                    : 'font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {link.label}
                {/* Active Underline Indicator Bar */}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-powder-600 dark:bg-powder-400 rounded-full" />
                )}
              </a>
            );
          })}
        </nav>

        {/* Right Section: Theme Toggle, Login & Signup (Desktop) */}
        <div className="flex items-center flex-1 justify-end gap-2 sm:gap-3">
          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label="Toggle theme"
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-powder-500 transition cursor-pointer"
          >
            {darkMode ? (
              <Sun className="w-5 h-5 text-amber-400" />
            ) : (
              <Moon className="w-5 h-5 text-slate-600" />
            )}
          </button>

          {/* Desktop Authentication Actions */}
          <div className="hidden sm:flex items-center gap-2">
            <Link
              to="/login"
              className="px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition focus:outline-hidden focus-visible:ring-2 focus-visible:ring-powder-500"
            >
              Login
            </Link>

            <Link
              to="/signup"
              className="px-4 py-2 text-sm font-semibold text-white bg-powder-600 hover:bg-powder-700 active:bg-powder-800 rounded-xl shadow-xs hover:shadow-sm transition focus:outline-hidden focus-visible:ring-2 focus-visible:ring-powder-500"
            >
              Sign Up
            </Link>
          </div>

          {/* Mobile Hamburger Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
            className="md:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-powder-500 transition cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Responsive Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg px-4 pt-3 pb-5 space-y-3 shadow-lg transition-all">
          {/* Section Links */}
          <div className="flex flex-col space-y-1">
            {NAV_LINKS.map((link) => {
              const isActive = location.pathname === '/' && activeSection === link.id;
              return (
                <a
                  key={link.id}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  className={`px-3 py-2.5 rounded-xl text-base transition ${
                    isActive
                      ? 'font-semibold text-powder-700 dark:text-powder-300 bg-powder-50 dark:bg-powder-950/60'
                      : 'font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {link.label}
                </a>
              );
            })}
          </div>

          {/* Divider */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-2">
            {/* Mobile Auth Links */}
            <div className="grid grid-cols-2 gap-2">
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                Login
              </Link>
              <Link
                to="/signup"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center px-4 py-2.5 rounded-xl text-sm font-semibold bg-powder-600 hover:bg-powder-700 text-white shadow-xs transition"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default PublicNavbar;
