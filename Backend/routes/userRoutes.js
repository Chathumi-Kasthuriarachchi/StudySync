const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { uploadSingleImage } = require("../middleware/uploadMiddleware");
const {
    searchUsers,
    uploadProfileImage,
    removeProfileImage,
    getUserProfile,
    updateUserProfile,
    updateUserPreferences,
} = require("../controllers/userController");

// Profile & Preferences endpoints
router.get("/profile", protect, getUserProfile);
router.put("/profile", protect, updateUserProfile);
router.put("/preferences", protect, updateUserPreferences);

// Search registered users for project invitations
router.get("/search", protect, searchUsers);

// Profile Image Upload & Removal endpoints
router.post(
    "/profile-image",
    protect,
    uploadSingleImage("image"),
    uploadProfileImage
);
router.delete("/profile-image", protect, removeProfileImage);

// Generic user health / status endpoint
router.get("/", (req, res) => {
    res.json({ success: true, message: "Users endpoint active" });
});

module.exports = router;
