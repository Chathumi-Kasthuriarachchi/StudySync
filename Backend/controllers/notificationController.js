const notificationService = require("../services/notificationService");

/**
 * Notification Controller — Phase 11
 */

/**
 * @desc    Get user's paginated notifications
 * @route   GET /api/notifications
 * @access  Private
 */
const getNotifications = async (req, res) => {
    try {
        const result = await notificationService.getUserNotifications(req.user._id, req.query);
        return res.status(200).json({
            success: true,
            ...result,
        });
    } catch (err) {
        console.error("getNotifications error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to retrieve notifications",
        });
    }
};

/**
 * @desc    Get count of unread notifications
 * @route   GET /api/notifications/unread-count
 * @access  Private
 */
const getUnreadCount = async (req, res) => {
    try {
        const count = await notificationService.getUnreadCount(req.user._id);
        return res.status(200).json({
            success: true,
            unreadCount: count,
        });
    } catch (err) {
        console.error("getUnreadCount error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to get unread count",
        });
    }
};

/**
 * @desc    Mark a notification as read
 * @route   PATCH /api/notifications/:id/read
 * @access  Private
 */
const markAsRead = async (req, res) => {
    try {
        const notification = await notificationService.markAsRead(req.params.id, req.user._id);
        return res.status(200).json({
            success: true,
            message: "Notification marked as read",
            notification,
        });
    } catch (err) {
        console.error("markAsRead error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to mark notification as read",
        });
    }
};

/**
 * @desc    Mark all user notifications as read
 * @route   PATCH /api/notifications/read-all
 * @access  Private
 */
const markAllAsRead = async (req, res) => {
    try {
        const result = await notificationService.markAllAsRead(req.user._id);
        return res.status(200).json({
            success: true,
            message: "All notifications marked as read",
            ...result,
        });
    } catch (err) {
        console.error("markAllAsRead error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to mark all notifications as read",
        });
    }
};

/**
 * @desc    Delete a single notification
 * @route   DELETE /api/notifications/:id
 * @access  Private
 */
const deleteNotification = async (req, res) => {
    try {
        const result = await notificationService.deleteNotification(req.params.id, req.user._id);
        return res.status(200).json({
            success: true,
            message: result.message,
        });
    } catch (err) {
        console.error("deleteNotification error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to delete notification",
        });
    }
};

/**
 * @desc    Clear all notifications for user
 * @route   DELETE /api/notifications
 * @access  Private
 */
const clearAllNotifications = async (req, res) => {
    try {
        const result = await notificationService.clearAllNotifications(req.user._id);
        return res.status(200).json({
            success: true,
            message: "All notifications cleared",
            deletedCount: result.deletedCount,
        });
    } catch (err) {
        console.error("clearAllNotifications error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to clear notifications",
        });
    }
};

/**
 * @desc    Trigger deadline and overdue checks for user
 * @route   POST /api/notifications/check-deadlines
 * @access  Private
 */
const checkDeadlines = async (req, res) => {
    try {
        const result = await notificationService.checkDeadlinesAndOverdue(req.user._id);
        return res.status(200).json({
            success: true,
            message: "Deadline check completed",
            ...result,
        });
    } catch (err) {
        console.error("checkDeadlines error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to check deadlines",
        });
    }
};

module.exports = {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    checkDeadlines,
};
