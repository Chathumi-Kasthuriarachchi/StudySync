const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const RefreshTokenSession = require("../models/RefreshTokenSession");

// ── Configuration ────────────────────────────────────────────────────────────
const ACCESS_TOKEN_EXPIRES = process.env.JWT_ACCESS_EXPIRES || "15m";
const REFRESH_TOKEN_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
const REFRESH_COOKIE_NAME = "studysync_refresh_token";

// ── Token Generation ─────────────────────────────────────────────────────────

/**
 * generateAccessToken
 *
 * Issues a short-lived (15 min) JWT access token.
 * Contains minimal, non-sensitive payload needed for authorization.
 * Access tokens are stateless — the backend validates them by signature only.
 */
const generateAccessToken = (userId, systemRole) => {
    return jwt.sign(
        { id: userId, systemRole },
        process.env.JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRES }
    );
};

/**
 * generateRefreshToken
 *
 * Issues a cryptographically random 64-byte hex token.
 * Refresh tokens are NOT JWTs — they are opaque random strings.
 * Only a SHA-256 hash is stored in the database.
 */
const generateRefreshToken = () => {
    return crypto.randomBytes(64).toString("hex");
};

/**
 * hashToken
 *
 * SHA-256 hash of a token for safe database storage.
 * SHA-256 is appropriate here (not bcrypt) because:
 * - The token is already cryptographically random (128 bits of entropy)
 * - We need fast lookup by hash on every refresh request
 * - bcrypt is designed for low-entropy inputs (passwords); overkill here
 */
const hashToken = (token) => {
    return crypto.createHash("sha256").update(token).digest("hex");
};

/**
 * verifyAccessToken
 *
 * Verifies JWT signature and expiration.
 * Returns decoded payload or throws on failure.
 */
const verifyAccessToken = (token) => {
    return jwt.verify(token, process.env.JWT_SECRET);
};

// ── Session Management ────────────────────────────────────────────────────────

/**
 * createRefreshSession
 *
 * Stores a new refresh token session in the database.
 * Only the SHA-256 hash of the token is stored — never the raw token.
 */
const createRefreshSession = async (userId, refreshToken, req) => {
    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_MS);

    await RefreshTokenSession.create({
        userId,
        tokenHash,
        expiresAt,
        ipAddress: req?.ip || null,
        userAgent: req?.headers?.["user-agent"] || null,
    });

    return { tokenHash, expiresAt };
};

/**
 * rotateRefreshSession
 *
 * Token Rotation Pattern:
 * 1. Validates the incoming refresh token hash exists and is not revoked
 * 2. Marks the old session as revoked (invalidates it permanently)
 * 3. Creates a new session with a new token
 *
 * This detects token theft: if an attacker steals and reuses an old refresh token,
 * the rotation will fail because the old session is already revoked. A legitimate
 * client would be using the new token from the last rotation.
 */
const rotateRefreshSession = async (oldTokenHash, userId, newRefreshToken, req) => {
    // Atomically revoke the old session
    const oldSession = await RefreshTokenSession.findOneAndUpdate(
        {
            tokenHash: oldTokenHash,
            userId,
            revoked: false,
            expiresAt: { $gt: new Date() },
        },
        { revoked: true },
        { new: true }
    );

    if (!oldSession) {
        // Token not found, already revoked, or expired
        // Possible token theft — revoke ALL sessions for this user as a precaution
        await revokeAllUserSessions(userId);
        return null;
    }

    // Create a new session
    return await createRefreshSession(userId, newRefreshToken, req);
};

/**
 * revokeRefreshSession
 *
 * Invalidates a single refresh session (used on logout).
 */
const revokeRefreshSession = async (tokenHash) => {
    await RefreshTokenSession.findOneAndUpdate(
        { tokenHash },
        { revoked: true }
    );
};

/**
 * revokeAllUserSessions
 *
 * Invalidates all active refresh sessions for a user.
 * Used when: password reset, suspicious activity detected, logout-all-devices.
 */
const revokeAllUserSessions = async (userId) => {
    await RefreshTokenSession.updateMany(
        { userId, revoked: false },
        { revoked: true }
    );
};

/**
 * findValidRefreshSession
 *
 * Looks up an active, non-revoked, non-expired session by token hash.
 */
const findValidRefreshSession = async (tokenHash) => {
    return await RefreshTokenSession.findOne({
        tokenHash,
        revoked: false,
        expiresAt: { $gt: new Date() },
    });
};

// ── Cookie Helpers ────────────────────────────────────────────────────────────

/**
 * setRefreshCookie
 *
 * Sets the refresh token in an HttpOnly, Secure cookie.
 *
 * Security properties:
 * - HttpOnly: Not accessible to JavaScript — prevents XSS from stealing the token
 * - Secure: Only sent over HTTPS (in production)
 * - SameSite=Strict: Cookie only sent for same-site requests — prevents CSRF
 * - Path=/api/auth: Cookie only sent to auth endpoints — reduces attack surface
 */
const setRefreshCookie = (res, refreshToken) => {
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
        maxAge: REFRESH_TOKEN_EXPIRES_MS,
        path: "/api/auth",
    });
};

/**
 * clearRefreshCookie
 *
 * Clears the refresh token cookie on logout.
 * Path must match exactly to correctly clear the cookie.
 */
const clearRefreshCookie = (res) => {
    res.clearCookie(REFRESH_COOKIE_NAME, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
        path: "/api/auth",
    });
};

/**
 * parseUserAgent
 * Friendly device & browser parser
 */
const parseUserAgent = (userAgent) => {
    if (!userAgent) {
        return { browser: "Web Browser", os: "Unknown Device", deviceType: "desktop", displayName: "Web Browser • Unknown Device" };
    }

    let browser = "Web Browser";
    if (/edg/i.test(userAgent)) browser = "Microsoft Edge";
    else if (/chrome|crios/i.test(userAgent)) browser = "Google Chrome";
    else if (/firefox|fxios/i.test(userAgent)) browser = "Mozilla Firefox";
    else if (/safari/i.test(userAgent)) browser = "Apple Safari";
    else if (/opera|opr/i.test(userAgent)) browser = "Opera";

    let os = "Unknown OS";
    let deviceType = "desktop";
    if (/windows/i.test(userAgent)) os = "Windows";
    else if (/macintosh|mac os x/i.test(userAgent)) os = "macOS";
    else if (/linux/i.test(userAgent)) os = "Linux";
    else if (/android/i.test(userAgent)) {
        os = "Android";
        deviceType = "mobile";
    } else if (/iphone|ipad|ipod/i.test(userAgent)) {
        os = "iOS";
        deviceType = "mobile";
    }

    return {
        browser,
        os,
        deviceType,
        displayName: `${browser} • ${os}`,
    };
};

/**
 * getUserActiveSessions
 * Returns sanitized non-sensitive session metadata for user
 */
const getUserActiveSessions = async (userId, currentRefreshToken = null) => {
    const currentTokenHash = currentRefreshToken ? hashToken(currentRefreshToken) : null;

    const sessions = await RefreshTokenSession.find({
        userId,
        revoked: false,
        expiresAt: { $gt: new Date() },
    }).sort({ updatedAt: -1 });

    return sessions.map((s) => {
        const uaInfo = parseUserAgent(s.userAgent);
        return {
            id: s._id.toString(),
            browser: uaInfo.browser,
            os: uaInfo.os,
            displayName: uaInfo.displayName,
            deviceType: uaInfo.deviceType,
            ipAddress: s.ipAddress || "Unknown IP",
            lastActive: s.updatedAt || s.createdAt,
            createdAt: s.createdAt,
            isCurrent: Boolean(currentTokenHash && s.tokenHash === currentTokenHash),
        };
    });
};

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    hashToken,
    verifyAccessToken,
    createRefreshSession,
    rotateRefreshSession,
    revokeRefreshSession,
    revokeAllUserSessions,
    findValidRefreshSession,
    setRefreshCookie,
    clearRefreshCookie,
    REFRESH_COOKIE_NAME,
    parseUserAgent,
    getUserActiveSessions,
};

