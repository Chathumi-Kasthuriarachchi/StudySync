const mongoose = require("mongoose");
const Goal = require("../models/Goal");
const Task = require("../models/Task");
const TimeSession = require("../models/TimeSession");
const ProjectMembership = require("../models/ProjectMembership");
const Project = require("../models/Project");

/**
 * Goal Service — Phase 10
 *
 * Implements business logic for Goal management and derived progress calculations.
 * Ensures strict context integrity (Personal vs Project) and enforces RBAC.
 */

/**
 * Helper: verify user access and permissions for a goal
 * @param {Object} goal - Goal document
 * @param {string|ObjectId} userId - User ID
 * @param {"VIEW"|"CONTRIBUTE"|"MANAGE"} level - Required access level
 * @returns {Promise<{ membership: Object|null, role: string }>}
 */
const verifyGoalAccess = async (goal, userId, level = "VIEW") => {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Personal Goal context
    if (!goal.project) {
        if (!goal.owner.equals(userObjectId)) {
            const error = new Error("Access denied to personal goal");
            error.statusCode = 403;
            throw error;
        }
        return { membership: null, role: "OWNER" };
    }

    // Project Goal context
    const membership = await ProjectMembership.findOne({
        project: goal.project,
        user: userObjectId,
    });

    if (!membership) {
        const error = new Error("Access denied. You are not a member of this project.");
        error.statusCode = 403;
        throw error;
    }

    if (level === "MANAGE" && !["OWNER", "MANAGER"].includes(membership.role)) {
        const error = new Error(`Permission denied. Project Goal management requires OWNER or MANAGER role (current: ${membership.role}).`);
        error.statusCode = 403;
        throw error;
    }

    if (level === "CONTRIBUTE" && membership.role === "VIEWER") {
        const error = new Error("Permission denied. Project VIEWERS cannot modify tasks or link goals.");
        error.statusCode = 403;
        throw error;
    }

    return { membership, role: membership.role };
};

/**
 * Compute derived progress and metrics for a goal
 * @param {Object} goal - Goal doc or plain object
 * @param {Array} [linkedTasks] - Optional array of pre-fetched tasks
 * @returns {Promise<{ progress: number, metrics: Object, taskCount: number, completedTaskCount: number }>}
 */
const computeGoalProgress = async (goal, linkedTasks = null) => {
    const goalId = goal._id;
    const tasks = linkedTasks !== null
        ? linkedTasks
        : await Task.find({ goal: goalId });

    const taskCount = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === "COMPLETED");
    const completedTaskCount = completedTasks.length;

    let progress = 0;
    let metrics = {};

    switch (goal.measurementType) {
        case "TASK_COUNT": {
            const target = Number(goal.targetValue) || 0;
            if (target > 0) {
                progress = Math.min(100, Math.round((completedTaskCount / target) * 100));
            } else if (taskCount > 0) {
                progress = Math.min(100, Math.round((completedTaskCount / taskCount) * 100));
            } else {
                progress = 0;
            }
            metrics = {
                type: "TASK_COUNT",
                totalTasks: taskCount,
                completedTasks: completedTaskCount,
                targetTasks: target,
            };
            break;
        }

        case "TIME": {
            const targetHours = Number(goal.targetValue) || 0;
            const targetSeconds = targetHours * 3600;

            const taskIds = tasks.map((t) => t._id);
            let totalTrackedSeconds = 0;

            if (taskIds.length > 0) {
                const sessions = await TimeSession.find({
                    task: { $in: taskIds },
                    endedAt: { $ne: null },
                });
                totalTrackedSeconds = sessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
            }

            if (targetSeconds > 0) {
                progress = Math.min(100, Math.round((totalTrackedSeconds / targetSeconds) * 100));
            } else {
                progress = 0;
            }

            metrics = {
                type: "TIME",
                totalTasks: taskCount,
                completedTasks: completedTaskCount,
                trackedSeconds: totalTrackedSeconds,
                trackedHours: Math.round((totalTrackedSeconds / 3600) * 10) / 10,
                targetHours,
            };
            break;
        }

        case "MILESTONE": {
            const explicitMilestones = tasks.filter((t) => t.isMilestone);
            const milestoneList = explicitMilestones.length > 0 ? explicitMilestones : tasks;
            const totalMilestones = milestoneList.length;
            const completedMilestones = milestoneList.filter((t) => t.status === "COMPLETED").length;

            if (totalMilestones > 0) {
                progress = Math.min(100, Math.round((completedMilestones / totalMilestones) * 100));
            } else {
                progress = 0;
            }

            metrics = {
                type: "MILESTONE",
                totalTasks: taskCount,
                completedTasks: completedTaskCount,
                totalMilestones,
                completedMilestones,
            };
            break;
        }

        default: {
            progress = taskCount > 0 ? Math.min(100, Math.round((completedTaskCount / taskCount) * 100)) : 0;
            metrics = {
                type: "TASK_COUNT",
                totalTasks: taskCount,
                completedTasks: completedTaskCount,
            };
        }
    }

    return {
        progress,
        metrics,
        taskCount,
        completedTaskCount,
    };
};

/**
 * Create a new goal
 */
const createGoal = async (data, user) => {
    const { title, description, project, status, measurementType, targetValue, startDate, targetDate } = data;

    if (!title || !title.trim()) {
        const error = new Error("Goal title is required");
        error.statusCode = 400;
        throw error;
    }

    const goalData = {
        title: title.trim(),
        description: description ? description.trim() : "",
        owner: user._id,
        project: null,
        status: status || "NOT_STARTED",
        measurementType: measurementType || "TASK_COUNT",
        targetValue: targetValue !== undefined ? Number(targetValue) : 0,
        startDate: startDate ? new Date(startDate) : new Date(),
        targetDate: targetDate ? new Date(targetDate) : null,
    };

    if (goalData.targetDate && goalData.startDate && goalData.targetDate < goalData.startDate) {
        const error = new Error("Target date cannot be before start date");
        error.statusCode = 400;
        throw error;
    }

    // If project goal, verify permissions
    if (project) {
        if (!mongoose.Types.ObjectId.isValid(project)) {
            const error = new Error("Invalid project ID format");
            error.statusCode = 400;
            throw error;
        }

        const projectDoc = await Project.findById(project);
        if (!projectDoc) {
            const error = new Error("Project not found");
            error.statusCode = 404;
            throw error;
        }

        const membership = await ProjectMembership.findOne({
            project,
            user: user._id,
        });

        if (!membership) {
            const error = new Error("Access denied. You are not a member of this project.");
            error.statusCode = 403;
            throw error;
        }

        if (!["OWNER", "MANAGER"].includes(membership.role)) {
            const error = new Error(`Permission denied. Project Goal creation requires OWNER or MANAGER role (current: ${membership.role}).`);
            error.statusCode = 403;
            throw error;
        }

        goalData.project = projectDoc._id;
    }

    const goal = await Goal.create(goalData);
    const populated = await Goal.findById(goal._id)
        .populate("owner", "name email avatar")
        .populate("project", "name");

    const progressInfo = await computeGoalProgress(populated, []);
    return {
        ...populated.toObject(),
        ...progressInfo,
        tasks: [],
    };
};

/**
 * Get goal by ID with progress and linked tasks
 */
const getGoalById = async (goalId, userId) => {
    if (!mongoose.Types.ObjectId.isValid(goalId)) {
        const error = new Error("Invalid goal ID format");
        error.statusCode = 400;
        throw error;
    }

    const goal = await Goal.findById(goalId)
        .populate("owner", "name email avatar")
        .populate("project", "name");

    if (!goal) {
        const error = new Error("Goal not found");
        error.statusCode = 404;
        throw error;
    }

    await verifyGoalAccess(goal, userId, "VIEW");

    const tasks = await Task.find({ goal: goal._id })
        .populate("assignee", "name email avatar")
        .populate("createdBy", "name email avatar")
        .sort({ isMilestone: -1, createdAt: -1 });

    const progressInfo = await computeGoalProgress(goal, tasks);

    return {
        ...goal.toObject(),
        ...progressInfo,
        tasks,
    };
};

/**
 * List goals accessible to the user with optional filters
 */
const listGoals = async (userId, query = {}) => {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const { scope, project, status, measurementType } = query;

    let filter = {};

    if (scope === "personal") {
        filter = { owner: userObjectId, project: null };
    } else if (project) {
        if (project === "personal") {
            filter = { owner: userObjectId, project: null };
        } else {
            if (!mongoose.Types.ObjectId.isValid(project)) {
                const error = new Error("Invalid project ID format");
                error.statusCode = 400;
                throw error;
            }

            // Verify membership
            const membership = await ProjectMembership.findOne({
                project,
                user: userObjectId,
            });

            if (!membership) {
                const error = new Error("Access denied to this project");
                error.statusCode = 403;
                throw error;
            }

            filter = { project };
        }
    } else if (scope === "project") {
        const memberships = await ProjectMembership.find({ user: userObjectId });
        const projectIds = memberships.map((m) => m.project);
        filter = { project: { $in: projectIds } };
    } else {
        // "all" — user's personal goals + goals in projects user belongs to
        const memberships = await ProjectMembership.find({ user: userObjectId });
        const projectIds = memberships.map((m) => m.project);
        filter = {
            $or: [
                { owner: userObjectId, project: null },
                { project: { $in: projectIds } },
            ],
        };
    }

    if (status) {
        filter.status = status;
    }
    if (measurementType) {
        filter.measurementType = measurementType;
    }

    const goals = await Goal.find(filter)
        .populate("owner", "name email avatar")
        .populate("project", "name")
        .sort({ targetDate: 1, createdAt: -1 });

    if (goals.length === 0) {
        return [];
    }

    const goalIds = goals.map((g) => g._id);
    const allLinkedTasks = await Task.find({ goal: { $in: goalIds } });

    // Group tasks by goal
    const tasksByGoal = {};
    for (const gId of goalIds) {
        tasksByGoal[gId.toString()] = [];
    }
    for (const task of allLinkedTasks) {
        if (task.goal) {
            const key = task.goal.toString();
            if (tasksByGoal[key]) {
                tasksByGoal[key].push(task);
            }
        }
    }

    // Compute progress for each goal
    const results = await Promise.all(
        goals.map(async (goal) => {
            const linked = tasksByGoal[goal._id.toString()] || [];
            const progressInfo = await computeGoalProgress(goal, linked);
            return {
                ...goal.toObject(),
                ...progressInfo,
            };
        })
    );

    return results;
};

/**
 * Update a goal
 */
const updateGoal = async (goalId, updateData, userId) => {
    if (!mongoose.Types.ObjectId.isValid(goalId)) {
        const error = new Error("Invalid goal ID format");
        error.statusCode = 400;
        throw error;
    }

    const goal = await Goal.findById(goalId);
    if (!goal) {
        const error = new Error("Goal not found");
        error.statusCode = 404;
        throw error;
    }

    await verifyGoalAccess(goal, userId, "MANAGE");

    // Allowed fields to update
    const allowedFields = ["title", "description", "status", "measurementType", "targetValue", "startDate", "targetDate"];
    for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
            goal[field] = updateData[field];
        }
    }

    if (goal.startDate && goal.targetDate && new Date(goal.targetDate) < new Date(goal.startDate)) {
        const error = new Error("Target date cannot be before start date");
        error.statusCode = 400;
        throw error;
    }

    await goal.save();

    const populated = await Goal.findById(goal._id)
        .populate("owner", "name email avatar")
        .populate("project", "name");

    const tasks = await Task.find({ goal: goal._id });
    const progressInfo = await computeGoalProgress(populated, tasks);

    return {
        ...populated.toObject(),
        ...progressInfo,
    };
};

/**
 * Delete a goal and unlink all associated tasks
 */
const deleteGoal = async (goalId, userId) => {
    if (!mongoose.Types.ObjectId.isValid(goalId)) {
        const error = new Error("Invalid goal ID format");
        error.statusCode = 400;
        throw error;
    }

    const goal = await Goal.findById(goalId);
    if (!goal) {
        const error = new Error("Goal not found");
        error.statusCode = 404;
        throw error;
    }

    await verifyGoalAccess(goal, userId, "MANAGE");

    // Unlink all tasks associated with this goal
    await Task.updateMany({ goal: goal._id }, { $set: { goal: null } });

    // Delete the goal
    await Goal.findByIdAndDelete(goal._id);

    return {
        success: true,
        message: "Goal deleted successfully and linked tasks unlinked",
    };
};

/**
 * Link a task to a goal with strict context integrity validation
 */
const linkTaskToGoal = async (goalId, taskId, userId) => {
    if (!mongoose.Types.ObjectId.isValid(goalId) || !mongoose.Types.ObjectId.isValid(taskId)) {
        const error = new Error("Invalid goal or task ID format");
        error.statusCode = 400;
        throw error;
    }

    const goal = await Goal.findById(goalId);
    if (!goal) {
        const error = new Error("Goal not found");
        error.statusCode = 404;
        throw error;
    }

    const task = await Task.findById(taskId);
    if (!task) {
        const error = new Error("Task not found");
        error.statusCode = 404;
        throw error;
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Context Integrity Check
    if (!goal.project) {
        // Personal Goal:
        // 1. Goal must belong to the requesting user
        if (!goal.owner.equals(userObjectId)) {
            const error = new Error("Cannot link tasks to another user's personal goal");
            error.statusCode = 403;
            throw error;
        }

        // 2. Task MUST be a personal task (project is null)
        if (task.project) {
            const error = new Error("Cannot link a project task to a personal goal");
            error.statusCode = 400;
            throw error;
        }

        // 3. Task must belong to the same user
        if (!task.createdBy.equals(userObjectId)) {
            const error = new Error("Cannot link another user's personal task");
            error.statusCode = 403;
            throw error;
        }
    } else {
        // Project Goal:
        // 1. Task must be in the exact same project
        if (!task.project || !task.project.equals(goal.project)) {
            const error = new Error("Task must belong to the same project as the goal");
            error.statusCode = 400;
            throw error;
        }

        // 2. User must have at least MEMBER role in this project (VIEWER cannot contribute)
        const membership = await ProjectMembership.findOne({
            project: goal.project,
            user: userObjectId,
        });

        if (!membership) {
            const error = new Error("Access denied to project");
            error.statusCode = 403;
            throw error;
        }

        if (membership.role === "VIEWER") {
            const error = new Error("Project VIEWERS cannot link tasks to goals");
            error.statusCode = 403;
            throw error;
        }
    }

    // Link task
    task.goal = goal._id;
    await task.save();

    const tasks = await Task.find({ goal: goal._id });
    const progressInfo = await computeGoalProgress(goal, tasks);

    return {
        task,
        progressInfo,
    };
};

/**
 * Unlink a task from a goal
 */
const unlinkTaskFromGoal = async (goalId, taskId, userId) => {
    if (!mongoose.Types.ObjectId.isValid(goalId) || !mongoose.Types.ObjectId.isValid(taskId)) {
        const error = new Error("Invalid goal or task ID format");
        error.statusCode = 400;
        throw error;
    }

    const goal = await Goal.findById(goalId);
    if (!goal) {
        const error = new Error("Goal not found");
        error.statusCode = 404;
        throw error;
    }

    const task = await Task.findById(taskId);
    if (!task) {
        const error = new Error("Task not found");
        error.statusCode = 404;
        throw error;
    }

    if (!task.goal || !task.goal.equals(goal._id)) {
        const error = new Error("Task is not linked to this goal");
        error.statusCode = 400;
        throw error;
    }

    // Access check:
    await verifyGoalAccess(goal, userId, "CONTRIBUTE");

    task.goal = null;
    await task.save();

    const tasks = await Task.find({ goal: goal._id });
    const progressInfo = await computeGoalProgress(goal, tasks);

    return {
        task,
        progressInfo,
    };
};

module.exports = {
    verifyGoalAccess,
    computeGoalProgress,
    createGoal,
    getGoalById,
    listGoals,
    updateGoal,
    deleteGoal,
    linkTaskToGoal,
    unlinkTaskFromGoal,
};
