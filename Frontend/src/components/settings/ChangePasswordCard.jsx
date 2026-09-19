import { useState } from 'react';
import { Lock, Eye, EyeOff, Check, X, ShieldAlert, Loader2, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { changePassword } from '../../services/userService';

const ChangePasswordCard = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Password criteria
  const hasMinLength = newPassword.length >= 8;
  const hasNumber = /[0-9]/.test(newPassword);
  // eslint-disable-next-line no-useless-escape
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(newPassword);
  const isMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isAllValid = hasMinLength && hasNumber && hasSpecial && isMatch;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!currentPassword) {
      setErrorMessage('Please enter your current password.');
      return;
    }

    if (!isAllValid) {
      setErrorMessage('Please satisfy all password criteria before submitting.');
      return;
    }

    if (currentPassword === newPassword) {
      setErrorMessage('New password must be different from your current password.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      if (res.success) {
        toast.success('Password changed successfully! Other sessions were signed out.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      console.error('Change password error:', err);
      const msg = err.response?.data?.message || 'Failed to change password. Please try again.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs">
      <div className="flex items-start gap-4 mb-6">
        <div className="p-2.5 rounded-2xl bg-powder-50 dark:bg-powder-950/60 text-powder-600 dark:text-powder-400">
          <KeyRound className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Change Password
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Update your account password to maintain security across your workspace.
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-5 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 flex items-center gap-2.5 text-xs text-rose-700 dark:text-rose-300">
          <ShieldAlert className="w-4 h-4 shrink-0 text-rose-500" />
          <span className="font-medium">{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
        {/* Current Password */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Current Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Lock className="w-4 h-4" />
            </div>
            <input
              type={showCurrent ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter your current password"
              required
              className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-powder-500/20 focus:border-powder-500 transition"
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* New Password */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            New Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Lock className="w-4 h-4" />
            </div>
            <input
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Create a strong new password"
              required
              className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-powder-500/20 focus:border-powder-500 transition"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Confirm New Password */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Confirm New Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Lock className="w-4 h-4" />
            </div>
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your new password"
              required
              className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-powder-500/20 focus:border-powder-500 transition"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Password Strength Checklist */}
        {newPassword.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Password Requirements
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
              <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-mint-600 dark:text-mint-400' : 'text-slate-400'}`}>
                {hasMinLength ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                <span>At least 8 characters</span>
              </div>
              <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-mint-600 dark:text-mint-400' : 'text-slate-400'}`}>
                {hasNumber ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                <span>At least one number</span>
              </div>
              <div className={`flex items-center gap-1.5 ${hasSpecial ? 'text-mint-600 dark:text-mint-400' : 'text-slate-400'}`}>
                {hasSpecial ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                <span>At least one special symbol</span>
              </div>
              <div className={`flex items-center gap-1.5 ${isMatch ? 'text-mint-600 dark:text-mint-400' : 'text-slate-400'}`}>
                {isMatch ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                <span>Passwords match</span>
              </div>
            </div>
          </div>
        )}

        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting || !currentPassword || !newPassword}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold text-white bg-powder-600 hover:bg-powder-700 active:scale-95 shadow-md shadow-powder-500/20 transition cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Updating Password...
              </>
            ) : (
              'Change Password'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChangePasswordCard;
