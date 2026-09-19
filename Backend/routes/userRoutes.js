const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { uploadSingleImage } = require("../middleware/uploadMiddleware");
const {
    searchUsers,
    uploadProfileImage,
    removeProfileImage,
    refreshProfileImageUrl,
    getUserProfile,
    updateUserProfile,
    updateUserPreferences,
    changePassword,
    getActiveSessions,
    logoutAllDevices,
    revokeSession,
    submitSupportTicket,
    deleteAccount,
} = require("../controllers/userController");

// Profile & Preferences endpoints
router.get("/profile", protect, getUserProfile);
router.put("/profile", protect, updateUserProfile);
router.put("/preferences", protect, updateUserPreferences);

// Security & Session endpoints
router.put("/change-password", protect, changePassword);
router.get("/sessions", protect, getActiveSessions);
router.post("/sessions/logout-all", protect, logoutAllDevices);
router.delete("/sessions/:id", protect, revokeSession);

// Support & Danger Zone endpoints
router.post("/support", protect, submitSupportTicket);
router.delete("/account", protect, deleteAccount);

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
router.get("/profile-image-url", protect, refreshProfileImageUrl);

// Generic user health / status endpoint
router.get("/", (req, res) => {
    res.json({ success: true, message: "Users endpoint active" });
});

module.exports = router;
