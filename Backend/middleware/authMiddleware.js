const { verifyAccessToken } = require("../services/tokenService");
const User = require("../models/User");

/**
 * protect Middleware (Authentication)
 *
 * Responsibility: "Who are you?"
 * Verifies the short-lived (15 min) access token from the Authorization header.
 * On success, attaches the full authenticated user to req.user.
 *
 * Note: This middleware only validates the ACCESS token.
 * The REFRESH token lives in an HttpOnly cookie and is handled by /api/auth/refresh.
 */
const protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith("Bearer")
    ) {
        try {
            // Extract token from "Bearer <token>"
            token = req.headers.authorization.split(" ")[1];

            // Verify access token signature and expiration
            const decoded = verifyAccessToken(token);

            // Fetch user from DB — ensures user still exists and gets latest data
            req.user = await User.findById(decoded.id).select("-password -loginAttempts -lockUntil");

            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: "User account no longer exists",
                });
            }

            return next();
        } catch (error) {
            // Distinguish token expiry from invalid token for better UX
            if (error.name === "TokenExpiredError") {
                return res.status(401).json({
                    success: false,
                    message: "Access token expired",
                    code: "TOKEN_EXPIRED",
                });
            }

            console.error("Auth Middleware Error:", error.message);
            return res.status(401).json({
                success: false,
                message: "Not authorized, token is invalid",
            });
        }
    }

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Not authorized, no token provided",
        });
    }
};

/**
 * requireAdmin Middleware (System-Level Authorization)
 *
 * Responsibility: "What are you allowed to do?"
 * Ensures that the authenticated user possesses the 'ADMIN' systemRole.
 * Must be used AFTER protect middleware.
 */
const requireAdmin = (req, res, next) => {
    if (req.user && req.user.systemRole === "ADMIN") {
        return next();
    }
    return res.status(403).json({
        success: false,
        message: "Forbidden: System Admin access required",
    });
};

/**
 * requireEmailVerified Middleware
 *
 * Blocks access to routes that require a verified email address.
 * Ensures that users who registered but haven't verified their email
 * cannot access protected workspace features.
 *
 * Must be used AFTER protect middleware.
 */
const requireEmailVerified = (req, res, next) => {
    if (req.user && req.user.emailVerified) {
        return next();
    }
    return res.status(403).json({
        success: false,
        message: "Email verification required. Please verify your email to continue.",
        code: "EMAIL_NOT_VERIFIED",
    });
};

module.exports = { protect, requireAdmin, adminOnly: requireAdmin, requireEmailVerified };