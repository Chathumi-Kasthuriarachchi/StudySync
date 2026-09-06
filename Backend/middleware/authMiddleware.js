const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Protect Middleware (Authentication)
 * 
 * Responsibility:
 * "Who are you?"
 * Intercepts incoming requests, verifies the JWT token present in the
 * Authorization header (Bearer <token>), and attaches the authenticated
 * user record to `req.user`.
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

            // Verify JWT signature
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Fetch user from DB excluding password
            req.user = await User.findById(decoded.id).select("-password");

            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: "User account no longer exists",
                });
            }

            return next();
        } catch (error) {
            console.error("Auth Middleware Error:", error.message);
            return res.status(401).json({
                success: false,
                message: "Not authorized, token failed or expired",
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
 * RequireAdmin Middleware (System-Level Authorization)
 * 
 * Responsibility:
 * "What are you allowed to do?"
 * Ensures that the authenticated user possesses the 'ADMIN' systemRole.
 * If not, halts execution with HTTP 403 Forbidden.
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

module.exports = { protect, requireAdmin, adminOnly: requireAdmin };