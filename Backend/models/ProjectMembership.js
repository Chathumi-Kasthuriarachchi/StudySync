const mongoose = require("mongoose");

const ProjectMembershipSchema = new mongoose.Schema(
    {
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            required: [true, "Project reference is required"],
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "User reference is required"],
        },
        role: {
            type: String,
            enum: {
                values: ["OWNER", "MANAGER", "MEMBER", "VIEWER"],
                message: "{VALUE} is not a valid project role",
            },
            default: "MEMBER",
            required: [true, "Project role is required"],
        },
        joinedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

// Compound unique index: a user can only have one membership per project
ProjectMembershipSchema.index({ project: 1, user: 1 }, { unique: true });

// Query indexes
ProjectMembershipSchema.index({ user: 1, role: 1 });
ProjectMembershipSchema.index({ project: 1, role: 1 });

module.exports = mongoose.model("ProjectMembership", ProjectMembershipSchema);
