import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Mail, RefreshCw, CheckCircle2 } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { DotPattern } from '../../components/ui/dot-pattern';

const OTP_LENGTH = 6;
const OTP_EXPIRY_SECONDS = 5 * 60; // 5 minutes
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * VerifyEmail Page (Phase 3)
 *
 * Shown after successful registration. User enters the 6-digit OTP
 * from their email to verify their account and log in.
 *
 * Features:
 * - 6 individual digit input boxes with auto-focus/tab
 * - Countdown timer (5:00 → 0:00) for OTP expiry
 * - Resend button with 60-second cooldown
 * - Paste support for the OTP (paste anywhere in the boxes)
 * - On success → sets auth tokens and redirects to /dashboard
 */
const VerifyEmail = () => {
  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''));
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [otpCountdown, setOtpCountdown] = useState(OTP_EXPIRY_SECONDS);
  const [success, setSuccess] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  const inputRefs = useRef([]);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { checkAuth } = useAuth();

  const email = searchParams.get('email') || '';
  const name = searchParams.get('name') || '';

  // ── OTP Expiry Countdown ──────────────────────────────────────────────────
  useEffect(() => {
    if (otpCountdown <= 0) return;
    const timer = setInterval(() => setOtpCountdown((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(timer);
  }, [otpCountdown]);

  // ── Resend Cooldown ────────────────────────────────────────────────────────
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ── OTP Input Handling ────────────────────────────────────────────────────
  const handleDigitChange = (index, value) => {
    // Only allow single digits
    const digit = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);
    setError('');

    // Auto-advance to next input
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits filled
    if (digit && newDigits.every((d) => d !== '')) {
      handleVerify(newDigits.join(''));
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        const newDigits = [...digits];
        newDigits[index] = '';
        setDigits(newDigits);
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    const newDigits = [...digits];
    for (let i = 0; i < pasted.length; i++) newDigits[i] = pasted[i];
    setDigits(newDigits);
    // Focus last filled or next empty
    const nextEmpty = newDigits.findIndex((d) => d === '');
    const focusIndex = nextEmpty === -1 ? OTP_LENGTH - 1 : nextEmpty;
    inputRefs.current[focusIndex]?.focus();
    if (pasted.length === OTP_LENGTH) {
      handleVerify(pasted);
    }
  };

  // ── Verify OTP ───────────────────────────────────────────────────────────
  const handleVerify = useCallback(async (otpCode) => {
    if (!email) { setError('Email is missing. Please go back and try again.'); return; }
    if (isSubmitting) return;

    setError('');
    setIsSubmitting(true);
    try {
      const response = await api.post('/api/auth/verify-email', { email, otp: otpCode });
      if (response.data?.success) {
        const { accessToken } = response.data.data;
        localStorage.setItem('studysync_access_token', accessToken);
        setSuccess(true);
        await checkAuth();
        setTimeout(() => navigate('/dashboard', { replace: true }), 1200);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed. Please check the code and try again.');
      setDigits(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setIsSubmitting(false);
    }
  }, [email, isSubmitting, checkAuth, navigate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const code = digits.join('');
    if (code.length < OTP_LENGTH) { setError('Please enter all 6 digits of the verification code.'); return; }
    handleVerify(code);
  };

  // ── Resend OTP ────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (resendCooldown > 0 || isResending) return;
    setIsResending(true);
    setResendMessage('');
    setError('');
    try {
      await api.post('/api/auth/resend-otp', { email, purpose: 'EMAIL_VERIFICATION' });
      setResendMessage('A new code has been sent to your email.');
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

  return (
    <div className="relative min-h-[calc(100vh-4rem)] w-full flex items-center justify-center py-10 px-4 sm:px-6">
      <DotPattern className="z-0" dotSize={2.5} gap={26} proximity={160} glowIntensity={1.8} waveSpeed={1.2} />

      <div className="relative z-10 w-full max-w-md mx-auto">
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xl p-6 sm:p-8 transition-all">
          {/* Header */}
          <div className="text-center mb-6">
            <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 transition-all duration-500 ${success ? 'bg-mint-100 dark:bg-mint-950/50' : 'bg-powder-100 dark:bg-powder-900/40'}`}>
              {success
                ? <CheckCircle2 className="w-7 h-7 text-mint-600 dark:text-mint-400" />
                : <Mail className="w-7 h-7 text-powder-600 dark:text-powder-400" />
              }
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {success ? 'Email Verified!' : 'Verify your email'}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              {success
                ? 'Redirecting you to your dashboard...'
                : (
                  <>
                    {name ? `Hi ${name}! We` : 'We'} sent a 6-digit code to<br />
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{email || 'your email'}</span>
                  </>
                )
              }
            </p>
          </div>

          {/* OTP Expiry Timer */}
          {!success && (
            <div className={`flex items-center justify-center gap-2 mb-5 text-sm font-medium ${otpCountdown <= 60 ? 'text-rose-500' : 'text-slate-500 dark:text-slate-400'}`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Code expires in <strong>{formatTime(otpCountdown)}</strong></span>
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm flex items-start gap-2">
              <svg className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Resend Success Message */}
          {resendMessage && (
            <div className="mb-4 p-3 rounded-xl bg-mint-50 dark:bg-mint-950/40 border border-mint-200 dark:border-mint-800 text-mint-700 dark:text-mint-300 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-mint-500" />
              <span>{resendMessage}</span>
            </div>
          )}

          {!success && (
            <form onSubmit={handleSubmit}>
              {/* 6-Digit OTP Input */}
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
                    aria-label={`OTP digit ${index + 1}`}
                    className={`w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-bold rounded-xl border-2 transition-all duration-150 focus:outline-none
                      ${digit
                        ? 'border-powder-500 bg-powder-50 dark:bg-powder-950/30 text-powder-700 dark:text-powder-300'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white'
                      }
                      focus:border-powder-500 focus:ring-2 focus:ring-powder-500/30
                      disabled:opacity-50
                    `}
                    disabled={isSubmitting}
                    style={{ height: '3.25rem' }}
                  />
                ))}
              </div>

              {/* Verify Button */}
              <button
                type="submit"
                disabled={isSubmitting || digits.join('').length < OTP_LENGTH}
                className="w-full py-3 px-4 rounded-xl bg-powder-600 hover:bg-powder-700 active:bg-powder-800 text-white font-semibold text-sm transition shadow-sm hover:shadow flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Verifying...</span>
                  </>
                ) : (
                  <span>Verify Email</span>
                )}
              </button>

              {/* Resend Section */}
              <div className="mt-5 text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Didn't receive the code?{' '}
                </p>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || isResending}
                  className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-semibold text-powder-600 hover:text-powder-700 dark:text-powder-400 dark:hover:text-powder-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
                  {resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : isResending ? 'Sending...' : 'Resend Code'
                  }
                </button>
              </div>
            </form>
          )}

          {/* Back Link */}
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 text-center text-sm text-slate-500 dark:text-slate-400">
            <Link to="/signup" className="font-medium text-slate-600 dark:text-slate-400 hover:text-powder-600 dark:hover:text-powder-400 transition">
              &larr; Back to Sign Up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
