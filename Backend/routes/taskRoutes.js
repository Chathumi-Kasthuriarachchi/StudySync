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

module.exports = router;
