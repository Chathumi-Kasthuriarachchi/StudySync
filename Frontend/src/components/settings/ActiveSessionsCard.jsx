import { useState, useEffect, useCallback } from 'react';
import {
  Laptop,
  Smartphone,
  Monitor,
  LogOut,
  Clock,
  MapPin,
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import moment from 'moment';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { getActiveSessions, logoutAllDevices, revokeSession } from '../../services/userService';

const ActiveSessionsCard = () => {
  const { logout } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRevokingId, setIsRevokingId] = useState(null);
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const loadSessions = useCallback(async () => {
    try {
      const res = await getActiveSessions();
      if (res.success && res.data?.sessions) {
        setSessions(res.data.sessions);
      }
    } catch (err) {
      console.error('Failed to load active sessions:', err);
      toast.error('Failed to retrieve active sessions.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSessions();
  }, [loadSessions]);

  const refetchSessions = async () => {
    setIsLoading(true);
    await loadSessions();
  };

  const handleRevokeSession = async (sessionId) => {
    try {
      setIsRevokingId(sessionId);
      const res = await revokeSession(sessionId);
      if (res.success) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        toast.success('Session terminated successfully.');
      }
    } catch (err) {
      console.error('Failed to revoke session:', err);
      toast.error(err.response?.data?.message || 'Failed to terminate session.');
    } finally {
      setIsRevokingId(null);
    }
  };

  const handleLogoutAll = async () => {
    try {
      setIsLoggingOutAll(true);
      await logoutAllDevices();
      toast.success('All sessions terminated. Redirecting to login...');
      setTimeout(() => {
        logout();
      }, 1000);
    } catch (err) {
      console.error('Logout all devices error:', err);
      toast.error('Failed to log out from all devices.');
      setIsLoggingOutAll(false);
      setShowConfirmModal(false);
    }
  };

  const getDeviceIcon = (deviceType, os) => {
    if (deviceType === 'mobile' || /android|ios|iphone/i.test(os)) {
      return Smartphone;
    }
    return Laptop;
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-start gap-4">
          <div className="p-2.5 rounded-2xl bg-mint-50 dark:bg-mint-950/60 text-mint-600 dark:text-mint-400">
            <Monitor className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Active Sessions
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Devices and browsers currently logged into your StudySync account.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={refetchSessions}
            disabled={isLoading}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
            title="Refresh sessions list"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setShowConfirmModal(true)}
            disabled={isLoggingOutAll || sessions.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition cursor-pointer disabled:opacity-50"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout from all devices
          </button>
        </div>
      </div>

      {/* Sessions List */}
      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-powder-500" />
          <span className="text-xs">Loading active sessions...</span>
        </div>
      ) : sessions.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-400">
          No active sessions detected.
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((sess) => {
            const Icon = getDeviceIcon(sess.deviceType, sess.os);
            const isCurrent = sess.isCurrent;

            return (
              <div
                key={sess.id}
                className={`p-4 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  isCurrent
                    ? 'border-mint-200 dark:border-mint-900/60 bg-mint-50/30 dark:bg-mint-950/20'
                    : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={`p-2.5 rounded-xl ${
                      isCurrent
                        ? 'bg-mint-100 dark:bg-mint-900/40 text-mint-700 dark:text-mint-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {sess.displayName}
                      </span>
                      {isCurrent && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-mint-100 text-mint-800 dark:bg-mint-900/60 dark:text-mint-300 border border-mint-200 dark:border-mint-800">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Current session
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 font-mono">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {isCurrent
                          ? 'Active now'
                          : `Last active ${moment(sess.lastActive).fromNow()}`}
                      </span>
                      <span>&bull;</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {sess.ipAddress}
                      </span>
                    </div>
                  </div>
                </div>

                {!isCurrent && (
                  <button
                    type="button"
                    onClick={() => handleRevokeSession(sess.id)}
                    disabled={isRevokingId === sess.id}
                    className="self-start sm:self-center px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-700 hover:border-rose-200 transition cursor-pointer disabled:opacity-50"
                  >
                    {isRevokingId === sess.id ? (
                      <span className="flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Revoking...
                      </span>
                    ) : (
                      'Terminate'
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Logout All Devices Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Log out from all devices?
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              This will revoke all active refresh sessions across your browsers and devices,
              including this current session. You will be redirected to the sign-in page to log in again.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isLoggingOutAll}
                className="px-4 py-2 rounded-2xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleLogoutAll}
                disabled={isLoggingOutAll}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition cursor-pointer disabled:opacity-50"
              >
                {isLoggingOutAll ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Logging out...
                  </>
                ) : (
                  'Yes, log out all devices'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActiveSessionsCard;
