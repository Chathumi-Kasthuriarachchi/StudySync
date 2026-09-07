const express = require("express");
const router = express.Router();

// Placeholder for Phase 2+ User routes
// GET /api/users
router.get("/", (req, res) => {
    res.json({ success: true, message: "Users endpoint active" });
});

module.exports = router;
