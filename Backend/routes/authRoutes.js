const express = require("express");
const { register, login, getUserProfile, updateProfile } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Auth Routes
router.post("/login", login);
router.post("/register", register);
router.get("/profile", protect, getUserProfile);
router.put("/profile", protect, updateProfile);

module.exports = router;