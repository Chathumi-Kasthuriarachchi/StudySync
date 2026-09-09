const mongoose = require("mongoose");

const ProjectInvitationSchema = new mongoose.Schema(
    {
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            required: [true, "Project reference is required"],
        },
        invitedUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "Invited user reference is required"],
        },
        invitedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "Inviter reference is required"],
        },
        role: {
            type: String,
            enum: {
                values: ["MANAGER", "MEMBER", "VIEWER"],
                message: "{VALUE} is not an invitable project role",
            },
            default: "MEMBER",
            required: true,
        },
        status: {
            type: String,
            enum: {
                values: ["PENDING", "ACCEPTED", "REJECTED", "EXPIRED"],
                message: "{VALUE} is not a valid invitation status",
            },
            default: "PENDING",
        },
        expiresAt: {
            type: Date,
            default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from creation
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
ProjectInvitationSchema.index({ project: 1, invitedUser: 1, status: 1 });
ProjectInvitationSchema.index({ invitedUser: 1, status: 1 });
ProjectInvitationSchema.index({ expiresAt: 1 });

module.exports = mongoose.model("ProjectInvitation", ProjectInvitationSchema);
