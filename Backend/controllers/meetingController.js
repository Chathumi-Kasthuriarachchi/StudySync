const mongoose = require("mongoose");
const Meeting = require("../models/Meeting");
const Project = require("../models/Project");
const ProjectMembership = require("../models/ProjectMembership");
const User = require("../models/User");

/**
 * Meeting Controller
 *
 * CRUD operations for meetings with authorization enforcement:
 * - Organizer can always manage their meetings.
 * - If project-scoped, only active project members can view/participate.
 * - Participants can view meetings they belong to.
 */

/**
 * @desc    Create a new meeting
 * @route   POST /api/meetings
 * @access  Protected
 */
const createMeeting = async (req, res) => {
    try {
        const { title, description, startTime, endTime, meetingLink, location, participants, project, status } = req.body;

        if (!title || !startTime || !endTime) {
            return res.status(400).json({
                success: false,
                message: "Title, startTime, and endTime are required",
            });
        }

        // Validate time ordering
        if (new Date(endTime) <= new Date(startTime)) {
            return res.status(400).json({
                success: false,
                message: "End time must be after start time",
            });
        }

        // Validate participant IDs if provided
        let validParticipants = [];
        if (participants && Array.isArray(participants) && participants.length > 0) {
            const uniqueIds = [...new Set(participants.filter((id) => mongoose.Types.ObjectId.isValid(id)))];
            const existingUsers = await User.find({ _id: { $in: uniqueIds } }).select("_id");
            validParticipants = existingUsers.map((u) => u._id);
        }

        // If project is specified, validate membership
        if (project) {
            if (!mongoose.Types.ObjectId.isValid(project)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid project ID format",
                });
            }

            const projectDoc = await Project.findById(project);
            if (!projectDoc) {
                return res.status(404).json({
                    success: false,
                    message: "Project not found",
                });
            }

            const membership = await ProjectMembership.findOne({
                project: project,
                user: req.user._id,
            });

            if (!membership) {
                return res.status(403).json({
                    success: false,
                    message: "You must be a member of the project to create a meeting for it",
                });
            }
        }

        const meeting = await Meeting.create({
            title,
            description: description || "",
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            meetingLink: meetingLink || "",
            location: location || "",
            organizer: req.user._id,
            participants: validParticipants,
            project: project || null,
            status: status || "SCHEDULED",
        });

        const populated = await Meeting.findById(meeting._id)
            .populate("organizer", "_id name email profileImageURL")
            .populate("participants", "_id name email profileImageURL")
            .populate("project", "_id name");

        return res.status(201).json({
            success: true,
            message: "Meeting created successfully",
            data: populated,
        });
    } catch (err) {
        console.error("createMeeting error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to create meeting",
            error: err.message,
        });
    }
};

/**
 * @desc    Get meetings for the authenticated user
 * @route   GET /api/meetings
 * @access  Protected
 * @query   start, end, projectId, status
 */
const getMeetings = async (req, res) => {
    try {
        const { start, end, projectId, status } = req.query;
        const userId = req.user._id;

        // Build date filter
        const dateFilter = {};
        if (start) dateFilter.$gte = new Date(start);
        if (end) dateFilter.$lte = new Date(end);

        // Build base query: user is organizer OR participant
        const query = {
            $or: [
                { organizer: userId },
                { participants: userId },
            ],
        };

        // If filtering by project
        if (projectId) {
            if (!mongoose.Types.ObjectId.isValid(projectId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid project ID format",
                });
            }
            query.project = new mongoose.Types.ObjectId(projectId);
        }

        // Date range filter on startTime
        if (Object.keys(dateFilter).length > 0) {
            query.startTime = dateFilter;
        }

        // Status filter
        if (status && ["SCHEDULED", "COMPLETED", "CANCELLED"].includes(status)) {
            query.status = status;
        }

        const meetings = await Meeting.find(query)
            .populate("organizer", "_id name email profileImageURL")
            .populate("participants", "_id name email profileImageURL")
            .populate("project", "_id name")
            .sort({ startTime: 1 });

        return res.status(200).json({
            success: true,
            count: meetings.length,
            data: meetings,
        });
    } catch (err) {
        console.error("getMeetings error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve meetings",
            error: err.message,
        });
    }
};

/**
 * @desc    Get a single meeting by ID
 * @route   GET /api/meetings/:id
 * @access  Protected (organizer, participant, or project member)
 */
const getMeetingById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid meeting ID format",
            });
        }

        const meeting = await Meeting.findById(id)
            .populate("organizer", "_id name email profileImageURL")
            .populate("participants", "_id name email profileImageURL")
            .populate("project", "_id name");

        if (!meeting) {
            return res.status(404).json({
                success: false,
                message: "Meeting not found",
            });
        }

        // Authorization: organizer, participant, or project member
        const userId = req.user._id.toString();
        const isOrganizer = meeting.organizer._id.toString() === userId;
        const isParticipant = meeting.participants.some(
            (p) => p._id.toString() === userId
        );

        let isProjectMember = false;
        if (meeting.project) {
            const membership = await ProjectMembership.findOne({
                project: meeting.project._id,
                user: req.user._id,
            });
            isProjectMember = !!membership;
        }

        if (!isOrganizer && !isParticipant && !isProjectMember) {
            return res.status(403).json({
                success: false,
                message: "You do not have access to this meeting",
            });
        }

        return res.status(200).json({
            success: true,
            data: meeting,
        });
    } catch (err) {
        console.error("getMeetingById error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve meeting",
            error: err.message,
        });
    }
};

/**
 * @desc    Update a meeting
 * @route   PUT /api/meetings/:id
 * @access  Protected (organizer only)
 */
const updateMeeting = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid meeting ID format",
            });
        }

        const meeting = await Meeting.findById(id);
        if (!meeting) {
            return res.status(404).json({
                success: false,
                message: "Meeting not found",
            });
        }

        // Only the organizer can update
        if (!meeting.organizer.equals(req.user._id)) {
            return res.status(403).json({
                success: false,
                message: "Only the organizer can update this meeting",
            });
        }

        const { title, description, startTime, endTime, meetingLink, location, participants, project, status } = req.body;

        // Validate time ordering if both are provided
        const newStart = startTime ? new Date(startTime) : meeting.startTime;
        const newEnd = endTime ? new Date(endTime) : meeting.endTime;
        if (newEnd <= newStart) {
            return res.status(400).json({
                success: false,
                message: "End time must be after start time",
            });
        }

        // Validate participant IDs if provided
        if (participants && Array.isArray(participants)) {
            const uniqueIds = [...new Set(participants.filter((pid) => mongoose.Types.ObjectId.isValid(pid)))];
            const existingUsers = await User.find({ _id: { $in: uniqueIds } }).select("_id");
            meeting.participants = existingUsers.map((u) => u._id);
        }

        if (title !== undefined) meeting.title = title;
        if (description !== undefined) meeting.description = description;
        if (startTime) meeting.startTime = newStart;
        if (endTime) meeting.endTime = newEnd;
        if (meetingLink !== undefined) meeting.meetingLink = meetingLink;
        if (location !== undefined) meeting.location = location;
        if (project !== undefined) meeting.project = project || null;
        if (status && ["SCHEDULED", "COMPLETED", "CANCELLED"].includes(status)) {
            meeting.status = status;
        }

        await meeting.save();

        const populated = await Meeting.findById(meeting._id)
            .populate("organizer", "_id name email profileImageURL")
            .populate("participants", "_id name email profileImageURL")
            .populate("project", "_id name");

        return res.status(200).json({
            success: true,
            message: "Meeting updated successfully",
            data: populated,
        });
    } catch (err) {
        console.error("updateMeeting error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to update meeting",
            error: err.message,
        });
    }
};

/**
 * @desc    Delete a meeting
 * @route   DELETE /api/meetings/:id
 * @access  Protected (organizer only)
 */
const deleteMeeting = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid meeting ID format",
            });
        }

        const meeting = await Meeting.findById(id);
        if (!meeting) {
            return res.status(404).json({
                success: false,
                message: "Meeting not found",
            });
        }

        // Only the organizer can delete
        if (!meeting.organizer.equals(req.user._id)) {
            return res.status(403).json({
                success: false,
                message: "Only the organizer can delete this meeting",
            });
        }

        await Meeting.findByIdAndDelete(id);

        return res.status(200).json({
            success: true,
            message: "Meeting deleted successfully",
        });
    } catch (err) {
        console.error("deleteMeeting error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to delete meeting",
            error: err.message,
        });
    }
};

module.exports = {
    createMeeting,
    getMeetings,
    getMeetingById,
    updateMeeting,
    deleteMeeting,
};
