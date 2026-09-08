const express = require("express");
const {
    register,
    login,
    verifyEmail,
    resendOTP,
    refreshToken,
    logout,
    forgotPassword,
    verifyResetOTP,
    resetPassword,
    getMe,
    checkAdmin,
    updateProfile,
} = require("../controllers/authController");
const { protect, requireAdmin } = require("../middleware/authMiddleware");
const { authLimiter, loginLimiter, otpLimiter, refreshLimiter } = require("../middleware/rateLimitMiddleware");

const router = express.Router();

// ── Public: Registration & Verification ───────────────────────────────────────
router.post("/register", authLimiter, register);
router.post("/verify-email", otpLimiter, verifyEmail);
router.post("/resend-otp", authLimiter, resendOTP);

// ── Public: Login & Token Management ─────────────────────────────────────────
router.post("/login", loginLimiter, login);
router.post("/refresh", refreshLimiter, refreshToken);
router.post("/logout", protect, logout);

// ── Public: Password Recovery ─────────────────────────────────────────────────
router.post("/forgot-password", authLimiter, forgotPassword);
router.post("/verify-reset-otp", otpLimiter, verifyResetOTP);
router.post("/reset-password", authLimiter, resetPassword);

// ── Private: Authenticated User Endpoints ─────────────────────────────────────
router.get("/me", protect, getMe);
router.get("/profile", protect, getMe);
router.put("/profile", protect, updateProfile);

// ── Admin-Only: Authorization Test ────────────────────────────────────────────
router.get("/admin-check", protect, requireAdmin, checkAdmin);

module.exports = router;