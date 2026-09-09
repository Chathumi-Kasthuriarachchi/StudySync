const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { requireTaskAccess } = require("../middleware/projectMiddleware");

const {
    getMyTasks,
    getTaskById,
    updateTask,
    updateTaskStatus,
    deleteTask,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    createPersonalTask,
    getPersonalTasks,
} = require("../controllers/taskController");

const {
    getTaskComments,
    createTaskComment,
    updateTaskComment,
    deleteTaskComment,
    getTaskActivities,
} = require("../controllers/commentController");

// Protect all task routes
router.use(protect);

// ── Global User Tasks ─────────────────────────────────────────────────────────
router.get("/my", getMyTasks);
router.get("/personal", getPersonalTasks);
router.post("/personal", createPersonalTask);

// ── Task Specific Operations ──────────────────────────────────────────────────
router.route("/:taskId")
    .get(requireTaskAccess, getTaskById)
    .put(requireTaskAccess, updateTask)
    .delete(requireTaskAccess, deleteTask);

router.patch("/:taskId/status", requireTaskAccess, updateTaskStatus);

// ── Subtasks Operations ───────────────────────────────────────────────────────
router.post("/:taskId/subtasks", requireTaskAccess, addSubtask);
router.patch("/:taskId/subtasks/:subtaskId", requireTaskAccess, toggleSubtask);
router.delete("/:taskId/subtasks/:subtaskId", requireTaskAccess, deleteSubtask);

// ── Comments Operations ───────────────────────────────────────────────────────
router.route("/:taskId/comments")
    .get(requireTaskAccess, getTaskComments)
    .post(requireTaskAccess, createTaskComment);

router.route("/:taskId/comments/:commentId")
    .put(requireTaskAccess, updateTaskComment)
    .delete(requireTaskAccess, deleteTaskComment);

// ── Activity History ──────────────────────────────────────────────────────────
router.get("/:taskId/activities", requireTaskAccess, getTaskActivities);

module.exports = router;
