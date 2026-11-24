import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, UserPlus, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { DotPattern } from '../../components/ui/dot-pattern';

const GoogleIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

/**
 * Password strength calculator
 * Returns: { score: 0-4, label, color }
 */
const getPasswordStrength = (password) => {
  if (!password) return { score: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) score++;
  if (score <= 1) return { score, label: 'Weak', color: 'bg-rose-500', textColor: 'text-rose-600 dark:text-rose-400' };
  if (score === 2) return { score, label: 'Fair', color: 'bg-amber-400', textColor: 'text-amber-600 dark:text-amber-400' };
  if (score === 3) return { score, label: 'Good', color: 'bg-powder-500', textColor: 'text-powder-600 dark:text-powder-400' };
  return { score, label: 'Strong', color: 'bg-mint-500', textColor: 'text-mint-600 dark:text-mint-400' };
};

/**
 * Signup Page (Phase 3)
 *
 * Enhancements:
 * - Password visibility toggles on both password fields
 * - Password strength indicator (Weak / Fair / Good / Strong)
 * - Password requirements: 8+ chars, 1 number, 1 special character
 * - Required Terms & Conditions + Privacy Policy consent checkbox
 * - "Continue with Google" placeholder (UI only)
 * - On success: redirects to /verify-email (no auto-login)
 */
const Signup = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();
  const strength = getPasswordStrength(password);

  const validatePassword = (pw) => {
    if (pw.length < 8) return 'Password must be at least 8 characters long.';
    if (!/[0-9]/.test(pw)) return 'Password must contain at least one number.';
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(pw)) return 'Password must contain at least one special character.';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !email.trim() || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    const pwError = validatePassword(password);
    if (pwError) { setError(pwError); return; }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!termsAccepted) {
      setError('You must agree to the Terms & Conditions to create an account.');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await register(name.trim(), email.trim(), password, confirmPassword, termsAccepted);
      // Registration successful — redirect to email verification
      if (result.pendingVerification) {
        navigate(`/verify-email?email=${encodeURIComponent(result.email)}&name=${encodeURIComponent(result.name || name.trim())}`);
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        'Registration failed. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] w-full flex items-center justify-center py-10 px-4 sm:px-6">
      <DotPattern className="z-0" dotSize={2.5} gap={26} proximity={160} glowIntensity={1.8} waveSpeed={1.2} />

      <div className="relative z-10 w-full max-w-md mx-auto">
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xl p-6 sm:p-8 transition-all">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Join StudySync
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Start organizing your productivity journey
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm flex items-start gap-2">
              <svg className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label htmlFor="signup-name" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                Full Name
              </label>
              <input
                id="signup-name"
                type="text"
                required
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Rivera"
                className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-powder-500 transition"
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="signup-email" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                Email Address
              </label>
              <input
                id="signup-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@example.com"
                className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-powder-500 transition"
              />
            </div>

            {/* Password with Strength Indicator */}
            <div>
              <label htmlFor="signup-password" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 chars, number & symbol"
                  className="w-full px-3.5 py-2.5 pr-11 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-powder-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-powder-400 rounded"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {password && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
                        style={{ width: `${(strength.score / 4) * 100}%` }}
                      />
                    </div>
                    <span className={`text-xs font-semibold ${strength.textColor}`}>
                      {strength.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                    <span className={`text-[10px] ${password.length >= 8 ? 'text-mint-600 dark:text-mint-400' : 'text-slate-400'}`}>
                      {password.length >= 8 ? '✓' : '○'} 8+ characters
                    </span>
                    <span className={`text-[10px] ${/[0-9]/.test(password) ? 'text-mint-600 dark:text-mint-400' : 'text-slate-400'}`}>
                      {/[0-9]/.test(password) ? '✓' : '○'} Number
                    </span>
                    <span className={`text-[10px] ${/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password) ? 'text-mint-600 dark:text-mint-400' : 'text-slate-400'}`}>
                      {/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password) ? '✓' : '○'} Special character
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="signup-confirm-password" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="signup-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full px-3.5 py-2.5 pr-11 border rounded-xl bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 transition ${
                    confirmPassword && confirmPassword !== password
                      ? 'border-rose-400 dark:border-rose-700 focus:ring-rose-400'
                      : confirmPassword && confirmPassword === password
                      ? 'border-mint-400 dark:border-mint-700 focus:ring-mint-400'
                      : 'border-slate-200 dark:border-slate-700 focus:ring-powder-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-powder-400 rounded"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword && confirmPassword === password && (
                <p className="text-[11px] text-mint-600 dark:text-mint-400 mt-1 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Passwords match
                </p>
              )}
            </div>

            {/* Terms & Privacy Checkbox */}
            <div className="pt-1">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  id="terms-accepted"
                  type="checkbox"
                  required
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="w-4 h-4 mt-0.5 shrink-0 rounded border-slate-300 dark:border-slate-600 text-powder-600 focus:ring-powder-500 cursor-pointer"
                />
                <span className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  I agree to StudySync's{' '}
                  <Link
                    to="/terms"
                    target="_blank"
                    className="font-semibold text-powder-600 hover:text-powder-700 dark:text-powder-400 dark:hover:text-powder-300 underline transition"
                  >
                    Terms & Conditions
                  </Link>
                  {' '}and{' '}
                  <Link
                    to="/privacy"
                    target="_blank"
                    className="font-semibold text-powder-600 hover:text-powder-700 dark:text-powder-400 dark:hover:text-powder-300 underline transition"
                  >
                    Privacy Policy
                  </Link>
                </span>
              </label>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-1 py-3 px-4 rounded-xl bg-powder-600 hover:bg-powder-700 active:bg-powder-800 text-white font-semibold text-sm transition shadow-sm hover:shadow flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Create Account</span>
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-700" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-white/90 dark:bg-slate-900/90 text-slate-400 font-medium">OR</span>
            </div>
          </div>

          {/* Google Auth Placeholder */}
          <button
            type="button"
            disabled
            title="Google Sign-Up is coming soon"
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-sm font-medium cursor-not-allowed opacity-60 transition"
          >
            <GoogleIcon />
            <span>Continue with Google</span>
            <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-400 uppercase tracking-wider">Soon</span>
          </button>

          {/* Footer Link */}
          <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800 text-center text-sm text-slate-500 dark:text-slate-400">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-semibold text-powder-600 hover:text-powder-700 dark:text-powder-400 dark:hover:text-powder-300 transition"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;