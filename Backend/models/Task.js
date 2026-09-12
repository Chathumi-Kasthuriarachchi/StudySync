const mongoose = require("mongoose");

const subtaskSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, "Subtask title is required"],
        trim: true,
        maxlength: [200, "Subtask title cannot exceed 200 characters"],
    },
    completed: {
        type: Boolean,
        default: false,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

const taskSchema = new mongoose.Schema(
    {
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            default: null,
        },
        goal: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Goal",
            default: null,
            index: true,
        },
        title: {
            type: String,
            required: [true, "Task title is required"],
            trim: true,
            maxlength: [200, "Task title cannot exceed 200 characters"],
        },
        description: {
            type: String,
            trim: true,
            maxlength: [2000, "Description cannot exceed 2000 characters"],
            default: "",
        },
        status: {
            type: String,
            enum: {
                values: ["TODO", "IN_PROGRESS", "COMPLETED"],
                message: "{VALUE} is not a valid task status",
            },
            default: "TODO",
        },
        priority: {
            type: String,
            enum: {
                values: ["LOW", "MEDIUM", "HIGH", "URGENT"],
                message: "{VALUE} is not a valid task priority",
            },
            default: "MEDIUM",
        },
        assignee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "Creator reference is required"],
        },
        startDate: {
            type: Date,
            default: null,
        },
        dueDate: {
            type: Date,
            default: null,
        },
        tags: [
            {
                type: String,
                trim: true,
                maxlength: [50, "Tag cannot exceed 50 characters"],
            },
        ],
        subtasks: [subtaskSchema],
        estimatedMinutes: {
            type: Number,
            min: [0, "Estimated minutes cannot be negative"],
            default: null,
        },
        isMilestone: {
            type: Boolean,
            default: false,
        },
        dependencies: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Task",
            },
        ],
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Virtual progress calculation
taskSchema.virtual("progress").get(function () {
    if (this.subtasks && this.subtasks.length > 0) {
        const completed = this.subtasks.filter((st) => st.completed).length;
        return Math.round((completed / this.subtasks.length) * 100);
    }
    if (this.status === "COMPLETED") return 100;
    if (this.status === "IN_PROGRESS") return 50;
    return 0;
});

// Timeline validation: dueDate cannot be before startDate if both exist
taskSchema.pre("validate", function () {
    if (this.startDate && this.dueDate) {
        const start = new Date(this.startDate);
        const due = new Date(this.dueDate);
        if (due < start) {
            this.invalidate("dueDate", "Due date cannot be before start date");
        }
    }
});

// Indexes for performance
taskSchema.index({ project: 1, status: 1 });
taskSchema.index({ project: 1, dueDate: 1 });
taskSchema.index({ assignee: 1, status: 1 });
taskSchema.index({ project: 1, priority: 1 });
taskSchema.index({ createdBy: 1, project: 1 });
taskSchema.index({ createdBy: 1, status: 1 });
taskSchema.index({ goal: 1, status: 1 });

module.exports = mongoose.model("Task", taskSchema);