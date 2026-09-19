const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const {
    generateAccessToken,
    generateRefreshToken,
    hashToken,
    createRefreshSession,
    rotateRefreshSession,
    revokeRefreshSession,
    revokeAllUserSessions,
    findValidRefreshSession,
    setRefreshCookie,
    clearRefreshCookie,
    REFRESH_COOKIE_NAME,
} = require("../services/tokenService");
const { createOTPRecord, verifyOTP } = require("../services/otpService");
const { sendEmailVerificationOTP, sendPasswordResetOTP } = require("../services/emailService");

// ── Password Validation ────────────────────────────────────────────────────────
const PASSWORD_REGEX = /^(?=.*[0-9])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~])/;
const validatePasswordStrength = (password) => {
    if (password.length < 8) return "Password must be at least 8 characters long.";
    if (!/[0-9]/.test(password)) return "Password must contain at least one number.";
    if (!PASSWORD_REGEX.test(password)) return "Password must contain at least one special character.";
    return null;
};

// ── Password Reset Token (short-lived JWT, separate from auth tokens) ─────────
const RESET_TOKEN_EXPIRY = "15m";
const generateResetToken = (email) => {
    return jwt.sign({ email, purpose: "PASSWORD_RESET" }, process.env.JWT_SECRET, {
        expiresIn: RESET_TOKEN_EXPIRY,
    });
};

// ── User Response Serializer ──────────────────────────────────────────────────
const formatAuthUser = (user) => ({
    id: user._id,
    name: user.name,
    email: user.email,
    username: user.username || "",
    bio: user.bio || "",
    systemRole: user.systemRole,
    profileImageURL: user.profileImageURL || null,
    preferences: user.preferences || {
        theme: "system",
        language: "en",
        emailNotifications: true,
    },
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
});

// ═════════════════════════════════════════════════════════════════════════════
// REGISTRATION
// ═════════════════════════════════════════════════════════════════════════════

/**
 * @desc    Register a new user account (requires email verification before login)
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = async (req, res) => {
    try {
        const { name, email, password, confirmPassword, termsAccepted } = req.body;

        // 1. Required fields
        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: "Please provide name, email, and password." });
        }

        // 2. Terms & Conditions agreement (backend enforcement)
        if (!termsAccepted) {
            return res.status(400).json({ success: false, message: "You must agree to the Terms & Conditions to create an account." });
        }

        // 3. Password strength (backend is authoritative)
        const pwError = validatePasswordStrength(password);
        if (pwError) return res.status(400).json({ success: false, message: pwError });

        // 4. Passwords match
        if (confirmPassword !== undefined && password !== confirmPassword) {
            return res.status(400).json({ success: false, message: "Passwords do not match." });
        }

        // 5. Email uniqueness
        const userExists = await User.findOne({ email: email.toLowerCase().trim() });
        if (userExists) {
            return res.status(400).json({ success: false, message: "A user with this email already exists." });
        }

        // 6. Create user — NOT verified yet, cannot log in
        const user = await User.create({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            password,
            systemRole: "USER",  // Never from client body
            emailVerified: false,
            termsAccepted: true,
            termsAcceptedAt: new Date(),
        });

        // 7. Generate & send OTP
        const { otp } = await createOTPRecord(user.email, "EMAIL_VERIFICATION");
        await sendEmailVerificationOTP(user.email, user.name, otp);

        return res.status(201).json({
            success: true,
            message: "Account created! Please check your email for a verification code.",
            data: {
                pendingVerification: true,
                email: user.email,
                name: user.name,
            },
        });
    } catch (error) {
        console.error("Register Error:", error);
        if (error.code === "RATE_LIMIT_EXCEEDED" || error.code === "RESEND_COOLDOWN") {
            return res.status(429).json({ success: false, message: error.message });
        }
        return res.status(500).json({ success: false, message: "Server error during registration." });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// EMAIL VERIFICATION
// ═════════════════════════════════════════════════════════════════════════════

/**
 * @desc    Verify email with OTP code
 * @route   POST /api/auth/verify-email
 * @access  Public
 */
const verifyEmail = async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ success: false, message: "Email and verification code are required." });
        }

        // Verify OTP (throws on failure with descriptive messages)
        await verifyOTP(email.toLowerCase().trim(), "EMAIL_VERIFICATION", otp.toString().trim());

        // Mark user as verified
        const user = await User.findOneAndUpdate(
            { email: email.toLowerCase().trim() },
            { emailVerified: true, emailVerifiedAt: new Date() },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        // Issue tokens — user is now fully authenticated
        const accessToken = generateAccessToken(user._id, user.systemRole);
        const refreshToken = generateRefreshToken();
        await createRefreshSession(user._id, refreshToken, req);
        setRefreshCookie(res, refreshToken);

        return res.status(200).json({
            success: true,
            message: "Email verified successfully! Welcome to StudySync.",
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    systemRole: user.systemRole,
                    emailVerified: user.emailVerified,
                    createdAt: user.createdAt,
                },
                accessToken,
            },
        });
    } catch (error) {
        console.error("Verify Email Error:", error);
        const clientErrors = ["INVALID_OTP", "OTP_EXPIRED", "MAX_ATTEMPTS_EXCEEDED", "OTP_ALREADY_USED"];
        if (clientErrors.includes(error.code)) {
            return res.status(400).json({ success: false, message: error.message });
        }
        return res.status(500).json({ success: false, message: "Server error during verification." });
    }
};

/**
 * @desc    Resend email verification OTP
 * @route   POST /api/auth/resend-otp
 * @access  Public
 */
const resendOTP = async (req, res) => {
    try {
        const { email, purpose } = req.body;
        if (!email) return res.status(400).json({ success: false, message: "Email is required." });

        const validPurposes = ["EMAIL_VERIFICATION", "PASSWORD_RESET"];
        const otpPurpose = validPurposes.includes(purpose) ? purpose : "EMAIL_VERIFICATION";

        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            // Generic response — do not reveal whether email exists
            return res.status(200).json({ success: true, message: "If an account exists, a new code has been sent." });
        }

        const { otp } = await createOTPRecord(user.email, otpPurpose);

        if (otpPurpose === "EMAIL_VERIFICATION") {
            await sendEmailVerificationOTP(user.email, user.name, otp);
        } else {
            await sendPasswordResetOTP(user.email, user.name, otp);
        }

        return res.status(200).json({ success: true, message: "A new verification code has been sent." });
    } catch (error) {
        console.error("Resend OTP Error:", error);
        if (error.code === "RESEND_COOLDOWN") {
            return res.status(429).json({ success: false, message: error.message, remainingSeconds: error.remainingSeconds });
        }
        if (error.code === "RATE_LIMIT_EXCEEDED") {
            return res.status(429).json({ success: false, message: error.message });
        }
        return res.status(500).json({ success: false, message: "Server error. Please try again." });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// LOGIN
// ═════════════════════════════════════════════════════════════════════════════

/**
 * @desc    Authenticate user & issue access + refresh tokens
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Please provide email and password." });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });

        // Generic error — do not reveal whether email exists
        if (!user) {
            return res.status(401).json({ success: false, message: "Invalid email or password." });
        }

        // Check temporary account lock
        if (user.isLocked()) {
            const remainingMs = user.lockUntil - Date.now();
            const remainingMins = Math.ceil(remainingMs / 60000);
            return res.status(429).json({
                success: false,
                message: `Account is temporarily locked. Please try again in ${remainingMins} minute${remainingMins !== 1 ? "s" : ""}.`,
                code: "ACCOUNT_LOCKED",
            });
        }

        // Verify password
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            await user.incrementLoginAttempts();
            return res.status(401).json({ success: false, message: "Invalid email or password." });
        }

        // Check email verification
        if (!user.emailVerified) {
            return res.status(403).json({
                success: false,
                message: "Please verify your email address before logging in.",
                code: "EMAIL_NOT_VERIFIED",
                email: user.email,
            });
        }

        // Successful login — clear failed attempts
        await user.resetLoginAttempts();

        // Issue tokens
        const accessToken = generateAccessToken(user._id, user.systemRole);
        const refreshToken = generateRefreshToken();
        await createRefreshSession(user._id, refreshToken, req);
        setRefreshCookie(res, refreshToken);

        return res.status(200).json({
            success: true,
            message: "Login successful.",
            data: {
                user: formatAuthUser(user),
                accessToken,
            },
        });
    } catch (error) {
        console.error("Login Error:", error);
        return res.status(500).json({ success: false, message: "Server error during login." });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// TOKEN REFRESH
// ═════════════════════════════════════════════════════════════════════════════

/**
 * @desc    Silently refresh access token using HttpOnly cookie refresh token
 * @route   POST /api/auth/refresh
 * @access  Public (uses cookie, not Authorization header)
 */
const refreshToken = async (req, res) => {
    try {
        const token = req.cookies?.[REFRESH_COOKIE_NAME];

        if (!token) {
            return res.status(401).json({ success: false, message: "No refresh token provided.", code: "NO_REFRESH_TOKEN" });
        }

        const tokenHash = hashToken(token);

        // Find the session in the database
        const session = await findValidRefreshSession(tokenHash);
        if (!session) {
            clearRefreshCookie(res);
            return res.status(401).json({ success: false, message: "Refresh session invalid or expired.", code: "SESSION_INVALID" });
        }

        // Fetch user
        const user = await User.findById(session.userId).select("-password");
        if (!user) {
            clearRefreshCookie(res);
            return res.status(401).json({ success: false, message: "User not found.", code: "USER_NOT_FOUND" });
        }

        // Rotate: invalidate old session, create new one
        const newRefreshToken = generateRefreshToken();
        const rotated = await rotateRefreshSession(tokenHash, user._id, newRefreshToken, req);

        if (!rotated) {
            // Token reuse detected — all sessions revoked
            clearRefreshCookie(res);
            return res.status(401).json({ success: false, message: "Token reuse detected. Please log in again.", code: "TOKEN_REUSE" });
        }

        // Issue new access token + set new refresh cookie
        const accessToken = generateAccessToken(user._id, user.systemRole);
        setRefreshCookie(res, newRefreshToken);

        return res.status(200).json({
            success: true,
            data: {
                accessToken,
                user: formatAuthUser(user),
            },
        });
    } catch (error) {
        console.error("Refresh Token Error:", error);
        clearRefreshCookie(res);
        return res.status(500).json({ success: false, message: "Server error during token refresh." });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// LOGOUT
// ═════════════════════════════════════════════════════════════════════════════

/**
 * @desc    Logout — invalidate refresh session & clear cookie
 * @route   POST /api/auth/logout
 * @access  Private
 */
const logout = async (req, res) => {
    try {
        const token = req.cookies?.[REFRESH_COOKIE_NAME];
        if (token) {
            const tokenHash = hashToken(token);
            await revokeRefreshSession(tokenHash);
        }
        clearRefreshCookie(res);
        return res.status(200).json({ success: true, message: "Logged out successfully." });
    } catch (error) {
        console.error("Logout Error:", error);
        clearRefreshCookie(res);
        return res.status(500).json({ success: false, message: "Server error during logout." });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// FORGOT PASSWORD
// ═════════════════════════════════════════════════════════════════════════════

/**
 * @desc    Request password reset OTP
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: "Email is required." });

        // Privacy: always return the same generic response regardless of whether email exists
        const genericResponse = {
            success: true,
            message: "If an account exists for this email, a verification code has been sent.",
        };

        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) return res.status(200).json(genericResponse); // Do not reveal non-existence

        const { otp } = await createOTPRecord(user.email, "PASSWORD_RESET");
        await sendPasswordResetOTP(user.email, user.name, otp);

        return res.status(200).json(genericResponse);
    } catch (error) {
        console.error("Forgot Password Error:", error);
        if (error.code === "RESEND_COOLDOWN") {
            return res.status(429).json({ success: false, message: error.message, remainingSeconds: error.remainingSeconds });
        }
        if (error.code === "RATE_LIMIT_EXCEEDED") {
            return res.status(429).json({ success: false, message: error.message });
        }
        // Generic response on all other errors to prevent information leakage
        return res.status(200).json({
            success: true,
            message: "If an account exists for this email, a verification code has been sent.",
        });
    }
};

/**
 * @desc    Verify password reset OTP and issue a short-lived reset token
 * @route   POST /api/auth/verify-reset-otp
 * @access  Public
 */
const verifyResetOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ success: false, message: "Email and verification code are required." });
        }

        await verifyOTP(email.toLowerCase().trim(), "PASSWORD_RESET", otp.toString().trim());

        // Issue a short-lived password reset JWT (15 min)
        const resetToken = generateResetToken(email.toLowerCase().trim());

        return res.status(200).json({
            success: true,
            message: "Code verified. You may now set a new password.",
            data: { resetToken },
        });
    } catch (error) {
        console.error("Verify Reset OTP Error:", error);
        const clientErrors = ["INVALID_OTP", "OTP_EXPIRED", "MAX_ATTEMPTS_EXCEEDED", "OTP_ALREADY_USED"];
        if (clientErrors.includes(error.code)) {
            return res.status(400).json({ success: false, message: error.message });
        }
        return res.status(500).json({ success: false, message: "Server error during OTP verification." });
    }
};

/**
 * @desc    Reset password using verified reset token
 * @route   POST /api/auth/reset-password
 * @access  Public (requires reset token from verifyResetOTP)
 */
const resetPassword = async (req, res) => {
    try {
        const { resetToken, password, confirmPassword } = req.body;

        if (!resetToken || !password) {
            return res.status(400).json({ success: false, message: "Reset token and new password are required." });
        }

        // Verify reset token
        let decoded;
        try {
            decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(400).json({ success: false, message: "Password reset link is invalid or has expired." });
        }

        if (decoded.purpose !== "PASSWORD_RESET") {
            return res.status(400).json({ success: false, message: "Invalid reset token." });
        }

        // Password validation
        const pwError = validatePasswordStrength(password);
        if (pwError) return res.status(400).json({ success: false, message: pwError });

        if (confirmPassword !== undefined && password !== confirmPassword) {
            return res.status(400).json({ success: false, message: "Passwords do not match." });
        }

        const user = await User.findOne({ email: decoded.email });
        if (!user) return res.status(404).json({ success: false, message: "User not found." });

        // Update password (triggers bcrypt pre-save hook)
        user.password = password;
        await user.save();

        // Invalidate ALL refresh sessions for security
        await revokeAllUserSessions(user._id);

        return res.status(200).json({ success: true, message: "Password reset successfully. Please log in with your new password." });
    } catch (error) {
        console.error("Reset Password Error:", error);
        return res.status(500).json({ success: false, message: "Server error during password reset." });
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// PROFILE / ME
// ═════════════════════════════════════════════════════════════════════════════

/**
 * @desc    Get currently authenticated user profile
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = async (req, res) => {
    try {
        return res.status(200).json({
            success: true,
            data: {
                user: formatAuthUser(req.user),
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error retrieving profile." });
    }
};

/**
 * @desc    Verify Admin Authorization
 * @route   GET /api/auth/admin-check
 * @access  Private (Admin only)
 */
const checkAdmin = async (req, res) => {
    return res.status(200).json({
        success: true,
        message: "Admin authorization verified successfully.",
        data: {
            admin: {
                id: req.user._id,
                name: req.user.name,
                email: req.user.email,
                systemRole: req.user.systemRole,
            },
        },
    });
};

/**
 * @desc    Update user profile
 * @route   PUT /api/auth/profile
 * @access  Private
 */
const updateProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: "User not found." });

        if (req.body.name) user.name = req.body.name.trim();
        if (req.body.username !== undefined) {
            const trimmedUsername = req.body.username.trim().toLowerCase();
            if (trimmedUsername.length > 0) {
                const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
                if (!usernameRegex.test(trimmedUsername)) {
                    return res.status(400).json({
                        success: false,
                        message: "Username must be 3-30 characters and contain only letters, numbers, and underscores.",
                    });
                }
                const existing = await User.findOne({ username: trimmedUsername, _id: { $ne: user._id } });
                if (existing) {
                    return res.status(409).json({ success: false, message: "Username is already taken." });
                }
                user.username = trimmedUsername;
            } else {
                user.username = undefined;
            }
        }
        if (req.body.bio !== undefined) {
            if (req.body.bio.length > 500) {
                return res.status(400).json({ success: false, message: "Bio cannot exceed 500 characters." });
            }
            user.bio = req.body.bio.trim();
        }
        if (req.body.password) {
            const pwError = validatePasswordStrength(req.body.password);
            if (pwError) return res.status(400).json({ success: false, message: pwError });
            user.password = req.body.password;
            await revokeAllUserSessions(user._id); // Invalidate all sessions on password change
        }

        await user.save();

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully.",
            data: { user: formatAuthUser(user) },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error updating profile." });
    }
};

module.exports = {
    register,
    login,
    verifyEmail,
    resendOTP,
    refreshToken,
    logout,
    forgotPassword,
    verifyResetOTP,
    resetPassword,
    getMe,
    getUserProfile: getMe,
    checkAdmin,
    updateProfile,
};