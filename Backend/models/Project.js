const mongoose = require("mongoose");

const ProjectSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Project name is required"],
            trim: true,
            maxlength: [100, "Project name cannot exceed 100 characters"],
        },
        description: {
            type: String,
            trim: true,
            maxlength: [500, "Description cannot exceed 500 characters"],
            default: "",
        },
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "Project owner is required"],
        },
        startDate: {
            type: Date,
            required: [true, "Start date is required"],
        },
        dueDate: {
            type: Date,
            required: [true, "Due date is required"],
        },
        status: {
            type: String,
            enum: {
                values: ["PLANNING", "ACTIVE", "COMPLETED", "ARCHIVED"],
                message: "{VALUE} is not a valid project status",
            },
            default: "PLANNING",
        },
    },
    {
        timestamps: true,
    }
);

// Timeline validation: dueDate must not be before startDate
ProjectSchema.pre("validate", function () {
    if (this.startDate && this.dueDate) {
        const start = new Date(this.startDate);
        const due = new Date(this.dueDate);
        if (due < start) {
            this.invalidate("dueDate", "Due date cannot be before start date");
        }
    }
});

// Indexes for fast querying
ProjectSchema.index({ owner: 1, createdAt: -1 });
ProjectSchema.index({ status: 1 });

module.exports = mongoose.model("Project", ProjectSchema);
