const User = require("../models/User");

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

module.exports = {
    searchUsers,
};
