const mongoose = require("mongoose");
const Task = require("../models/Task");
const TimeSession = require("../models/TimeSession");
const Goal = require("../models/Goal");
const Project = require("../models/Project");
const ProjectMembership = require("../models/ProjectMembership");
const TaskActivity = require("../models/TaskActivity");

/**
 * analyticsService — Phase 12
 *
 * Provides aggregated, performant, and secure analytics across:
 * 1. Personal Analytics (task productivity, time/focus, completion trends, goals)
 * 2. Project Analytics (progress, distribution, velocity, time tracking)
 * 3. Team Analytics (member workload, contribution, time spent, RBAC guarded)
 */

/**
 * Normalizes date bounds according to period filter or custom date range.
 * Supported periods: 'today', 'this_week' / 'week', 'this_month' / 'month', 'last_30_days' / '30days', 'all'
 *
 * @param {string} [period='this_month']
 * @param {string|Date} [customStart]
 * @param {string|Date} [customEnd]
 * @returns {{ start: Date, end: Date, periodKey: string, label: string }}
 */
const parsePeriod = (period = "this_month", customStart = null, customEnd = null) => {
    const now = new Date();
    const end = customEnd ? new Date(customEnd) : new Date(now);
    // Ensure end includes full day
    end.setHours(23, 59, 59, 999);

    let start = new Date(now);

    if (customStart) {
        start = new Date(customStart);
        start.setHours(0, 0, 0, 0);
        return {
            start,
            end,
            periodKey: "custom",
            label: "Custom Range",
        };
    }

    const normalized = (period || "this_month").toLowerCase();

    switch (normalized) {
        case "today": {
            start.setHours(0, 0, 0, 0);
            return {
                start,
                end,
                periodKey: "today",
                label: "Today",
            };
        }
        case "this_week":
        case "week": {
            // Monday as start of week
            const day = start.getDay();
            const diff = start.getDate() - day + (day === 0 ? -6 : 1);
            start.setDate(diff);
            start.setHours(0, 0, 0, 0);
            return {
                start,
                end,
                periodKey: "this_week",
                label: "This Week",
            };
        }
        case "this_month":
        case "month": {
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
            return {
                start,
                end,
                periodKey: "this_month",
                label: "This Month",
            };
        }
        case "last_30_days":
        case "30days": {
            start.setDate(start.getDate() - 30);
            start.setHours(0, 0, 0, 0);
            return {
                start,
                end,
                periodKey: "last_30_days",
                label: "Last 30 Days",
            };
        }
        case "all":
        case "all_time": {
            start = new Date(0); // Unix epoch
            return {
                start,
                end,
                periodKey: "all",
                label: "All Time",
            };
        }
        default: {
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
            return {
                start,
                end,
                periodKey: "this_month",
                label: "This Month",
            };
        }
    }
};

/**
 * Helper to calculate member workload signal:
 * - 0 - 2 active tasks: 'LOW'
 * - 3 - 5 active tasks: 'MODERATE'
 * - 6+ active tasks: 'HIGH'
 */
const calculateMemberWorkload = (activeTaskCount) => {
    const count = Number(activeTaskCount) || 0;
    if (count <= 2) {
        return {
            workloadSignal: "LOW",
            activeTasks: count,
            label: "Low Workload",
        };
    }
    if (count <= 5) {
        return {
            workloadSignal: "MODERATE",
            activeTasks: count,
            label: "Moderate Workload",
        };
    }
    return {
        workloadSignal: "HIGH",
        activeTasks: count,
        label: "High Workload",
    };
};

/**
 * Generates an array of formatted date keys between start and end dates.
 */
const generateDateSeries = (startDate, endDate, maxDays = 30) => {
    const dates = [];
    const curr = new Date(startDate);
    const end = new Date(endDate);

    // If span exceeds maxDays, limit to the last maxDays
    const diffDays = Math.ceil((end.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > maxDays) {
        curr.setDate(end.getDate() - (maxDays - 1));
        curr.setHours(0, 0, 0, 0);
    }

    while (curr <= end) {
        const yyyy = curr.getFullYear();
        const mm = String(curr.getMonth() + 1).padStart(2, "0");
        const dd = String(curr.getDate()).padStart(2, "0");
        const dateKey = `${yyyy}-${mm}-${dd}`;
        const dayLabel = curr.toLocaleDateString("en-US", { weekday: "short" });
        const shortDate = curr.toLocaleDateString("en-US", { month: "short", day: "numeric" });

        dates.push({
            date: dateKey,
            day: dayLabel,
            label: shortDate,
            timestamp: new Date(curr),
        });
        curr.setDate(curr.getDate() + 1);
    }

    return dates;
};

/**
 * Retrieve personal analytics for the authenticated user.
 *
 * @param {string|ObjectId} userId
 * @param {Object} options { period, startDate, endDate }
 */
const getPersonalAnalytics = async (userId, options = {}) => {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const dateRange = parsePeriod(options.period, options.startDate, options.endDate);

    // 1. Find all projects the user is a member of
    const memberships = await ProjectMembership.find({ user: userObjectId }).select("project");
    const userProjectIds = memberships.map((m) => m.project);

    // 2. Base task condition: personal tasks created by user OR assigned project tasks
    const taskQuery = {
        $or: [
            { project: null, createdBy: userObjectId },
            { project: { $in: userProjectIds }, assignee: userObjectId },
        ],
    };

    const allTasks = await Task.find(taskQuery)
        .populate("project", "_id name status")
        .populate("goal", "_id title status");

    const now = new Date();
    let totalTasks = 0;
    let completedTasks = 0;
    let inProgressTasks = 0;
    let todoTasks = 0;
    let overdueTasks = 0;
    let personalTasks = 0;
    let projectTasks = 0;

    const byPriority = {
        LOW: 0,
        MEDIUM: 0,
        HIGH: 0,
        URGENT: 0,
    };

    const byStatus = {
        TODO: 0,
        IN_PROGRESS: 0,
        COMPLETED: 0,
    };

    allTasks.forEach((task) => {
        totalTasks++;
        if (task.project) {
            projectTasks++;
        } else {
            personalTasks++;
        }

        // Status counts
        if (task.status === "COMPLETED") {
            completedTasks++;
            byStatus.COMPLETED++;
        } else if (task.status === "IN_PROGRESS") {
            inProgressTasks++;
            byStatus.IN_PROGRESS++;
        } else {
            todoTasks++;
            byStatus.TODO++;
        }

        // Priority counts
        if (byPriority[task.priority] !== undefined) {
            byPriority[task.priority]++;
        }

        // Overdue check: dueDate < now && not completed
        if (task.dueDate && new Date(task.dueDate) < now && task.status !== "COMPLETED") {
            overdueTasks++;
        }
    });

    const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const overdueRate = totalTasks > 0 ? Math.round((overdueTasks / totalTasks) * 100) : 0;

    // 3. Completion trend over time
    // Generate date series for the selected period (capped at 30 days for clean chart display)
    const trendSeries = generateDateSeries(dateRange.start, dateRange.end, 30);
    const trendMap = {};
    trendSeries.forEach((item) => {
        trendMap[item.date] = {
            date: item.date,
            day: item.day,
            label: item.label,
            completedCount: 0,
            createdCount: 0,
        };
    });

    // Populate completion trend from completed tasks (using updatedAt or task completion activities)
    allTasks.forEach((task) => {
        if (task.status === "COMPLETED" && task.updatedAt) {
            const completedDateStr = new Date(task.updatedAt).toISOString().split("T")[0];
            if (trendMap[completedDateStr]) {
                trendMap[completedDateStr].completedCount++;
            }
        }
        if (task.createdAt) {
            const createdDateStr = new Date(task.createdAt).toISOString().split("T")[0];
            if (trendMap[createdDateStr]) {
                trendMap[createdDateStr].createdCount++;
            }
        }
    });

    const completionTrend = Object.values(trendMap);

    // 4. Time & Focus analytics from TimeSession
    const timeSessionQuery = {
        user: userObjectId,
        endedAt: { $ne: null },
    };

    // Apply period filtering to time sessions if not all time
    if (dateRange.periodKey !== "all") {
        timeSessionQuery.endedAt = {
            $gte: dateRange.start,
            $lte: dateRange.end,
        };
    }

    const sessions = await TimeSession.find(timeSessionQuery).populate("task", "_id title estimatedMinutes status");

    let totalTrackedSeconds = 0;
    const focusDaysMap = {};
    const taskTrackedMap = {}; // taskId -> trackedSeconds
    const dayOfWeekCompletions = {
        Sunday: 0,
        Monday: 0,
        Tuesday: 0,
        Wednesday: 0,
        Thursday: 0,
        Friday: 0,
        Saturday: 0,
    };
    const dayOfWeekFocusSeconds = {
        Sunday: 0,
        Monday: 0,
        Tuesday: 0,
        Wednesday: 0,
        Thursday: 0,
        Friday: 0,
        Saturday: 0,
    };

    // Initialize daily focus trend series
    trendSeries.forEach((item) => {
        focusDaysMap[item.date] = {
            date: item.date,
            day: item.day,
            label: item.label,
            focusMinutes: 0,
            sessionCount: 0,
        };
    });

    sessions.forEach((s) => {
        const dur = Number(s.durationSeconds) || 0;
        totalTrackedSeconds += dur;

        const sessionDate = s.endedAt ? new Date(s.endedAt) : new Date(s.startedAt);
        const dateStr = sessionDate.toISOString().split("T")[0];
        const dayName = sessionDate.toLocaleDateString("en-US", { weekday: "long" });

        if (focusDaysMap[dateStr]) {
            focusDaysMap[dateStr].focusMinutes += Math.round(dur / 60);
            focusDaysMap[dateStr].sessionCount++;
        }

        if (dayOfWeekFocusSeconds[dayName] !== undefined) {
            dayOfWeekFocusSeconds[dayName] += dur;
        }

        if (s.task?._id) {
            const tId = s.task._id.toString();
            taskTrackedMap[tId] = (taskTrackedMap[tId] || 0) + dur;
        }
    });

    // Record completed task day-of-week counts
    allTasks.forEach((t) => {
        if (t.status === "COMPLETED" && t.updatedAt) {
            const dayName = new Date(t.updatedAt).toLocaleDateString("en-US", { weekday: "long" });
            if (dayOfWeekCompletions[dayName] !== undefined) {
                dayOfWeekCompletions[dayName]++;
            }
        }
    });

    const totalTrackedMinutes = Math.round(totalTrackedSeconds / 60);
    const totalTrackedHours = +(totalTrackedSeconds / 3600).toFixed(1);
    const focusSessionsCount = sessions.length;

    // Distinct tasks worked on
    const tasksWorkedOnCount = Object.keys(taskTrackedMap).length;
    const avgTimePerTaskMinutes =
        tasksWorkedOnCount > 0 ? Math.round(totalTrackedMinutes / tasksWorkedOnCount) : 0;

    // Estimated vs Actual Time
    let totalEstimatedMinutes = 0;
    let totalActualMinutesOnEstimatedTasks = 0;

    allTasks.forEach((task) => {
        if (typeof task.estimatedMinutes === "number" && task.estimatedMinutes > 0) {
            totalEstimatedMinutes += task.estimatedMinutes;
            const actualSec = taskTrackedMap[task._id.toString()] || 0;
            totalActualMinutesOnEstimatedTasks += Math.round(actualSec / 60);
        }
    });

    const estimatedVsActual = {
        totalEstimatedMinutes,
        totalActualMinutes: totalActualMinutesOnEstimatedTasks,
        differenceMinutes: totalActualMinutesOnEstimatedTasks - totalEstimatedMinutes,
        isOverEstimate: totalActualMinutesOnEstimatedTasks > totalEstimatedMinutes,
    };

    // Most productive day determination
    let mostProductiveDay = "Monday";
    let highestScore = -1;
    for (const [day, count] of Object.entries(dayOfWeekCompletions)) {
        const focusMin = Math.round((dayOfWeekFocusSeconds[day] || 0) / 60);
        // Weighted productivity score: 3 points per task completed + 1 point per 30m focus
        const score = count * 3 + Math.round(focusMin / 30);
        if (score > highestScore) {
            highestScore = score;
            mostProductiveDay = day;
        }
    }

    // Productivity velocity & trend
    const spanDays = Math.max(1, Math.ceil((dateRange.end - dateRange.start) / (1000 * 60 * 60 * 24)));
    const tasksCompletedPerDay = +(completedTasks / spanDays).toFixed(2);

    let productivityTrend = "STABLE";
    if (completionTrend.length >= 7) {
        const recentHalf = completionTrend.slice(-Math.floor(completionTrend.length / 2));
        const olderHalf = completionTrend.slice(0, Math.floor(completionTrend.length / 2));
        const recentCompleted = recentHalf.reduce((sum, item) => sum + item.completedCount, 0);
        const olderCompleted = olderHalf.reduce((sum, item) => sum + item.completedCount, 0);

        if (recentCompleted > olderCompleted * 1.15) {
            productivityTrend = "INCREASING";
        } else if (recentCompleted < olderCompleted * 0.85 && olderCompleted > 0) {
            productivityTrend = "DECREASING";
        }
    }

    // 5. Goals Metrics (Personal Goals owned by user)
    const personalGoals = await Goal.find({ owner: userObjectId, project: null });
    const totalGoals = personalGoals.length;
    const completedGoals = personalGoals.filter((g) => g.status === "COMPLETED").length;
    const activeGoals = personalGoals.filter((g) => g.status === "IN_PROGRESS").length;

    // Derived average progress across personal goals
    let avgGoalProgress = 0;
    if (totalGoals > 0) {
        let totalProgress = 0;
        for (const goal of personalGoals) {
            if (goal.status === "COMPLETED") {
                totalProgress += 100;
            } else {
                const linkedTasks = allTasks.filter(
                    (t) => t.goal && t.goal._id.toString() === goal._id.toString()
                );
                if (linkedTasks.length > 0) {
                    const completedLinked = linkedTasks.filter((t) => t.status === "COMPLETED").length;
                    totalProgress += Math.round((completedLinked / linkedTasks.length) * 100);
                } else if (goal.status === "IN_PROGRESS") {
                    totalProgress += 25;
                }
            }
        }
        avgGoalProgress = Math.round(totalProgress / totalGoals);
    }

    return {
        period: {
            key: dateRange.periodKey,
            label: dateRange.label,
            start: dateRange.start,
            end: dateRange.end,
        },
        taskMetrics: {
            total: totalTasks,
            completed: completedTasks,
            inProgress: inProgressTasks,
            todo: todoTasks,
            overdue: overdueTasks,
            completionPercentage,
            personalTasks,
            projectTasks,
            byPriority,
            byStatus,
            completionTrend,
        },
        timeMetrics: {
            totalTrackedSeconds,
            totalTrackedMinutes,
            totalTrackedHours,
            focusSessionsCount,
            avgTimePerTaskMinutes,
            estimatedVsActual,
            dailyFocusTrend: Object.values(focusDaysMap),
        },
        productivityMetrics: {
            tasksCompletedPerDay,
            mostProductiveDay,
            productivityTrend,
            overdueRate,
            completionRate: completionPercentage,
        },
        goalMetrics: {
            total: totalGoals,
            active: activeGoals,
            completed: completedGoals,
            avgProgress: avgGoalProgress,
        },
    };
};

/**
 * Retrieve analytics for a specific project.
 *
 * @param {string|ObjectId} projectId
 * @param {Object} options { period, startDate, endDate }
 */
const getProjectAnalytics = async (projectId, options = {}) => {
    const projectObjectId = new mongoose.Types.ObjectId(projectId);
    const dateRange = parsePeriod(options.period, options.startDate, options.endDate);

    const project = await Project.findById(projectObjectId);
    if (!project) {
        const error = new Error("Project not found");
        error.statusCode = 404;
        throw error;
    }

    const allTasks = await Task.find({ project: projectObjectId })
        .populate("assignee", "_id name email profileImageURL")
        .populate("goal", "_id title status");

    const now = new Date();
    let totalTasks = 0;
    let completedTasks = 0;
    let inProgressTasks = 0;
    let todoTasks = 0;
    let overdueTasks = 0;

    const byPriority = {
        LOW: 0,
        MEDIUM: 0,
        HIGH: 0,
        URGENT: 0,
    };

    const byStatus = {
        TODO: 0,
        IN_PROGRESS: 0,
        COMPLETED: 0,
    };

    allTasks.forEach((task) => {
        totalTasks++;
        if (task.status === "COMPLETED") {
            completedTasks++;
            byStatus.COMPLETED++;
        } else if (task.status === "IN_PROGRESS") {
            inProgressTasks++;
            byStatus.IN_PROGRESS++;
        } else {
            todoTasks++;
            byStatus.TODO++;
        }

        if (byPriority[task.priority] !== undefined) {
            byPriority[task.priority]++;
        }

        if (task.dueDate && new Date(task.dueDate) < now && task.status !== "COMPLETED") {
            overdueTasks++;
        }
    });

    const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Trend series
    const trendSeries = generateDateSeries(dateRange.start, dateRange.end, 30);
    const trendMap = {};
    trendSeries.forEach((item) => {
        trendMap[item.date] = {
            date: item.date,
            day: item.day,
            label: item.label,
            completedCount: 0,
            createdCount: 0,
        };
    });

    allTasks.forEach((task) => {
        if (task.status === "COMPLETED" && task.updatedAt) {
            const completedDateStr = new Date(task.updatedAt).toISOString().split("T")[0];
            if (trendMap[completedDateStr]) {
                trendMap[completedDateStr].completedCount++;
            }
        }
        if (task.createdAt) {
            const createdDateStr = new Date(task.createdAt).toISOString().split("T")[0];
            if (trendMap[createdDateStr]) {
                trendMap[createdDateStr].createdCount++;
            }
        }
    });

    // Time tracked on project
    const sessionQuery = {
        project: projectObjectId,
        endedAt: { $ne: null },
    };

    if (dateRange.periodKey !== "all") {
        sessionQuery.endedAt = {
            $gte: dateRange.start,
            $lte: dateRange.end,
        };
    }

    const sessions = await TimeSession.find(sessionQuery);
    let totalTrackedSeconds = 0;
    const taskTrackedMap = {};

    sessions.forEach((s) => {
        const dur = Number(s.durationSeconds) || 0;
        totalTrackedSeconds += dur;
        if (s.task) {
            const tId = s.task.toString();
            taskTrackedMap[tId] = (taskTrackedMap[tId] || 0) + dur;
        }
    });

    const totalTrackedMinutes = Math.round(totalTrackedSeconds / 60);

    // Estimated vs Actual
    let totalEstimatedMinutes = 0;
    let totalActualMinutesOnEstimatedTasks = 0;

    allTasks.forEach((task) => {
        if (typeof task.estimatedMinutes === "number" && task.estimatedMinutes > 0) {
            totalEstimatedMinutes += task.estimatedMinutes;
            const actualSec = taskTrackedMap[task._id.toString()] || 0;
            totalActualMinutesOnEstimatedTasks += Math.round(actualSec / 60);
        }
    });

    // Project linked goals
    const projectGoals = await Goal.find({ project: projectObjectId });
    const totalGoals = projectGoals.length;
    const completedGoals = projectGoals.filter((g) => g.status === "COMPLETED").length;
    const activeGoals = projectGoals.filter((g) => g.status === "IN_PROGRESS").length;

    let avgGoalProgress = 0;
    if (totalGoals > 0) {
        let totalProgress = 0;
        projectGoals.forEach((goal) => {
            if (goal.status === "COMPLETED") {
                totalProgress += 100;
            } else {
                const linkedTasks = allTasks.filter(
                    (t) => t.goal && t.goal._id.toString() === goal._id.toString()
                );
                if (linkedTasks.length > 0) {
                    const completedLinked = linkedTasks.filter((t) => t.status === "COMPLETED").length;
                    totalProgress += Math.round((completedLinked / linkedTasks.length) * 100);
                } else if (goal.status === "IN_PROGRESS") {
                    totalProgress += 25;
                }
            }
        });
        avgGoalProgress = Math.round(totalProgress / totalGoals);
    }

    return {
        project: {
            _id: project._id,
            name: project.name,
            description: project.description,
            status: project.status,
            startDate: project.startDate,
            dueDate: project.dueDate,
        },
        period: {
            key: dateRange.periodKey,
            label: dateRange.label,
            start: dateRange.start,
            end: dateRange.end,
        },
        taskMetrics: {
            total: totalTasks,
            completed: completedTasks,
            inProgress: inProgressTasks,
            todo: todoTasks,
            overdue: overdueTasks,
            completionPercentage,
            byPriority,
            byStatus,
            completionTrend: Object.values(trendMap),
        },
        timeMetrics: {
            totalTrackedSeconds,
            totalTrackedMinutes,
            sessionsCount: sessions.length,
            estimatedVsActual: {
                totalEstimatedMinutes,
                totalActualMinutes: totalActualMinutesOnEstimatedTasks,
                differenceMinutes: totalActualMinutesOnEstimatedTasks - totalEstimatedMinutes,
                isOverEstimate: totalActualMinutesOnEstimatedTasks > totalEstimatedMinutes,
            },
        },
        goalMetrics: {
            total: totalGoals,
            active: activeGoals,
            completed: completedGoals,
            avgProgress: avgGoalProgress,
        },
    };
};

/**
 * Retrieve team analytics for a project.
 * Must only be accessible by authorized project roles (e.g. OWNER, MANAGER, MEMBER; VIEWER forbidden).
 *
 * @param {string|ObjectId} projectId
 * @param {Object} options { period, startDate, endDate }
 */
const getTeamAnalytics = async (projectId, options = {}) => {
    const projectObjectId = new mongoose.Types.ObjectId(projectId);
    const dateRange = parsePeriod(options.period, options.startDate, options.endDate);

    const project = await Project.findById(projectObjectId);
    if (!project) {
        const error = new Error("Project not found");
        error.statusCode = 404;
        throw error;
    }

    const memberships = await ProjectMembership.find({ project: projectObjectId })
        .populate("user", "_id name email profileImageURL")
        .sort({ joinedAt: 1 });

    const allTasks = await Task.find({ project: projectObjectId });

    // Time session query
    const sessionQuery = {
        project: projectObjectId,
        endedAt: { $ne: null },
    };

    if (dateRange.periodKey !== "all") {
        sessionQuery.endedAt = {
            $gte: dateRange.start,
            $lte: dateRange.end,
        };
    }

    const sessions = await TimeSession.find(sessionQuery);

    // Calculate time spent per user
    const memberTimeMap = {};
    sessions.forEach((s) => {
        if (s.user) {
            const uId = s.user.toString();
            memberTimeMap[uId] = (memberTimeMap[uId] || 0) + (Number(s.durationSeconds) || 0);
        }
    });

    const now = new Date();
    let totalProjectTrackedSeconds = 0;

    const members = memberships.map((m) => {
        const memberUser = m.user;
        const memberIdStr = memberUser._id.toString();

        const memberTasks = allTasks.filter(
            (t) => t.assignee && t.assignee.toString() === memberIdStr
        );

        const assignedTasks = memberTasks.length;
        const completedTasks = memberTasks.filter((t) => t.status === "COMPLETED").length;
        const inProgressTasks = memberTasks.filter((t) => t.status === "IN_PROGRESS").length;
        const todoTasks = memberTasks.filter((t) => t.status === "TODO").length;
        const activeTasks = inProgressTasks + todoTasks;

        const overdueTasks = memberTasks.filter(
            (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== "COMPLETED"
        ).length;

        const completionRate = assignedTasks > 0 ? Math.round((completedTasks / assignedTasks) * 100) : 0;
        const workload = calculateMemberWorkload(activeTasks);

        const timeSpentSeconds = memberTimeMap[memberIdStr] || 0;
        totalProjectTrackedSeconds += timeSpentSeconds;
        const timeSpentMinutes = Math.round(timeSpentSeconds / 60);

        return {
            member: {
                _id: memberUser._id,
                name: memberUser.name,
                email: memberUser.email,
                profileImageURL: memberUser.profileImageURL,
                role: m.role,
                joinedAt: m.joinedAt,
            },
            assignedTasks,
            completedTasks,
            inProgressTasks,
            todoTasks,
            activeTasks,
            overdueTasks,
            completionRate,
            timeSpentSeconds,
            timeSpentMinutes,
            workloadSignal: workload.workloadSignal,
            workloadLabel: workload.label,
        };
    });

    const unassignedTasks = allTasks.filter((t) => !t.assignee).length;

    return {
        project: {
            _id: project._id,
            name: project.name,
        },
        period: {
            key: dateRange.periodKey,
            label: dateRange.label,
            start: dateRange.start,
            end: dateRange.end,
        },
        summary: {
            totalMembers: memberships.length,
            totalProjectTasks: allTasks.length,
            unassignedTasks,
            totalProjectTrackedSeconds,
            totalProjectTrackedMinutes: Math.round(totalProjectTrackedSeconds / 60),
        },
        members,
    };
};

module.exports = {
    parsePeriod,
    calculateMemberWorkload,
    getPersonalAnalytics,
    getProjectAnalytics,
    getTeamAnalytics,
};
