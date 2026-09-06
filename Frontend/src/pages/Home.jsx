import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Home Page (Phase 0)
 * 
 * Why this file exists:
 * Serves as the landing entry point (route: "/") for verifying basic routing.
 */
const Home = () => {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4 sm:px-6">
      <div className="max-w-2xl">
        <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700 bg-blue-100 rounded-full mb-4">
          Foundation Stage
        </span>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
          Welcome to <span className="text-blue-600">StudyFlow</span>
        </h1>
        <p className="text-lg text-slate-600 leading-relaxed mb-8">
          A smart productivity and task management platform built on the MERN stack.
          Currently in <strong>Phase 0</strong>, establishing clean architecture, isolated configurations,
          and robust client-server communication.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/dashboard"
            className="w-full sm:w-auto px-6 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition shadow-sm"
          >
            Go to Dashboard &rarr;
          </Link>
          <Link
            to="/login"
            className="w-full sm:w-auto px-6 py-3 rounded-lg bg-white border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition shadow-sm"
          >
            Login Page (Placeholder)
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Home;
