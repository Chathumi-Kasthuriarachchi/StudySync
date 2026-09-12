const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
    createGoal,
    getGoals,
    getGoalById,
    updateGoal,
    deleteGoal,
    linkTask,
    unlinkTask,
} = require("../controllers/goalController");

// All goal routes require authentication
router.use(protect);

router.route("/")
    .post(createGoal)
    .get(getGoals);

router.route("/:id")
    .get(getGoalById)
    .put(updateGoal)
    .delete(deleteGoal);

router.route("/:id/tasks")
    .post(linkTask);

router.route("/:id/tasks/:taskId")
    .delete(unlinkTask);

module.exports = router;
