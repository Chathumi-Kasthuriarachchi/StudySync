const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const {
    requireProjectMember,
    requireProjectRole,
} = require("../middleware/projectMiddleware");

const {
    getPersonalAnalytics,
    getProjectAnalytics,
    getTeamAnalytics,
} = require("../controllers/analyticsController");

// All analytics endpoints require valid authentication
router.use(protect);

// 1. Personal Analytics
// GET /api/analytics/personal?period=today|week|month|last30days|all
router.get("/personal", getPersonalAnalytics);

// 2. Project Analytics
// GET /api/analytics/project/:projectId?period=today|week|month|last30days|all
// Accessible to all active project members (including VIEWERS for project-level progress)
router.get("/project/:projectId", requireProjectMember, getProjectAnalytics);

// 3. Team Analytics
// GET /api/analytics/project/:projectId/team?period=today|week|month|last30days|all
// RBAC Enforcement: OWNER, MANAGER, and MEMBER can view team workload; VIEWER is explicitly blocked
router.get(
    "/project/:projectId/team",
    requireProjectMember,
    requireProjectRole("OWNER", "MANAGER", "MEMBER"),
    getTeamAnalytics
);

module.exports = router;
