const mongoose = require("mongoose");

const taskActivitySchema = new mongoose.Schema(
    {
        task: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Task",
            required: [true, "Task reference is required"],
            index: true,
        },
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            default: null,
            index: true,
        },
        actor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "Actor reference is required"],
        },
        action: {
            type: String,
            required: [true, "Action type is required"],
            enum: [
                "CREATED",
                "STATUS_CHANGED",
                "PRIORITY_CHANGED",
                "ASSIGNED",
                "SUBTASK_TOGGLED",
                "SUBTASK_ADDED",
                "COMMENT_ADDED",
                "UPDATED",
            ],
        },
        details: {
            type: String,
            required: [true, "Activity details are required"],
            trim: true,
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        createdAt: {
            type: Date,
            default: Date.now,
            index: true,
        },
    },
    {
        timestamps: false,
    }
);

taskActivitySchema.index({ task: 1, createdAt: -1 });

module.exports = mongoose.model("TaskActivity", taskActivitySchema);
