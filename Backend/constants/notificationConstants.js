/**
 * Notification Constants — Phase 11
 *
 * Centralized constants for notification types and source categories.
 */

const NOTIFICATION_TYPES = {
    // Task Lifecycle Events
    TASK_ASSIGNED: "TASK_ASSIGNED",
    TASK_COMPLETED: "TASK_COMPLETED",
    TASK_DEADLINE_APPROACHING: "TASK_DEADLINE_APPROACHING",
    TASK_OVERDUE: "TASK_OVERDUE",

    // Collaboration Events
    COMMENT_ADDED: "COMMENT_ADDED",
    MENTIONED: "MENTIONED",

    // Dependency Events
    DEPENDENCY_COMPLETED: "DEPENDENCY_COMPLETED",
    TASK_UNBLOCKED: "TASK_UNBLOCKED",

    // Goal Events
    GOAL_PROGRESS: "GOAL_PROGRESS",
    GOAL_DEADLINE_APPROACHING: "GOAL_DEADLINE_APPROACHING",
    GOAL_COMPLETED: "GOAL_COMPLETED",
};

const SOURCE_TYPES = {
    TASK: "TASK",
    GOAL: "GOAL",
    PROJECT: "PROJECT",
    COMMENT: "COMMENT",
};

module.exports = {
    NOTIFICATION_TYPES,
    SOURCE_TYPES,
};
