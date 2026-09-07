const express = require("express");
const router = express.Router();

// Placeholder for Phase 2+ Report routes
// GET /api/reports
router.get("/", (req, res) => {
    res.json({ success: true, message: "Reports endpoint active" });
});

module.exports = router;
