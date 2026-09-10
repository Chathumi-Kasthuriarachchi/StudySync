const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
    startTimer,
    stopTimer,
    cancelTimer,
    getActiveTimer,
    getTaskTimeSummary,
    getTodaySummary,
} = require("../controllers/timeController");

// All time tracking routes require authentication
router.use(protect);

router.post("/start", startTimer);
router.post("/stop", stopTimer);
router.post("/cancel", cancelTimer);
router.get("/active", getActiveTimer);
router.get("/today", getTodaySummary);
router.get("/tasks/:taskId", getTaskTimeSummary);

module.exports = router;
