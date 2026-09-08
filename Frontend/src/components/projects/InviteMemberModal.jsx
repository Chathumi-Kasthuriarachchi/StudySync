import React, { useState, useEffect } from 'react';
import { X, Search, UserPlus, Shield, Check, AlertCircle, User } from 'lucide-react';
import { searchUsers, inviteUser } from '../../services/projectService';

const InviteMemberModal = ({ isOpen, onClose, projectId, onInvitationSent }) => {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [role, setRole] = useState('MEMBER');
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        setError('');
        const res = await searchUsers(query.trim());
        if (res.success) {
          setSearchResults(res.data);
        }
      } catch (err) {
        console.error('User search failed:', err);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setQuery(user.name || user.email);
    setSearchResults([]);
    setError('');
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!selectedUser) {
      setError('Please select a registered user to invite.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      const res = await inviteUser(projectId, {
        userId: selectedUser._id,
        role,
      });

      if (res.success) {
        setSuccessMsg(`Invitation sent to ${selectedUser.name || selectedUser.email}`);
        if (onInvitationSent) onInvitationSent(res.data);
        setTimeout(() => {
          onClose();
          setSelectedUser(null);
          setQuery('');
          setSuccessMsg('');
        }, 1200);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send invitation');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-scaleIn">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-powder-100 dark:bg-powder-900/60 text-powder-600 dark:text-powder-400 flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Invite Member
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Search StudySync users and assign a project role.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alerts */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 flex items-center gap-2.5 text-rose-700 dark:text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-mint-50 dark:bg-mint-950/50 border border-mint-200 dark:border-mint-900/60 flex items-center gap-2.5 text-mint-700 dark:text-mint-300 text-xs">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSend} className="p-6 space-y-4">
          {/* User Search Input */}
          <div className="relative">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              User Name or Email <span className="text-rose-500">*</span>
            </label>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedUser(null);
                }}
                placeholder="Type to search registered users..."
                className="w-full pl-9.5 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-powder-500/30 focus:border-powder-500 transition"
              />
              {searching && (
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                  <div className="w-3.5 h-3.5 border-2 border-powder-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Live Autocomplete Dropdown */}
            {searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {searchResults.map((user) => (
                  <button
                    key={user._id}
                    type="button"
                    onClick={() => handleSelectUser(user)}
                    className="w-full px-4 py-2.5 text-left hover:bg-powder-50 dark:hover:bg-slate-800 flex items-center justify-between transition group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-powder-100 dark:bg-powder-900/60 text-powder-600 dark:text-powder-400 flex items-center justify-center font-bold text-xs">
                        {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-powder-600 dark:group-hover:text-powder-400">
                          {user.name}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {user.email}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500">
                      Select
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected User Pill */}
          {selectedUser && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-mint-100 dark:bg-mint-950/60 text-mint-700 dark:text-mint-300 flex items-center justify-center font-bold text-xs">
                  {selectedUser.name ? selectedUser.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    {selectedUser.name}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {selectedUser.email}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-mint-600 dark:text-mint-400 bg-mint-50 dark:bg-mint-950/60 px-2 py-0.5 rounded-md border border-mint-200 dark:border-mint-800">
                Selected
              </span>
            </div>
          )}

          {/* Role Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-powder-500" />
              <span>Project Role</span>
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-powder-500/30 focus:border-powder-500 transition"
            >
              <option value="MEMBER">Member (Can view, contribute to tasks)</option>
              <option value="MANAGER">Manager (Can invite members, manage timeline)</option>
              <option value="VIEWER">Viewer (Read-only access)</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedUser}
              className="px-4 py-2 rounded-xl bg-powder-600 hover:bg-powder-700 text-white text-xs font-semibold shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Send Invitation</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InviteMemberModal;
