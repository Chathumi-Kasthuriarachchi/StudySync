const mongoose = require("mongoose");

/**
 * OTPVerification Model
 *
 * Why a separate collection:
 * OTPs are temporary records with independent lifecycle from the User document.
 * Keeping them separate prevents the User document from growing with disposable data
 * and allows precise TTL-based cleanup with MongoDB indexes.
 *
 * Security Design:
 * - OTPs are NEVER stored in plain text
 * - Only bcrypt hashes are persisted
 * - Rate limiting enforced at model/service level (5 requests/hour, 5 attempts)
 * - Purpose field prevents EMAIL_VERIFICATION OTPs from being used for PASSWORD_RESET
 */
const OTPVerificationSchema = new mongoose.Schema(
    {
        // Email associated with this OTP (used as lookup key)
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
        },

        // Purpose distinguishes OTP intent so an OTP generated for one
        // purpose cannot be abused for another.
        purpose: {
            type: String,
            required: true,
            enum: {
                values: ["EMAIL_VERIFICATION", "PASSWORD_RESET"],
                message: "{VALUE} is not a valid OTP purpose",
            },
        },

        // bcrypt hash of the 6-digit OTP code
        otpHash: {
            type: String,
            required: true,
        },

        // When this OTP record expires (5 minutes from creation)
        expiresAt: {
            type: Date,
            required: true,
        },

        // Number of failed verification attempts for this OTP
        // When attempts reaches 5, the OTP is invalidated regardless of expiry
        attempts: {
            type: Number,
            default: 0,
            max: 5,
        },

        // Whether this OTP has been successfully consumed
        used: {
            type: Boolean,
            default: false,
        },

        // Rate-limit tracking: number of OTP requests in the current window
        requestCount: {
            type: Number,
            default: 1,
        },

        // Start of the 1-hour rate-limit window
        windowStart: {
            type: Date,
            default: Date.now,
        },

        // Timestamp of the most recent OTP send (enforces 60s resend cooldown)
        lastSentAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

// TTL Index: MongoDB automatically deletes OTP records after they expire.
// Adds a 10-minute buffer to allow error messages to remain meaningful.
OTPVerificationSchema.index(
    { expiresAt: 1 },
    { expireAfterSeconds: 600 }
);

// Compound index for efficient lookups by email + purpose
OTPVerificationSchema.index({ email: 1, purpose: 1 });

module.exports = mongoose.model("OTPVerification", OTPVerificationSchema);
