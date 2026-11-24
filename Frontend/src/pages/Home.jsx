import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { DotPattern } from '../components/ui/dot-pattern';
import { CheckSquare, Timer, BarChart3, ArrowRight } from 'lucide-react';

/**
 * Home Page
 * 
 * Public landing page featuring:
 * - #home: Hero section with animated dot pattern and primary call-to-actions
 * - #features: Minimal anchor section outlining core capabilities
 * - #how-it-works: Minimal anchor section demonstrating the study workflow
 * - #about: Minimal anchor section presenting the StudySync mission
 */
const Home = () => {
  const { isAuthenticated, user } = useAuth();

  return (
    <div className="w-full flex flex-col">
      {/* 1. Hero / Home Section (#home) */}
      <section
        id="home"
        className="relative min-h-[calc(100vh-4rem)] w-full flex items-center justify-center overflow-hidden scroll-mt-16"
      >
        {/* Animated Dot Pattern Background */}
        <DotPattern
          className="z-0"
          dotSize={2.5}
          gap={26}
          proximity={160}
          glowIntensity={1.8}
          waveSpeed={1.2}
        />

        {/* Hero Content */}
        <div className="relative z-10 flex flex-col items-center justify-center text-center py-16 px-4 sm:px-6 w-full">
          <div className="max-w-2xl">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4 leading-tight">
              Welcome to{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-powder-600 to-mint-500">
                StudySync
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed mb-8">
              A smart productivity and task management platform built on the MERN stack.
              Secure JWT authentication with bcrypt hashing, system-level authorization
              (<code>ADMIN</code> vs <code>USER</code>), and client session restoration.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-powder-600 hover:bg-powder-700 text-white font-medium shadow-sm transition flex items-center justify-center gap-2"
                >
                  <span>Go to Your Dashboard ({user?.name})</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <>
                  <Link
                    to="/signup"
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-powder-600 hover:bg-powder-700 text-white font-medium shadow-sm transition flex items-center justify-center gap-2"
                  >
                    <span>Create an Account</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>

                  <Link
                    to="/login"
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-sm"
                  >
                    Sign In to Existing Account
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 2. Features Section (#features) */}
      <section
        id="features"
        className="w-full py-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto scroll-mt-16 border-t border-slate-200/70 dark:border-slate-800/70"
      >
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Designed for Focused Academic Work
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base mt-2">
            Minimal, fast, and structured tools to keep your deadlines and focus sessions organized.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-powder-300 dark:hover:border-powder-700 transition">
            <div className="w-10 h-10 rounded-xl bg-powder-100 dark:bg-powder-900/60 text-powder-600 dark:text-powder-300 flex items-center justify-center mb-4">
              <CheckSquare className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Smart Task Management</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Organize assignments, prioritize deliverables with tags, and track progress with Kanban boards.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-mint-300 dark:hover:border-mint-700 transition">
            <div className="w-10 h-10 rounded-xl bg-mint-100 dark:bg-mint-950/60 text-mint-600 dark:text-mint-300 flex items-center justify-center mb-4">
              <Timer className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Focus Mode &amp; Timer</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Distraction-free Pomodoro intervals tailored for deep study sessions and continuous flow.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-powder-300 dark:hover:border-powder-700 transition">
            <div className="w-10 h-10 rounded-xl bg-powder-100 dark:bg-powder-900/60 text-powder-600 dark:text-powder-300 flex items-center justify-center mb-4">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Productivity Analytics</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Gain visibility into study hours, task completion velocity, and personal consistency trends.
            </p>
          </div>
        </div>
      </section>

      {/* 3. How This Works Section (#how-it-works) */}
      <section
        id="how-it-works"
        className="w-full py-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto scroll-mt-16 border-t border-slate-200/70 dark:border-slate-800/70"
      >
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            How This Works
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base mt-2">
            A three-step rhythm designed to keep students on track without cognitive overload.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-2xl bg-powder-100 dark:bg-powder-900/60 text-powder-700 dark:text-powder-300 font-extrabold text-lg flex items-center justify-center mb-4 border border-powder-200 dark:border-powder-800">
              01
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">Organize &amp; Plan</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xs">
              Break down semester projects into actionable items with clear priorities and due dates.
            </p>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-2xl bg-mint-100 dark:bg-mint-950/60 text-mint-700 dark:text-mint-300 font-extrabold text-lg flex items-center justify-center mb-4 border border-mint-200 dark:border-mint-800">
              02
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">Deep Work Sessions</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xs">
              Activate Focus Mode to eliminate noise and execute tasks in high-efficiency intervals.
            </p>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-2xl bg-powder-100 dark:bg-powder-900/60 text-powder-700 dark:text-powder-300 font-extrabold text-lg flex items-center justify-center mb-4 border border-powder-200 dark:border-powder-800">
              03
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">Track &amp; Reflect</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xs">
              Review weekly milestones, reflect on time spent, and maintain steady academic momentum.
            </p>
          </div>
        </div>
      </section>

      {/* 4. About Section (#about) */}
      <section
        id="about"
        className="w-full py-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto scroll-mt-16 border-t border-slate-200/70 dark:border-slate-800/70"
      >
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
            Built for Calm, Sustainable Productivity
          </h2>

          <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm sm:text-base">
            StudySync is built to replace chaotic to-do lists and fragmented spreadsheets with a single,
            serene study hub. Developed with modern web technologies, full authentication, and a restful
            Powder Blue &amp; Mint aesthetic, it keeps learners in control of their academic journey.
          </p>
        </div>
      </section>
    </div>
  );
};

export default Home;


