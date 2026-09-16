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
        ).select("_id name email profileImageURL systemRole");

        return res.status(200).json({
            success: true,
            message: "Profile image uploaded successfully.",
            data: {
                user: updatedUser,
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
        ).select("_id name email profileImageURL systemRole");

        return res.status(200).json({
            success: true,
            message: "Profile image removed successfully.",
            data: {
                user: updatedUser,
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

module.exports = {
    searchUsers,
    uploadProfileImage,
    removeProfileImage,
};
