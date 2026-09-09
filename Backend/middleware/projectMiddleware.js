const mongoose = require("mongoose");
const Project = require("../models/Project");
const ProjectMembership = require("../models/ProjectMembership");
const Task = require("../models/Task");

/**
 * requireProjectMember Middleware
 *
 * Verifies that the authenticated user (req.user) is an active member
 * of the requested project.
 *
 * Attaches to req:
 * - req.project: The Mongoose project document
 * - req.membership: The Mongoose membership document (includes .role, .joinedAt)
 */
const requireProjectMember = async (req, res, next) => {
    try {
        const projectId = req.params.projectId || req.params.id;

        if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid project ID format",
            });
        }

        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found",
            });
        }

        const membership = await ProjectMembership.findOne({
            project: projectId,
            user: req.user._id,
        });

        if (!membership) {
            return res.status(403).json({
                success: false,
                message: "Access denied. You are not a member of this project.",
            });
        }

        req.project = project;
        req.membership = membership;
        next();
    } catch (err) {
        console.error("requireProjectMember error:", err);
        return res.status(500).json({
            success: false,
            message: "Project authorization check failed",
            error: err.message,
        });
    }
};

/**
 * requireProjectRole Middleware Factory
 *
 * Enforces project-level Role-Based Access Control (RBAC).
 * Must be preceded by requireProjectMember in the route middleware chain.
 *
 * @param  {...string} allowedRoles Allowed roles (e.g. 'OWNER', 'MANAGER')
 */
const requireProjectRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.membership) {
            return res.status(500).json({
                success: false,
                message: "requireProjectRole must be preceded by requireProjectMember",
            });
        }

        if (!allowedRoles.includes(req.membership.role)) {
            return res.status(403).json({
                success: false,
                message: `Permission denied. Required role: ${allowedRoles.join(" or ")} (Current role: ${req.membership.role})`,
            });
        }

        next();
    };
};

/**
 * requireTaskAccess Middleware
 *
 * Verifies that a task exists and the authenticated user is an active member
 * of the project that owns the task.
 *
 * Attaches to req:
 * - req.task: The Mongoose task document
 * - req.project: The Mongoose project document
 * - req.membership: The Mongoose membership document
 */
const requireTaskAccess = async (req, res, next) => {
    try {
        const taskId = req.params.taskId || req.params.id;

        if (!taskId || !mongoose.Types.ObjectId.isValid(taskId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid task ID format",
            });
        }

        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({
                success: false,
                message: "Task not found",
            });
        }

        // Context 1: Personal Task (project is null)
        if (!task.project) {
            if (!task.createdBy.equals(req.user._id)) {
                return res.status(403).json({
                    success: false,
                    message: "Access denied. You do not have permission to access this personal task.",
                });
            }
            req.task = task;
            req.project = null;
            req.membership = { role: "OWNER" }; // Creator has full owner permissions over personal tasks
            return next();
        }

        // Context 2: Project-scoped Task
        const membership = await ProjectMembership.findOne({
            project: task.project,
            user: req.user._id,
        });

        if (!membership) {
            return res.status(403).json({
                success: false,
                message: "Access denied. You are not a member of the project this task belongs to.",
            });
        }

        const project = await Project.findById(task.project);

        req.task = task;
        req.project = project;
        req.membership = membership;
        next();
    } catch (err) {
        console.error("requireTaskAccess error:", err);
        return res.status(500).json({
            success: false,
            message: "Task authorization check failed",
            error: err.message,
        });
    }
};

module.exports = {
    requireProjectMember,
    requireProjectRole,
    requireTaskAccess,
};
