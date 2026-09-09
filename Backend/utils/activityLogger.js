const TaskActivity = require("../models/TaskActivity");

/**
 * Log task activity event
 * Fire-and-forget helper that never throws or blocks the main operation.
 */
const logTaskActivity = async ({ task, project = null, actor, action, details, metadata = {} }) => {
    try {
        if (!task || !actor || !action || !details) return null;
        return await TaskActivity.create({
            task: task._id || task,
            project: project ? (project._id || project) : null,
            actor: actor._id || actor,
            action,
            details,
            metadata,
        });
    } catch (err) {
        console.error("Failed to log task activity:", err.message);
        return null;
    }
};

module.exports = { logTaskActivity };
