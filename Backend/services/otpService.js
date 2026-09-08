const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const OTPVerification = require("../models/OTPVerification");

// ── Configuration ─────────────────────────────────────────────────────────────
const OTP_EXPIRY_MS = 5 * 60 * 1000;           // 5 minutes
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;       // 60 seconds
const OTP_MAX_ATTEMPTS = 5;                     // max wrong guesses
const OTP_MAX_REQUESTS_PER_HOUR = 5;            // max sends per hour

// ── OTP Generation ────────────────────────────────────────────────────────────

/**
 * generateOTP
 *
 * Generates a cryptographically secure 6-digit OTP using Node's crypto module.
 * Uses randomInt instead of Math.random() to avoid predictable sequences.
 * Returns a zero-padded string to ensure exactly 6 digits.
 */
const generateOTP = () => {
    const otp = crypto.randomInt(100000, 999999);
    return otp.toString();
};

/**
 * hashOTP
 *
 * bcrypt-hashes the OTP for secure storage.
 * bcrypt is used here (vs SHA-256) because:
 * - OTPs are low-entropy (6 digits = 10^6 possibilities)
 * - bcrypt's salting + cost factor prevents rainbow table attacks
 * - An attacker who accesses the database cannot simply precompute all OTPs
 */
const hashOTP = async (otp) => {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(otp, salt);
};

/**
 * verifyOTPHash
 *
 * Compares an entered OTP against its stored bcrypt hash.
 */
const verifyOTPHash = async (enteredOTP, storedHash) => {
    return await bcrypt.compare(enteredOTP, storedHash);
};

// ── OTP Record Management ─────────────────────────────────────────────────────

/**
 * createOTPRecord
 *
 * Creates or replaces an OTP record for a given email + purpose combination.
 *
 * Rate Limiting Logic:
 * - Enforces a maximum of 5 OTP requests per rolling 1-hour window per email+purpose
 * - Enforces a 60-second resend cooldown
 *
 * Returns: { otp (plaintext, for sending via email), record } or throws on rate limit.
 */
const createOTPRecord = async (email, purpose) => {
    const normalizedEmail = email.toLowerCase().trim();
    const now = new Date();

    // Check if an existing record exists for this email + purpose
    const existing = await OTPVerification.findOne({ email: normalizedEmail, purpose });

    if (existing) {
        // ── 60-second Resend Cooldown ─────────────────────────────────────────
        const secondsSinceLastSend = (now - existing.lastSentAt) / 1000;
        if (secondsSinceLastSend < 60) {
            const remainingSeconds = Math.ceil(60 - secondsSinceLastSend);
            throw Object.assign(
                new Error(`Please wait ${remainingSeconds} seconds before requesting a new code.`),
                { code: "RESEND_COOLDOWN", remainingSeconds }
            );
        }

        // ── Hourly Rate Limit ─────────────────────────────────────────────────
        const hoursSinceWindowStart = (now - existing.windowStart) / (1000 * 60 * 60);

        let requestCount = existing.requestCount;
        let windowStart = existing.windowStart;

        if (hoursSinceWindowStart >= 1) {
            // Window has reset
            requestCount = 0;
            windowStart = now;
        }

        if (requestCount >= OTP_MAX_REQUESTS_PER_HOUR) {
            throw Object.assign(
                new Error("Too many verification code requests. Please try again in an hour."),
                { code: "RATE_LIMIT_EXCEEDED" }
            );
        }

        // Generate new OTP and update the record
        const otp = generateOTP();
        const otpHash = await hashOTP(otp);
        const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MS);

        await OTPVerification.findByIdAndUpdate(existing._id, {
            otpHash,
            expiresAt,
            attempts: 0,
            used: false,
            requestCount: requestCount + 1,
            windowStart,
            lastSentAt: now,
        });

        return { otp };
    }

    // ── Create New Record ──────────────────────────────────────────────────────
    const otp = generateOTP();
    const otpHash = await hashOTP(otp);
    const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MS);

    await OTPVerification.create({
        email: normalizedEmail,
        purpose,
        otpHash,
        expiresAt,
        attempts: 0,
        used: false,
        requestCount: 1,
        windowStart: now,
        lastSentAt: now,
    });

    return { otp };
};

/**
 * verifyOTP
 *
 * Validates a user-entered OTP against the stored record.
 *
 * Security Rules Enforced:
 * 1. Record must exist for the specified email + purpose
 * 2. OTP must not be expired
 * 3. OTP must not already be consumed (used)
 * 4. Attempt count must not exceed maximum (5)
 * 5. Entered OTP must match the bcrypt hash
 *
 * Returns: { success: true } on valid OTP
 * Throws descriptive errors otherwise (safe for frontend display)
 */
const verifyOTP = async (email, purpose, enteredOTP) => {
    const normalizedEmail = email.toLowerCase().trim();

    const record = await OTPVerification.findOne({ email: normalizedEmail, purpose });

    if (!record) {
        throw Object.assign(
            new Error("Verification code is invalid or expired."),
            { code: "INVALID_OTP" }
        );
    }

    // Check if already consumed
    if (record.used) {
        throw Object.assign(
            new Error("This verification code has already been used. Please request a new one."),
            { code: "OTP_ALREADY_USED" }
        );
    }

    // Check expiration
    if (record.expiresAt < new Date()) {
        throw Object.assign(
            new Error("Verification code has expired. Please request a new one."),
            { code: "OTP_EXPIRED" }
        );
    }

    // Check attempt limit
    if (record.attempts >= OTP_MAX_ATTEMPTS) {
        throw Object.assign(
            new Error("Too many incorrect attempts. Please request a new verification code."),
            { code: "MAX_ATTEMPTS_EXCEEDED" }
        );
    }

    // Verify the OTP hash
    const isValid = await verifyOTPHash(enteredOTP, record.otpHash);

    if (!isValid) {
        // Increment attempt counter
        const newAttempts = record.attempts + 1;
        await OTPVerification.findByIdAndUpdate(record._id, { attempts: newAttempts });

        const remainingAttempts = OTP_MAX_ATTEMPTS - newAttempts;
        if (remainingAttempts <= 0) {
            throw Object.assign(
                new Error("Too many incorrect attempts. Please request a new verification code."),
                { code: "MAX_ATTEMPTS_EXCEEDED" }
            );
        }

        throw Object.assign(
            new Error(`Verification code is incorrect. ${remainingAttempts} attempt${remainingAttempts !== 1 ? "s" : ""} remaining.`),
            { code: "INVALID_OTP", remainingAttempts }
        );
    }

    // Mark as used
    await OTPVerification.findByIdAndUpdate(record._id, { used: true });

    return { success: true };
};

/**
 * canResend
 *
 * Checks whether the resend cooldown has elapsed for a given email + purpose.
 * Returns { canResend: boolean, remainingSeconds: number }
 */
const canResend = async (email, purpose) => {
    const normalizedEmail = email.toLowerCase().trim();
    const record = await OTPVerification.findOne({ email: normalizedEmail, purpose });

    if (!record) return { canResend: true, remainingSeconds: 0 };

    const secondsSinceLastSend = (Date.now() - record.lastSentAt) / 1000;
    if (secondsSinceLastSend >= 60) {
        return { canResend: true, remainingSeconds: 0 };
    }

    return {
        canResend: false,
        remainingSeconds: Math.ceil(60 - secondsSinceLastSend),
    };
};

module.exports = {
    generateOTP,
    hashOTP,
    createOTPRecord,
    verifyOTP,
    canResend,
    OTP_EXPIRY_MS,
    OTP_RESEND_COOLDOWN_MS,
    OTP_MAX_ATTEMPTS,
    OTP_MAX_REQUESTS_PER_HOUR,
};
