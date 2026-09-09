const mongoose = require("mongoose");
const Comment = require("../models/Comment");
const TaskActivity = require("../models/TaskActivity");
const { logTaskActivity } = require("../utils/activityLogger");

/**
 * getTaskComments
 * GET /api/tasks/:taskId/comments
 * Protected by requireTaskAccess.
 */
const getTaskComments = async (req, res) => {
    try {
        const taskId = req.task._id;
        const comments = await Comment.find({ task: taskId })
            .populate("author", "_id name email profileImageURL")
            .sort({ createdAt: 1 });

        return res.status(200).json({
            success: true,
            count: comments.length,
            data: comments,
        });
    } catch (err) {
        console.error("getTaskComments error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve comments",
            error: err.message,
        });
    }
};

/**
 * createTaskComment
 * POST /api/tasks/:taskId/comments
 * Protected by requireTaskAccess.
 */
const createTaskComment = async (req, res) => {
    try {
        const task = req.task;
        const userRole = req.membership?.role;

        if (userRole === "VIEWER") {
            return res.status(403).json({
                success: false,
                message: "Viewers have read-only access and cannot post comments",
            });
        }

        const { content } = req.body;
        if (!content || !content.trim()) {
            return res.status(400).json({
                success: false,
                message: "Comment content is required",
            });
        }

        const newComment = await Comment.create({
            task: task._id,
            project: task.project || null,
            author: req.user._id,
            content: content.trim(),
        });

        const populated = await Comment.findById(newComment._id).populate(
            "author",
            "_id name email profileImageURL"
        );

        // Log collaboration activity
        const snippet = content.trim().length > 60 ? content.trim().slice(0, 57) + "..." : content.trim();
        await logTaskActivity({
            task: task._id,
            project: task.project || null,
            actor: req.user._id,
            action: "COMMENT_ADDED",
            details: `${req.user.name || "A member"} added a comment: "${snippet}"`,
            metadata: { commentId: newComment._id },
        });

        return res.status(201).json({
            success: true,
            message: "Comment added successfully",
            data: populated,
        });
    } catch (err) {
        console.error("createTaskComment error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to create comment",
            error: err.message,
        });
    }
};

/**
 * updateTaskComment
 * PUT /api/tasks/:taskId/comments/:commentId
 * Protected by requireTaskAccess.
 * Only the comment author can edit their comment.
 */
const updateTaskComment = async (req, res) => {
    try {
        const { commentId } = req.params;
        const { content } = req.body;

        if (!mongoose.Types.ObjectId.isValid(commentId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid comment ID",
            });
        }

        const comment = await Comment.findById(commentId);
        if (!comment || !comment.task.equals(req.task._id)) {
            return res.status(404).json({
                success: false,
                message: "Comment not found on this task",
            });
        }

        // Author-only edit check
        if (!comment.author.equals(req.user._id)) {
            return res.status(403).json({
                success: false,
                message: "You can only edit your own comments",
            });
        }

        if (!content || !content.trim()) {
            return res.status(400).json({
                success: false,
                message: "Comment content cannot be empty",
            });
        }

        comment.content = content.trim();
        await comment.save();

        const populated = await Comment.findById(comment._id).populate(
            "author",
            "_id name email profileImageURL"
        );

        return res.status(200).json({
            success: true,
            message: "Comment updated successfully",
            data: populated,
        });
    } catch (err) {
        console.error("updateTaskComment error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to update comment",
            error: err.message,
        });
    }
};

/**
 * deleteTaskComment
 * DELETE /api/tasks/:taskId/comments/:commentId
 * Protected by requireTaskAccess.
 * Allowed for comment author OR project OWNER / MANAGER.
 */
const deleteTaskComment = async (req, res) => {
    try {
        const { commentId } = req.params;
        const userRole = req.membership?.role;

        if (!mongoose.Types.ObjectId.isValid(commentId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid comment ID",
            });
        }

        const comment = await Comment.findById(commentId);
        if (!comment || !comment.task.equals(req.task._id)) {
            return res.status(404).json({
                success: false,
                message: "Comment not found on this task",
            });
        }

        const isAuthor = comment.author.equals(req.user._id);
        const canModerate = ["OWNER", "MANAGER"].includes(userRole);

        if (!isAuthor && !canModerate) {
            return res.status(403).json({
                success: false,
                message: "Permission denied. You can only delete your own comments unless you are a Project Owner or Manager.",
            });
        }

        await Comment.findByIdAndDelete(commentId);

        return res.status(200).json({
            success: true,
            message: "Comment deleted successfully",
        });
    } catch (err) {
        console.error("deleteTaskComment error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to delete comment",
            error: err.message,
        });
    }
};

/**
 * getTaskActivities
 * GET /api/tasks/:taskId/activities
 * Protected by requireTaskAccess.
 */
const getTaskActivities = async (req, res) => {
    try {
        const taskId = req.task._id;
        const activities = await TaskActivity.find({ task: taskId })
            .populate("actor", "_id name email profileImageURL")
            .sort({ createdAt: -1 })
            .limit(50);

        return res.status(200).json({
            success: true,
            count: activities.length,
            data: activities,
        });
    } catch (err) {
        console.error("getTaskActivities error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve task activity history",
            error: err.message,
        });
    }
};

module.exports = {
    getTaskComments,
    createTaskComment,
    updateTaskComment,
    deleteTaskComment,
    getTaskActivities,
};
