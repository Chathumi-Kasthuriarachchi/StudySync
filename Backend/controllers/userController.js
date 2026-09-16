const User = require("../models/User");
const { uploadToCloudinary, deleteFromCloudinary } = require("../middleware/uploadMiddleware");

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

module.exports = {
    searchUsers,
    uploadProfileImage,
    removeProfileImage,
    getUserProfile,
    updateUserProfile,
    updateUserPreferences,
    formatUserResponse,
};

