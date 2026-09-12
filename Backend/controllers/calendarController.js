const mongoose = require("mongoose");
const Task = require("../models/Task");
const Goal = require("../models/Goal");
const Meeting = require("../models/Meeting");
const ProjectMembership = require("../models/ProjectMembership");
const { calculateTaskUrgency } = require("../services/taskIntelligenceService");

/**
 * Calendar Controller
 *
 * Unified calendar endpoint that aggregates tasks and meetings into
 * normalized calendar items with Phase 7 task intelligence enrichment.
 *
 * Query Parameters:
 * - start (ISO8601): Range start date (required)
 * - end   (ISO8601): Range end date (required)
 * - type  : ALL | TASKS | MEETINGS | DEADLINES
 * - scope : ALL | PERSONAL | PROJECT
 * - projectId : Filter to a specific project
 */

/**
 * Normalize a task into a calendar item
 */
const normalizeTask = (task, intelligence) => {
    const isAllDay = !task.startDate || !task.dueDate ||
        (task.startDate && task.dueDate &&
            new Date(task.startDate).toDateString() !== new Date(task.dueDate).toDateString());

    return {
        id: `task_${task._id}`,
        sourceType: "task",
        sourceId: task._id,
        title: task.title,
        description: task.description || "",
        start: task.startDate || task.dueDate || task.createdAt,
        end: task.dueDate || task.startDate || task.createdAt,
        allDay: true, // Tasks are always treated as all-day items on the calendar
        category: task.project ? "PROJECT" : "PERSONAL",
        project: task.project ? { _id: task.project._id, name: task.project.name } : null,
        status: task.status,
        priority: task.priority,
        assignee: task.assignee ? {
            _id: task.assignee._id,
            name: task.assignee.name,
            email: task.assignee.email,
        } : null,
        organizer: null,
        participants: [],
        meetingLink: null,
        location: null,
        deadlineClassification: intelligence.deadlineStatus,
        urgencyScore: intelligence.urgencyScore,
        isAtRisk: intelligence.isAtRisk,
        reasons: intelligence.reasons,
        progress: intelligence.progress,
        subtasks: task.subtasks || [],
        tags: task.tags || [],
    };
};

/**
 * Normalize a task's due date into a deadline calendar item
 */
const normalizeDeadline = (task, intelligence) => {
    return {
        id: `deadline_${task._id}`,
        sourceType: "deadline",
        sourceId: task._id,
        title: `📅 ${task.title}`,
        description: task.description || "",
        start: task.dueDate,
        end: task.dueDate,
        allDay: true,
        category: task.project ? "PROJECT" : "PERSONAL",
        project: task.project ? { _id: task.project._id, name: task.project.name } : null,
        status: task.status,
        priority: task.priority,
        assignee: task.assignee ? {
            _id: task.assignee._id,
            name: task.assignee.name,
            email: task.assignee.email,
        } : null,
        organizer: null,
        participants: [],
        meetingLink: null,
        location: null,
        deadlineClassification: intelligence.deadlineStatus,
        urgencyScore: intelligence.urgencyScore,
        isAtRisk: intelligence.isAtRisk,
        reasons: intelligence.reasons,
        progress: intelligence.progress,
    };
};

/**
 * Normalize a meeting into a calendar item
 */
const normalizeMeeting = (meeting) => {
    return {
        id: `meeting_${meeting._id}`,
        sourceType: "meeting",
        sourceId: meeting._id,
        title: meeting.title,
        description: meeting.description || "",
        start: meeting.startTime,
        end: meeting.endTime,
        allDay: false,
        category: meeting.project ? "PROJECT" : "PERSONAL",
        project: meeting.project ? { _id: meeting.project._id, name: meeting.project.name } : null,
        status: meeting.status,
        priority: null,
        assignee: null,
        organizer: meeting.organizer ? {
            _id: meeting.organizer._id,
            name: meeting.organizer.name,
            email: meeting.organizer.email,
        } : null,
        participants: (meeting.participants || []).map((p) => ({
            _id: p._id,
            name: p.name,
            email: p.email,
        })),
        meetingLink: meeting.meetingLink || null,
        location: meeting.location || null,
        deadlineClassification: null,
        urgencyScore: null,
        isAtRisk: false,
        reasons: [],
    };
};

/**
 * Normalize a goal's target date into a deadline calendar item
 */
const normalizeGoalDeadline = (goal) => {
    return {
        id: `goal_${goal._id}`,
        sourceType: "goal_deadline",
        sourceId: goal._id,
        title: `🎯 ${goal.title}`,
        description: goal.description || "",
        start: goal.targetDate,
        end: goal.targetDate,
        allDay: true,
        category: goal.project ? "PROJECT" : "PERSONAL",
        project: goal.project ? { _id: goal.project._id, name: goal.project.name } : null,
        status: goal.status,
        priority: "HIGH",
        assignee: null,
        organizer: null,
        participants: [],
        meetingLink: null,
        location: null,
        deadlineClassification: null,
        urgencyScore: null,
        isAtRisk: false,
        reasons: [],
        progress: null,
        measurementType: goal.measurementType,
        targetValue: goal.targetValue,
    };
};

/**
 * @desc    Get unified calendar events (tasks + meetings + goal deadlines)
 * @route   GET /api/calendar
 * @access  Protected
 */
const getCalendarEvents = async (req, res) => {
    try {
        const { start, end, type = "ALL", scope = "ALL", projectId } = req.query;
        const userId = req.user._id;

        if (!start || !end) {
            return res.status(400).json({
                success: false,
                message: "Both 'start' and 'end' query parameters are required (ISO8601 format)",
            });
        }

        const rangeStart = new Date(start);
        const rangeEnd = new Date(end);

        if (isNaN(rangeStart.getTime()) || isNaN(rangeEnd.getTime())) {
            return res.status(400).json({
                success: false,
                message: "Invalid date format. Use ISO8601 (e.g. 2025-01-01T00:00:00.000Z)",
            });
        }

        const calendarItems = [];
        const includeType = type.toUpperCase();
        const includeScope = scope.toUpperCase();

        // ─── TASKS ────────────────────────────────────────────────────────────────
        if (includeType === "ALL" || includeType === "TASKS" || includeType === "DEADLINES") {
            // Get user's active project memberships
            const memberships = await ProjectMembership.find({ user: userId }).select("project");
            const userProjectIds = memberships.map((m) => m.project);

            // Build task query conditions
            const taskOrConditions = [];

            // Personal tasks (owned by user, no project)
            if (includeScope === "ALL" || includeScope === "PERSONAL") {
                taskOrConditions.push({ project: null, createdBy: userId });
            }

            // Project tasks assigned to the user
            if (includeScope === "ALL" || includeScope === "PROJECT") {
                if (projectId && mongoose.Types.ObjectId.isValid(projectId)) {
                    // Filter to specific project
                    if (userProjectIds.some((pid) => pid.toString() === projectId)) {
                        taskOrConditions.push({
                            project: new mongoose.Types.ObjectId(projectId),
                            assignee: userId,
                        });
                    }
                } else {
                    // All project tasks assigned to user
                    if (userProjectIds.length > 0) {
                        taskOrConditions.push({
                            project: { $in: userProjectIds },
                            assignee: userId,
                        });
                    }
                }
            }

            if (taskOrConditions.length > 0) {
                // Date filter: tasks with dueDate or startDate within range
                const taskDateFilter = {
                    $or: [
                        { dueDate: { $gte: rangeStart, $lte: rangeEnd } },
                        { startDate: { $gte: rangeStart, $lte: rangeEnd } },
                        // Multi-day: startDate before range end AND dueDate after range start
                        {
                            startDate: { $lte: rangeEnd },
                            dueDate: { $gte: rangeStart },
                        },
                    ],
                };

                const taskQuery = {
                    $and: [
                        { $or: taskOrConditions },
                        taskDateFilter,
                    ],
                };

                const tasks = await Task.find(taskQuery)
                    .populate("project", "_id name status")
                    .populate("assignee", "_id name email profileImageURL")
                    .populate("createdBy", "_id name email");

                for (const task of tasks) {
                    const intelligence = calculateTaskUrgency(task);

                    if (includeType === "ALL" || includeType === "TASKS") {
                        calendarItems.push(normalizeTask(task, intelligence));
                    }

                    // Add a separate deadline marker for tasks with due dates
                    if ((includeType === "ALL" || includeType === "DEADLINES") && task.dueDate) {
                        // Only add deadline if it's distinct from the task item
                        if (includeType === "DEADLINES") {
                            calendarItems.push(normalizeDeadline(task, intelligence));
                        }
                    }
                }
            }
        }

        // ─── MEETINGS ─────────────────────────────────────────────────────────────
        if (includeType === "ALL" || includeType === "MEETINGS") {
            const meetingOrConditions = [
                { organizer: userId },
                { participants: userId },
            ];

            // Also include project meetings where user is a member
            if (includeScope !== "PERSONAL") {
                const memberships = await ProjectMembership.find({ user: userId }).select("project");
                const userProjectIds = memberships.map((m) => m.project);

                if (projectId && mongoose.Types.ObjectId.isValid(projectId)) {
                    if (userProjectIds.some((pid) => pid.toString() === projectId)) {
                        meetingOrConditions.push({
                            project: new mongoose.Types.ObjectId(projectId),
                        });
                    }
                } else if (userProjectIds.length > 0) {
                    meetingOrConditions.push({
                        project: { $in: userProjectIds },
                    });
                }
            }

            const meetingQuery = {
                $or: meetingOrConditions,
                $and: [
                    {
                        $or: [
                            { startTime: { $gte: rangeStart, $lte: rangeEnd } },
                            { endTime: { $gte: rangeStart, $lte: rangeEnd } },
                            {
                                startTime: { $lte: rangeEnd },
                                endTime: { $gte: rangeStart },
                            },
                        ],
                    },
                ],
            };

            // Scope filter for meetings
            if (includeScope === "PERSONAL") {
                meetingQuery.project = null;
            } else if (includeScope === "PROJECT") {
                meetingQuery.project = { $ne: null };
            }

            const meetings = await Meeting.find(meetingQuery)
                .populate("organizer", "_id name email profileImageURL")
                .populate("participants", "_id name email profileImageURL")
                .populate("project", "_id name")
                .sort({ startTime: 1 });

            for (const meeting of meetings) {
                calendarItems.push(normalizeMeeting(meeting));
            }
        }

        // ─── GOAL DEADLINES ───────────────────────────────────────────────────────
        if (includeType === "ALL" || includeType === "GOALS" || includeType === "DEADLINES") {
            const goalOrConditions = [];

            if (includeScope === "ALL" || includeScope === "PERSONAL") {
                goalOrConditions.push({ project: null, owner: userId });
            }

            if (includeScope === "ALL" || includeScope === "PROJECT") {
                const memberships = await ProjectMembership.find({ user: userId }).select("project");
                const userProjectIds = memberships.map((m) => m.project);

                if (projectId && mongoose.Types.ObjectId.isValid(projectId)) {
                    if (userProjectIds.some((pid) => pid.toString() === projectId)) {
                        goalOrConditions.push({ project: new mongoose.Types.ObjectId(projectId) });
                    }
                } else if (userProjectIds.length > 0) {
                    goalOrConditions.push({ project: { $in: userProjectIds } });
                }
            }

            if (goalOrConditions.length > 0) {
                const goalQuery = {
                    $and: [
                        { $or: goalOrConditions },
                        { targetDate: { $gte: rangeStart, $lte: rangeEnd } },
                    ],
                };

                const goals = await Goal.find(goalQuery).populate("project", "_id name");
                for (const goal of goals) {
                    calendarItems.push(normalizeGoalDeadline(goal));
                }
            }
        }

        // Sort all items by start date
        calendarItems.sort((a, b) => new Date(a.start) - new Date(b.start));

        return res.status(200).json({
            success: true,
            count: calendarItems.length,
            data: calendarItems,
        });
    } catch (err) {
        console.error("getCalendarEvents error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve calendar events",
            error: err.message,
        });
    }
};

module.exports = {
    getCalendarEvents,
};
