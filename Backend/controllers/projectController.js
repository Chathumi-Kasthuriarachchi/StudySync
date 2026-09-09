const mongoose = require("mongoose");
const Project = require("../models/Project");
const ProjectMembership = require("../models/ProjectMembership");
const ProjectInvitation = require("../models/ProjectInvitation");

/**
 * createProject
 * POST /api/projects
 *
 * Creates a new project and assigns the creator as OWNER in ProjectMembership.
 */
const createProject = async (req, res) => {
    try {
        const { name, description, startDate, dueDate, status } = req.body;

        // Validation
        if (!name || name.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: "Project name is required",
            });
        }

        if (!startDate || !dueDate) {
            return res.status(400).json({
                success: false,
                message: "Start date and due date are both required",
            });
        }

        const start = new Date(startDate);
        const due = new Date(dueDate);

        if (isNaN(start.getTime()) || isNaN(due.getTime())) {
            return res.status(400).json({
                success: false,
                message: "Invalid date format for start date or due date",
            });
        }

        if (due < start) {
            return res.status(400).json({
                success: false,
                message: "Due date cannot be before start date",
            });
        }

        // Create the Project
        const project = await Project.create({
            name: name.trim(),
            description: description ? description.trim() : "",
            owner: req.user._id,
            startDate: start,
            dueDate: due,
            status: status || "PLANNING",
        });

        // Automatically create the OWNER membership
        await ProjectMembership.create({
            project: project._id,
            user: req.user._id,
            role: "OWNER",
        });

        const populatedProject = await Project.findById(project._id).populate(
            "owner",
            "_id name email profileImageURL"
        );

        return res.status(201).json({
            success: true,
            message: "Project created successfully",
            data: {
                ...populatedProject.toObject(),
                userRole: "OWNER",
                memberCount: 1,
            },
        });
    } catch (err) {
        console.error("createProject error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to create project",
            error: err.message,
        });
    }
};

/**
 * getProjects
 * GET /api/projects
 *
 * Returns all projects where the authenticated user is a member.
 * Supports query params: ?status=ACTIVE&search=group
 */
const getProjects = async (req, res) => {
    try {
        const { status, search } = req.query;

        // Find all project memberships for this user
        const memberships = await ProjectMembership.find({
            user: req.user._id,
        });

        if (memberships.length === 0) {
            return res.status(200).json({
                success: true,
                count: 0,
                data: [],
            });
        }

        // Create a map from projectId to user's role
        const roleMap = {};
        const projectIds = memberships.map((m) => {
            roleMap[m.project.toString()] = m.role;
            return m.project;
        });

        // Query filter
        const filter = {
            _id: { $in: projectIds },
        };

        if (status && ["PLANNING", "ACTIVE", "COMPLETED", "ARCHIVED"].includes(status.toUpperCase())) {
            filter.status = status.toUpperCase();
        }

        if (search && search.trim().length > 0) {
            const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            filter.name = new RegExp(escaped, "i");
        }

        const projects = await Project.find(filter)
            .populate("owner", "_id name email profileImageURL")
            .sort({ updatedAt: -1 });

        // Aggregate member counts for these projects
        const memberCounts = await ProjectMembership.aggregate([
            { $match: { project: { $in: projectIds } } },
            { $group: { _id: "$project", count: { $sum: 1 } } },
        ]);

        const countMap = {};
        memberCounts.forEach((mc) => {
            countMap[mc._id.toString()] = mc.count;
        });

        // Enrich project objects with user's role and member count
        const enrichedProjects = projects.map((p) => {
            const pObj = p.toObject();
            return {
                ...pObj,
                userRole: roleMap[p._id.toString()] || "MEMBER",
                memberCount: countMap[p._id.toString()] || 1,
            };
        });

        return res.status(200).json({
            success: true,
            count: enrichedProjects.length,
            data: enrichedProjects,
        });
    } catch (err) {
        console.error("getProjects error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve projects",
            error: err.message,
        });
    }
};

/**
 * getProjectById
 * GET /api/projects/:id
 *
 * Returns detailed project info.
 * requireProjectMember middleware already verified membership.
 */
const getProjectById = async (req, res) => {
    try {
        const project = await Project.findById(req.project._id).populate(
            "owner",
            "_id name email profileImageURL"
        );

        const memberCount = await ProjectMembership.countDocuments({
            project: project._id,
        });

        return res.status(200).json({
            success: true,
            data: {
                ...project.toObject(),
                userRole: req.membership.role,
                joinedAt: req.membership.joinedAt,
                memberCount,
            },
        });
    } catch (err) {
        console.error("getProjectById error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to get project details",
            error: err.message,
        });
    }
};

/**
 * updateProject
 * PUT /api/projects/:id
 *
 * Updates project metadata.
 * Requires role: OWNER or MANAGER.
 */
const updateProject = async (req, res) => {
    try {
        const { name, description, startDate, dueDate, status } = req.body;
        const project = req.project;

        if (name !== undefined) {
            if (!name || name.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Project name cannot be empty",
                });
            }
            project.name = name.trim();
        }

        if (description !== undefined) {
            project.description = description ? description.trim() : "";
        }

        const newStart = startDate ? new Date(startDate) : project.startDate;
        const newDue = dueDate ? new Date(dueDate) : project.dueDate;

        if (startDate || dueDate) {
            if (isNaN(newStart.getTime()) || isNaN(newDue.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid date format for start date or due date",
                });
            }
            if (newDue < newStart) {
                return res.status(400).json({
                    success: false,
                    message: "Due date cannot be before start date",
                });
            }
            project.startDate = newStart;
            project.dueDate = newDue;
        }

        if (status !== undefined) {
            if (!["PLANNING", "ACTIVE", "COMPLETED", "ARCHIVED"].includes(status.toUpperCase())) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid status value. Must be PLANNING, ACTIVE, COMPLETED, or ARCHIVED",
                });
            }
            project.status = status.toUpperCase();
        }

        await project.save();

        const updated = await Project.findById(project._id).populate(
            "owner",
            "_id name email profileImageURL"
        );

        return res.status(200).json({
            success: true,
            message: "Project updated successfully",
            data: {
                ...updated.toObject(),
                userRole: req.membership.role,
            },
        });
    } catch (err) {
        console.error("updateProject error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to update project",
            error: err.message,
        });
    }
};

/**
 * deleteProject
 * DELETE /api/projects/:id
 *
 * Deletes the project and cleans up all memberships and invitations.
 * Requires role: OWNER only.
 */
const deleteProject = async (req, res) => {
    try {
        const projectId = req.project._id;

        // Cascade delete all memberships and invitations
        await Promise.all([
            Project.findByIdAndDelete(projectId),
            ProjectMembership.deleteMany({ project: projectId }),
            ProjectInvitation.deleteMany({ project: projectId }),
        ]);

        return res.status(200).json({
            success: true,
            message: "Project and associated memberships deleted successfully",
        });
    } catch (err) {
        console.error("deleteProject error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to delete project",
            error: err.message,
        });
    }
};

module.exports = {
    createProject,
    getProjects,
    getProjectById,
    updateProject,
    deleteProject,
};
