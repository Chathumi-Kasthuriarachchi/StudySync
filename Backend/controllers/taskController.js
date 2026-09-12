const mongoose = require("mongoose");
const Task = require("../models/Task");
const Goal = require("../models/Goal");
const Project = require("../models/Project");
const ProjectMembership = require("../models/ProjectMembership");
const TaskActivity = require("../models/TaskActivity");
const { logTaskActivity } = require("../utils/activityLogger");
const taskIntelligenceService = require("../services/taskIntelligenceService");
const notificationService = require("../services/notificationService");
const goalService = require("../services/goalService");

/**
 * createTask
 * POST /api/projects/:id/tasks
 *
 * Creates a task within a project.
 * Requires role: OWNER, MANAGER, or MEMBER (VIEWER is read-only).
 * Validates that assignee (if provided) is an active member of this project.
 */
const createTask = async (req, res) => {
    try {
        const projectId = req.project._id;
        const userRole = req.membership.role;

        if (userRole === "VIEWER") {
            return res.status(403).json({
                success: false,
                message: "Viewers have read-only access and cannot create tasks",
            });
        }

        const {
            title,
            description,
            status,
            priority,
            assignee,
            startDate,
            dueDate,
            tags,
            subtasks,
            estimatedMinutes,
            goal,
            isMilestone,
            dependencies,
        } = req.body;

        if (!title || title.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: "Task title is required",
            });
        }

        // Validate dates if provided
        let start = null;
        let due = null;
        if (startDate) {
            start = new Date(startDate);
            if (isNaN(start.getTime())) {
                return res.status(400).json({ success: false, message: "Invalid start date format" });
            }
        }
        if (dueDate) {
            due = new Date(dueDate);
            if (isNaN(due.getTime())) {
                return res.status(400).json({ success: false, message: "Invalid due date format" });
            }
        }
        if (start && due && due < start) {
            return res.status(400).json({
                success: false,
                message: "Due date cannot be earlier than start date",
            });
        }

        // Validate Goal if provided
        let goalId = null;
        if (goal) {
            if (!mongoose.Types.ObjectId.isValid(goal)) {
                return res.status(400).json({ success: false, message: "Invalid goal ID format" });
            }
            const goalDoc = await Goal.findById(goal);
            if (!goalDoc) {
                return res.status(404).json({ success: false, message: "Goal not found" });
            }
            if (!goalDoc.project || !goalDoc.project.equals(projectId)) {
                return res.status(400).json({
                    success: false,
                    message: "Task project must match goal project (cannot link personal goal to project task)",
                });
            }
            goalId = goalDoc._id;
        }

        // Validate Assignee if provided
        let assigneeId = null;
        if (assignee) {
            if (!mongoose.Types.ObjectId.isValid(assignee)) {
                return res.status(400).json({ success: false, message: "Invalid assignee user ID" });
            }

            const isMember = await ProjectMembership.findOne({
                project: projectId,
                user: assignee,
            });

            if (!isMember) {
                return res.status(400).json({
                    success: false,
                    message: "Assignee must be an active member of this project",
                });
            }
            assigneeId = assignee;
        }

        // Format subtasks if provided
        const formattedSubtasks = Array.isArray(subtasks)
            ? subtasks
                  .filter((st) => st && st.title && st.title.trim().length > 0)
                  .map((st) => ({
                      title: st.title.trim(),
                      completed: Boolean(st.completed),
                      createdAt: new Date(),
                  }))
            : [];

        // Format tags
        const formattedTags = Array.isArray(tags)
            ? tags.map((t) => String(t).trim()).filter(Boolean)
            : [];

        // Validate estimatedMinutes if provided
        let parsedEstimatedMinutes = null;
        if (estimatedMinutes !== undefined && estimatedMinutes !== null && estimatedMinutes !== "") {
            const num = Number(estimatedMinutes);
            if (isNaN(num) || num < 0) {
                return res.status(400).json({ success: false, message: "Estimated minutes must be a positive number" });
            }
            parsedEstimatedMinutes = Math.round(num);
        }

        const formattedDeps = Array.isArray(dependencies)
            ? dependencies.filter((d) => mongoose.Types.ObjectId.isValid(d))
            : [];

        const task = await Task.create({
            project: projectId,
            goal: goalId,
            title: title.trim(),
            description: description ? description.trim() : "",
            status: status || "TODO",
            priority: priority || "MEDIUM",
            assignee: assigneeId,
            createdBy: req.user._id,
            startDate: start,
            dueDate: due,
            tags: formattedTags,
            subtasks: formattedSubtasks,
            estimatedMinutes: parsedEstimatedMinutes,
            isMilestone: Boolean(isMilestone),
            dependencies: formattedDeps,
        });

        const populatedTask = await Task.findById(task._id)
            .populate("project", "_id name status dueDate owner")
            .populate("goal", "_id title status measurementType targetValue")
            .populate("dependencies", "_id title status")
            .populate("assignee", "_id name email profileImageURL")
            .populate("createdBy", "_id name email profileImageURL");

        await logTaskActivity({
            task: task._id,
            project: projectId,
            actor: req.user._id,
            action: "CREATED",
            details: `${req.user.name || "A member"} created this task`,
        });

        // Notify assigned user if assigned to someone else
        if (assigneeId) {
            await notificationService.notifyTaskAssigned(populatedTask, req.user._id);
        }

        return res.status(201).json({
            success: true,
            message: "Task created successfully",
            data: populatedTask,
        });
    } catch (err) {
        console.error("createTask error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to create task",
            error: err.message,
        });
    }
};

/**
 * getProjectTasks
 * GET /api/projects/:id/tasks
 *
 * Returns all tasks belonging to a project with filtering, sorting, and aggregate progress.
 */
const getProjectTasks = async (req, res) => {
    try {
        const projectId = req.project._id;
        const { status, priority, assignee, tag, search, sortBy, order } = req.query;

        // Base query filter
        const filter = { project: projectId };

        if (status && ["TODO", "IN_PROGRESS", "COMPLETED"].includes(status.toUpperCase())) {
            filter.status = status.toUpperCase();
        }

        if (priority && ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(priority.toUpperCase())) {
            filter.priority = priority.toUpperCase();
        }

        if (assignee) {
            if (assignee === "unassigned") {
                filter.assignee = null;
            } else if (mongoose.Types.ObjectId.isValid(assignee)) {
                filter.assignee = assignee;
            }
        }

        if (tag && tag.trim()) {
            filter.tags = tag.trim();
        }

        if (search && search.trim()) {
            const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            filter.$or = [
                { title: new RegExp(escaped, "i") },
                { description: new RegExp(escaped, "i") },
            ];
        }

        // Sorting
        const sortField = ["dueDate", "priority", "createdAt"].includes(sortBy)
            ? sortBy
            : "createdAt";
        const sortDirection = order === "asc" ? 1 : -1;
        const sortOptions = { [sortField]: sortDirection };

        // If sorting by dueDate, push tasks with no dueDate to the end
        if (sortField === "dueDate") {
            sortOptions.dueDate = sortDirection;
        }

        const tasks = await Task.find(filter)
            .populate("goal", "_id title status measurementType targetValue")
            .populate("assignee", "_id name email profileImageURL")
            .populate("createdBy", "_id name email profileImageURL")
            .sort(sortOptions);

        // Aggregate statistics for the whole project (unfiltered)
        const allProjectTasks = await Task.find({ project: projectId }).select(
            "status subtasks"
        );

        const totalTasks = allProjectTasks.length;
        const completedTasks = allProjectTasks.filter((t) => t.status === "COMPLETED").length;
        const completionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        let subtasksTotal = 0;
        let subtasksCompleted = 0;
        allProjectTasks.forEach((t) => {
            if (Array.isArray(t.subtasks)) {
                subtasksTotal += t.subtasks.length;
                subtasksCompleted += t.subtasks.filter((st) => st.completed).length;
            }
        });

        return res.status(200).json({
            success: true,
            count: tasks.length,
            stats: {
                totalTasks,
                completedTasks,
                completionPct,
                subtasksTotal,
                subtasksCompleted,
            },
            data: tasks,
        });
    } catch (err) {
        console.error("getProjectTasks error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve tasks",
            error: err.message,
        });
    }
};

/**
 * getMyTasks
 * GET /api/tasks/my
 *
 * Returns all tasks assigned to the authenticated user across projects they belong to.
 */
const getMyTasks = async (req, res) => {
    try {
        const { status, priority, projectId, search, type, due } = req.query;
        const normalizedType = type ? type.toUpperCase() : 'ALL';

        const conditions = [];

        if (normalizedType === 'PERSONAL') {
            conditions.push({ project: null, createdBy: req.user._id });
        } else if (normalizedType === 'PROJECT') {
            const memberships = await ProjectMembership.find({ user: req.user._id }).select('project');
            const userProjectIds = memberships.map((m) => m.project);

            if (projectId && mongoose.Types.ObjectId.isValid(projectId)) {
                conditions.push({ project: projectId, assignee: req.user._id });
            } else {
                conditions.push({ project: { $in: userProjectIds }, assignee: req.user._id });
            }
        } else {
            // ALL
            if (projectId && mongoose.Types.ObjectId.isValid(projectId)) {
                conditions.push({ project: projectId, assignee: req.user._id });
            } else {
                const memberships = await ProjectMembership.find({ user: req.user._id }).select('project');
                const userProjectIds = memberships.map((m) => m.project);
                conditions.push({
                    $or: [
                        { project: null, createdBy: req.user._id },
                        { project: { $in: userProjectIds }, assignee: req.user._id },
                    ],
                });
            }
        }

        if (status && ['TODO', 'IN_PROGRESS', 'COMPLETED'].includes(status.toUpperCase())) {
            conditions.push({ status: status.toUpperCase() });
        }

        if (priority && ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(priority.toUpperCase())) {
            conditions.push({ priority: priority.toUpperCase() });
        }

        if (due) {
            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
            const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
            const normalizedDue = due.toLowerCase();

            if (normalizedDue === 'today') {
                conditions.push({
                    dueDate: { $gte: startOfToday, $lte: endOfToday },
                });
            } else if (normalizedDue === 'overdue') {
                conditions.push({
                    dueDate: { $lt: startOfToday },
                    status: { $ne: 'COMPLETED' },
                });
            } else if (normalizedDue === 'upcoming') {
                conditions.push({
                    dueDate: { $gte: startOfToday },
                });
            }
        }

        if (search && search.trim()) {
            const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            conditions.push({
                $or: [
                    { title: new RegExp(escaped, 'i') },
                    { description: new RegExp(escaped, 'i') },
                ],
            });
        }

        const query = conditions.length > 0 ? { $and: conditions } : {};

        const tasks = await Task.find(query)
            .populate('project', '_id name status dueDate')
            .populate('goal', '_id title status measurementType targetValue')
            .populate('assignee', '_id name email profileImageURL')
            .populate('createdBy', '_id name email profileImageURL')
            .sort({ dueDate: 1, createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: tasks.length,
            data: tasks,
        });
    } catch (err) {
        console.error('getMyTasks error:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to get assigned tasks',
            error: err.message,
        });
    }
};

/**
 * getTaskById
 * GET /api/tasks/:taskId
 *
 * Returns task details.
 * Protected by requireTaskAccess.
 */
const getTaskById = async (req, res) => {
    try {
        const task = await Task.findById(req.task._id)
            .populate("project", "_id name status dueDate owner")
            .populate("goal", "_id title status measurementType targetValue")
            .populate("dependencies", "_id title status")
            .populate("assignee", "_id name email profileImageURL")
            .populate("createdBy", "_id name email profileImageURL");

        return res.status(200).json({
            success: true,
            data: task,
            userProjectRole: req.membership.role,
        });
    } catch (err) {
        console.error("getTaskById error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to get task",
            error: err.message,
        });
    }
};

/**
 * updateTask
 * PUT /api/tasks/:taskId
 *
 * Updates task fields.
 * Protected by requireTaskAccess.
 *
 * Authorization rules:
 * - VIEWER: blocked (403).
 * - MEMBER: can update if they are createdBy OR assignee.
 * - OWNER / MANAGER: can update any task.
 */
const updateTask = async (req, res) => {
    try {
        const task = req.task;
        const userRole = req.membership?.role || req.userProjectRole || (task.project ? "MEMBER" : "OWNER");
        const userIdStr = req.user._id.toString();

        if (userRole === "VIEWER") {
            return res.status(403).json({
                success: false,
                message: "Viewers have read-only access and cannot edit tasks",
            });
        }

        if (
            userRole === "MEMBER" &&
            task.createdBy.toString() !== userIdStr &&
            task.assignee?.toString() !== userIdStr
        ) {
            return res.status(403).json({
                success: false,
                message: "Members can only edit tasks they created or are assigned to",
            });
        }

        const prevStatus = task.status;
        const prevAssignee = task.assignee ? task.assignee.toString() : null;

        const {
            title,
            description,
            status,
            priority,
            assignee,
            startDate,
            dueDate,
            tags,
            estimatedMinutes,
            goal,
            isMilestone,
            dependencies,
        } = req.body;

        if (title !== undefined) {
            if (!title || title.trim().length === 0) {
                return res.status(400).json({ success: false, message: "Task title cannot be empty" });
            }
            task.title = title.trim();
        }

        if (description !== undefined) {
            task.description = description ? description.trim() : "";
        }

        if (status !== undefined) {
            const nextStatus = status.toUpperCase();
            if (!["TODO", "IN_PROGRESS", "COMPLETED"].includes(nextStatus)) {
                return res.status(400).json({ success: false, message: "Invalid status value" });
            }
            if (nextStatus === "COMPLETED" && task.subtasks && task.subtasks.length > 0) {
                const hasIncompleteSubtasks = task.subtasks.some((st) => !st.completed);
                if (hasIncompleteSubtasks) {
                    return res.status(400).json({
                        success: false,
                        message: "Cannot mark task as completed until all subtasks are completed",
                    });
                }
            }
            if (nextStatus === "TODO" && task.subtasks && task.subtasks.length > 0) {
                task.subtasks.forEach((st) => {
                    st.completed = false;
                });
            }
            task.status = nextStatus;
        }

        if (priority !== undefined) {
            if (!["LOW", "MEDIUM", "HIGH", "URGENT"].includes(priority.toUpperCase())) {
                return res.status(400).json({ success: false, message: "Invalid priority value" });
            }
            task.priority = priority.toUpperCase();
        }

        // Assignee update
        if (assignee !== undefined) {
            if (!task.project) {
                // Personal task: cannot assign to other users
                if (assignee !== null && assignee !== "" && assignee.toString() !== req.user._id.toString()) {
                    return res.status(400).json({
                        success: false,
                        message: "Personal tasks cannot be assigned to other users",
                    });
                }
                task.assignee = req.user._id;
            } else {
                if (assignee === null || assignee === "") {
                    task.assignee = null;
                } else {
                    if (!mongoose.Types.ObjectId.isValid(assignee)) {
                        return res.status(400).json({ success: false, message: "Invalid assignee user ID" });
                    }

                    const isMember = await ProjectMembership.findOne({
                        project: task.project,
                        user: assignee,
                    });

                    if (!isMember) {
                        return res.status(400).json({
                            success: false,
                            message: "Assignee must be an active member of this project",
                        });
                    }
                    task.assignee = assignee;
                }
            }
        }

        // Dates update
        const newStart = startDate !== undefined ? (startDate ? new Date(startDate) : null) : task.startDate;
        const newDue = dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : task.dueDate;

        if (newStart && newDue && newDue < newStart) {
            return res.status(400).json({
                success: false,
                message: "Due date cannot be earlier than start date",
            });
        }
        if (startDate !== undefined) task.startDate = newStart;
        if (dueDate !== undefined) task.dueDate = newDue;

        if (tags !== undefined && Array.isArray(tags)) {
            task.tags = tags.map((t) => String(t).trim()).filter(Boolean);
        }

        if (estimatedMinutes !== undefined) {
            if (estimatedMinutes === null || estimatedMinutes === "") {
                task.estimatedMinutes = null;
            } else {
                const num = Number(estimatedMinutes);
                if (isNaN(num) || num < 0) {
                    return res.status(400).json({ success: false, message: "Estimated minutes must be a positive number" });
                }
                task.estimatedMinutes = Math.round(num);
            }
        }

        // Goal update
        if (goal !== undefined) {
            if (goal === null || goal === "") {
                task.goal = null;
            } else {
                if (!mongoose.Types.ObjectId.isValid(goal)) {
                    return res.status(400).json({ success: false, message: "Invalid goal ID format" });
                }
                const goalDoc = await Goal.findById(goal);
                if (!goalDoc) {
                    return res.status(404).json({ success: false, message: "Goal not found" });
                }

                if (!task.project) {
                    // Personal task: goal must be personal and owned by user
                    if (goalDoc.project || !goalDoc.owner.equals(req.user._id)) {
                        return res.status(400).json({
                            success: false,
                            message: "Cannot link project goal to personal task",
                        });
                    }
                } else {
                    // Project task: goal must be in same project
                    if (!goalDoc.project || !goalDoc.project.equals(task.project)) {
                        return res.status(400).json({
                            success: false,
                            message: "Task project must match goal project",
                        });
                    }
                }
                task.goal = goalDoc._id;
            }
        }

        if (isMilestone !== undefined) {
            task.isMilestone = Boolean(isMilestone);
        }

        if (dependencies !== undefined) {
            task.dependencies = Array.isArray(dependencies)
                ? dependencies
                    .map((d) => (typeof d === "object" && d?._id ? d._id : d))
                    .filter((id) => mongoose.Types.ObjectId.isValid(id) && id.toString() !== task._id.toString())
                : [];
        }

        await task.save();

        const updated = await Task.findById(task._id)
            .populate("project", "_id name status dueDate owner")
            .populate("goal", "_id title status measurementType targetValue")
            .populate("dependencies", "_id title status")
            .populate("assignee", "_id name email profileImageURL")
            .populate("createdBy", "_id name email profileImageURL");

        await logTaskActivity({
            task: task._id,
            project: task.project || null,
            actor: req.user._id,
            action: "UPDATED",
            details: `${req.user.name || "A member"} updated task details`,
        });

        // Check if assignee changed
        const newAssigneeStr = updated.assignee?._id ? updated.assignee._id.toString() : null;
        if (newAssigneeStr && newAssigneeStr !== prevAssignee) {
            await notificationService.notifyTaskAssigned(updated, req.user._id);
        }

        // Check if completed
        if (prevStatus !== "COMPLETED" && updated.status === "COMPLETED") {
            await notificationService.notifyTaskCompleted(updated, req.user._id);
            await notificationService.checkAndNotifyDependenciesUnblocked(updated, req.user._id);
            if (updated.goal) {
                try {
                    const goalDoc = await Goal.findById(updated.goal._id || updated.goal);
                    if (goalDoc) {
                        const progress = await goalService.calculateGoalProgress(goalDoc._id);
                        await notificationService.notifyGoalProgress(goalDoc, progress);
                    }
                } catch (gErr) {
                    console.error("Goal notification error on updateTask:", gErr);
                }
            }
        }

        return res.status(200).json({
            success: true,
            message: "Task updated successfully",
            data: updated,
        });
    } catch (err) {
        console.error("updateTask error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to update task",
            error: err.message,
        });
    }
};

/**
 * updateTaskStatus
 * PATCH /api/tasks/:taskId/status
 *
 * Fast status toggle (TODO, IN_PROGRESS, COMPLETED).
 * Protected by requireTaskAccess.
 */
const updateTaskStatus = async (req, res) => {
    try {
        const task = req.task;
        const userRole = req.membership?.role || req.userProjectRole || (task.project ? "MEMBER" : "OWNER");
        const { status } = req.body;

        if (userRole === "VIEWER") {
            return res.status(403).json({
                success: false,
                message: "Viewers have read-only access",
            });
        }

        if (!status || !["TODO", "IN_PROGRESS", "COMPLETED"].includes(status.toUpperCase())) {
            return res.status(400).json({
                success: false,
                message: "Valid status (TODO, IN_PROGRESS, COMPLETED) is required",
            });
        }

        const prevStatus = task.status;
        const newStatus = status.toUpperCase();

        // Subtask completion guard: Cannot mark task as COMPLETED if any subtasks are incomplete
        if (newStatus === "COMPLETED" && task.subtasks && task.subtasks.length > 0) {
            const hasIncompleteSubtasks = task.subtasks.some((st) => !st.completed);
            if (hasIncompleteSubtasks) {
                return res.status(400).json({
                    success: false,
                    message: "Cannot mark task as completed until all subtasks are completed",
                });
            }
        }

        // When setting to TODO, reset all subtasks to incomplete
        if (newStatus === "TODO" && task.subtasks && task.subtasks.length > 0) {
            task.subtasks.forEach((st) => {
                st.completed = false;
            });
        }

        task.status = newStatus;

        await task.save();

        const updated = await Task.findById(task._id)
            .populate("project", "_id name status dueDate owner")
            .populate("goal", "_id title status measurementType targetValue")
            .populate("dependencies", "_id title status")
            .populate("assignee", "_id name email profileImageURL")
            .populate("createdBy", "_id name email profileImageURL");

        await logTaskActivity({
            task: task._id,
            project: task.project || null,
            actor: req.user._id,
            action: "STATUS_CHANGED",
            details: `${req.user.name || "A member"} changed status to ${newStatus}`,
            metadata: { prevStatus, newStatus },
        });

        if (prevStatus !== "COMPLETED" && newStatus === "COMPLETED") {
            await notificationService.notifyTaskCompleted(updated, req.user._id);
            await notificationService.checkAndNotifyDependenciesUnblocked(updated, req.user._id);
            if (updated.goal) {
                try {
                    const goalDoc = await Goal.findById(updated.goal._id || updated.goal);
                    if (goalDoc) {
                        const progress = await goalService.calculateGoalProgress(goalDoc._id);
                        await notificationService.notifyGoalProgress(goalDoc, progress);
                    }
                } catch (gErr) {
                    console.error("Goal notification error on updateTaskStatus:", gErr);
                }
            }
        }

        return res.status(200).json({
            success: true,
            message: `Task status updated to ${task.status}`,
            data: updated,
        });
    } catch (err) {
        console.error("updateTaskStatus error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to update status",
            error: err.message,
        });
    }
};

/**
 * deleteTask
 * DELETE /api/tasks/:taskId
 *
 * Deletes a task.
 * Protected by requireTaskAccess.
 * Allowed for: OWNER, MANAGER, or task createdBy.
 */
const deleteTask = async (req, res) => {
    try {
        const task = req.task;
        const userRole = req.membership?.role || req.userProjectRole || (task.project ? "MEMBER" : "OWNER");
        const userIdStr = req.user._id.toString();

        if (userRole === "VIEWER") {
            return res.status(403).json({
                success: false,
                message: "Viewers cannot delete tasks",
            });
        }

        if (userRole === "MEMBER" && task.createdBy.toString() !== userIdStr) {
            return res.status(403).json({
                success: false,
                message: "Members can only delete tasks they created. Contact a project Manager or Owner.",
            });
        }

        await Task.findByIdAndDelete(task._id);

        return res.status(200).json({
            success: true,
            message: "Task deleted successfully",
        });
    } catch (err) {
        console.error("deleteTask error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to delete task",
            error: err.message,
        });
    }
};

// ── Subtask Controllers ───────────────────────────────────────────────────────

/**
 * addSubtask
 * POST /api/tasks/:taskId/subtasks
 */
const addSubtask = async (req, res) => {
    try {
        const task = req.task;
        const userRole = req.membership?.role || req.userProjectRole || (task.project ? "MEMBER" : "OWNER");

        if (userRole === "VIEWER") {
            return res.status(403).json({ success: false, message: "Viewers cannot add subtasks" });
        }

        const { title } = req.body;
        if (!title || title.trim().length === 0) {
            return res.status(400).json({ success: false, message: "Subtask title is required" });
        }

        task.subtasks.push({
            title: title.trim(),
            completed: false,
            createdAt: new Date(),
        });

        syncTaskStatusFromSubtasks(task);
        await task.save();

        const updated = await Task.findById(task._id)
            .populate("project", "_id name status dueDate owner")
            .populate("assignee", "_id name email profileImageURL")
            .populate("createdBy", "_id name email profileImageURL");

        await logTaskActivity({
            task: task._id,
            project: task.project || null,
            actor: req.user._id,
            action: "SUBTASK_ADDED",
            details: `${req.user.name || "A member"} added subtask: "${title.trim()}"`,
        });

        return res.status(201).json({
            success: true,
            message: "Subtask added",
            data: updated,
        });
    } catch (err) {
        console.error("addSubtask error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to add subtask",
            error: err.message,
        });
    }
};

/**
 * toggleSubtask
 * PATCH /api/tasks/:taskId/subtasks/:subtaskId
 */
const toggleSubtask = async (req, res) => {
    try {
        const task = req.task;
        const userRole = req.membership?.role || req.userProjectRole || (task.project ? "MEMBER" : "OWNER");

        if (userRole === "VIEWER") {
            return res.status(403).json({ success: false, message: "Viewers cannot toggle subtasks" });
        }

        const { subtaskId } = req.params;
        const { completed, title } = req.body;

        const subtask = task.subtasks.id(subtaskId);
        if (!subtask) {
            return res.status(404).json({ success: false, message: "Subtask not found" });
        }

        let activityAction = "SUBTASK_TOGGLED";
        let activityDetails = "";

        if (title !== undefined) {
            if (!title || title.trim().length === 0) {
                return res.status(400).json({ success: false, message: "Subtask title cannot be empty" });
            }
            subtask.title = title.trim();
            activityAction = "SUBTASK_UPDATED";
            activityDetails = `${req.user.name || "A member"} updated subtask title to "${subtask.title}"`;
        }

        if (completed !== undefined) {
            subtask.completed = Boolean(completed);
            activityAction = "SUBTASK_TOGGLED";
            activityDetails = `${req.user.name || "A member"} marked subtask "${subtask.title}" as ${subtask.completed ? "completed" : "incomplete"}`;
        }

        const prevTaskStatus = task.status;
        syncTaskStatusFromSubtasks(task);
        await task.save();

        const updated = await Task.findById(task._id)
            .populate("project", "_id name status dueDate owner")
            .populate("goal", "_id title status measurementType targetValue")
            .populate("dependencies", "_id title status")
            .populate("assignee", "_id name email profileImageURL")
            .populate("createdBy", "_id name email profileImageURL");

        if (activityDetails) {
            await logTaskActivity({
                task: task._id,
                project: task.project || null,
                actor: req.user._id,
                action: activityAction,
                details: activityDetails,
                metadata: { subtaskId: subtask._id, completed: subtask.completed },
            });
        }

        if (prevTaskStatus !== "COMPLETED" && updated.status === "COMPLETED") {
            await notificationService.notifyTaskCompleted(updated, req.user._id);
            await notificationService.checkAndNotifyDependenciesUnblocked(updated, req.user._id);
            if (updated.goal) {
                try {
                    const goalDoc = await Goal.findById(updated.goal._id || updated.goal);
                    if (goalDoc) {
                        const progress = await goalService.calculateGoalProgress(goalDoc._id);
                        await notificationService.notifyGoalProgress(goalDoc, progress);
                    }
                } catch (gErr) {
                    console.error("Goal notification error on toggleSubtask:", gErr);
                }
            }
        }

        return res.status(200).json({
            success: true,
            message: "Subtask updated successfully",
            data: updated,
        });
    } catch (err) {
        console.error("toggleSubtask error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to update subtask",
            error: err.message,
        });
    }
};

/**
 * deleteSubtask
 * DELETE /api/tasks/:taskId/subtasks/:subtaskId
 */
const deleteSubtask = async (req, res) => {
    try {
        const task = req.task;
        const userRole = req.membership?.role || req.userProjectRole || (task.project ? "MEMBER" : "OWNER");

        if (userRole === "VIEWER") {
            return res.status(403).json({ success: false, message: "Viewers cannot delete subtasks" });
        }

        const { subtaskId } = req.params;
        const subtask = task.subtasks.id(subtaskId);
        if (!subtask) {
            return res.status(404).json({ success: false, message: "Subtask not found" });
        }

        const deletedTitle = subtask.title;
        task.subtasks.pull(subtaskId);
        if (task.subtasks.length > 0) {
            syncTaskStatusFromSubtasks(task);
        }
        await task.save();

        const updated = await Task.findById(task._id)
            .populate("project", "_id name status dueDate owner")
            .populate("assignee", "_id name email profileImageURL")
            .populate("createdBy", "_id name email profileImageURL");

        await logTaskActivity({
            task: task._id,
            project: task.project || null,
            actor: req.user._id,
            action: "SUBTASK_DELETED",
            details: `${req.user.name || "A member"} deleted subtask "${deletedTitle}"`,
        });

        return res.status(200).json({
            success: true,
            message: "Subtask deleted",
            data: updated,
        });
    } catch (err) {
        console.error("deleteSubtask error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to delete subtask",
            error: err.message,
        });
    }
};

/**
 * Helper to synchronize task status based on subtask completion
 */
const syncTaskStatusFromSubtasks = (task) => {
    if (task.subtasks && task.subtasks.length > 0) {
        const completedCount = task.subtasks.filter((st) => st.completed).length;
        if (completedCount === task.subtasks.length) {
            task.status = 'COMPLETED';
        } else if (completedCount > 0) {
            task.status = 'IN_PROGRESS';
        } else {
            if (task.status === 'COMPLETED') {
                task.status = 'TODO';
            }
        }
    }
};

/**
 * createPersonalTask
 * POST /api/tasks/personal
 *
 * Creates a personal task not associated with any project.
 * Automatically sets project = null, createdBy = req.user._id, assignee = req.user._id.
 */
const createPersonalTask = async (req, res) => {
    try {
        const {
            title,
            description,
            status,
            priority,
            startDate,
            dueDate,
            tags,
            subtasks,
            estimatedMinutes,
            goal,
            isMilestone,
        } = req.body;

        if (!title || title.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Task title is required',
            });
        }

        // Validate dates if provided
        let start = null;
        let due = null;
        if (startDate) {
            start = new Date(startDate);
            if (isNaN(start.getTime())) {
                return res.status(400).json({ success: false, message: 'Invalid start date format' });
            }
        }
        if (dueDate) {
            due = new Date(dueDate);
            if (isNaN(due.getTime())) {
                return res.status(400).json({ success: false, message: 'Invalid due date format' });
            }
        }
        if (start && due && due < start) {
            return res.status(400).json({
                success: false,
                message: 'Due date cannot be earlier than start date',
            });
        }

        // Validate Goal if provided
        let goalId = null;
        if (goal) {
            if (!mongoose.Types.ObjectId.isValid(goal)) {
                return res.status(400).json({ success: false, message: 'Invalid goal ID format' });
            }
            const goalDoc = await Goal.findById(goal);
            if (!goalDoc) {
                return res.status(404).json({ success: false, message: 'Goal not found' });
            }
            if (goalDoc.project || !goalDoc.owner.equals(req.user._id)) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot link project goal to personal task',
                });
            }
            goalId = goalDoc._id;
        }

        const formattedSubtasks = Array.isArray(subtasks)
            ? subtasks
                  .filter((st) => st && st.title && st.title.trim().length > 0)
                  .map((st) => ({
                      title: st.title.trim(),
                      completed: Boolean(st.completed),
                      createdAt: new Date(),
                  }))
            : [];

        const formattedTags = Array.isArray(tags)
            ? tags.map((t) => String(t).trim()).filter(Boolean)
            : [];

        let parsedEstimatedMinutes = null;
        if (estimatedMinutes !== undefined && estimatedMinutes !== null && estimatedMinutes !== "") {
            const num = Number(estimatedMinutes);
            if (isNaN(num) || num < 0) {
                return res.status(400).json({ success: false, message: "Estimated minutes must be a positive number" });
            }
            parsedEstimatedMinutes = Math.round(num);
        }

        const task = new Task({
            project: null,
            goal: goalId,
            title: title.trim(),
            description: description ? description.trim() : '',
            status: status || 'TODO',
            priority: priority || 'MEDIUM',
            assignee: req.user._id,
            createdBy: req.user._id,
            startDate: start,
            dueDate: due,
            tags: formattedTags,
            subtasks: formattedSubtasks,
            estimatedMinutes: parsedEstimatedMinutes,
            isMilestone: Boolean(isMilestone),
        });

        if (task.subtasks.length > 0 && !status) {
            syncTaskStatusFromSubtasks(task);
        }

        await task.save();

        const populatedTask = await Task.findById(task._id)
            .populate('goal', '_id title status measurementType targetValue')
            .populate('assignee', '_id name email profileImageURL')
            .populate('createdBy', '_id name email profileImageURL');

        return res.status(201).json({
            success: true,
            message: 'Personal task created successfully',
            data: populatedTask,
        });
    } catch (err) {
        console.error('createPersonalTask error:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to create personal task',
            error: err.message,
        });
    }
};

/**
 * getPersonalTasks
 * GET /api/tasks/personal
 *
 * Returns all personal tasks belonging to the authenticated user.
 */
const getPersonalTasks = async (req, res) => {
    try {
        const { status, priority, tag, search, sortBy, order } = req.query;

        const filter = {
            project: null,
            createdBy: req.user._id,
        };

        if (status && ['TODO', 'IN_PROGRESS', 'COMPLETED'].includes(status.toUpperCase())) {
            filter.status = status.toUpperCase();
        }

        if (priority && ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(priority.toUpperCase())) {
            filter.priority = priority.toUpperCase();
        }

        if (tag && tag.trim()) {
            filter.tags = tag.trim();
        }

        if (search && search.trim()) {
            const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter.$or = [
                { title: new RegExp(escaped, 'i') },
                { description: new RegExp(escaped, 'i') },
            ];
        }

        const sortField = ['dueDate', 'priority', 'createdAt'].includes(sortBy)
            ? sortBy
            : 'createdAt';
        const sortDirection = order === 'asc' ? 1 : -1;
        const sortOptions = { [sortField]: sortDirection };

        if (sortField === 'dueDate') {
            sortOptions.dueDate = sortDirection;
        }

        const tasks = await Task.find(filter)
            .populate('goal', '_id title status measurementType targetValue')
            .populate('assignee', '_id name email profileImageURL')
            .populate('createdBy', '_id name email profileImageURL')
            .sort(sortOptions);

        const allPersonalTasks = await Task.find({ project: null, createdBy: req.user._id }).select(
            'status subtasks'
        );

        const totalTasks = allPersonalTasks.length;
        const completedTasks = allPersonalTasks.filter((t) => t.status === 'COMPLETED').length;
        const completionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        let subtasksTotal = 0;
        let subtasksCompleted = 0;
        allPersonalTasks.forEach((t) => {
            if (Array.isArray(t.subtasks)) {
                subtasksTotal += t.subtasks.length;
                subtasksCompleted += t.subtasks.filter((st) => st.completed).length;
            }
        });

        return res.status(200).json({
            success: true,
            count: tasks.length,
            stats: {
                totalTasks,
                completedTasks,
                completionPct,
                subtasksTotal,
                subtasksCompleted,
            },
            data: tasks,
        });
    } catch (err) {
        console.error('getPersonalTasks error:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve personal tasks',
            error: err.message,
        });
    }
};

/**
 * getDashboardSummary
 * GET /api/tasks/dashboard-summary
 *
 * Aggregates all productivity metrics and lists for the authenticated user's main dashboard:
 * - Metrics: totalTasks, todoCount, inProgressCount, completedCount, dueTodayCount, overdueCount, completedThisWeek, personalCount, projectCount, activeProjectsCount
 * - Due Today Tasks: tasks due today
 * - Upcoming Tasks: upcoming tasks (due today or future, incomplete)
 * - Overdue Tasks: incomplete tasks with dueDate < startOfToday
 * - Recent Tasks: top 5 latest updated/created tasks
 * - Recent Activities: latest task/project audit events for the user
 */
const getDashboardSummary = async (req, res) => {
    try {
        const memberships = await ProjectMembership.find({ user: req.user._id }).select('project');
        const userProjectIds = memberships.map((m) => m.project);

        const baseCondition = {
            $or: [
                { project: null, createdBy: req.user._id },
                { project: { $in: userProjectIds }, assignee: req.user._id },
            ],
        };

        const allTasks = await Task.find(baseCondition)
            .populate('project', '_id name status dueDate')
            .populate('goal', '_id title status measurementType targetValue')
            .populate('assignee', '_id name email profileImageURL')
            .populate('createdBy', '_id name email profileImageURL')
            .sort({ dueDate: 1, createdAt: -1 });

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        let todoCount = 0;
        let inProgressCount = 0;
        let completedCount = 0;
        let personalCount = 0;
        let projectCount = 0;
        let completedThisWeekCount = 0;

        const dueTodayTasks = [];
        const upcomingTasks = [];
        const overdueTasks = [];

        for (const task of allTasks) {
            if (task.project) {
                projectCount++;
            } else {
                personalCount++;
            }

            if (task.status === 'COMPLETED') {
                completedCount++;
                if (task.updatedAt && new Date(task.updatedAt) >= startOfWeek) {
                    completedThisWeekCount++;
                }
            } else if (task.status === 'IN_PROGRESS') {
                inProgressCount++;
            } else {
                todoCount++;
            }

            if (task.dueDate) {
                const dueTime = new Date(task.dueDate).getTime();
                const isDueToday = dueTime >= startOfToday.getTime() && dueTime <= endOfToday.getTime();
                const isOverdue = dueTime < startOfToday.getTime() && task.status !== 'COMPLETED';
                const isUpcoming = dueTime >= startOfToday.getTime() && task.status !== 'COMPLETED';

                if (isDueToday) {
                    dueTodayTasks.push(task);
                }
                if (isOverdue) {
                    overdueTasks.push(task);
                }
                if (isUpcoming) {
                    upcomingTasks.push(task);
                }
            }
        }

        // Sort upcoming tasks by due date ascending
        upcomingTasks.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

        // Get recent tasks (latest created or updated)
        const recentTasks = [...allTasks]
            .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
            .slice(0, 5);

        // Fetch recent activities
        const userTaskIds = allTasks.map((t) => t._id);
        const recentActivities = await TaskActivity.find({
            $or: [
                { actor: req.user._id },
                { task: { $in: userTaskIds } },
                { project: { $in: userProjectIds } },
            ],
        })
            .sort({ createdAt: -1 })
            .limit(10)
            .populate('actor', '_id name email profileImageURL')
            .populate('task', '_id title status priority project')
            .populate('project', '_id name');

        // Fetch top recommended tasks via Task Intelligence Engine
        let recommendedTasks = [];
        try {
            recommendedTasks = await taskIntelligenceService.getRecommendedTasksForUser(req.user._id, { limit: 4 });
        } catch (intelErr) {
            console.error('Task intelligence calculation in dashboard error:', intelErr);
        }

        return res.status(200).json({
            success: true,
            data: {
                metrics: {
                    totalTasks: allTasks.length,
                    todoCount,
                    inProgressCount,
                    completedCount,
                    dueTodayCount: dueTodayTasks.length,
                    overdueCount: overdueTasks.length,
                    completedThisWeek: completedThisWeekCount,
                    personalCount,
                    projectCount,
                    activeProjectsCount: userProjectIds.length,
                },
                dueTodayTasks,
                upcomingTasks: upcomingTasks.slice(0, 8),
                overdueTasks: overdueTasks.slice(0, 8),
                recentTasks,
                recentActivities,
                recommendedTasks,
            },
        });
    } catch (err) {
        console.error('getDashboardSummary error:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to generate dashboard summary',
            error: err.message,
        });
    }
};

/**
 * getRecommendedTasks
 * GET /api/tasks/recommended
 *
 * Returns the authenticated user's highest-ranked actionable tasks
 * based on rule-based urgency scoring and deadline classification.
 */
const getRecommendedTasks = async (req, res) => {
    try {
        const { limit } = req.query;
        const recommendations = await taskIntelligenceService.getRecommendedTasksForUser(
            req.user._id,
            { limit }
        );

        return res.status(200).json({
            success: true,
            count: recommendations.length,
            data: recommendations,
        });
    } catch (err) {
        console.error("getRecommendedTasks error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch recommended tasks",
            error: err.message,
        });
    }
};

module.exports = {
    createTask,
    getProjectTasks,
    getMyTasks,
    getTaskById,
    updateTask,
    updateTaskStatus,
    deleteTask,
    addSubtask,
    toggleSubtask,
    updateSubtask: toggleSubtask,
    deleteSubtask,
    createPersonalTask,
    getPersonalTasks,
    getDashboardSummary,
    getRecommendedTasks,
};
