const mongoose = require("mongoose");

/**
 * Goal Model — Phase 10
 *
 * A Goal represents a high-level outcome measured through linked tasks,
 * time tracking sessions, or milestone completions.
 *
 * Context distinction:
 * - project: null       -> Personal Goal (owned by user)
 * - project: ProjectId  -> Project Goal (scoped to project, accessible via RBAC)
 */
const goalSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, "Goal title is required"],
            trim: true,
            maxlength: [200, "Goal title cannot exceed 200 characters"],
        },
        description: {
            type: String,
            trim: true,
            maxlength: [2000, "Goal description cannot exceed 2000 characters"],
            default: "",
        },
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "Goal owner is required"],
            index: true,
        },
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            default: null,
            index: true,
        },
        status: {
            type: String,
            enum: {
                values: ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "ON_HOLD"],
                message: "{VALUE} is not a valid goal status",
            },
            default: "NOT_STARTED",
            index: true,
        },
        measurementType: {
            type: String,
            enum: {
                values: ["TASK_COUNT", "TIME", "MILESTONE"],
                message: "{VALUE} is not a valid measurement type",
            },
            default: "TASK_COUNT",
        },
        targetValue: {
            type: Number,
            min: [0, "Target value cannot be negative"],
            default: 0,
        },
        startDate: {
            type: Date,
            default: Date.now,
        },
        targetDate: {
            type: Date,
            default: null,
            index: true,
        },
    },
    {
        timestamps: true,
    }
);

// Deadline validation: targetDate cannot be before startDate if both exist
goalSchema.pre("validate", function () {
    if (this.startDate && this.targetDate) {
        const start = new Date(this.startDate);
        const target = new Date(this.targetDate);
        if (target < start) {
            this.invalidate("targetDate", "Target date cannot be before start date");
        }
    }
});

// Compound indexes for query optimization
goalSchema.index({ owner: 1, project: 1 });
goalSchema.index({ project: 1, status: 1 });
goalSchema.index({ owner: 1, status: 1 });

module.exports = mongoose.model("Goal", goalSchema);
