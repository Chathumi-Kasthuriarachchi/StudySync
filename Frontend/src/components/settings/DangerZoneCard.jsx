import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Trash2,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  X,
  AlertOctagon,
  ShieldAlert,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { deleteAccount } from '../../services/userService';

/**
 * Danger Zone & Delete Account Card
 * 
 * Provides:
 * 1. Warning card outlining irreversible consequences of account deletion.
 * 2. Multi-step confirmation modal requiring typing "DELETE" and entering password.
 * 3. Cascading database cleanup execution via backend API.
 * 4. Automatic session revocation, cookie clearance, and redirect to login.
 */
const DangerZoneCard = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const openModal = () => {
    setConfirmText('');
    setPassword('');
    setErrorMessage('');
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isDeleting) return;
    setIsModalOpen(false);
    setConfirmText('');
    setPassword('');
    setErrorMessage('');
  };

  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (confirmText.trim() !== 'DELETE') {
      setErrorMessage('Please type DELETE in all capital letters to confirm.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your account password.');
      return;
    }

    try {
      setIsDeleting(true);
      const res = await deleteAccount({
        password,
        confirmationText: confirmText.trim(),
      });

      if (res.success) {
        toast.success('Your account and all associated data have been permanently deleted.');
        setIsModalOpen(false);
        // Revoke auth state in frontend
        await logout();
        navigate('/login', { replace: true });
      } else {
        setErrorMessage(res.message || 'Failed to delete account.');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to delete account.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const isFormValid = confirmText.trim() === 'DELETE' && password.length > 0;

  return (
    <div className="bg-red-50/50 dark:bg-red-950/20 rounded-3xl border border-red-200 dark:border-red-900/50 p-6 sm:p-8 shadow-xs">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="p-2.5 rounded-2xl bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-red-950 dark:text-red-300">
              Danger Zone
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
              Irreversible
            </span>
          </div>
          <p className="text-xs text-red-700/80 dark:text-red-400/80 mt-0.5">
            Destructive actions that cannot be recovered once executed.
          </p>
        </div>
      </div>

      {/* Warning Box & Action */}
      <div className="bg-white/80 dark:bg-slate-900/80 rounded-2xl border border-red-200/70 dark:border-red-900/40 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="space-y-1 max-w-xl">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-red-500" />
            Permanently Delete Your Account
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Immediately purges your profile, avatar, personal tasks, owned study projects, and
            active login sessions. Any unowned team workspace memberships will be revoked.
          </p>
        </div>

        <button
          type="button"
          onClick={openModal}
          className="px-5 py-2.5 rounded-xl font-semibold text-xs text-white bg-red-600 hover:bg-red-700 active:bg-red-800 transition shadow-xs hover:shadow-red-600/20 cursor-pointer shrink-0 self-start sm:self-center"
        >
          Delete Account
        </button>
      </div>

      {/* ── Confirmation Modal ────────────────────────────────────────── */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn"
          onClick={closeModal}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl border border-red-200 dark:border-red-900/60 p-6 sm:p-8 max-w-lg w-full shadow-2xl relative animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400">
                  <AlertOctagon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Delete Account Permanently
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    This action is final and cannot be undone.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={isDeleting}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleDeleteAccount} className="pt-4 space-y-4">
              {/* Caution Callout */}
              <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-xs text-red-800 dark:text-red-300 leading-relaxed flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <strong>All personal data will be erased:</strong>
                  <ul className="list-disc pl-4 mt-1 space-y-0.5 text-[11px] text-red-700 dark:text-red-300/90">
                    <li>Tasks, projects, and comments will be permanently deleted</li>
                    <li>Uploaded Cloudinary avatar files will be unlinked and removed</li>
                    <li>All active sessions on all devices will be terminated immediately</li>
                  </ul>
                </div>
              </div>

              {/* Error Message Box */}
              {errorMessage && (
                <div className="p-3 rounded-xl bg-red-100 dark:bg-red-900/40 border border-red-200 dark:border-red-800 text-xs font-semibold text-red-700 dark:text-red-300">
                  {errorMessage}
                </div>
              )}

              {/* Confirmation Phrase Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  To confirm, type <span className="font-mono font-bold text-red-600 dark:text-red-400">DELETE</span> below:
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  disabled={isDeleting}
                  placeholder="DELETE"
                  autoComplete="off"
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm font-mono text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition disabled:opacity-50"
                />
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Enter your password to authorize deletion:
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isDeleting}
                    placeholder="Current account password"
                    autoComplete="current-password"
                    className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isFormValid || isDeleting}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-semibold text-xs text-white bg-red-600 hover:bg-red-700 active:bg-red-800 transition shadow-xs hover:shadow-red-600/20 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Deleting Account...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      Permanently Delete Account
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DangerZoneCard;
