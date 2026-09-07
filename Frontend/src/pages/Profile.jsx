import React from 'react';
import { User as UserIcon, Mail, Shield, KeyRound, Calendar } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * Profile Page (Phase 2)
 * 
 * Sourced directly from AuthContext:
 * Displays user identity, email, system-level role (ADMIN / USER), and session details.
 */
const Profile = () => {
  const { user } = useAuth();

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const isAdmin = user?.systemRole === 'ADMIN';

  return (
    <div className="space-y-6 max-w-4xl animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Account Profile
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Manage your personal details and view your system authorization level.
        </p>
      </div>

      {/* Main Profile Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 pb-8 border-b border-slate-100 dark:border-slate-800">
          {/* Large Avatar */}
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-powder-500 to-mint-400 text-white font-extrabold text-2xl flex items-center justify-center shadow-md shrink-0">
            {getInitials(user?.name)}
          </div>

          <div className="flex-1 text-center sm:text-left space-y-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {user?.name || 'StudySync Member'}
              </h2>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  isAdmin
                    ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                    : 'bg-mint-100 text-mint-900 dark:bg-mint-950/60 dark:text-mint-300 border border-mint-300 dark:border-mint-700'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                {user?.systemRole || 'USER'}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-mono">
              {user?.email}
            </p>
          </div>
        </div>

        {/* User Information Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-8">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-powder-50 dark:bg-powder-950/60 text-powder-600 dark:text-powder-400">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Full Name</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                {user?.name || 'Not provided'}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-powder-50 dark:bg-powder-950/60 text-powder-600 dark:text-powder-400">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Email Address</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5 font-mono">
                {user?.email || 'Not provided'}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-mint-50 dark:bg-mint-950/60 text-mint-600 dark:text-mint-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">System Role (RBAC)</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                {user?.systemRole === 'ADMIN'
                  ? 'Administrator (Full System Access)'
                  : 'Standard User (Personal Workspace)'}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-mint-50 dark:bg-mint-950/60 text-mint-600 dark:text-mint-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Authentication Token</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                JWT Active & Verified
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
