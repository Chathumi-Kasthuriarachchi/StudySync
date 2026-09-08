const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const UserSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Name is required"],
            trim: true,
            maxlength: [50, "Name cannot exceed 50 characters"],
        },
        email: {
            type: String,
            required: [true, "Email is required"],
            unique: true,
            lowercase: true,
            trim: true,
            match: [
                /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
                "Please provide a valid email address",
            ],
        },
        password: {
            type: String,
            required: [true, "Password is required"],
            minlength: [8, "Password must be at least 8 characters long"],
            select: true, // Selected by default for auth checks, stripped in toJSON
        },
        systemRole: {
            type: String,
            enum: {
                values: ["ADMIN", "USER"],
                message: "{VALUE} is not a valid system role",
            },
            default: "USER",
        },
        profileImageURL: {
            type: String,
            default: null,
        },

        // ── Email Verification ──────────────────────────────────────────────────
        emailVerified: {
            type: Boolean,
            default: false,
        },
        emailVerifiedAt: {
            type: Date,
            default: null,
        },

        // ── Terms & Conditions Consent ──────────────────────────────────────────
        termsAccepted: {
            type: Boolean,
            default: false,
        },
        termsAcceptedAt: {
            type: Date,
            default: null,
        },

        // ── Login Security: Brute-Force Protection ──────────────────────────────
        loginAttempts: {
            type: Number,
            default: 0,
        },
        lockUntil: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
        toJSON: {
            transform: function (doc, ret) {
                delete ret.password;
                delete ret.__v;
                delete ret.loginAttempts;
                delete ret.lockUntil;
                return ret;
            },
        },
        toObject: {
            transform: function (doc, ret) {
                delete ret.password;
                delete ret.__v;
                return ret;
            },
        },
    }
);

/**
 * Pre-save Middleware: Hash Password
 *
 * Ensures passwords are automatically hashed with a strong salt (12 rounds) before
 * being persisted to MongoDB. If a user's details are updated without touching the
 * password, the hash is untouched.
 */
UserSchema.pre("save", async function () {
    if (!this.isModified("password")) {
        return;
    }
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
});

/**
 * Compare Password Instance Method
 *
 * Securely checks plaintext password against stored bcrypt hash using constant-time comparison.
 */
UserSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

/**
 * isLocked Instance Method
 *
 * Returns true if the account is currently under a temporary lock due to
 * repeated failed login attempts. Lock is time-based, not permanent.
 */
UserSchema.methods.isLocked = function () {
    return !!(this.lockUntil && this.lockUntil > Date.now());
};

/**
 * incrementLoginAttempts Instance Method
 *
 * Tracks failed login attempts with progressive locking:
 * - 5 failed attempts → 15 minute lock
 * - 10 failed attempts → 1 hour lock
 * - 15+ failed attempts → 24 hour lock
 *
 * Security Note: Progressive locking deters brute-force attacks while
 * avoiding permanently locking legitimate users. An attacker cannot
 * permanently lock another user's account.
 */
UserSchema.methods.incrementLoginAttempts = async function () {
    // If there's an existing lock that has expired, reset attempts
    if (this.lockUntil && this.lockUntil < Date.now()) {
        await this.updateOne({
            $set: { loginAttempts: 1 },
            $unset: { lockUntil: 1 },
        });
        return;
    }

    const updates = { $inc: { loginAttempts: 1 } };

    // Lock thresholds
    const attempts = this.loginAttempts + 1;
    let lockDurationMs = null;
    if (attempts >= 15) {
        lockDurationMs = 24 * 60 * 60 * 1000; // 24 hours
    } else if (attempts >= 10) {
        lockDurationMs = 60 * 60 * 1000; // 1 hour
    } else if (attempts >= 5) {
        lockDurationMs = 15 * 60 * 1000; // 15 minutes
    }

    if (lockDurationMs !== null) {
        updates.$set = { lockUntil: new Date(Date.now() + lockDurationMs) };
    }

    await this.updateOne(updates);
};

/**
 * resetLoginAttempts Instance Method
 *
 * Clears login attempt counter after a successful authentication.
 */
UserSchema.methods.resetLoginAttempts = async function () {
    if (this.loginAttempts > 0 || this.lockUntil) {
        await this.updateOne({
            $set: { loginAttempts: 0 },
            $unset: { lockUntil: 1 },
        });
    }
};

module.exports = mongoose.model("User", UserSchema);