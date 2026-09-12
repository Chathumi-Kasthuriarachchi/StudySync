const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    checkDeadlines,
} = require("../controllers/notificationController");

// All notification routes require authentication
router.use(protect);

router.route("/")
    .get(getNotifications)
    .delete(clearAllNotifications);

router.get("/unread-count", getUnreadCount);
router.patch("/read-all", markAllAsRead);
router.post("/check-deadlines", checkDeadlines);

router.route("/:id")
    .delete(deleteNotification);

router.patch("/:id/read", markAsRead);

module.exports = router;
