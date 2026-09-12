const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const Task = require("../models/Task");
const Goal = require("../models/Goal");
const Project = require("../models/Project");
const ProjectMembership = require("../models/ProjectMembership");
const User = require("../models/User");
const { NOTIFICATION_TYPES, SOURCE_TYPES } = require("../constants/notificationConstants");

/**
 * Notification Service — Phase 11
 *
 * Provides central notification business logic, deterministic deduplication,
 * in-app storage, and domain event dispatchers.
 */

/**
 * Create a single in-app notification with deduplication support
 */
const createNotification = async ({
    recipient,
    type,
    title,
    message,
    sourceType,
    sourceId,
    project = null,
    metadata = {},
    eventKey = null,
}) => {
    if (!recipient || !type || !title || !message || !sourceType || !sourceId) {
        throw new Error("Missing required notification fields");
    }

    const recipientId = new mongoose.Types.ObjectId(recipient);

    // Deduplication check: if eventKey is provided, check if already notified
    if (eventKey) {
        const existing = await Notification.findOne({
            recipient: recipientId,
            eventKey,
        });
        if (existing) {
            return null;
        }
    }

    const notification = await Notification.create({
        recipient: recipientId,
        type,
        title: title.trim(),
        message: message.trim(),
        sourceType,
        sourceId: new mongoose.Types.ObjectId(sourceId),
        project: project ? new mongoose.Types.ObjectId(project) : null,
        metadata,
        eventKey,
        isRead: false,
    });

    return notification;
};

/**
 * Create multiple notifications with deduplication
 */
const createNotifications = async (items) => {
    if (!Array.isArray(items) || items.length === 0) return [];
    const results = [];
    for (const item of items) {
        try {
            const notif = await createNotification(item);
            if (notif) results.push(notif);
        } catch (err) {
            console.error("Failed to create notification item:", err.message);
        }
    }
    return results;
};

/**
 * Get paginated notifications for a user
 */
const getUserNotifications = async (userId, options = {}) => {
    const recipientId = new mongoose.Types.ObjectId(userId);
    const page = Math.max(1, parseInt(options.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(options.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter = { recipient: recipientId };

    if (options.isRead !== undefined && options.isRead !== null && options.isRead !== "") {
        filter.isRead = options.isRead === true || options.isRead === "true";
    }

    if (options.type && NOTIFICATION_TYPES[options.type]) {
        filter.type = options.type;
    }

    const [notifications, total, unreadCount] = await Promise.all([
        Notification.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate("project", "name"),
        Notification.countDocuments(filter),
        Notification.countDocuments({ recipient: recipientId, isRead: false }),
    ]);

    return {
        notifications,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        hasMore: skip + notifications.length < total,
        unreadCount,
    };
};

/**
 * Get count of unread notifications for a user
 */
const getUnreadCount = async (userId) => {
    const recipientId = new mongoose.Types.ObjectId(userId);
    const count = await Notification.countDocuments({ recipient: recipientId, isRead: false });
    return count;
};

/**
 * Mark a single notification as read
 */
const markAsRead = async (notificationId, userId) => {
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
        const error = new Error("Invalid notification ID format");
        error.statusCode = 400;
        throw error;
    }

    const notification = await Notification.findOne({
        _id: notificationId,
        recipient: new mongoose.Types.ObjectId(userId),
    });

    if (!notification) {
        const error = new Error("Notification not found");
        error.statusCode = 404;
        throw error;
    }

    if (!notification.isRead) {
        notification.isRead = true;
        notification.readAt = new Date();
        await notification.save();
    }

    return notification;
};

/**
 * Mark all unread notifications as read for a user
 */
const markAllAsRead = async (userId) => {
    const recipientId = new mongoose.Types.ObjectId(userId);
    const result = await Notification.updateMany(
        { recipient: recipientId, isRead: false },
        { $set: { isRead: true, readAt: new Date() } }
    );
    return { count: result.modifiedCount };
};

/**
 * Delete a notification
 */
const deleteNotification = async (notificationId, userId) => {
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
        const error = new Error("Invalid notification ID format");
        error.statusCode = 400;
        throw error;
    }

    const notification = await Notification.findOneAndDelete({
        _id: notificationId,
        recipient: new mongoose.Types.ObjectId(userId),
    });

    if (!notification) {
        const error = new Error("Notification not found");
        error.statusCode = 404;
        throw error;
    }

    return { success: true, message: "Notification deleted successfully" };
};

/**
 * Clear all notifications for a user
 */
const clearAllNotifications = async (userId) => {
    const recipientId = new mongoose.Types.ObjectId(userId);
    const result = await Notification.deleteMany({ recipient: recipientId });
    return { success: true, deletedCount: result.deletedCount };
};

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN EVENT DISPATCHERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Task Assigned Event
 */
const notifyTaskAssigned = async (task, actorId) => {
    if (!task.assignee) return null;
    const assigneeId = task.assignee._id || task.assignee;
    const actorObjectId = actorId ? (actorId._id || actorId) : null;

    // Do not notify user if they assigned the task to themselves
    if (actorObjectId && assigneeId.toString() === actorObjectId.toString()) {
        return null;
    }

    return createNotification({
        recipient: assigneeId,
        type: NOTIFICATION_TYPES.TASK_ASSIGNED,
        title: "New Task Assigned",
        message: `You were assigned "${task.title}".`,
        sourceType: SOURCE_TYPES.TASK,
        sourceId: task._id,
        project: task.project || null,
        metadata: {
            taskId: task._id,
            taskTitle: task.title,
            priority: task.priority,
            assignedBy: actorObjectId,
        },
    });
};

/**
 * Task Completed Event
 */
const notifyTaskCompleted = async (task, actorId) => {
    const actorObjectId = actorId ? (actorId._id || actorId) : null;
    const recipients = new Set();

    // 1. Notify task creator if creator != actor
    const creatorId = task.createdBy?._id || task.createdBy;
    if (creatorId && (!actorObjectId || creatorId.toString() !== actorObjectId.toString())) {
        recipients.add(creatorId.toString());
    }

    // 2. If project task, notify project owner if not already notified and not actor
    if (task.project) {
        const projId = task.project._id || task.project;
        const projectDoc = await Project.findById(projId);
        if (projectDoc && projectDoc.owner) {
            const ownerIdStr = projectDoc.owner.toString();
            if (!actorObjectId || ownerIdStr !== actorObjectId.toString()) {
                recipients.add(ownerIdStr);
            }
        }
    }

    const notifications = [];
    for (const recipient of recipients) {
        notifications.push({
            recipient,
            type: NOTIFICATION_TYPES.TASK_COMPLETED,
            title: "Task Completed",
            message: `"${task.title}" was completed.`,
            sourceType: SOURCE_TYPES.TASK,
            sourceId: task._id,
            project: task.project || null,
            metadata: {
                taskId: task._id,
                taskTitle: task.title,
                completedBy: actorObjectId,
            },
        });
    }

    return createNotifications(notifications);
};

/**
 * Check task dependencies and notify when dependent tasks become unblocked
 */
const checkAndNotifyDependenciesUnblocked = async (completedTask, actorId) => {
    // Find all incomplete tasks that have completedTask in their dependencies
    const dependentTasks = await Task.find({
        dependencies: completedTask._id,
        status: { $ne: "COMPLETED" },
    });

    if (dependentTasks.length === 0) return [];

    const unblockedNotifications = [];

    for (const depTask of dependentTasks) {
        // Check if all dependencies of depTask are now completed
        const otherDeps = depTask.dependencies.filter(
            (dId) => dId.toString() !== completedTask._id.toString()
        );

        let isFullyUnblocked = true;
        if (otherDeps.length > 0) {
            const pendingCount = await Task.countDocuments({
                _id: { $in: otherDeps },
                status: { $ne: "COMPLETED" },
            });
            if (pendingCount > 0) {
                isFullyUnblocked = false;
            }
        }

        if (isFullyUnblocked) {
            // Target: assignee if assigned, otherwise creator
            const targetUser = depTask.assignee || depTask.createdBy;
            if (targetUser) {
                unblockedNotifications.push({
                    recipient: targetUser,
                    type: NOTIFICATION_TYPES.TASK_UNBLOCKED,
                    title: "Task Unblocked",
                    message: `Task "${depTask.title}" is now unblocked because "${completedTask.title}" was completed.`,
                    sourceType: SOURCE_TYPES.TASK,
                    sourceId: depTask._id,
                    project: depTask.project || null,
                    metadata: {
                        unblockedTaskId: depTask._id,
                        unblockedTaskTitle: depTask.title,
                        completedPrerequisiteId: completedTask._id,
                    },
                });
            }
        }
    }

    return createNotifications(unblockedNotifications);
};

/**
 * Comment Added & Mention Notifications
 */
const notifyCommentAndMentions = async (comment, task, authorId) => {
    const authorObjectId = authorId ? (authorId._id || authorId) : null;
    const authorIdStr = authorObjectId ? authorObjectId.toString() : null;

    // 1. Extract mentions (@username or @email or @name)
    const mentionRegex = /@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|[a-zA-Z0-9._-]+)/g;
    const matches = [...comment.content.matchAll(mentionRegex)].map((m) => m[1]);

    const mentionedUserIds = new Set();
    if (matches.length > 0) {
        // Query users by username/name/email regex
        for (const token of matches) {
            const user = await User.findOne({
                $or: [
                    { email: token.toLowerCase() },
                    { name: new RegExp(`^${token}$`, "i") },
                    { name: new RegExp(token, "i") },
                ],
            });
            if (user && user._id.toString() !== authorIdStr) {
                mentionedUserIds.add(user._id.toString());
            }
        }
    }

    const notifications = [];

    // 2. Mention notifications
    for (const mentionedId of mentionedUserIds) {
        notifications.push({
            recipient: mentionedId,
            type: NOTIFICATION_TYPES.MENTIONED,
            title: "You Were Mentioned",
            message: `You were mentioned in a comment on "${task.title}".`,
            sourceType: SOURCE_TYPES.TASK,
            sourceId: task._id,
            project: task.project || null,
            metadata: {
                commentId: comment._id,
                taskId: task._id,
                taskTitle: task.title,
                authorId: authorObjectId,
            },
        });
    }

    // 3. Generic comment notifications for task assignee & creator (excluding author & mentioned users)
    const commentRecipients = new Set();
    const assigneeId = task.assignee ? (task.assignee._id || task.assignee).toString() : null;
    const creatorId = task.createdBy ? (task.createdBy._id || task.createdBy).toString() : null;

    if (assigneeId && assigneeId !== authorIdStr && !mentionedUserIds.has(assigneeId)) {
        commentRecipients.add(assigneeId);
    }
    if (creatorId && creatorId !== authorIdStr && !mentionedUserIds.has(creatorId)) {
        commentRecipients.add(creatorId);
    }

    for (const recId of commentRecipients) {
        notifications.push({
            recipient: recId,
            type: NOTIFICATION_TYPES.COMMENT_ADDED,
            title: "New Comment",
            message: `New comment on "${task.title}".`,
            sourceType: SOURCE_TYPES.TASK,
            sourceId: task._id,
            project: task.project || null,
            metadata: {
                commentId: comment._id,
                taskId: task._id,
                taskTitle: task.title,
                authorId: authorObjectId,
            },
        });
    }

    return createNotifications(notifications);
};

/**
 * Goal Milestone Progress & Completion Notifications
 */
const notifyGoalProgress = async (goal, progressInput) => {
    const ownerId = goal.owner._id || goal.owner;
    const progress = typeof progressInput === "object" && progressInput !== null
        ? (typeof progressInput.progress === "number" ? progressInput.progress : 0)
        : (Number(progressInput) || 0);

    if (progress >= 100 || goal.status === "COMPLETED") {
        return createNotification({
            recipient: ownerId,
            type: NOTIFICATION_TYPES.GOAL_COMPLETED,
            title: "🎯 Goal Completed",
            message: `Congratulations! Your goal "${goal.title}" has been completed.`,
            sourceType: SOURCE_TYPES.GOAL,
            sourceId: goal._id,
            project: goal.project || null,
            eventKey: `GOAL_COMPLETED:${goal._id}`,
            metadata: { goalId: goal._id, goalTitle: goal.title, progress },
        });
    }

    // Milestone thresholds: 50% and 75%
    if (progress >= 75) {
        return createNotification({
            recipient: ownerId,
            type: NOTIFICATION_TYPES.GOAL_PROGRESS,
            title: "Goal Progress Milestone",
            message: `Your goal "${goal.title}" has reached 75% completion.`,
            sourceType: SOURCE_TYPES.GOAL,
            sourceId: goal._id,
            project: goal.project || null,
            eventKey: `GOAL_PROGRESS:${goal._id}:75`,
            metadata: { goalId: goal._id, goalTitle: goal.title, progress: 75 },
        });
    } else if (progress >= 50) {
        return createNotification({
            recipient: ownerId,
            type: NOTIFICATION_TYPES.GOAL_PROGRESS,
            title: "Goal Progress Milestone",
            message: `Your goal "${goal.title}" has reached 50% completion.`,
            sourceType: SOURCE_TYPES.GOAL,
            sourceId: goal._id,
            project: goal.project || null,
            eventKey: `GOAL_PROGRESS:${goal._id}:50`,
            metadata: { goalId: goal._id, goalTitle: goal.title, progress: 50 },
        });
    }

    return null;
};

/**
 * Deterministic Deadline & Overdue Checker
 * Checks tasks and goals for upcoming deadlines and overdue states,
 * using daily eventKeys to prevent duplicate notifications.
 */
const checkDeadlinesAndOverdue = async (userId) => {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const notifications = [];

    // 1. Task Check
    // Find active tasks assigned to or created by this user
    const tasks = await Task.find({
        $or: [{ assignee: userObjectId }, { createdBy: userObjectId }],
        status: { $ne: "COMPLETED" },
        dueDate: { $ne: null },
    });

    for (const task of tasks) {
        const due = new Date(task.dueDate);
        const recipient = task.assignee || task.createdBy;

        if (due < now) {
            // Task is overdue -> once per day
            notifications.push({
                recipient,
                type: NOTIFICATION_TYPES.TASK_OVERDUE,
                title: "Task Overdue",
                message: `"${task.title}" is overdue.`,
                sourceType: SOURCE_TYPES.TASK,
                sourceId: task._id,
                project: task.project || null,
                eventKey: `TASK_OVERDUE:${task._id}:${todayStr}`,
                metadata: { taskId: task._id, taskTitle: task.title, dueDate: task.dueDate },
            });
        } else if (due <= in24Hours) {
            // Task deadline approaching (due within 24 hours) -> once per task due date
            const dueDayStr = due.toISOString().split("T")[0];
            notifications.push({
                recipient,
                type: NOTIFICATION_TYPES.TASK_DEADLINE_APPROACHING,
                title: "Task Deadline Approaching",
                message: `"${task.title}" is due soon (${due.toLocaleDateString()}).`,
                sourceType: SOURCE_TYPES.TASK,
                sourceId: task._id,
                project: task.project || null,
                eventKey: `TASK_DEADLINE_APPROACHING:${task._id}:${dueDayStr}`,
                metadata: { taskId: task._id, taskTitle: task.title, dueDate: task.dueDate },
            });
        }
    }

    // 2. Goal Check
    // Find active goals owned by this user
    const goals = await Goal.find({
        owner: userObjectId,
        status: { $ne: "COMPLETED" },
        targetDate: { $ne: null },
    });

    for (const goal of goals) {
        const target = new Date(goal.targetDate);
        if (target <= in24Hours && target >= new Date(now.getTime() - 24 * 60 * 60 * 1000)) {
            const targetDayStr = target.toISOString().split("T")[0];
            notifications.push({
                recipient: userObjectId,
                type: NOTIFICATION_TYPES.GOAL_DEADLINE_APPROACHING,
                title: "Goal Deadline Approaching",
                message: `Target deadline for goal "${goal.title}" is approaching.`,
                sourceType: SOURCE_TYPES.GOAL,
                sourceId: goal._id,
                project: goal.project || null,
                eventKey: `GOAL_DEADLINE_APPROACHING:${goal._id}:${targetDayStr}`,
                metadata: { goalId: goal._id, goalTitle: goal.title, targetDate: goal.targetDate },
            });
        }
    }

    const created = await createNotifications(notifications);
    return { createdCount: created.length, checkedTasks: tasks.length, checkedGoals: goals.length };
};

module.exports = {
    createNotification,
    createNotifications,
    getUserNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    notifyTaskAssigned,
    notifyTaskCompleted,
    checkAndNotifyDependenciesUnblocked,
    notifyCommentAndMentions,
    notifyGoalProgress,
    checkDeadlinesAndOverdue,
};
