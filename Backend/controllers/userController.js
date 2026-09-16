const User = require("../models/User");
const RefreshTokenSession = require("../models/RefreshTokenSession");
const Project = require("../models/Project");
const ProjectMembership = require("../models/ProjectMembership");
const ProjectInvitation = require("../models/ProjectInvitation");
const Task = require("../models/Task");
const Comment = require("../models/Comment");
const Goal = require("../models/Goal");
const TimeSession = require("../models/TimeSession");
const Meeting = require("../models/Meeting");
const Notification = require("../models/Notification");
const { uploadToCloudinary, deleteFromCloudinary } = require("../middleware/uploadMiddleware");
const {
    generateAccessToken,
    generateRefreshToken,
    createRefreshSession,
    revokeAllUserSessions,
    setRefreshCookie,
    clearRefreshCookie,
    REFRESH_COOKIE_NAME,
    getUserActiveSessions,
} = require("../services/tokenService");
const { sendSupportEmail } = require("../services/emailService");

/**
 * searchUsers
 * GET /api/users/search?q=query
 *
 * Search registered users by name or email for member invitations.
 * Only returns verified users (or all active users), projecting only public fields:
 * _id, name, email, profileImageURL, systemRole.
 */
const searchUsers = async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.trim().length === 0) {
            return res.status(200).json({
                success: true,
                count: 0,
                data: [],
            });
        }

        const queryTrimmed = q.trim();
        // Safe regex escaping to prevent regex injection
        const escaped = queryTrimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(escaped, "i");

        const users = await User.find({
            _id: { $ne: req.user._id }, // Exclude requesting user
            $or: [{ name: regex }, { email: regex }],
        })
            .select("_id name email profileImageURL systemRole")
            .limit(10);

        return res.status(200).json({
            success: true,
            count: users.length,
            data: users,
        });
    } catch (err) {
        console.error("searchUsers error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to search users",
            error: err.message,
        });
    }
};

/**
 * uploadProfileImage
 * POST /api/users/profile-image
 *
 * Uploads an image to Cloudinary in the "studysync" folder and
 * sets the user's profileImageURL field.
 */
const uploadProfileImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Please select an image file to upload.",
            });
        }

        if (
            !process.env.CLOUDINARY_CLOUD_NAME ||
            !process.env.CLOUDINARY_API_KEY ||
            !process.env.CLOUDINARY_API_SECRET
        ) {
            return res.status(500).json({
                success: false,
                message: "Cloudinary credentials are not configured on the server.",
            });
        }

        // Upload buffer directly to Cloudinary folder "studysync"
        const result = await uploadToCloudinary(req.file.buffer, {
            folder: "studysync",
            public_id: `user_avatar_${req.user._id}`,
            overwrite: true,
            invalidate: true,
        });

        // Persist new URL to MongoDB User model
        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            { profileImageURL: result.secure_url },
            { new: true }
        );

        return res.status(200).json({
            success: true,
            message: "Profile image uploaded successfully.",
            data: {
                user: formatUserResponse(updatedUser),
                profileImageURL: result.secure_url,
            },
        });
    } catch (err) {
        console.error("uploadProfileImage error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to upload profile image.",
            error: err.message,
        });
    }
};

/**
 * removeProfileImage
 * DELETE /api/users/profile-image
 *
 * Clears the user's profileImageURL and deletes the avatar asset from Cloudinary.
 */
const removeProfileImage = async (req, res) => {
    try {
        // Attempt to clean up asset in Cloudinary
        try {
            await deleteFromCloudinary(`studysync/user_avatar_${req.user._id}`);
        } catch (cloudErr) {
            console.warn("Notice: Could not delete old avatar from Cloudinary:", cloudErr.message);
        }

        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            { profileImageURL: null },
            { new: true }
        );

        return res.status(200).json({
            success: true,
            message: "Profile image removed successfully.",
            data: {
                user: formatUserResponse(updatedUser),
                profileImageURL: null,
            },
        });
    } catch (err) {
        console.error("removeProfileImage error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to remove profile image.",
            error: err.message,
        });
    }
};

/**
 * Helper to normalize and sanitize user payload
 */
const formatUserResponse = (user) => ({
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
    updatedAt: user.updatedAt,
});

/**
 * getUserProfile
 * GET /api/users/profile
 *
 * Returns current authenticated user's complete profile and preferences.
 */
const getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }
        return res.status(200).json({
            success: true,
            data: { user: formatUserResponse(user) },
        });
    } catch (err) {
        console.error("getUserProfile error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve user profile.",
            error: err.message,
        });
    }
};

/**
 * updateUserProfile
 * PUT /api/users/profile
 *
 * Updates current authenticated user's name, username, and bio.
 * Enforces username validation and uniqueness.
 */
const updateUserProfile = async (req, res) => {
    try {
        const { name, username, bio } = req.body;
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        // Validate Full Name if supplied
        if (name !== undefined) {
            const trimmedName = name.trim();
            if (!trimmedName) {
                return res.status(400).json({
                    success: false,
                    message: "Name cannot be empty.",
                });
            }
            if (trimmedName.length > 50) {
                return res.status(400).json({
                    success: false,
                    message: "Name cannot exceed 50 characters.",
                });
            }
            user.name = trimmedName;
        }

        // Validate Username if supplied
        if (username !== undefined) {
            const trimmedUsername = username.trim().toLowerCase();
            if (trimmedUsername.length > 0) {
                const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
                if (!usernameRegex.test(trimmedUsername)) {
                    return res.status(400).json({
                        success: false,
                        message: "Username must be 3-30 characters long and contain only letters, numbers, and underscores.",
                    });
                }

                // Check uniqueness against other users
                const existingUser = await User.findOne({
                    username: trimmedUsername,
                    _id: { $ne: user._id },
                });

                if (existingUser) {
                    return res.status(409).json({
                        success: false,
                        message: "Username is already taken. Please choose another username.",
                    });
                }

                user.username = trimmedUsername;
            } else {
                user.username = undefined;
            }
        }

        // Validate Bio if supplied
        if (bio !== undefined) {
            if (bio.length > 500) {
                return res.status(400).json({
                    success: false,
                    message: "Bio cannot exceed 500 characters.",
                });
            }
            user.bio = bio.trim();
        }

        await user.save();

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully.",
            data: { user: formatUserResponse(user) },
        });
    } catch (err) {
        console.error("updateUserProfile error:", err);
        if (err.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "Username is already taken. Please choose another username.",
            });
        }
        return res.status(500).json({
            success: false,
            message: "Failed to update profile.",
            error: err.message,
        });
    }
};

/**
 * updateUserPreferences
 * PUT /api/users/preferences
 *
 * Updates current authenticated user's theme, language, and emailNotifications preferences.
 */
const updateUserPreferences = async (req, res) => {
    try {
        const { theme, language, emailNotifications } = req.body;
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        if (!user.preferences) {
            user.preferences = {
                theme: "system",
                language: "en",
                emailNotifications: true,
            };
        }

        if (theme !== undefined) {
            const validThemes = ["light", "dark", "system"];
            if (!validThemes.includes(theme)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid theme preference. Choose from light, dark, or system.",
                });
            }
            user.preferences.theme = theme;
        }

        if (language !== undefined) {
            if (typeof language !== "string" || !language.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid language preference.",
                });
            }
            user.preferences.language = language.trim();
        }

        if (emailNotifications !== undefined) {
            if (typeof emailNotifications !== "boolean") {
                return res.status(400).json({
                    success: false,
                    message: "emailNotifications must be a boolean (true or false).",
                });
            }
            user.preferences.emailNotifications = emailNotifications;
        }

        await user.save();

        return res.status(200).json({
            success: true,
            message: "Preferences updated successfully.",
            data: {
                preferences: user.preferences,
                user: formatUserResponse(user),
            },
        });
    } catch (err) {
        console.error("updateUserPreferences error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to update preferences.",
            error: err.message,
        });
    }
};

const PASSWORD_REGEX = /^(?=.*[0-9])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~])/;
const validatePasswordStrength = (password) => {
    if (!password || password.length < 8) return "Password must be at least 8 characters long.";
    if (!/[0-9]/.test(password)) return "Password must contain at least one number.";
    if (!PASSWORD_REGEX.test(password)) return "Password must contain at least one special character.";
    return null;
};

/**
 * changePassword
 * PUT /api/users/change-password
 */
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Current password and new password are required.",
            });
        }

        if (confirmPassword !== undefined && newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "New password and confirmation do not match.",
            });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        // Verify current password
        const isMatch = await user.matchPassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: "The current password you entered is incorrect.",
            });
        }

        // Validate new password strength
        const strengthError = validatePasswordStrength(newPassword);
        if (strengthError) {
            return res.status(400).json({
                success: false,
                message: strengthError,
            });
        }

        // Check that new password is not identical to current password
        const isSame = await user.matchPassword(newPassword);
        if (isSame) {
            return res.status(400).json({
                success: false,
                message: "New password must be different from your current password.",
            });
        }

        // Update password (pre-save hook will hash it with bcrypt)
        user.password = newPassword;
        await user.save();

        // Revoke all existing sessions for security
        await revokeAllUserSessions(user._id);

        // Issue new session & cookie for current device so user stays logged in seamlessly
        const newRefreshToken = generateRefreshToken();
        await createRefreshSession(user._id, newRefreshToken, req);
        setRefreshCookie(res, newRefreshToken);
        const accessToken = generateAccessToken(user._id, user.systemRole);

        return res.status(200).json({
            success: true,
            message: "Password changed successfully.",
            data: { accessToken },
        });
    } catch (err) {
        console.error("changePassword error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to change password.",
            error: err.message,
        });
    }
};

/**
 * getActiveSessions
 * GET /api/users/sessions
 */
const getActiveSessions = async (req, res) => {
    try {
        const currentRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
        const sessions = await getUserActiveSessions(req.user._id, currentRefreshToken);

        return res.status(200).json({
            success: true,
            data: { sessions },
        });
    } catch (err) {
        console.error("getActiveSessions error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve active sessions.",
            error: err.message,
        });
    }
};

/**
 * logoutAllDevices
 * POST /api/users/sessions/logout-all
 */
const logoutAllDevices = async (req, res) => {
    try {
        await revokeAllUserSessions(req.user._id);
        clearRefreshCookie(res);

        return res.status(200).json({
            success: true,
            message: "Successfully logged out from all devices.",
        });
    } catch (err) {
        console.error("logoutAllDevices error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to logout from all devices.",
            error: err.message,
        });
    }
};

/**
 * revokeSession
 * DELETE /api/users/sessions/:id
 */
const revokeSession = async (req, res) => {
    try {
        const { id } = req.params;

        const session = await RefreshTokenSession.findOne({
            _id: id,
            userId: req.user._id,
        });

        if (!session) {
            return res.status(404).json({
                success: false,
                message: "Session not found or already terminated.",
            });
        }

        session.revoked = true;
        await session.save();

        return res.status(200).json({
            success: true,
            message: "Session revoked successfully.",
        });
    } catch (err) {
        console.error("revokeSession error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to revoke session.",
            error: err.message,
        });
    }
};

/**
 * submitSupportTicket
 * POST /api/users/support
 */
const submitSupportTicket = async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: "Name is required." });
        }
        if (!email || !email.trim()) {
            return res.status(400).json({ success: false, message: "Email is required." });
        }
        if (!subject || !subject.trim()) {
            return res.status(400).json({ success: false, message: "Subject is required." });
        }
        if (!message || !message.trim()) {
            return res.status(400).json({ success: false, message: "Message is required." });
        }

        if (subject.trim().length > 150) {
            return res.status(400).json({ success: false, message: "Subject cannot exceed 150 characters." });
        }
        if (message.trim().length > 2000) {
            return res.status(400).json({ success: false, message: "Message cannot exceed 2000 characters." });
        }

        await sendSupportEmail({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            subject: subject.trim(),
            message: message.trim(),
        });

        return res.status(200).json({
            success: true,
            message: "Support inquiry sent successfully. Our team will review your request.",
        });
    } catch (err) {
        console.error("submitSupportTicket error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to submit support inquiry. Please try again.",
            error: err.message,
        });
    }
};

/**
 * deleteAccount
 * DELETE /api/users/account
 *
 * Destructive permanent account deletion with password verification & cascading cleanup.
 */
const deleteAccount = async (req, res) => {
    try {
        const { confirmationText, password } = req.body;

        if (confirmationText !== "DELETE") {
            return res.status(400).json({
                success: false,
                message: "Please type 'DELETE' exactly to confirm account deletion.",
            });
        }

        if (!password) {
            return res.status(400).json({
                success: false,
                message: "Please enter your password to confirm account deletion.",
            });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: "Incorrect password. Account deletion aborted.",
            });
        }

        const userId = user._id;

        // 1. Delete Cloudinary avatar asset if exists
        if (user.profileImageURL) {
            try {
                await deleteFromCloudinary(`studysync/user_avatar_${userId}`);
            } catch (cloudErr) {
                console.warn("Notice: Could not delete Cloudinary avatar during account deletion:", cloudErr.message);
            }
        }

        // 2. Cascade delete projects owned by this user
        const ownedProjects = await Project.find({ owner: userId }).select("_id");
        const ownedProjectIds = ownedProjects.map((p) => p._id);

        if (ownedProjectIds.length > 0) {
            await Promise.all([
                Project.deleteMany({ _id: { $in: ownedProjectIds } }),
                ProjectMembership.deleteMany({ project: { $in: ownedProjectIds } }),
                ProjectInvitation.deleteMany({ project: { $in: ownedProjectIds } }),
                Task.deleteMany({ project: { $in: ownedProjectIds } }),
            ]);
        }

        // 3. Cascade cleanup for memberships and invitations in other projects
        await Promise.all([
            ProjectMembership.deleteMany({ user: userId }),
            ProjectInvitation.deleteMany({ $or: [{ invitedUser: userId }, { invitedBy: userId }] }),
        ]);

        // 4. Tasks: unassign from shared projects, delete personal tasks
        await Promise.all([
            Task.updateMany({ assignee: userId }, { $set: { assignee: null } }),
            Task.deleteMany({ createdBy: userId, project: null }),
        ]);

        // 5. Delete comments, goals, time sessions, notifications
        await Promise.all([
            Comment.deleteMany({ author: userId }),
            Goal.deleteMany({ user: userId }),
            TimeSession.deleteMany({ user: userId }),
            Notification.deleteMany({ $or: [{ recipient: userId }, { sender: userId }] }),
        ]);

        // 6. Meetings: delete owned meetings, pull from participants
        await Promise.all([
            Meeting.deleteMany({ organizer: userId }),
            Meeting.updateMany({ participants: userId }, { $pull: { participants: userId } }),
        ]);

        // 7. Revoke and delete all refresh token sessions
        await RefreshTokenSession.deleteMany({ userId });
        clearRefreshCookie(res);

        // 8. Delete user record
        await User.findByIdAndDelete(userId);

        return res.status(200).json({
            success: true,
            message: "Account and associated data deleted permanently.",
        });
    } catch (err) {
        console.error("deleteAccount error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to delete account.",
            error: err.message,
        });
    }
};

module.exports = {
    searchUsers,
    uploadProfileImage,
    removeProfileImage,
    getUserProfile,
    updateUserProfile,
    updateUserPreferences,
    formatUserResponse,
    changePassword,
    getActiveSessions,
    logoutAllDevices,
    revokeSession,
    submitSupportTicket,
    deleteAccount,
};


