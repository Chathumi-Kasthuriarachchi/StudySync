const rateLimit = require("express-rate-limit");

/**
 * Rate Limit Middleware
 *
 * Why rate limiting is applied on the backend:
 * Frontend timers and disabled buttons are purely UX — they provide zero security.
 * An attacker can bypass the browser entirely and hit the API directly.
 * Backend rate limiting is the only true enforcement mechanism.
 *
 * Design Decisions:
 * - Applied selectively to security-sensitive auth endpoints only
 * - Not applied globally (would hurt non-auth API performance)
 * - Returns consistent JSON error format matching the rest of the API
 * - IP-based limiting (most practical for public APIs without user sessions)
 */

const createLimiter = (windowMs, max, message) =>
    rateLimit({
        windowMs,
        max,
        standardHeaders: true,   // Return rate limit info in RateLimit-* headers
        legacyHeaders: false,
        message: {
            success: false,
            message,
        },
        // Skip successful requests for login (count only failures)
        // Note: express-rate-limit v6+ uses skipSuccessfulRequests
    });

/**
 * authLimiter
 *
 * Used on: /register, /forgot-password, /resend-otp
 * Allows 5 requests per hour per IP.
 * Prevents mass account creation and OTP spam from a single source.
 */
const authLimiter = createLimiter(
    60 * 60 * 1000,  // 1 hour window
    5,
    "Too many requests from this IP. Please try again in an hour."
);

/**
 * loginLimiter
 *
 * Used on: /login
 * Allows 10 login attempts per 15 minutes per IP.
 * Less strict than OTP limits because users may legitimately mistype passwords.
 * Account-level locking (in User model) provides additional per-account protection.
 */
const loginLimiter = createLimiter(
    15 * 60 * 1000,  // 15 minute window
    10,
    "Too many login attempts from this IP. Please wait 15 minutes."
);

/**
 * otpLimiter
 *
 * Used on: /verify-email, /verify-reset-otp
 * Allows 10 verification attempts per hour per IP.
 * Account-level attempt counting (in OTPVerification model) provides per-OTP protection.
 */
const otpLimiter = createLimiter(
    60 * 60 * 1000,  // 1 hour window
    10,
    "Too many verification attempts from this IP. Please try again later."
);

/**
 * refreshLimiter
 *
 * Used on: /refresh
 * Allows 30 refresh requests per 15 minutes per IP.
 * Permissive — normal use involves frequent silent refreshes.
 * Prevents DoS against the refresh endpoint specifically.
 */
const refreshLimiter = createLimiter(
    15 * 60 * 1000,  // 15 minute window
    30,
    "Too many refresh requests. Please try again shortly."
);

module.exports = { authLimiter, loginLimiter, otpLimiter, refreshLimiter };
