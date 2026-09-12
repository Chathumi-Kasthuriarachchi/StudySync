const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { getCalendarEvents } = require("../controllers/calendarController");

// Calendar route requires authentication
router.use(protect);

router.get("/", getCalendarEvents);

module.exports = router;
