const goalService = require("../services/goalService");

/**
 * Goal Controller — Phase 10
 */

/**
 * @desc    Create a new goal (Personal or Project)
 * @route   POST /api/goals
 * @access  Private (OWNER/MANAGER if project, any user if personal)
 */
const createGoal = async (req, res) => {
    try {
        const goal = await goalService.createGoal(req.body, req.user);
        res.status(201).json({
            success: true,
            message: "Goal created successfully",
            goal,
        });
    } catch (err) {
        console.error("createGoal error:", err);
        const status = err.statusCode || (err.name === "ValidationError" ? 400 : 500);
        res.status(status).json({
            success: false,
            message: err.message || "Failed to create goal",
        });
    }
};

/**
 * @desc    List goals accessible to the user
 * @route   GET /api/goals
 * @access  Private
 */
const getGoals = async (req, res) => {
    try {
        const goals = await goalService.listGoals(req.user._id, req.query);
        res.status(200).json({
            success: true,
            count: goals.length,
            goals,
        });
    } catch (err) {
        console.error("getGoals error:", err);
        const status = err.statusCode || 500;
        res.status(status).json({
            success: false,
            message: err.message || "Failed to fetch goals",
        });
    }
};

/**
 * @desc    Get single goal by ID with progress and linked tasks
 * @route   GET /api/goals/:id
 * @access  Private
 */
const getGoalById = async (req, res) => {
    try {
        const goal = await goalService.getGoalById(req.params.id, req.user._id);
        res.status(200).json({
            success: true,
            goal,
        });
    } catch (err) {
        console.error("getGoalById error:", err);
        const status = err.statusCode || 500;
        res.status(status).json({
            success: false,
            message: err.message || "Failed to fetch goal",
        });
    }
};

/**
 * @desc    Update goal
 * @route   PUT /api/goals/:id
 * @access  Private (OWNER if personal, OWNER/MANAGER if project)
 */
const updateGoal = async (req, res) => {
    try {
        const goal = await goalService.updateGoal(req.params.id, req.body, req.user._id);
        res.status(200).json({
            success: true,
            message: "Goal updated successfully",
            goal,
        });
    } catch (err) {
        console.error("updateGoal error:", err);
        const status = err.statusCode || (err.name === "ValidationError" ? 400 : 500);
        res.status(status).json({
            success: false,
            message: err.message || "Failed to update goal",
        });
    }
};

/**
 * @desc    Delete goal and unlink tasks
 * @route   DELETE /api/goals/:id
 * @access  Private (OWNER if personal, OWNER/MANAGER if project)
 */
const deleteGoal = async (req, res) => {
    try {
        const result = await goalService.deleteGoal(req.params.id, req.user._id);
        res.status(200).json({
            success: true,
            message: result.message,
        });
    } catch (err) {
        console.error("deleteGoal error:", err);
        const status = err.statusCode || 500;
        res.status(status).json({
            success: false,
            message: err.message || "Failed to delete goal",
        });
    }
};

/**
 * @desc    Link a task to a goal
 * @route   POST /api/goals/:id/tasks
 * @access  Private
 */
const linkTask = async (req, res) => {
    try {
        const { taskId } = req.body;
        if (!taskId) {
            return res.status(400).json({
                success: false,
                message: "taskId is required in request body",
            });
        }

        const result = await goalService.linkTaskToGoal(req.params.id, taskId, req.user._id);
        res.status(200).json({
            success: true,
            message: "Task linked to goal successfully",
            ...result,
        });
    } catch (err) {
        console.error("linkTask error:", err);
        const status = err.statusCode || 500;
        res.status(status).json({
            success: false,
            message: err.message || "Failed to link task to goal",
        });
    }
};

/**
 * @desc    Unlink a task from a goal
 * @route   DELETE /api/goals/:id/tasks/:taskId
 * @access  Private
 */
const unlinkTask = async (req, res) => {
    try {
        const result = await goalService.unlinkTaskFromGoal(req.params.id, req.params.taskId, req.user._id);
        res.status(200).json({
            success: true,
            message: "Task unlinked from goal successfully",
            ...result,
        });
    } catch (err) {
        console.error("unlinkTask error:", err);
        const status = err.statusCode || 500;
        res.status(status).json({
            success: false,
            message: err.message || "Failed to unlink task from goal",
        });
    }
};

module.exports = {
    createGoal,
    getGoals,
    getGoalById,
    updateGoal,
    deleteGoal,
    linkTask,
    unlinkTask,
};
