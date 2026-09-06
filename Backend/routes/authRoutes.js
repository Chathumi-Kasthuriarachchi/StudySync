const express = require("express");
const {
    register,
    login,
    getMe,
    checkAdmin,
    updateProfile,
} = require("../controllers/authController");
const { protect, requireAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

// Public Authentication Endpoints
router.post("/register", register);
router.post("/login", login);

// Private User Endpoints (Requires valid JWT)
router.get("/me", protect, getMe);
router.get("/profile", protect, getMe);
router.put("/profile", protect, updateProfile);

// Admin-Only Authorization Endpoint (Requires JWT + systemRole === 'ADMIN')
router.get("/admin-check", protect, requireAdmin, checkAdmin);

module.exports = router;