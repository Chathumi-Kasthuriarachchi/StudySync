const mongoose = require("mongoose");
const Project = require("../models/Project");
const ProjectMembership = require("../models/ProjectMembership");
const User = require("../models/User");
const Task = require("../models/Task");
const { calculateMemberWorkload } = require("../services/taskIntelligenceService");

/**
 * getProjectMembers
 * GET /api/projects/:id/members
 *
 * Returns list of members with user details and project roles.
 */
const getProjectMembers = async (req, res) => {
    try {
        const members = await ProjectMembership.find({ project: req.project._id })
            .populate("user", "_id name email profileImageURL systemRole")
            .sort({ joinedAt: 1 });

        // Custom sort order: OWNER (1), MANAGER (2), MEMBER (3), VIEWER (4)
        const roleOrder = { OWNER: 1, MANAGER: 2, MEMBER: 3, VIEWER: 4 };
        const sortedMembers = members.sort(
            (a, b) => (roleOrder[a.role] || 99) - (roleOrder[b.role] || 99)
        );

        return res.status(200).json({
            success: true,
            count: sortedMembers.length,
            data: sortedMembers,
        });
    } catch (err) {
        console.error("getProjectMembers error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to get project members",
            error: err.message,
        });
    }
};

/**
 * addProjectMember
 * POST /api/projects/:id/members
 *
 * Direct add member (Requires OWNER or MANAGER).
 */
const addProjectMember = async (req, res) => {
    try {
        const { userId, role } = req.body;

        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: "Valid user ID is required",
            });
        }

        const validRoles = ["MANAGER", "MEMBER", "VIEWER"];
        const memberRole = role ? role.toUpperCase() : "MEMBER";

        if (!validRoles.includes(memberRole)) {
            return res.status(400).json({
                success: false,
                message: "Invalid role. Can only add members as MANAGER, MEMBER, or VIEWER",
            });
        }

        const targetUser = await User.findById(userId);
        if (!targetUser) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // Check if user is already a member
        const existingMembership = await ProjectMembership.findOne({
            project: req.project._id,
            user: userId,
        });

        if (existingMembership) {
            return res.status(400).json({
                success: false,
                message: "User is already a member of this project",
            });
        }

        const newMembership = await ProjectMembership.create({
            project: req.project._id,
            user: userId,
            role: memberRole,
        });

        const populated = await ProjectMembership.findById(newMembership._id).populate(
            "user",
            "_id name email profileImageURL"
        );

        return res.status(201).json({
            success: true,
            message: "Member added successfully",
            data: populated,
        });
    } catch (err) {
        console.error("addProjectMember error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to add project member",
            error: err.message,
        });
    }
};

/**
 * updateMemberRole
 * PUT /api/projects/:id/members/:userId
 *
 * Updates a member's role.
 * Requires role: OWNER or MANAGER.
 *
 * Security rules:
 * - MANAGER cannot change OWNER's role or another MANAGER's role.
 * - MANAGER cannot promote someone to OWNER.
 * - Only OWNER can transfer ownership to another member.
 */
const updateMemberRole = async (req, res) => {
    try {
        const { userId } = req.params;
        const { role } = req.body;

        if (!role) {
            return res.status(400).json({
                success: false,
                message: "Role is required",
            });
        }

        const newRole = role.toUpperCase();
        if (!["OWNER", "MANAGER", "MEMBER", "VIEWER"].includes(newRole)) {
            return res.status(400).json({
                success: false,
                message: "Invalid project role",
            });
        }

        const targetMembership = await ProjectMembership.findOne({
            project: req.project._id,
            user: userId,
        });

        if (!targetMembership) {
            return res.status(404).json({
                success: false,
                message: "Member not found in this project",
            });
        }

        const requesterRole = req.membership.role;

        // Rule 1: Cannot modify own role here (use transfer ownership or leave)
        if (userId === req.user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: "Cannot change your own role directly",
            });
        }

        // Rule 2: If target is currently OWNER, only OWNER can transfer ownership
        if (targetMembership.role === "OWNER") {
            return res.status(403).json({
                success: false,
                message: "Cannot change the role of the project owner",
            });
        }

        // Rule 3: If requester is MANAGER
        if (requesterRole === "MANAGER") {
            if (newRole === "OWNER") {
                return res.status(403).json({
                    success: false,
                    message: "Managers cannot transfer or assign the Owner role",
                });
            }
            if (targetMembership.role === "MANAGER") {
                return res.status(403).json({
                    success: false,
                    message: "Managers cannot modify the role of another Manager",
                });
            }
        }

        // Rule 4: Ownership transfer (when newRole === 'OWNER')
        if (newRole === "OWNER") {
            if (requesterRole !== "OWNER") {
                return res.status(403).json({
                    success: false,
                    message: "Only the current Project Owner can transfer ownership",
                });
            }

            // Transfer ownership:
            // 1. Current owner becomes MANAGER
            req.membership.role = "MANAGER";
            await req.membership.save();

            // 2. Target member becomes OWNER
            targetMembership.role = "OWNER";
            await targetMembership.save();

            // 3. Update Project.owner reference
            req.project.owner = targetMembership.user;
            await req.project.save();

            const populated = await ProjectMembership.findById(targetMembership._id).populate(
                "user",
                "_id name email profileImageURL"
            );

            return res.status(200).json({
                success: true,
                message: "Ownership transferred successfully. You are now a Manager.",
                data: populated,
            });
        }

        // Standard role update
        targetMembership.role = newRole;
        await targetMembership.save();

        const populated = await ProjectMembership.findById(targetMembership._id).populate(
            "user",
            "_id name email profileImageURL"
        );

        return res.status(200).json({
            success: true,
            message: `Member role updated to ${newRole}`,
            data: populated,
        });
    } catch (err) {
        console.error("updateMemberRole error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to update member role",
            error: err.message,
        });
    }
};

/**
 * removeProjectMember
 * DELETE /api/projects/:id/members/:userId
 *
 * Removes a member from the project or allows a user to leave.
 *
 * Security rules:
 * - OWNER cannot be removed (must delete project or transfer ownership first).
 * - A member removing themselves ("Leave Project") is allowed (except OWNER).
 * - If removing another member:
 *   - MANAGER cannot remove OWNER or another MANAGER.
 *   - OWNER can remove MANAGER, MEMBER, or VIEWER.
 */
const removeProjectMember = async (req, res) => {
    try {
        const { userId } = req.params;

        const targetMembership = await ProjectMembership.findOne({
            project: req.project._id,
            user: userId,
        });

        if (!targetMembership) {
            return res.status(404).json({
                success: false,
                message: "Member not found in this project",
            });
        }

        const isSelf = userId === req.user._id.toString();
        const requesterRole = req.membership.role;

        // OWNER cannot leave or be removed
        if (targetMembership.role === "OWNER") {
            return res.status(400).json({
                success: false,
                message: "Project Owner cannot leave or be removed. Transfer ownership or delete the project.",
            });
        }

        // If self-leaving, any non-owner member can leave
        if (isSelf) {
            await ProjectMembership.findByIdAndDelete(targetMembership._id);
            // Safe Member Removal: unassign any active tasks assigned to this member in this project
            await Task.updateMany(
                { project: req.project._id, assignee: targetMembership.user },
                { $set: { assignee: null } }
            );
            return res.status(200).json({
                success: true,
                message: "You have left the project",
            });
        }

        // If removing someone else, must be OWNER or MANAGER
        if (!["OWNER", "MANAGER"].includes(requesterRole)) {
            return res.status(403).json({
                success: false,
                message: "Permission denied. Only Owners and Managers can remove members.",
            });
        }

        // MANAGER cannot remove another MANAGER or OWNER
        if (requesterRole === "MANAGER" && targetMembership.role === "MANAGER") {
            return res.status(403).json({
                success: false,
                message: "Managers cannot remove another Manager",
            });
        }

        await ProjectMembership.findByIdAndDelete(targetMembership._id);

        // Safe Member Removal: unassign any active tasks assigned to this member in this project
        await Task.updateMany(
            { project: req.project._id, assignee: targetMembership.user },
            { $set: { assignee: null } }
        );

        return res.status(200).json({
            success: true,
            message: "Member removed from the project",
        });
    } catch (err) {
        console.error("removeProjectMember error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to remove member",
            error: err.message,
        });
    }
};

/**
 * getProjectWorkload
 * GET /api/projects/:id/workload
 * Protected by requireProjectMember.
 *
 * Computes workload metrics for all members of the project.
 */
const getProjectWorkload = async (req, res) => {
    try {
        const projectId = req.project._id;

        // Fetch all project members
        const memberships = await ProjectMembership.find({ project: projectId })
            .populate("user", "_id name email profileImageURL")
            .sort({ joinedAt: 1 });

        // Fetch all project tasks
        const tasks = await Task.find({ project: projectId }).select(
            "title status priority assignee dueDate subtasks"
        );

        // Group tasks by assignee
        const workload = memberships.map((m) => {
            const memberUser = m.user;
            const memberTasks = tasks.filter(
                (t) => t.assignee && t.assignee.toString() === memberUser._id.toString()
            );

            const totalAssigned = memberTasks.length;
            const completed = memberTasks.filter((t) => t.status === "COMPLETED").length;
            const inProgress = memberTasks.filter((t) => t.status === "IN_PROGRESS").length;
            const todo = memberTasks.filter((t) => t.status === "TODO").length;
            const activeAssigned = inProgress + todo;
            const completionPct = totalAssigned > 0 ? Math.round((completed / totalAssigned) * 100) : 0;
            const workloadMetric = calculateMemberWorkload(activeAssigned);

            return {
                member: {
                    _id: memberUser._id,
                    name: memberUser.name,
                    email: memberUser.email,
                    profileImageURL: memberUser.profileImageURL,
                    role: m.role,
                },
                totalAssigned,
                completed,
                inProgress,
                todo,
                activeAssigned,
                completionPct,
                workloadSignal: workloadMetric.workloadSignal,
                workloadLabel: workloadMetric.label,
            };
        });

        const unassignedTasks = tasks.filter((t) => !t.assignee).length;

        return res.status(200).json({
            success: true,
            data: {
                workload,
                unassignedTasks,
                totalProjectTasks: tasks.length,
            },
        });
    } catch (err) {
        console.error("getProjectWorkload error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to calculate project workload",
            error: err.message,
        });
    }
};

module.exports = {
    getProjectMembers,
    addProjectMember,
    updateMemberRole,
    removeProjectMember,
    getProjectWorkload,
};
