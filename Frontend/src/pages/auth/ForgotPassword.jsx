import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound, Mail, Eye, EyeOff, RefreshCw, ArrowLeft, CheckCircle2 } from 'lucide-react';
import api from '../../services/api';
import { DotPattern } from '../../components/ui/dot-pattern';

const OTP_LENGTH = 6;
const OTP_EXPIRY_SECONDS = 5 * 60;
const RESEND_COOLDOWN_SECONDS = 60;

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

const STEPS = { EMAIL: 'email', OTP: 'otp', NEW_PASSWORD: 'new_password', DONE: 'done' };

/**
 * ForgotPassword Page (Phase 3)
 *
 * Multi-step password recovery flow:
 *   Step 1 (EMAIL):        Enter email → sends OTP
 *   Step 2 (OTP):          Enter 6-digit OTP with countdown + resend
 *   Step 3 (NEW_PASSWORD): Enter new password + confirm (with strength indicator)
 *   Step 4 (DONE):         Success screen with redirect to login
 */
const ForgotPassword = () => {
  const [step, setStep] = useState(STEPS.EMAIL);
  const [email, setEmail] = useState('');
  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''));
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpCountdown, setOtpCountdown] = useState(OTP_EXPIRY_SECONDS);

  const inputRefs = useRef([]);
  const navigate = useNavigate();
  const strength = getPasswordStrength(password);

  useEffect(() => {
    if (step !== STEPS.OTP || otpCountdown <= 0) return;
    const timer = setInterval(() => setOtpCountdown((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(timer);
  }, [step, otpCountdown]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  // ── Step 1: Request OTP ───────────────────────────────────────────────────
  const handleRequestOTP = async (e) => {
    e.preventDefault();
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    setError('');
    setIsSubmitting(true);
    try {
      await api.post('/api/auth/forgot-password', { email: email.trim() });
      setOtpCountdown(OTP_EXPIRY_SECONDS);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setStep(STEPS.OTP);
    } catch (err) {
      if (err.response?.status === 429) {
        setError(err.response.data.message);
      } else {
        // Even on error, show generic success — privacy
        setStep(STEPS.OTP);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Step 2: OTP Input ─────────────────────────────────────────────────────
  const handleDigitChange = (index, value) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);
    setError('');
    if (digit && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
    if (digit && newDigits.every((d) => d !== '')) handleVerifyOTP(newDigits.join(''));
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        const newDigits = [...digits];
        newDigits[index] = '';
        setDigits(newDigits);
      } else if (index > 0) inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) inputRefs.current[index - 1]?.focus();
    else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    const newDigits = [...digits];
    for (let i = 0; i < pasted.length; i++) newDigits[i] = pasted[i];
    setDigits(newDigits);
    const nextEmpty = newDigits.findIndex((d) => d === '');
    inputRefs.current[nextEmpty === -1 ? OTP_LENGTH - 1 : nextEmpty]?.focus();
    if (pasted.length === OTP_LENGTH) handleVerifyOTP(pasted);
  };

  const handleVerifyOTP = useCallback(async (otpCode) => {
    if (isSubmitting) return;
    setError('');
    setIsSubmitting(true);
    try {
      const response = await api.post('/api/auth/verify-reset-otp', { email, otp: otpCode });
      if (response.data?.success) {
        setResetToken(response.data.data.resetToken);
        setStep(STEPS.NEW_PASSWORD);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid code. Please try again.');
      setDigits(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setIsSubmitting(false);
    }
  }, [email, isSubmitting]);

  const handleOTPSubmit = (e) => {
    e.preventDefault();
    const code = digits.join('');
    if (code.length < OTP_LENGTH) { setError('Please enter all 6 digits.'); return; }
    handleVerifyOTP(code);
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || isResending) return;
    setIsResending(true);
    setError('');
    try {
      await api.post('/api/auth/resend-otp', { email, purpose: 'PASSWORD_RESET' });
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setOtpCountdown(OTP_EXPIRY_SECONDS);
      setDigits(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not resend code. Please try again shortly.');
    } finally {
      setIsResending(false);
    }
  };

  // ── Step 3: Reset Password ────────────────────────────────────────────────
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (!/[0-9]/.test(password)) { setError('Password must contain at least one number.'); return; }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) { setError('Password must contain at least one special character.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setIsSubmitting(true);
    try {
      await api.post('/api/auth/reset-password', { resetToken, password, confirmPassword });
      setStep(STEPS.DONE);
    } catch (err) {
      setError(err.response?.data?.message || 'Password reset failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepLabel = { [STEPS.EMAIL]: 'Step 1 of 3', [STEPS.OTP]: 'Step 2 of 3', [STEPS.NEW_PASSWORD]: 'Step 3 of 3', [STEPS.DONE]: 'Complete' };
  const stepTitle = { [STEPS.EMAIL]: 'Forgot Password?', [STEPS.OTP]: 'Check your email', [STEPS.NEW_PASSWORD]: 'Set new password', [STEPS.DONE]: 'Password Reset!' };
  const stepDescription = {
    [STEPS.EMAIL]: 'Enter your email address and we\'ll send you a verification code.',
    [STEPS.OTP]: `Enter the 6-digit code sent to ${email}`,
    [STEPS.NEW_PASSWORD]: 'Create a strong new password for your account.',
    [STEPS.DONE]: 'Your password has been reset successfully.',
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] w-full flex items-center justify-center py-10 px-4 sm:px-6">
      <DotPattern className="z-0" dotSize={2.5} gap={26} proximity={160} glowIntensity={1.8} waveSpeed={1.2} />

      <div className="relative z-10 w-full max-w-md mx-auto">
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xl p-6 sm:p-8 transition-all">
          {/* Header */}
          <div className="text-center mb-6">
            <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 ${step === STEPS.DONE ? 'bg-mint-100 dark:bg-mint-950/50' : 'bg-powder-100 dark:bg-powder-900/40'}`}>
              {step === STEPS.DONE
                ? <CheckCircle2 className="w-7 h-7 text-mint-600 dark:text-mint-400" />
                : step === STEPS.OTP
                ? <Mail className="w-7 h-7 text-powder-600 dark:text-powder-400" />
                : <KeyRound className="w-7 h-7 text-powder-600 dark:text-powder-400" />
              }
            </div>
            <span className="inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              {stepLabel[step]}
            </span>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{stepTitle[step]}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">{stepDescription[step]}</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm flex items-start gap-2">
              <svg className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* ── Step 1: Email ── */}
          {step === STEPS.EMAIL && (
            <form onSubmit={handleRequestOTP} className="space-y-4">
              <div>
                <label htmlFor="forgot-email" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Email Address
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-powder-500 transition"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-xl bg-powder-600 hover:bg-powder-700 text-white font-semibold text-sm transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div><span>Sending...</span></>
                ) : (
                  <><Mail className="w-4 h-4" /><span>Send Verification Code</span></>
                )}
              </button>
            </form>
          )}

          {/* ── Step 2: OTP ── */}
          {step === STEPS.OTP && (
            <form onSubmit={handleOTPSubmit}>
              <div className={`flex items-center justify-center gap-1 mb-4 text-sm font-medium ${otpCountdown <= 60 ? 'text-rose-500' : 'text-slate-500 dark:text-slate-400'}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Expires in <strong>{formatTime(otpCountdown)}</strong></span>
              </div>
              <div className="flex items-center justify-center gap-2 sm:gap-3 mb-6" onPaste={handlePaste}>
                {digits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    autoFocus={index === 0}
                    aria-label={`Reset OTP digit ${index + 1}`}
                    className={`w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-bold rounded-xl border-2 transition-all duration-150 focus:outline-none
                      ${digit ? 'border-powder-500 bg-powder-50 dark:bg-powder-950/30 text-powder-700 dark:text-powder-300' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white'}
                      focus:border-powder-500 focus:ring-2 focus:ring-powder-500/30 disabled:opacity-50`}
                    disabled={isSubmitting}
                    style={{ height: '3.25rem' }}
                  />
                ))}
              </div>
              <button
                type="submit"
                disabled={isSubmitting || digits.join('').length < OTP_LENGTH}
                className="w-full py-3 rounded-xl bg-powder-600 hover:bg-powder-700 text-white font-semibold text-sm transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (<><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div><span>Verifying...</span></>) : <span>Verify Code</span>}
              </button>
              <div className="mt-4 text-center">
                <button type="button" onClick={handleResend} disabled={resendCooldown > 0 || isResending}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-powder-600 hover:text-powder-700 dark:text-powder-400 dark:hover:text-powder-300 transition disabled:opacity-50 disabled:cursor-not-allowed">
                  <RefreshCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : isResending ? 'Sending...' : 'Resend Code'}
                </button>
              </div>
            </form>
          )}

          {/* ── Step 3: New Password ── */}
          {step === STEPS.NEW_PASSWORD && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label htmlFor="new-password" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">New Password</label>
                <div className="relative">
                  <input id="new-password" type={showPassword ? 'text' : 'password'} required autoFocus autoComplete="new-password" value={password}
                    onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 chars, number & symbol"
                    className="w-full px-3.5 py-2.5 pr-11 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-powder-500 transition" />
                  <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {password && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-300 ${strength.color}`} style={{ width: `${(strength.score / 4) * 100}%` }} />
                    </div>
                    <span className={`text-xs font-semibold ${strength.textColor}`}>{strength.label}</span>
                  </div>
                )}
              </div>
              <div>
                <label htmlFor="confirm-new-password" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">Confirm Password</label>
                <div className="relative">
                  <input id="confirm-new-password" type={showConfirmPassword ? 'text' : 'password'} required autoComplete="new-password" value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 pr-11 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-powder-500 transition" />
                  <button type="button" onClick={() => setShowConfirmPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition">
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={isSubmitting}
                className="w-full py-3 rounded-xl bg-powder-600 hover:bg-powder-700 text-white font-semibold text-sm transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                {isSubmitting ? (<><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div><span>Resetting...</span></>) : <span>Reset Password</span>}
              </button>
            </form>
          )}

          {/* ── Step 4: Done ── */}
          {step === STEPS.DONE && (
            <div className="text-center space-y-4">
              <div className="p-4 rounded-xl bg-mint-50 dark:bg-mint-950/30 border border-mint-200 dark:border-mint-800 text-mint-700 dark:text-mint-300 text-sm">
                You can now sign in with your new password.
              </div>
              <button onClick={() => navigate('/login', { replace: true })}
                className="w-full py-3 rounded-xl bg-powder-600 hover:bg-powder-700 text-white font-semibold text-sm transition shadow-sm flex items-center justify-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Go to Sign In
              </button>
            </div>
          )}

          {/* Back to Login */}
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 text-center text-sm text-slate-500 dark:text-slate-400">
            <Link to="/login" className="inline-flex items-center gap-1 font-medium text-slate-600 dark:text-slate-400 hover:text-powder-600 dark:hover:text-powder-400 transition">
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
