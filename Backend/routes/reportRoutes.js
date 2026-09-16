const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const {
    requireProjectMember,
    requireProjectRole,
} = require("../middleware/projectMiddleware");

const {
    getPersonalReport,
    getProjectReport,
    getTeamReport,
    getTaskDetailReport,
    exportReport,
} = require("../controllers/reportController");

// All report endpoints require authentication
router.use(protect);

// 1. Export endpoint (CSV / PDF)
// GET /api/reports/export?type=personal|project|team|tasks&format=csv|pdf&...
router.get("/export", exportReport);

// 2. Personal Productivity Report Preview
// GET /api/reports/personal?period=today|this_week|this_month|last_30_days|all
router.get("/personal", getPersonalReport);

// 3. Project Report Preview
// GET /api/reports/project/:projectId?period=today|this_week|this_month|last_30_days|all
router.get("/project/:projectId", requireProjectMember, getProjectReport);

// 4. Team Workload Report Preview
// GET /api/reports/team/:projectId?period=today|this_week|this_month|last_30_days|all
// RBAC: OWNER, MANAGER, MEMBER allowed; VIEWER is rejected with 403
router.get(
    "/team/:projectId",
    requireProjectMember,
    requireProjectRole("OWNER", "MANAGER", "MEMBER"),
    getTeamReport
);

// 5. Task Details Report Preview
// GET /api/reports/tasks?scope=all|personal|:projectId&status=...&priority=...
router.get("/tasks", getTaskDetailReport);

module.exports = router;
