const reportService = require("../services/reportService");
const ProjectMembership = require("../models/ProjectMembership");
const mongoose = require("mongoose");

/**
 * Report Controller — Phase 14
 */

/**
 * GET /api/reports/personal
 */
const getPersonalReport = async (req, res) => {
    try {
        const { period, startDate, endDate } = req.query;
        const data = await reportService.getPersonalProductivityReport(req.user._id, {
            period,
            startDate,
            endDate,
        });

        return res.status(200).json({
            success: true,
            data,
        });
    } catch (err) {
        console.error("getPersonalReport error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to generate personal productivity report",
        });
    }
};

/**
 * GET /api/reports/project/:projectId
 */
const getProjectReport = async (req, res) => {
    try {
        const projectId = req.project ? req.project._id : req.params.projectId;
        const { period, startDate, endDate } = req.query;

        const data = await reportService.getProjectReport(projectId, req.user._id, {
            period,
            startDate,
            endDate,
        });

        return res.status(200).json({
            success: true,
            data,
        });
    } catch (err) {
        console.error("getProjectReport error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to generate project report",
        });
    }
};

/**
 * GET /api/reports/team/:projectId
 */
const getTeamReport = async (req, res) => {
    try {
        const projectId = req.project ? req.project._id : req.params.projectId;
        const { period, startDate, endDate } = req.query;

        const data = await reportService.getTeamReport(projectId, req.user._id, {
            period,
            startDate,
            endDate,
        });

        return res.status(200).json({
            success: true,
            data,
        });
    } catch (err) {
        console.error("getTeamReport error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to generate team report",
        });
    }
};

/**
 * GET /api/reports/tasks
 */
const getTaskDetailReport = async (req, res) => {
    try {
        const { scope, status, priority, period, startDate, endDate } = req.query;
        const data = await reportService.getTaskDetailReport(req.user._id, {
            scope,
            status,
            priority,
            period,
            startDate,
            endDate,
        });

        return res.status(200).json({
            success: true,
            data,
        });
    } catch (err) {
        console.error("getTaskDetailReport error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to generate task details report",
        });
    }
};

/**
 * GET /api/reports/export
 * Query: type=personal|project|team|tasks, format=csv|pdf, projectId, period, etc.
 */
const exportReport = async (req, res) => {
    try {
        const { type = "personal", format = "csv", projectId, scope, status, priority, period, startDate, endDate } = req.query;
        const formatLower = (format || "csv").toLowerCase();
        const typeLower = (type || "personal").toLowerCase();

        let reportData = null;

        if (typeLower === "personal") {
            reportData = await reportService.getPersonalProductivityReport(req.user._id, {
                period,
                startDate,
                endDate,
            });
        } else if (typeLower === "project") {
            if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
                return res.status(400).json({ success: false, message: "Valid projectId is required for project report" });
            }

            // Verify membership
            const membership = await ProjectMembership.findOne({ project: projectId, user: req.user._id });
            if (!membership) {
                return res.status(403).json({ success: false, message: "Access denied. You are not a member of this project." });
            }

            reportData = await reportService.getProjectReport(projectId, req.user._id, {
                period,
                startDate,
                endDate,
            });
        } else if (typeLower === "team") {
            if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
                return res.status(400).json({ success: false, message: "Valid projectId is required for team report" });
            }

            // Verify RBAC
            const membership = await ProjectMembership.findOne({ project: projectId, user: req.user._id });
            if (!membership) {
                return res.status(403).json({ success: false, message: "Access denied. You are not a member of this project." });
            }
            if (membership.role === "VIEWER") {
                return res.status(403).json({ success: false, message: "Permission denied. Project Viewers cannot access team reports." });
            }

            reportData = await reportService.getTeamReport(projectId, req.user._id, {
                period,
                startDate,
                endDate,
            });
        } else if (typeLower === "tasks") {
            reportData = await reportService.getTaskDetailReport(req.user._id, {
                scope,
                status,
                priority,
                period,
                startDate,
                endDate,
            });
        } else {
            return res.status(400).json({ success: false, message: "Invalid report type" });
        }

        const cleanTitle = (reportData.title || "StudySync_Report").replace(/[^a-zA-Z0-9_-]/g, "_");
        const timestamp = new Date().toISOString().split("T")[0];

        if (formatLower === "pdf") {
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `attachment; filename="${cleanTitle}_${timestamp}.pdf"`);
            return reportService.generatePDF(reportData.reportType, reportData, res);
        } else {
            // Default to CSV
            const csvOutput = reportService.generateCSV(reportData.reportType, reportData);
            res.setHeader("Content-Type", "text/csv; charset=utf-8");
            res.setHeader("Content-Disposition", `attachment; filename="${cleanTitle}_${timestamp}.csv"`);
            return res.send(csvOutput);
        }
    } catch (err) {
        console.error("exportReport error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to export report",
        });
    }
};

module.exports = {
    getPersonalReport,
    getProjectReport,
    getTeamReport,
    getTaskDetailReport,
    exportReport,
};
