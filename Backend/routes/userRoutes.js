const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { searchUsers } = require("../controllers/userController");

// Search registered users for project invitations
router.get("/search", protect, searchUsers);

// Generic user health / status endpoint
router.get("/", (req, res) => {
    res.json({ success: true, message: "Users endpoint active" });
});

module.exports = router;
