const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");
const Task = require("../models/Task");
const TimeSession = require("../models/TimeSession");
const Goal = require("../models/Goal");
const Project = require("../models/Project");
const ProjectMembership = require("../models/ProjectMembership");
const { parsePeriod, calculateMemberWorkload } = require("./analyticsService");

/**
 * reportService — Phase 14: Reports Module
 *
 * Provides data aggregation and document generation (CSV & PDF) for:
 * 1. Personal Productivity Report
 * 2. Project Report
 * 3. Team Report
 * 4. Task Detail Report
 */

/**
 * Generates personal productivity report for a user.
 */
const getPersonalProductivityReport = async (userId, options = {}) => {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const dateRange = parsePeriod(options.period, options.startDate, options.endDate);

    const memberships = await ProjectMembership.find({ user: userObjectId }).select("project");
    const userProjectIds = memberships.map((m) => m.project);

    // Tasks accessible to user
    const taskQuery = {
        $or: [
            { project: null, createdBy: userObjectId },
            { project: { $in: userProjectIds }, assignee: userObjectId },
        ],
    };

    // Apply date filtering to tasks if not 'all'
    if (dateRange.periodKey !== "all") {
        taskQuery.$and = [
            {
                $or: [
                    { createdAt: { $gte: dateRange.start, $lte: dateRange.end } },
                    { updatedAt: { $gte: dateRange.start, $lte: dateRange.end } },
                    { dueDate: { $gte: dateRange.start, $lte: dateRange.end } },
                ],
            },
        ];
    }

    const tasks = await Task.find(taskQuery)
        .populate("project", "_id name status")
        .sort({ dueDate: 1, createdAt: -1 });

    const now = new Date();
    let totalTasks = 0;
    let completedTasks = 0;
    let inProgressTasks = 0;
    let todoTasks = 0;
    let overdueTasks = 0;
    let personalTasks = 0;
    let projectTasks = 0;
    let totalSubtasks = 0;
    let completedSubtasks = 0;

    const byPriority = { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0 };
    const byStatus = { TODO: 0, IN_PROGRESS: 0, COMPLETED: 0 };

    tasks.forEach((t) => {
        totalTasks++;
        if (t.project) projectTasks++;
        else personalTasks++;

        if (t.status === "COMPLETED") {
            completedTasks++;
            byStatus.COMPLETED++;
        } else if (t.status === "IN_PROGRESS") {
            inProgressTasks++;
            byStatus.IN_PROGRESS++;
        } else {
            todoTasks++;
            byStatus.TODO++;
        }

        if (byPriority[t.priority] !== undefined) {
            byPriority[t.priority]++;
        }

        if (t.dueDate && new Date(t.dueDate) < now && t.status !== "COMPLETED") {
            overdueTasks++;
        }

        if (t.subtasks && t.subtasks.length > 0) {
            totalSubtasks += t.subtasks.length;
            completedSubtasks += t.subtasks.filter((st) => st.completed).length;
        }
    });

    const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const subtaskCompletionRate = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

    // Time Tracking for user
    const timeSessionQuery = {
        user: userObjectId,
        endedAt: { $ne: null },
    };
    if (dateRange.periodKey !== "all") {
        timeSessionQuery.endedAt = { $gte: dateRange.start, $lte: dateRange.end };
    }

    const sessions = await TimeSession.find(timeSessionQuery);
    let totalTrackedSeconds = 0;
    const taskTimeMap = {};

    sessions.forEach((s) => {
        const dur = Number(s.durationSeconds) || 0;
        totalTrackedSeconds += dur;
        if (s.task) {
            const tid = s.task.toString();
            taskTimeMap[tid] = (taskTimeMap[tid] || 0) + dur;
        }
    });

    const totalTrackedMinutes = Math.round(totalTrackedSeconds / 60);
    const totalTrackedHours = +(totalTrackedSeconds / 3600).toFixed(1);

    // Format tasks list for report
    const taskDetails = tasks.map((t) => {
        const subCount = t.subtasks ? t.subtasks.length : 0;
        const subDone = t.subtasks ? t.subtasks.filter((st) => st.completed).length : 0;
        const trackedSec = taskTimeMap[t._id.toString()] || 0;

        return {
            _id: t._id,
            title: t.title,
            type: t.project ? "PROJECT" : "PERSONAL",
            projectName: t.project?.name || "Personal Workspace",
            status: t.status,
            priority: t.priority,
            dueDate: t.dueDate,
            subtasksCount: subCount,
            subtasksCompleted: subDone,
            subtaskProgressPct: subCount > 0 ? Math.round((subDone / subCount) * 100) : (t.status === "COMPLETED" ? 100 : 0),
            trackedMinutes: Math.round(trackedSec / 60),
            estimatedMinutes: t.estimatedMinutes || 0,
            isOverdue: Boolean(t.dueDate && new Date(t.dueDate) < now && t.status !== "COMPLETED"),
            createdAt: t.createdAt,
        };
    });

    return {
        reportType: "PERSONAL_PRODUCTIVITY",
        title: "Personal Productivity Report",
        generatedAt: new Date(),
        period: {
            key: dateRange.periodKey,
            label: dateRange.label,
            start: dateRange.start,
            end: dateRange.end,
        },
        summary: {
            totalTasks,
            completedTasks,
            inProgressTasks,
            todoTasks,
            overdueTasks,
            completionPercentage,
            personalTasks,
            projectTasks,
            byPriority,
            byStatus,
            totalSubtasks,
            completedSubtasks,
            subtaskCompletionRate,
            totalTrackedSeconds,
            totalTrackedMinutes,
            totalTrackedHours,
            focusSessionsCount: sessions.length,
        },
        tasks: taskDetails,
    };
};

/**
 * Generates project report for a specific project.
 */
const getProjectReport = async (projectId, userId, options = {}) => {
    const projectObjectId = new mongoose.Types.ObjectId(projectId);
    const dateRange = parsePeriod(options.period, options.startDate, options.endDate);

    const project = await Project.findById(projectObjectId).populate("owner", "name email");
    if (!project) {
        const err = new Error("Project not found");
        err.statusCode = 404;
        throw err;
    }

    const memberships = await ProjectMembership.find({ project: projectObjectId })
        .populate("user", "_id name email profileImageURL role")
        .sort({ joinedAt: 1 });

    const tasks = await Task.find({ project: projectObjectId })
        .populate("assignee", "name email")
        .populate("goal", "title status")
        .sort({ dueDate: 1, createdAt: -1 });

    const now = new Date();
    let totalTasks = 0;
    let completedTasks = 0;
    let inProgressTasks = 0;
    let todoTasks = 0;
    let overdueTasks = 0;

    const byPriority = { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0 };
    const byStatus = { TODO: 0, IN_PROGRESS: 0, COMPLETED: 0 };

    tasks.forEach((t) => {
        totalTasks++;
        if (t.status === "COMPLETED") {
            completedTasks++;
            byStatus.COMPLETED++;
        } else if (t.status === "IN_PROGRESS") {
            inProgressTasks++;
            byStatus.IN_PROGRESS++;
        } else {
            todoTasks++;
            byStatus.TODO++;
        }

        if (byPriority[t.priority] !== undefined) {
            byPriority[t.priority]++;
        }

        if (t.dueDate && new Date(t.dueDate) < now && t.status !== "COMPLETED") {
            overdueTasks++;
        }
    });

    const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Timeline information
    let daysRemaining = null;
    let isOverdue = false;
    if (project.dueDate) {
        const diffMs = new Date(project.dueDate).getTime() - now.getTime();
        daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (daysRemaining < 0 && project.status !== "COMPLETED") {
            isOverdue = true;
        }
    }

    // Time tracked on project
    const sessionQuery = { project: projectObjectId, endedAt: { $ne: null } };
    if (dateRange.periodKey !== "all") {
        sessionQuery.endedAt = { $gte: dateRange.start, $lte: dateRange.end };
    }
    const sessions = await TimeSession.find(sessionQuery);

    let totalProjectTrackedSeconds = 0;
    const memberTimeMap = {};
    const taskTimeMap = {};

    sessions.forEach((s) => {
        const dur = Number(s.durationSeconds) || 0;
        totalProjectTrackedSeconds += dur;
        if (s.user) {
            const uid = s.user.toString();
            memberTimeMap[uid] = (memberTimeMap[uid] || 0) + dur;
        }
        if (s.task) {
            const tid = s.task.toString();
            taskTimeMap[tid] = (taskTimeMap[tid] || 0) + dur;
        }
    });

    // Linked project goals
    const projectGoals = await Goal.find({ project: projectObjectId });
    const goalSummary = projectGoals.map((g) => {
        const linkedTasks = tasks.filter((t) => t.goal && t.goal._id.toString() === g._id.toString());
        const completedLinked = linkedTasks.filter((t) => t.status === "COMPLETED").length;
        const progress = linkedTasks.length > 0 ? Math.round((completedLinked / linkedTasks.length) * 100) : (g.status === "COMPLETED" ? 100 : 0);
        return {
            _id: g._id,
            title: g.title,
            status: g.status,
            targetValue: g.targetValue,
            progressPercentage: progress,
            linkedTasksCount: linkedTasks.length,
            completedTasksCount: completedLinked,
        };
    });

    // Member contribution breakdown
    const memberContributions = memberships.map((m) => {
        const uid = m.user._id.toString();
        const memberTasks = tasks.filter((t) => t.assignee && t.assignee._id.toString() === uid);
        const assigned = memberTasks.length;
        const completed = memberTasks.filter((t) => t.status === "COMPLETED").length;
        const inProg = memberTasks.filter((t) => t.status === "IN_PROGRESS").length;
        const overdue = memberTasks.filter((t) => t.dueDate && new Date(t.dueDate) < now && t.status !== "COMPLETED").length;
        const timeSec = memberTimeMap[uid] || 0;

        return {
            member: {
                _id: m.user._id,
                name: m.user.name,
                email: m.user.email,
                role: m.role,
            },
            assignedTasks: assigned,
            completedTasks: completed,
            inProgressTasks: inProg,
            overdueTasks: overdue,
            completionRate: assigned > 0 ? Math.round((completed / assigned) * 100) : 0,
            trackedMinutes: Math.round(timeSec / 60),
            trackedHours: +(timeSec / 3600).toFixed(1),
        };
    });

    const taskDetails = tasks.map((t) => ({
        _id: t._id,
        title: t.title,
        assigneeName: t.assignee?.name || "Unassigned",
        assigneeEmail: t.assignee?.email || "",
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
        trackedMinutes: Math.round((taskTimeMap[t._id.toString()] || 0) / 60),
        estimatedMinutes: t.estimatedMinutes || 0,
        isOverdue: Boolean(t.dueDate && new Date(t.dueDate) < now && t.status !== "COMPLETED"),
    }));

    return {
        reportType: "PROJECT_REPORT",
        title: `Project Report: ${project.name}`,
        generatedAt: new Date(),
        period: {
            key: dateRange.periodKey,
            label: dateRange.label,
            start: dateRange.start,
            end: dateRange.end,
        },
        project: {
            _id: project._id,
            name: project.name,
            description: project.description,
            status: project.status,
            startDate: project.startDate,
            dueDate: project.dueDate,
            ownerName: project.owner?.name || "Unknown",
            timeline: {
                daysRemaining,
                isOverdue,
            },
        },
        summary: {
            totalTasks,
            completedTasks,
            inProgressTasks,
            todoTasks,
            overdueTasks,
            completionPercentage,
            byPriority,
            byStatus,
            totalMembers: memberships.length,
            totalProjectTrackedMinutes: Math.round(totalProjectTrackedSeconds / 60),
            totalProjectTrackedHours: +(totalProjectTrackedSeconds / 3600).toFixed(1),
        },
        goals: goalSummary,
        memberContributions,
        tasks: taskDetails,
    };
};

/**
 * Generates team workload report for a project.
 * Guarded by RBAC: only OWNER, MANAGER, MEMBER allowed. VIEWER is rejected.
 */
const getTeamReport = async (projectId, userId, options = {}) => {
    const projectObjectId = new mongoose.Types.ObjectId(projectId);
    const dateRange = parsePeriod(options.period, options.startDate, options.endDate);

    const project = await Project.findById(projectObjectId);
    if (!project) {
        const err = new Error("Project not found");
        err.statusCode = 404;
        throw err;
    }

    const memberships = await ProjectMembership.find({ project: projectObjectId })
        .populate("user", "_id name email profileImageURL")
        .sort({ joinedAt: 1 });

    const tasks = await Task.find({ project: projectObjectId });

    // Time sessions query
    const sessionQuery = { project: projectObjectId, endedAt: { $ne: null } };
    if (dateRange.periodKey !== "all") {
        sessionQuery.endedAt = { $gte: dateRange.start, $lte: dateRange.end };
    }
    const sessions = await TimeSession.find(sessionQuery);

    const memberTimeMap = {};
    let totalProjectTrackedSeconds = 0;

    sessions.forEach((s) => {
        if (s.user) {
            const uid = s.user.toString();
            const dur = Number(s.durationSeconds) || 0;
            memberTimeMap[uid] = (memberTimeMap[uid] || 0) + dur;
            totalProjectTrackedSeconds += dur;
        }
    });

    const now = new Date();

    const members = memberships.map((m) => {
        const uid = m.user._id.toString();
        const memberTasks = tasks.filter((t) => t.assignee && t.assignee.toString() === uid);

        const assigned = memberTasks.length;
        const completed = memberTasks.filter((t) => t.status === "COMPLETED").length;
        const inProgress = memberTasks.filter((t) => t.status === "IN_PROGRESS").length;
        const todo = memberTasks.filter((t) => t.status === "TODO").length;
        const activeTasks = inProgress + todo;

        const overdue = memberTasks.filter(
            (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== "COMPLETED"
        ).length;

        const completionRate = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;
        const workload = calculateMemberWorkload(activeTasks);
        const timeSec = memberTimeMap[uid] || 0;

        return {
            member: {
                _id: m.user._id,
                name: m.user.name,
                email: m.user.email,
                role: m.role,
                joinedAt: m.joinedAt,
            },
            assignedTasks: assigned,
            completedTasks: completed,
            inProgressTasks: inProgress,
            todoTasks: todo,
            activeTasks,
            overdueTasks: overdue,
            completionRate,
            workloadSignal: workload.workloadSignal,
            workloadLabel: workload.label,
            trackedSeconds: timeSec,
            trackedMinutes: Math.round(timeSec / 60),
            trackedHours: +(timeSec / 3600).toFixed(1),
        };
    });

    const unassignedTasks = tasks.filter((t) => !t.assignee).length;

    return {
        reportType: "TEAM_REPORT",
        title: `Team Report: ${project.name}`,
        generatedAt: new Date(),
        period: {
            key: dateRange.periodKey,
            label: dateRange.label,
            start: dateRange.start,
            end: dateRange.end,
        },
        project: {
            _id: project._id,
            name: project.name,
        },
        summary: {
            totalMembers: memberships.length,
            totalProjectTasks: tasks.length,
            unassignedTasks,
            totalProjectTrackedSeconds,
            totalProjectTrackedMinutes: Math.round(totalProjectTrackedSeconds / 60),
            totalProjectTrackedHours: +(totalProjectTrackedSeconds / 3600).toFixed(1),
        },
        members,
    };
};

/**
 * Generates task details report with flexible filters.
 */
const getTaskDetailReport = async (userId, options = {}) => {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const dateRange = parsePeriod(options.period, options.startDate, options.endDate);

    const memberships = await ProjectMembership.find({ user: userObjectId }).select("project");
    const userProjectIds = memberships.map((m) => m.project);

    const query = {};

    // Scope filtering
    if (options.scope === "personal") {
        query.project = null;
        query.createdBy = userObjectId;
    } else if (options.scope && mongoose.Types.ObjectId.isValid(options.scope)) {
        // Must belong to user's authorized projects
        const requestedProj = new mongoose.Types.ObjectId(options.scope);
        if (!userProjectIds.some((p) => p.equals(requestedProj))) {
            const err = new Error("Access denied to requested project tasks");
            err.statusCode = 403;
            throw err;
        }
        query.project = requestedProj;
    } else {
        // 'all' scope
        query.$or = [
            { project: null, createdBy: userObjectId },
            { project: { $in: userProjectIds } },
        ];
    }

    // Status filter
    if (options.status && ["TODO", "IN_PROGRESS", "COMPLETED"].includes(options.status)) {
        query.status = options.status;
    }

    // Priority filter
    if (options.priority && ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(options.priority)) {
        query.priority = options.priority;
    }

    // Date range
    if (dateRange.periodKey !== "all") {
        query.$and = query.$and || [];
        query.$and.push({
            $or: [
                { createdAt: { $gte: dateRange.start, $lte: dateRange.end } },
                { dueDate: { $gte: dateRange.start, $lte: dateRange.end } },
                { updatedAt: { $gte: dateRange.start, $lte: dateRange.end } },
            ],
        });
    }

    const tasks = await Task.find(query)
        .populate("project", "name status")
        .populate("assignee", "name email")
        .populate("createdBy", "name email")
        .sort({ dueDate: 1, createdAt: -1 });

    // Aggregate time spent on these tasks
    const taskIds = tasks.map((t) => t._id);
    const sessions = await TimeSession.find({ task: { $in: taskIds }, endedAt: { $ne: null } });

    const taskTimeMap = {};
    let totalTrackedSeconds = 0;

    sessions.forEach((s) => {
        const tid = s.task.toString();
        const dur = Number(s.durationSeconds) || 0;
        taskTimeMap[tid] = (taskTimeMap[tid] || 0) + dur;
        totalTrackedSeconds += dur;
    });

    const now = new Date();
    let completedCount = 0;
    let inProgressCount = 0;
    let todoCount = 0;
    let overdueCount = 0;

    const taskRows = tasks.map((t) => {
        if (t.status === "COMPLETED") completedCount++;
        else if (t.status === "IN_PROGRESS") inProgressCount++;
        else todoCount++;

        const isOverdue = Boolean(t.dueDate && new Date(t.dueDate) < now && t.status !== "COMPLETED");
        if (isOverdue) overdueCount++;

        const subCount = t.subtasks ? t.subtasks.length : 0;
        const subDone = t.subtasks ? t.subtasks.filter((st) => st.completed).length : 0;
        const trackedSec = taskTimeMap[t._id.toString()] || 0;

        return {
            _id: t._id,
            title: t.title,
            description: t.description || "",
            type: t.project ? "PROJECT" : "PERSONAL",
            projectName: t.project?.name || "Personal Workspace",
            assigneeName: t.assignee?.name || "Unassigned",
            assigneeEmail: t.assignee?.email || "",
            status: t.status,
            priority: t.priority,
            startDate: t.startDate,
            dueDate: t.dueDate,
            subtasksCount: subCount,
            subtasksCompleted: subDone,
            progressPct: t.progress || 0,
            trackedSeconds: trackedSec,
            trackedMinutes: Math.round(trackedSec / 60),
            estimatedMinutes: t.estimatedMinutes || 0,
            isOverdue,
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
        };
    });

    return {
        reportType: "TASK_DETAIL_REPORT",
        title: "Task Details Report",
        generatedAt: new Date(),
        period: {
            key: dateRange.periodKey,
            label: dateRange.label,
            start: dateRange.start,
            end: dateRange.end,
        },
        filters: {
            scope: options.scope || "all",
            status: options.status || "ALL",
            priority: options.priority || "ALL",
        },
        summary: {
            totalTasks: tasks.length,
            completedCount,
            inProgressCount,
            todoCount,
            overdueCount,
            totalTrackedMinutes: Math.round(totalTrackedSeconds / 60),
            totalTrackedHours: +(totalTrackedSeconds / 3600).toFixed(1),
        },
        tasks: taskRows,
    };
};

/**
 * Generates an RFC-4180 compliant CSV string from report data.
 */
const generateCSV = (reportType, data) => {
    const escapeCell = (val) => {
        if (val === null || val === undefined) return "";
        const str = String(val);
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const lines = [];

    // Header block
    lines.push([`StudySync Workspace Report: ${data.title || reportType}`]);
    lines.push([`Generated: ${new Date(data.generatedAt).toLocaleString()}`]);
    lines.push([`Period: ${data.period?.label || "All Time"}`]);
    lines.push([]); // blank line

    if (reportType === "PERSONAL_PRODUCTIVITY") {
        // Summary block
        lines.push(["--- SUMMARY METRICS ---"]);
        lines.push(["Total Tasks", data.summary.totalTasks]);
        lines.push(["Completed Tasks", data.summary.completedTasks]);
        lines.push(["In Progress", data.summary.inProgressTasks]);
        lines.push(["To Do", data.summary.todoTasks]);
        lines.push(["Overdue Tasks", data.summary.overdueTasks]);
        lines.push(["Completion Rate", `${data.summary.completionPercentage}%`]);
        lines.push(["Personal Tasks", data.summary.personalTasks]);
        lines.push(["Project Tasks", data.summary.projectTasks]);
        lines.push(["Total Subtasks", data.summary.totalSubtasks]);
        lines.push(["Subtask Completion Rate", `${data.summary.subtaskCompletionRate}%`]);
        lines.push(["Total Time Logged", `${data.summary.totalTrackedHours} hours (${data.summary.totalTrackedMinutes} mins)`]);
        lines.push(["Focus Sessions Count", data.summary.focusSessionsCount]);
        lines.push([]);

        // Data table
        lines.push(["--- TASK DETAILS ---"]);
        lines.push(["Task Title", "Type", "Project", "Status", "Priority", "Due Date", "Subtasks", "Time Spent (mins)", "Overdue?"]);
        data.tasks.forEach((t) => {
            lines.push([
                escapeCell(t.title),
                escapeCell(t.type),
                escapeCell(t.projectName),
                escapeCell(t.status),
                escapeCell(t.priority),
                escapeCell(t.dueDate ? new Date(t.dueDate).toISOString().split("T")[0] : "None"),
                escapeCell(`${t.subtasksCompleted}/${t.subtasksCount}`),
                escapeCell(t.trackedMinutes),
                escapeCell(t.isOverdue ? "YES" : "NO"),
            ]);
        });
    } else if (reportType === "PROJECT_REPORT") {
        lines.push(["--- PROJECT SUMMARY ---"]);
        lines.push(["Project Name", data.project.name]);
        lines.push(["Status", data.project.status]);
        lines.push(["Start Date", data.project.startDate ? new Date(data.project.startDate).toISOString().split("T")[0] : "N/A"]);
        lines.push(["Due Date", data.project.dueDate ? new Date(data.project.dueDate).toISOString().split("T")[0] : "N/A"]);
        lines.push(["Project Completion", `${data.summary.completionPercentage}%`]);
        lines.push(["Total Tasks", data.summary.totalTasks]);
        lines.push(["Completed", data.summary.completedTasks]);
        lines.push(["In Progress", data.summary.inProgressTasks]);
        lines.push(["Overdue", data.summary.overdueTasks]);
        lines.push(["Total Time Tracked", `${data.summary.totalProjectTrackedHours} hours`]);
        lines.push([]);

        // Goals table
        if (data.goals && data.goals.length > 0) {
            lines.push(["--- LINKED GOALS ---"]);
            lines.push(["Goal Title", "Status", "Progress", "Linked Tasks", "Completed Tasks"]);
            data.goals.forEach((g) => {
                lines.push([
                    escapeCell(g.title),
                    escapeCell(g.status),
                    escapeCell(`${g.progressPercentage}%`),
                    escapeCell(g.linkedTasksCount),
                    escapeCell(g.completedTasksCount),
                ]);
            });
            lines.push([]);
        }

        // Member contributions
        lines.push(["--- TEAM CONTRIBUTIONS ---"]);
        lines.push(["Member Name", "Email", "Role", "Assigned Tasks", "Completed", "In Progress", "Overdue", "Completion Rate", "Time Spent (mins)"]);
        data.memberContributions.forEach((m) => {
            lines.push([
                escapeCell(m.member.name),
                escapeCell(m.member.email),
                escapeCell(m.member.role),
                escapeCell(m.assignedTasks),
                escapeCell(m.completedTasks),
                escapeCell(m.inProgressTasks),
                escapeCell(m.overdueTasks),
                escapeCell(`${m.completionRate}%`),
                escapeCell(m.trackedMinutes),
            ]);
        });
        lines.push([]);

        // Tasks list
        lines.push(["--- PROJECT TASKS ---"]);
        lines.push(["Title", "Assignee", "Status", "Priority", "Due Date", "Time Spent (mins)", "Overdue?"]);
        data.tasks.forEach((t) => {
            lines.push([
                escapeCell(t.title),
                escapeCell(t.assigneeName),
                escapeCell(t.status),
                escapeCell(t.priority),
                escapeCell(t.dueDate ? new Date(t.dueDate).toISOString().split("T")[0] : "None"),
                escapeCell(t.trackedMinutes),
                escapeCell(t.isOverdue ? "YES" : "NO"),
            ]);
        });
    } else if (reportType === "TEAM_REPORT") {
        lines.push(["--- TEAM WORKLOAD SUMMARY ---"]);
        lines.push(["Project Name", data.project.name]);
        lines.push(["Total Members", data.summary.totalMembers]);
        lines.push(["Total Tasks", data.summary.totalProjectTasks]);
        lines.push(["Unassigned Tasks", data.summary.unassignedTasks]);
        lines.push(["Total Time Spent", `${data.summary.totalProjectTrackedHours} hours`]);
        lines.push([]);

        lines.push(["--- MEMBER WORKLOAD & PERFORMANCE ---"]);
        lines.push(["Member Name", "Email", "Role", "Active Tasks", "Assigned", "Completed", "Overdue", "Completion Rate", "Workload Signal", "Time Spent (mins)"]);
        data.members.forEach((m) => {
            lines.push([
                escapeCell(m.member.name),
                escapeCell(m.member.email),
                escapeCell(m.member.role),
                escapeCell(m.activeTasks),
                escapeCell(m.assignedTasks),
                escapeCell(m.completedTasks),
                escapeCell(m.overdueTasks),
                escapeCell(`${m.completionRate}%`),
                escapeCell(m.workloadSignal),
                escapeCell(m.trackedMinutes),
            ]);
        });
    } else if (reportType === "TASK_DETAIL_REPORT") {
        lines.push(["--- TASK REPORT SUMMARY ---"]);
        lines.push(["Total Tasks", data.summary.totalTasks]);
        lines.push(["Completed", data.summary.completedCount]);
        lines.push(["In Progress", data.summary.inProgressCount]);
        lines.push(["To Do", data.summary.todoCount]);
        lines.push(["Overdue", data.summary.overdueCount]);
        lines.push(["Total Time Spent", `${data.summary.totalTrackedHours} hours`]);
        lines.push([]);

        lines.push(["--- DETAILED TASKS ---"]);
        lines.push(["Title", "Description", "Type", "Project", "Assignee", "Status", "Priority", "Start Date", "Due Date", "Subtasks", "Time Spent (mins)"]);
        data.tasks.forEach((t) => {
            lines.push([
                escapeCell(t.title),
                escapeCell(t.description),
                escapeCell(t.type),
                escapeCell(t.projectName),
                escapeCell(t.assigneeName),
                escapeCell(t.status),
                escapeCell(t.priority),
                escapeCell(t.startDate ? new Date(t.startDate).toISOString().split("T")[0] : "N/A"),
                escapeCell(t.dueDate ? new Date(t.dueDate).toISOString().split("T")[0] : "None"),
                escapeCell(`${t.subtasksCompleted}/${t.subtasksCount}`),
                escapeCell(t.trackedMinutes),
            ]);
        });
    }

    return lines.map((row) => row.join(",")).join("\r\n");
};

/**
 * Generates a clean, branded PDF report document using PDFKit.
 * Streams output directly into the Express response object.
 */
const generatePDF = (reportType, data, res) => {
    const doc = new PDFDocument({
        size: "A4",
        margin: 40,
        info: {
            Title: `StudySync — ${data.title}`,
            Author: "StudySync Workspace",
        },
    });

    doc.pipe(res);

    // Palette
    const powderColor = "#0284c7"; // powder-600
    const mintColor = "#059669";   // mint-600
    const darkSlate = "#0f172a";   // slate-900
    const mutedSlate = "#64748b";  // slate-500
    const lightBg = "#f8fafc";     // slate-50

    // Header Banner
    doc.rect(40, 40, 515, 60).fill(lightBg);
    doc.fillColor(powderColor).fontSize(18).font("Helvetica-Bold").text("StudySync", 55, 52);
    doc.fillColor(darkSlate).fontSize(14).font("Helvetica-Bold").text(data.title, 55, 75);
    doc.fillColor(mutedSlate).fontSize(9).font("Helvetica").text(
        `Generated: ${new Date(data.generatedAt).toLocaleString()}  |  Period: ${data.period?.label || "All Time"}`,
        300,
        55,
        { align: "right", width: 240 }
    );

    doc.moveDown(3);

    // Summary Box
    doc.fillColor(darkSlate).fontSize(12).font("Helvetica-Bold").text("Executive Summary", 40, 115);
    doc.rect(40, 130, 515, 60).strokeColor("#e2e8f0").stroke();

    const sum = data.summary;
    let colX = 50;
    if (reportType === "PERSONAL_PRODUCTIVITY") {
        doc.fontSize(8).fillColor(mutedSlate).text("COMPLETION RATE", colX, 140);
        doc.fontSize(14).fillColor(mintColor).font("Helvetica-Bold").text(`${sum.completionPercentage}%`, colX, 155);

        colX += 100;
        doc.fontSize(8).fillColor(mutedSlate).font("Helvetica").text("TOTAL TASKS", colX, 140);
        doc.fontSize(14).fillColor(darkSlate).font("Helvetica-Bold").text(`${sum.totalTasks}`, colX, 155);

        colX += 90;
        doc.fontSize(8).fillColor(mutedSlate).font("Helvetica").text("COMPLETED", colX, 140);
        doc.fontSize(14).fillColor(powderColor).font("Helvetica-Bold").text(`${sum.completedTasks}`, colX, 155);

        colX += 80;
        doc.fontSize(8).fillColor(mutedSlate).font("Helvetica").text("OVERDUE", colX, 140);
        doc.fontSize(14).fillColor(sum.overdueTasks > 0 ? "#e11d48" : darkSlate).font("Helvetica-Bold").text(`${sum.overdueTasks}`, colX, 155);

        colX += 80;
        doc.fontSize(8).fillColor(mutedSlate).font("Helvetica").text("TIME LOGGED", colX, 140);
        doc.fontSize(14).fillColor(darkSlate).font("Helvetica-Bold").text(`${sum.totalTrackedHours}h`, colX, 155);
    } else if (reportType === "PROJECT_REPORT") {
        doc.fontSize(8).fillColor(mutedSlate).text("PROJECT PROGRESS", colX, 140);
        doc.fontSize(14).fillColor(mintColor).font("Helvetica-Bold").text(`${sum.completionPercentage}%`, colX, 155);

        colX += 110;
        doc.fontSize(8).fillColor(mutedSlate).font("Helvetica").text("STATUS", colX, 140);
        doc.fontSize(14).fillColor(darkSlate).font("Helvetica-Bold").text(`${data.project.status}`, colX, 155);

        colX += 90;
        doc.fontSize(8).fillColor(mutedSlate).font("Helvetica").text("TOTAL TASKS", colX, 140);
        doc.fontSize(14).fillColor(powderColor).font("Helvetica-Bold").text(`${sum.totalTasks}`, colX, 155);

        colX += 90;
        doc.fontSize(8).fillColor(mutedSlate).font("Helvetica").text("MEMBERS", colX, 140);
        doc.fontSize(14).fillColor(darkSlate).font("Helvetica-Bold").text(`${sum.totalMembers}`, colX, 155);

        colX += 80;
        doc.fontSize(8).fillColor(mutedSlate).font("Helvetica").text("TIME SPENT", colX, 140);
        doc.fontSize(14).fillColor(darkSlate).font("Helvetica-Bold").text(`${sum.totalProjectTrackedHours}h`, colX, 155);
    } else if (reportType === "TEAM_REPORT") {
        doc.fontSize(8).fillColor(mutedSlate).text("TOTAL MEMBERS", colX, 140);
        doc.fontSize(14).fillColor(darkSlate).font("Helvetica-Bold").text(`${sum.totalMembers}`, colX, 155);

        colX += 110;
        doc.fontSize(8).fillColor(mutedSlate).font("Helvetica").text("TOTAL TASKS", colX, 140);
        doc.fontSize(14).fillColor(powderColor).font("Helvetica-Bold").text(`${sum.totalProjectTasks}`, colX, 155);

        colX += 110;
        doc.fontSize(8).fillColor(mutedSlate).font("Helvetica").text("UNASSIGNED", colX, 140);
        doc.fontSize(14).fillColor(sum.unassignedTasks > 0 ? "#f59e0b" : darkSlate).font("Helvetica-Bold").text(`${sum.unassignedTasks}`, colX, 155);

        colX += 110;
        doc.fontSize(8).fillColor(mutedSlate).font("Helvetica").text("TOTAL TIME", colX, 140);
        doc.fontSize(14).fillColor(mintColor).font("Helvetica-Bold").text(`${sum.totalProjectTrackedHours}h`, colX, 155);
    } else {
        doc.fontSize(8).fillColor(mutedSlate).text("FILTERED TASKS", colX, 140);
        doc.fontSize(14).fillColor(darkSlate).font("Helvetica-Bold").text(`${sum.totalTasks}`, colX, 155);

        colX += 110;
        doc.fontSize(8).fillColor(mutedSlate).font("Helvetica").text("COMPLETED", colX, 140);
        doc.fontSize(14).fillColor(mintColor).font("Helvetica-Bold").text(`${sum.completedCount}`, colX, 155);

        colX += 100;
        doc.fontSize(8).fillColor(mutedSlate).font("Helvetica").text("IN PROGRESS", colX, 140);
        doc.fontSize(14).fillColor(powderColor).font("Helvetica-Bold").text(`${sum.inProgressCount}`, colX, 155);

        colX += 100;
        doc.fontSize(8).fillColor(mutedSlate).font("Helvetica").text("OVERDUE", colX, 140);
        doc.fontSize(14).fillColor(sum.overdueCount > 0 ? "#e11d48" : darkSlate).font("Helvetica-Bold").text(`${sum.overdueCount}`, colX, 155);
    }

    // Records Section
    doc.y = 210;
    doc.fillColor(darkSlate).fontSize(12).font("Helvetica-Bold").text("Detailed Records", 40, doc.y);

    let startY = doc.y + 15;

    if (reportType === "TEAM_REPORT") {
        // Table Header
        doc.rect(40, startY, 515, 20).fill("#f1f5f9");
        doc.fillColor(darkSlate).fontSize(8).font("Helvetica-Bold");
        doc.text("Member", 45, startY + 6);
        doc.text("Role", 160, startY + 6);
        doc.text("Assigned", 220, startY + 6);
        doc.text("Completed", 280, startY + 6);
        doc.text("Overdue", 340, startY + 6);
        doc.text("Rate", 395, startY + 6);
        doc.text("Signal", 440, startY + 6);
        doc.text("Time (h)", 495, startY + 6);

        let rowY = startY + 22;
        data.members.forEach((m) => {
            if (rowY > 750) {
                doc.addPage();
                rowY = 50;
            }
            doc.font("Helvetica").fontSize(8).fillColor(darkSlate);
            doc.text(m.member.name.substring(0, 20), 45, rowY);
            doc.text(m.member.role, 160, rowY);
            doc.text(String(m.assignedTasks), 220, rowY);
            doc.text(String(m.completedTasks), 280, rowY);
            doc.text(String(m.overdueTasks), 340, rowY);
            doc.text(`${m.completionRate}%`, 395, rowY);
            doc.text(m.workloadSignal, 440, rowY);
            doc.text(String(m.trackedHours), 495, rowY);

            doc.moveTo(40, rowY + 12).lineTo(555, rowY + 12).strokeColor("#f1f5f9").stroke();
            rowY += 16;
        });
    } else {
        // Table Header for Tasks
        doc.rect(40, startY, 515, 20).fill("#f1f5f9");
        doc.fillColor(darkSlate).fontSize(8).font("Helvetica-Bold");
        doc.text("Task Title", 45, startY + 6);
        doc.text("Status", 230, startY + 6);
        doc.text("Priority", 310, startY + 6);
        doc.text("Due Date", 380, startY + 6);
        doc.text("Subtasks", 440, startY + 6);
        doc.text("Time", 500, startY + 6);

        let rowY = startY + 22;
        const taskList = data.tasks || [];
        taskList.forEach((t) => {
            if (rowY > 750) {
                doc.addPage();
                rowY = 50;
            }
            doc.font("Helvetica").fontSize(8).fillColor(darkSlate);
            doc.text((t.title || "").substring(0, 32), 45, rowY);
            doc.text(t.status, 230, rowY);
            doc.text(t.priority, 310, rowY);
            doc.text(t.dueDate ? new Date(t.dueDate).toISOString().split("T")[0] : "-", 380, rowY);
            doc.text(`${t.subtasksCompleted || 0}/${t.subtasksCount || 0}`, 440, rowY);
            doc.text(`${t.trackedMinutes || 0}m`, 500, rowY);

            doc.moveTo(40, rowY + 12).lineTo(555, rowY + 12).strokeColor("#f1f5f9").stroke();
            rowY += 16;
        });
    }

    doc.end();
};

module.exports = {
    getPersonalProductivityReport,
    getProjectReport,
    getTeamReport,
    getTaskDetailReport,
    generateCSV,
    generatePDF,
};
