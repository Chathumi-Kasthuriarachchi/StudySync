const timeTrackingService = require("../services/timeTrackingService");

/**
 * timeController — Phase 9
 *
 * REST API controllers for time tracking and focus sessions.
 */

/**
 * startTimer
 * POST /api/time/start
 * Body: { taskId }
 */
const startTimer = async (req, res) => {
    try {
        const { taskId } = req.body;
        if (!taskId) {
            return res.status(400).json({
                success: false,
                message: "taskId is required to start a timer",
            });
        }

        const session = await timeTrackingService.startTimer(req.user._id, taskId);

        return res.status(201).json({
            success: true,
            message: "Timer started successfully",
            data: session,
        });
    } catch (err) {
        console.error("startTimer error:", err.message);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to start timer",
            code: err.code || "TIMER_START_ERROR",
            activeSession: err.activeSession || undefined,
        });
    }
};

/**
 * stopTimer
 * POST /api/time/stop
 */
const stopTimer = async (req, res) => {
    try {
        const session = await timeTrackingService.stopTimer(req.user._id);

        return res.status(200).json({
            success: true,
            message: "Timer stopped successfully",
            data: session,
        });
    } catch (err) {
        console.error("stopTimer error:", err.message);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to stop timer",
            code: err.code || "TIMER_STOP_ERROR",
        });
    }
};

/**
 * cancelTimer
 * POST /api/time/cancel
 */
const cancelTimer = async (req, res) => {
    try {
        const result = await timeTrackingService.cancelTimer(req.user._id);

        return res.status(200).json({
            success: true,
            message: result.message || "Active timer cancelled",
            data: result,
        });
    } catch (err) {
        console.error("cancelTimer error:", err.message);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to cancel timer",
            code: err.code || "TIMER_CANCEL_ERROR",
        });
    }
};

/**
 * getActiveTimer
 * GET /api/time/active
 */
const getActiveTimer = async (req, res) => {
    try {
        const result = await timeTrackingService.getActiveTimer(req.user._id);

        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (err) {
        console.error("getActiveTimer error:", err.message);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to retrieve active timer",
        });
    }
};

/**
 * getTaskTimeSummary
 * GET /api/time/tasks/:taskId
 */
const getTaskTimeSummary = async (req, res) => {
    try {
        const summary = await timeTrackingService.getTaskTimeSummary(
            req.user._id,
            req.params.taskId
        );

        return res.status(200).json({
            success: true,
            data: summary,
        });
    } catch (err) {
        console.error("getTaskTimeSummary error:", err.message);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to retrieve task time summary",
        });
    }
};

/**
 * getTodaySummary
 * GET /api/time/today
 */
const getTodaySummary = async (req, res) => {
    try {
        const summary = await timeTrackingService.getTodaySummary(req.user._id);

        return res.status(200).json({
            success: true,
            data: summary,
        });
    } catch (err) {
        console.error("getTodaySummary error:", err.message);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to retrieve today focus summary",
        });
    }
};

module.exports = {
    startTimer,
    stopTimer,
    cancelTimer,
    getActiveTimer,
    getTaskTimeSummary,
    getTodaySummary,
};
