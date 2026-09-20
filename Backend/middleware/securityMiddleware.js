const helmet = require("helmet");

/**
 * Security Headers Middleware — Phase 21
 *
 * Configures Helmet for standard HTTP security headers.
 * Environment-aware: relaxed in development, strict in production.
 *
 * Does NOT conflict with:
 * - Socket.IO WebSocket upgrades
 * - S3 presigned URL image/file rendering
 * - Frontend SPA routing
 */

const isProduction = () => process.env.NODE_ENV === "production";

const securityHeaders = helmet({
    // Content-Security-Policy: relaxed for API server (no HTML pages served)
    contentSecurityPolicy: false,

    // X-DNS-Prefetch-Control: off
    dnsPrefetchControl: { allow: false },

    // X-Frame-Options: DENY (API should never be framed)
    frameguard: { action: "deny" },

    // Strict-Transport-Security: enable in production
    hsts: isProduction()
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,

    // X-Content-Type-Options: nosniff
    noSniff: true,

    // X-Powered-By: removed (hides Express)
    hidePoweredBy: true,

    // Referrer-Policy: no-referrer
    referrerPolicy: { policy: "no-referrer" },

    // X-XSS-Protection: 0 (modern browsers, CSP preferred)
    xssFilter: true,

    // Cross-Origin policies
    crossOriginEmbedderPolicy: false, // Allow embedding S3 presigned URLs
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false, // Allow cross-origin resource loading
});

module.exports = { securityHeaders };
