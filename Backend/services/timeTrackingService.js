const mongoose = require("mongoose");
const Task = require("../models/Task");
const TimeSession = require("../models/TimeSession");
const ProjectMembership = require("../models/ProjectMembership");

/**
 * timeTrackingService — Phase 9
 *
 * Encapsulates all domain logic for task-level work timers, session logging,
 * active timer enforcement, and time estimation vs. actual calculations.
 */

/**
 * Verify if a user is authorized to track time on a task.
 * Personal tasks -> Task creator only
 * Project tasks  -> Active project member
 */
const verifyTaskAccess = async (task, userId) => {
    if (!task.project) {
        // Personal task
        if (!task.createdBy.equals(userId)) {
            const err = new Error("Access denied. You do not have permission to access this personal task.");
            err.statusCode = 403;
            throw err;
        }
        return;
    }

    // Project task
    const membership = await ProjectMembership.findOne({
        project: task.project,
        user: userId,
    });

    if (!membership) {
        const err = new Error("Access denied. You are not a member of the project this task belongs to.");
        err.statusCode = 403;
        throw err;
    }
};

/**
 * Start a timer for a task.
 * Enforces: One user -> One active timer.
 * Server timestamp is the absolute source of truth.
 */
const startTimer = async (userId, taskId) => {
    if (!taskId || !mongoose.Types.ObjectId.isValid(taskId)) {
        const err = new Error("Invalid task ID format");
        err.statusCode = 400;
        throw err;
    }

    // 1. Check if user already has an active session running
    const existingActive = await TimeSession.findOne({ user: userId, endedAt: null }).populate(
        "task",
        "title"
    );

    if (existingActive) {
        const activeTaskTitle = existingActive.task?.title || "another task";
        const err = new Error(`You already have an active timer for "${activeTaskTitle}".`);
        err.statusCode = 400;
        err.code = "ACTIVE_TIMER_EXISTS";
        err.activeSession = existingActive;
        throw err;
    }

    // 2. Validate task existence
    const task = await Task.findById(taskId);
    if (!task) {
        const err = new Error("Task not found");
        err.statusCode = 404;
        throw err;
    }

    // 3. Verify user authorization
    await verifyTaskAccess(task, userId);

    // 4. Check completed task policy
    if (task.status === "COMPLETED") {
        const err = new Error(
            "Cannot track time on a completed task. Reopen the task if you need to continue working on it."
        );
        err.statusCode = 400;
        err.code = "TASK_ALREADY_COMPLETED";
        throw err;
    }

    // 5. Create new session with server timestamp
    const now = new Date();
    const session = await TimeSession.create({
        user: userId,
        task: task._id,
        project: task.project || null,
        startedAt: now,
        endedAt: null,
        durationSeconds: 0,
    });

    const populated = await TimeSession.findById(session._id)
        .populate("task", "title estimatedMinutes status priority project")
        .populate("project", "name");

    return populated;
};

/**
 * Stop the user's active timer.
 * Duration is calculated and persisted strictly server-side.
 */
const stopTimer = async (userId) => {
    const session = await TimeSession.findOne({ user: userId, endedAt: null })
        .populate("task", "title estimatedMinutes status priority project")
        .populate("project", "name");

    if (!session) {
        const err = new Error("No active timer found to stop");
        err.statusCode = 400;
        err.code = "NO_ACTIVE_TIMER";
        throw err;
    }

    const endedAt = new Date();
    const startedAt = session.startedAt;
    const durationSeconds = Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000));

    session.endedAt = endedAt;
    session.durationSeconds = durationSeconds;
    await session.save();

    return session;
};

/**
 * Cancel the user's active timer without saving duration.
 */
const cancelTimer = async (userId) => {
    const session = await TimeSession.findOneAndDelete({ user: userId, endedAt: null });

    if (!session) {
        const err = new Error("No active timer found to cancel");
        err.statusCode = 400;
        err.code = "NO_ACTIVE_TIMER";
        throw err;
    }

    return {
        cancelled: true,
        sessionId: session._id,
        message: "Active timer cancelled successfully",
    };
};

/**
 * Retrieve the current active timer for the user, if one exists.
 */
const getActiveTimer = async (userId) => {
    const session = await TimeSession.findOne({ user: userId, endedAt: null })
        .populate("task", "title estimatedMinutes status priority project")
        .populate("project", "name");

    if (!session) {
        return {
            active: false,
            session: null,
            elapsedSeconds: 0,
            serverTime: new Date(),
        };
    }

    const now = new Date();
    const elapsedSeconds = Math.max(0, Math.round((now.getTime() - session.startedAt.getTime()) / 1000));

    return {
        active: true,
        session,
        elapsedSeconds,
        serverTime: now,
    };
};

/**
 * Get task-level time summary and history.
 * Aggregates all completed sessions, compares estimated vs. actual time,
 * and lists historical sessions.
 */
const getTaskTimeSummary = async (userId, taskId) => {
    if (!taskId || !mongoose.Types.ObjectId.isValid(taskId)) {
        const err = new Error("Invalid task ID format");
        err.statusCode = 400;
        throw err;
    }

    const task = await Task.findById(taskId);
    if (!task) {
        const err = new Error("Task not found");
        err.statusCode = 404;
        throw err;
    }

    await verifyTaskAccess(task, userId);

    // Fetch all completed sessions for this task
    const sessions = await TimeSession.find({
        task: taskId,
        endedAt: { $ne: null },
    })
        .sort({ startedAt: -1 })
        .populate("user", "_id name email profileImageURL");

    const totalTrackedSeconds = sessions.reduce(
        (sum, s) => sum + (Number(s.durationSeconds) || 0),
        0
    );
    const totalTrackedMinutes = Math.round(totalTrackedSeconds / 60);

    const estimatedMinutes =
        typeof task.estimatedMinutes === "number" && task.estimatedMinutes >= 0
            ? task.estimatedMinutes
            : null;

    let remainingMinutes = null;
    let overMinutes = null;

    if (estimatedMinutes !== null) {
        if (totalTrackedMinutes >= estimatedMinutes) {
            remainingMinutes = 0;
            overMinutes = totalTrackedMinutes - estimatedMinutes;
        } else {
            remainingMinutes = estimatedMinutes - totalTrackedMinutes;
            overMinutes = 0;
        }
    }

    // Check if authenticated user currently has an active timer on this task
    const activeForUser = await TimeSession.findOne({
        user: userId,
        task: taskId,
        endedAt: null,
    });

    return {
        taskId: task._id,
        title: task.title,
        status: task.status,
        estimatedMinutes,
        totalTrackedSeconds,
        totalTrackedMinutes,
        remainingMinutes,
        overMinutes,
        isOverEstimate: overMinutes !== null && overMinutes > 0,
        hasActiveTimer: Boolean(activeForUser),
        activeSessionId: activeForUser ? activeForUser._id : null,
        sessionsCount: sessions.length,
        sessions,
    };
};

/**
 * Get the user's focus summary for today (midnight to midnight).
 */
const getTodaySummary = async (userId) => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const todaySessions = await TimeSession.find({
        user: userId,
        endedAt: { $gte: startOfToday, $lte: endOfToday },
    })
        .sort({ startedAt: -1 })
        .populate("task", "_id title priority project")
        .populate("project", "_id name");

    const totalTrackedSeconds = todaySessions.reduce(
        (sum, s) => sum + (Number(s.durationSeconds) || 0),
        0
    );
    const totalTrackedMinutes = Math.round(totalTrackedSeconds / 60);

    const activeSession = await TimeSession.findOne({ user: userId, endedAt: null })
        .populate("task", "_id title priority project")
        .populate("project", "_id name");

    let activeElapsedSeconds = 0;
    if (activeSession) {
        activeElapsedSeconds = Math.max(
            0,
            Math.round((Date.now() - activeSession.startedAt.getTime()) / 1000)
        );
    }

    return {
        date: startOfToday.toISOString().split("T")[0],
        totalTrackedSeconds,
        totalTrackedMinutes,
        sessionsCount: todaySessions.length,
        sessions: todaySessions,
        activeTimer: activeSession
            ? {
                  session: activeSession,
                  elapsedSeconds: activeElapsedSeconds,
              }
            : null,
    };
};

module.exports = {
    verifyTaskAccess,
    startTimer,
    stopTimer,
    cancelTimer,
    getActiveTimer,
    getTaskTimeSummary,
    getTodaySummary,
};
