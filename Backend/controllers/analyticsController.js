const analyticsService = require("../services/analyticsService");

/**
 * Analytics Controller — Phase 12
 *
 * Keeps controllers thin by delegating domain aggregation to analyticsService.
 */

/**
 * GET /api/analytics/personal
 * Protected: requires valid JWT (req.user)
 */
const getPersonalAnalytics = async (req, res) => {
    try {
        const { period, startDate, endDate } = req.query;
        const data = await analyticsService.getPersonalAnalytics(req.user._id, {
            period,
            startDate,
            endDate,
        });

        return res.status(200).json({
            success: true,
            data,
        });
    } catch (err) {
        console.error("getPersonalAnalytics error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to retrieve personal analytics",
        });
    }
};

/**
 * GET /api/analytics/project/:projectId
 * Protected: requires valid JWT & project membership (req.project, req.membership)
 */
const getProjectAnalytics = async (req, res) => {
    try {
        const projectId = req.project ? req.project._id : req.params.projectId;
        const { period, startDate, endDate } = req.query;

        const data = await analyticsService.getProjectAnalytics(projectId, {
            period,
            startDate,
            endDate,
        });

        return res.status(200).json({
            success: true,
            data,
        });
    } catch (err) {
        console.error("getProjectAnalytics error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to retrieve project analytics",
        });
    }
};

/**
 * GET /api/analytics/project/:projectId/team
 * Protected: requires valid JWT, project membership, and authorized role (OWNER, MANAGER, MEMBER; VIEWER blocked)
 */
const getTeamAnalytics = async (req, res) => {
    try {
        const projectId = req.project ? req.project._id : req.params.projectId;
        const { period, startDate, endDate } = req.query;

        const data = await analyticsService.getTeamAnalytics(projectId, {
            period,
            startDate,
            endDate,
        });

        return res.status(200).json({
            success: true,
            data,
        });
    } catch (err) {
        console.error("getTeamAnalytics error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to retrieve team analytics",
        });
    }
};

module.exports = {
    getPersonalAnalytics,
    getProjectAnalytics,
    getTeamAnalytics,
};
