const mongoose = require("mongoose");

/**
 * RefreshTokenSession Model
 *
 * Why a separate collection:
 * Storing refresh token sessions in the database allows:
 * 1. Revocation: Logout can truly invalidate a refresh token by deleting/revoking
 *    the session record, even if the token itself hasn't expired.
 * 2. Rotation: Each use of a refresh token creates a new session record and
 *    invalidates the old one, detecting token theft (if an old token is reused).
 * 3. Multi-device support: Each device has its own session record.
 * 4. "Logout from all devices": Revoking all sessions for a userId.
 *
 * Security Design:
 * - Refresh tokens are NEVER stored in plain text
 * - Only SHA-256 hashes are persisted
 * - The actual refresh token lives only in the HttpOnly cookie
 * - TTL index auto-removes expired sessions
 */
const RefreshTokenSessionSchema = new mongoose.Schema(
    {
        // Reference to the authenticated user
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        // SHA-256 hash of the refresh token (NOT the token itself)
        tokenHash: {
            type: String,
            required: true,
            unique: true,
        },

        // When this session expires (7 days from creation)
        expiresAt: {
            type: Date,
            required: true,
        },

        // Whether this session has been explicitly revoked
        // (e.g., via logout or token rotation invalidation)
        revoked: {
            type: Boolean,
            default: false,
        },

        // Metadata for session context (useful for "active sessions" UI later)
        ipAddress: {
            type: String,
            default: null,
        },
        userAgent: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// TTL Index: MongoDB automatically removes sessions after they expire
RefreshTokenSessionSchema.index(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 }
);

// Index for fast user-based lookups (logout all devices, active sessions)
RefreshTokenSessionSchema.index({ userId: 1, revoked: 1 });

module.exports = mongoose.model("RefreshTokenSession", RefreshTokenSessionSchema);
