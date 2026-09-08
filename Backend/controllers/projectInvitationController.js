const mongoose = require("mongoose");
const Project = require("../models/Project");
const ProjectMembership = require("../models/ProjectMembership");
const ProjectInvitation = require("../models/ProjectInvitation");
const User = require("../models/User");

/**
 * inviteUser
 * POST /api/projects/:id/invitations
 *
 * Sends a project invitation to a user by email or userId.
 * Requires role: OWNER or MANAGER.
 */
const inviteUser = async (req, res) => {
    try {
        const { email, userId, role } = req.body;

        if (!email && !userId) {
            return res.status(400).json({
                success: false,
                message: "Please provide either an email or user ID to invite",
            });
        }

        // Find target user
        let targetUser;
        if (userId && mongoose.Types.ObjectId.isValid(userId)) {
            targetUser = await User.findById(userId);
        } else if (email) {
            targetUser = await User.findOne({ email: email.toLowerCase().trim() });
        }

        if (!targetUser) {
            return res.status(404).json({
                success: false,
                message: "No user found with the provided email or ID",
            });
        }

        // Cannot invite yourself
        if (targetUser._id.toString() === req.user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: "You cannot invite yourself to a project",
            });
        }

        // Check if already a member
        const existingMembership = await ProjectMembership.findOne({
            project: req.project._id,
            user: targetUser._id,
        });

        if (existingMembership) {
            return res.status(400).json({
                success: false,
                message: `${targetUser.name || "This user"} is already a member of this project`,
            });
        }

        // Check if a pending, unexpired invitation already exists
        const existingInvitation = await ProjectInvitation.findOne({
            project: req.project._id,
            invitedUser: targetUser._id,
            status: "PENDING",
            expiresAt: { $gt: new Date() },
        });

        if (existingInvitation) {
            return res.status(400).json({
                success: false,
                message: "A pending invitation has already been sent to this user",
            });
        }

        // Validate role
        const targetRole = role ? role.toUpperCase() : "MEMBER";
        if (!["MANAGER", "MEMBER", "VIEWER"].includes(targetRole)) {
            return res.status(400).json({
                success: false,
                message: "Invited role must be MANAGER, MEMBER, or VIEWER",
            });
        }

        // Create the invitation (expires in 7 days)
        const invitation = await ProjectInvitation.create({
            project: req.project._id,
            invitedUser: targetUser._id,
            invitedBy: req.user._id,
            role: targetRole,
            status: "PENDING",
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        const populated = await ProjectInvitation.findById(invitation._id)
            .populate("invitedUser", "_id name email profileImageURL")
            .populate("invitedBy", "_id name email");

        return res.status(201).json({
            success: true,
            message: `Invitation sent to ${targetUser.name || targetUser.email}`,
            data: populated,
        });
    } catch (err) {
        console.error("inviteUser error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to send invitation",
            error: err.message,
        });
    }
};

/**
 * getProjectInvitations
 * GET /api/projects/:id/invitations
 *
 * Lists pending invitations for a specific project.
 * Requires role: OWNER or MANAGER.
 */
const getProjectInvitations = async (req, res) => {
    try {
        const invitations = await ProjectInvitation.find({
            project: req.project._id,
            status: "PENDING",
            expiresAt: { $gt: new Date() },
        })
            .populate("invitedUser", "_id name email profileImageURL")
            .populate("invitedBy", "_id name email")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: invitations.length,
            data: invitations,
        });
    } catch (err) {
        console.error("getProjectInvitations error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to get project invitations",
            error: err.message,
        });
    }
};

/**
 * cancelInvitation
 * DELETE /api/projects/:id/invitations/:invitationId
 *
 * Cancels a pending invitation for a project.
 * Requires role: OWNER or MANAGER.
 */
const cancelInvitation = async (req, res) => {
    try {
        const { invitationId } = req.params;

        const invitation = await ProjectInvitation.findOne({
            _id: invitationId,
            project: req.project._id,
        });

        if (!invitation) {
            return res.status(404).json({
                success: false,
                message: "Invitation not found",
            });
        }

        await ProjectInvitation.findByIdAndDelete(invitationId);

        return res.status(200).json({
            success: true,
            message: "Invitation cancelled",
        });
    } catch (err) {
        console.error("cancelInvitation error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to cancel invitation",
            error: err.message,
        });
    }
};

/**
 * getMyInvitations
 * GET /api/projects/invitations/my
 *
 * Retrieves all pending invitations sent to the authenticated user.
 */
const getMyInvitations = async (req, res) => {
    try {
        const invitations = await ProjectInvitation.find({
            invitedUser: req.user._id,
            status: "PENDING",
            expiresAt: { $gt: new Date() },
        })
            .populate("project", "_id name description status startDate dueDate owner")
            .populate("invitedBy", "_id name email profileImageURL")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: invitations.length,
            data: invitations,
        });
    } catch (err) {
        console.error("getMyInvitations error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve invitations",
            error: err.message,
        });
    }
};

/**
 * acceptInvitation
 * POST /api/projects/invitations/:invitationId/accept
 *
 * Accepts an invitation and adds user as a member.
 */
const acceptInvitation = async (req, res) => {
    try {
        const { invitationId } = req.params;

        const invitation = await ProjectInvitation.findOne({
            _id: invitationId,
            invitedUser: req.user._id,
        }).populate("project");

        if (!invitation) {
            return res.status(404).json({
                success: false,
                message: "Invitation not found",
            });
        }

        if (invitation.status !== "PENDING") {
            return res.status(400).json({
                success: false,
                message: `Invitation has already been ${invitation.status.toLowerCase()}`,
            });
        }

        if (invitation.expiresAt < new Date()) {
            invitation.status = "EXPIRED";
            await invitation.save();
            return res.status(400).json({
                success: false,
                message: "This invitation has expired",
            });
        }

        // Check if already a member
        let membership = await ProjectMembership.findOne({
            project: invitation.project._id,
            user: req.user._id,
        });

        if (!membership) {
            membership = await ProjectMembership.create({
                project: invitation.project._id,
                user: req.user._id,
                role: invitation.role,
            });
        }

        invitation.status = "ACCEPTED";
        await invitation.save();

        return res.status(200).json({
            success: true,
            message: `Invitation accepted! You joined as ${invitation.role}`,
            data: {
                project: invitation.project,
                role: invitation.role,
            },
        });
    } catch (err) {
        console.error("acceptInvitation error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to accept invitation",
            error: err.message,
        });
    }
};

/**
 * rejectInvitation
 * POST /api/projects/invitations/:invitationId/reject
 *
 * Rejects a pending invitation.
 */
const rejectInvitation = async (req, res) => {
    try {
        const { invitationId } = req.params;

        const invitation = await ProjectInvitation.findOne({
            _id: invitationId,
            invitedUser: req.user._id,
        });

        if (!invitation) {
            return res.status(404).json({
                success: false,
                message: "Invitation not found",
            });
        }

        if (invitation.status !== "PENDING") {
            return res.status(400).json({
                success: false,
                message: `Invitation has already been ${invitation.status.toLowerCase()}`,
            });
        }

        invitation.status = "REJECTED";
        await invitation.save();

        return res.status(200).json({
            success: true,
            message: "Invitation declined",
        });
    } catch (err) {
        console.error("rejectInvitation error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to decline invitation",
            error: err.message,
        });
    }
};

module.exports = {
    inviteUser,
    getProjectInvitations,
    cancelInvitation,
    getMyInvitations,
    acceptInvitation,
    rejectInvitation,
};
