const mongoose = require("mongoose");
const Task = require("../models/Task");
const ProjectMembership = require("../models/ProjectMembership");

/**
 * Task Intelligence Service
 *
 * Deterministic, rule-based intelligence engine for StudySync:
 * 1. Task Urgency Scoring (0 - 100)
 * 2. Automatic Deadline Classification (OVERDUE, DUE_TODAY, DUE_SOON, UPCOMING, NO_DEADLINE)
 * 3. At-Risk Task Detection
 * 4. "What should I do next?" Personalized Recommendations
 * 5. Explainable Recommendation Reasons
 * 6. Project Member Workload Signals (LOW, MODERATE, HIGH)
 */

/**
 * Helper to compute task progress percentage (0 - 100)
 */
const getTaskProgress = (task) => {
    if (task.subtasks && task.subtasks.length > 0) {
        const completed = task.subtasks.filter((st) => st.completed).length;
        return Math.round((completed / task.subtasks.length) * 100);
    }
    if (task.status === "COMPLETED") return 100;
    if (task.status === "IN_PROGRESS") return 50;
    return 0;
};

/**
 * Classify a task's deadline state based on server time.
 * Returns: 'OVERDUE' | 'DUE_TODAY' | 'DUE_SOON' | 'UPCOMING' | 'NO_DEADLINE'
 */
const classifyDeadline = (dueDate, status, referenceDate = new Date()) => {
    if (!dueDate) return "NO_DEADLINE";

    const ref = new Date(referenceDate);
    const startOfToday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 23, 59, 59, 999);
    const threeDaysOut = new Date(endOfToday.getTime() + 3 * 24 * 60 * 60 * 1000);

    const due = new Date(dueDate);
    const dueTime = due.getTime();

    if (dueTime < startOfToday.getTime()) {
        return "OVERDUE";
    }
    if (dueTime >= startOfToday.getTime() && dueTime <= endOfToday.getTime()) {
        return "DUE_TODAY";
    }
    if (dueTime > endOfToday.getTime() && dueTime <= threeDaysOut.getTime()) {
        return "DUE_SOON";
    }
    return "UPCOMING";
};

/**
 * Detect if an active task is at risk of missing its deadline or failing.
 */
const detectAtRisk = (task, referenceDate = new Date()) => {
    if (task.status === "COMPLETED") {
        return { isAtRisk: false, riskReasons: [] };
    }

    const ref = new Date(referenceDate);
    const startOfToday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 23, 59, 59, 999);

    const progress = getTaskProgress(task);
    const deadlineStatus = classifyDeadline(task.dueDate, task.status, ref);
    const riskReasons = [];

    // Rule 1: Task is already overdue
    if (deadlineStatus === "OVERDUE") {
        const diffMs = startOfToday.getTime() - new Date(task.dueDate).getTime();
        const daysOverdue = Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
        riskReasons.push(`Task is overdue by ${daysOverdue} day${daysOverdue > 1 ? "s" : ""}`);
    }

    // Rule 2: Due today with low or incomplete progress (< 80%)
    if (deadlineStatus === "DUE_TODAY" && progress < 80) {
        riskReasons.push(`Due today with ${100 - progress}% incomplete`);
    }

    // Rule 3: Due soon (within next 3 days) with low progress (< 40%)
    if (deadlineStatus === "DUE_SOON" && progress < 40) {
        const diffDays = Math.ceil((new Date(task.dueDate).getTime() - endOfToday.getTime()) / (24 * 60 * 60 * 1000));
        riskReasons.push(`Due in ${diffDays} day${diffDays > 1 ? "s" : ""} with only ${progress}% completed`);
    }

    // Rule 4: High or Urgent priority due within 5 days with significant work remaining (< 50%)
    if ((task.priority === "URGENT" || task.priority === "HIGH") && task.dueDate && progress < 50) {
        const fiveDaysOut = new Date(endOfToday.getTime() + 5 * 24 * 60 * 60 * 1000);
        if (new Date(task.dueDate) <= fiveDaysOut && deadlineStatus !== "OVERDUE" && deadlineStatus !== "DUE_TODAY") {
            riskReasons.push(`${task.priority} priority with substantial incomplete work due soon`);
        }
    }

    return {
        isAtRisk: riskReasons.length > 0,
        riskReasons,
    };
};

/**
 * Generate explainable bullet reasons for why a task received its recommendation / urgency score.
 */
const generateTaskReasons = (task, metrics, referenceDate = new Date()) => {
    const reasons = [];
    const ref = new Date(referenceDate);
    const startOfToday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 23, 59, 59, 999);

    // 1. Deadline reasons
    if (!task.dueDate) {
        reasons.push("No deadline set");
    } else {
        const due = new Date(task.dueDate);
        if (due.getTime() < startOfToday.getTime()) {
            const diffDays = Math.max(1, Math.ceil((startOfToday.getTime() - due.getTime()) / (24 * 60 * 60 * 1000)));
            reasons.push(`Overdue by ${diffDays} day${diffDays > 1 ? "s" : ""}`);
        } else if (due.getTime() <= endOfToday.getTime()) {
            reasons.push("Due today");
        } else {
            const diffDays = Math.ceil((due.getTime() - endOfToday.getTime()) / (24 * 60 * 60 * 1000));
            if (diffDays === 1) {
                reasons.push("Due tomorrow");
            } else if (diffDays <= 3) {
                reasons.push(`Due in ${diffDays} days`);
            } else {
                reasons.push(`Due on ${due.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`);
            }
        }
    }

    // 2. Priority reasons
    if (task.priority === "URGENT") {
        reasons.push("Urgent priority");
    } else if (task.priority === "HIGH") {
        reasons.push("High priority");
    } else if (task.priority === "MEDIUM") {
        reasons.push("Medium priority");
    } else if (task.priority === "LOW") {
        reasons.push("Low priority");
    }

    // 3. Subtask / Progress reasons
    const progress = metrics?.progress !== undefined ? metrics.progress : getTaskProgress(task);
    if (task.subtasks && task.subtasks.length > 0) {
        const completed = task.subtasks.filter((st) => st.completed).length;
        reasons.push(`${completed}/${task.subtasks.length} subtasks done (${100 - progress}% remaining)`);
    } else if (progress < 100) {
        reasons.push(`${100 - progress}% incomplete`);
    }

    // 4. Status / Activity reasons
    if (task.status === "IN_PROGRESS") {
        reasons.push("Currently in progress");
    } else if (task.status === "TODO") {
        reasons.push("Not yet started");
    }

    // 5. Risk reasons
    if (metrics?.isAtRisk && metrics?.riskReasons?.length > 0) {
        reasons.push(metrics.riskReasons[0]);
    }

    return reasons;
};

/**
 * Calculate deterministic urgency score (0 - 100) for a given task.
 *
 * Scoring Formula:
 * - Completed tasks: 0
 * - Priority weight (0 - 35): URGENT=35, HIGH=25, MEDIUM=15, LOW=5
 * - Deadline weight (0 - 45):
 *     OVERDUE: 45
 *     DUE_TODAY: 38
 *     DUE_SOON (tomorrow): 30
 *     DUE_SOON (<= 2 days): 24
 *     DUE_SOON (<= 3 days): 18
 *     UPCOMING (<= 7 days): 10
 *     UPCOMING (> 7 days): 5
 *     NO_DEADLINE: 0
 * - Incomplete progress weight (0 - 15): round((100 - progress) / 100 * 15)
 * - Status momentum weight (0 - 5): IN_PROGRESS=5, TODO=0
 *
 * Clamped strictly between 0 and 100.
 */
const calculateTaskUrgency = (task, referenceDate = new Date()) => {
    if (!task) {
        return {
            urgencyScore: 0,
            deadlineStatus: "NO_DEADLINE",
            progress: 0,
            isAtRisk: false,
            riskReasons: [],
            reasons: [],
        };
    }

    // Completed tasks have no urgency
    if (task.status === "COMPLETED") {
        const deadlineStatus = classifyDeadline(task.dueDate, task.status, referenceDate);
        return {
            urgencyScore: 0,
            priority: task.priority || "MEDIUM",
            deadlineStatus,
            progress: 100,
            isAtRisk: false,
            riskReasons: [],
            reasons: ["Task is already completed"],
        };
    }

    const ref = new Date(referenceDate);
    const startOfToday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 23, 59, 59, 999);

    // 1. Priority Weight (0 - 35)
    let priorityWeight = 15; // default MEDIUM
    switch (task.priority) {
        case "URGENT":
            priorityWeight = 35;
            break;
        case "HIGH":
            priorityWeight = 25;
            break;
        case "MEDIUM":
            priorityWeight = 15;
            break;
        case "LOW":
            priorityWeight = 5;
            break;
        default:
            priorityWeight = 15;
    }

    // 2. Deadline Weight (0 - 45)
    let deadlineWeight = 0;
    const deadlineStatus = classifyDeadline(task.dueDate, task.status, ref);

    if (task.dueDate) {
        const dueTime = new Date(task.dueDate).getTime();
        if (dueTime < startOfToday.getTime()) {
            deadlineWeight = 45; // OVERDUE
        } else if (dueTime <= endOfToday.getTime()) {
            deadlineWeight = 38; // DUE_TODAY
        } else {
            const diffDays = Math.ceil((dueTime - endOfToday.getTime()) / (24 * 60 * 60 * 1000));
            if (diffDays <= 1) {
                deadlineWeight = 30; // Tomorrow
            } else if (diffDays <= 2) {
                deadlineWeight = 24; // 2 days
            } else if (diffDays <= 3) {
                deadlineWeight = 18; // 3 days
            } else if (diffDays <= 7) {
                deadlineWeight = 10; // Within a week
            } else {
                deadlineWeight = 5; // Further out
            }
        }
    }

    // 3. Incomplete Progress Weight (0 - 15)
    const progress = getTaskProgress(task);
    const incompleteFraction = Math.max(0, Math.min(100, 100 - progress)) / 100;
    const progressWeight = Math.round(incompleteFraction * 15);

    // 4. Status Momentum Weight (0 - 5)
    const statusWeight = task.status === "IN_PROGRESS" ? 5 : 0;

    // Total Score (0 - 100)
    const rawScore = priorityWeight + deadlineWeight + progressWeight + statusWeight;
    const urgencyScore = Math.min(100, Math.max(0, rawScore));

    // At-Risk Assessment
    const { isAtRisk, riskReasons } = detectAtRisk(task, ref);

    // Human-readable Explanation
    const reasons = generateTaskReasons(
        task,
        { progress, isAtRisk, riskReasons },
        ref
    );

    return {
        urgencyScore,
        priority: task.priority || "MEDIUM",
        deadlineStatus,
        progress,
        isAtRisk,
        riskReasons,
        reasons,
        components: {
            priorityWeight,
            deadlineWeight,
            progressWeight,
            statusWeight,
        },
    };
};

/**
 * Calculate member workload signal based on active assigned tasks.
 * Active tasks: status !== 'COMPLETED'
 *
 * Rules:
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
 * Retrieve top recommended actionable tasks for a given user.
 *
 * Criteria:
 * - Excludes COMPLETED tasks.
 * - Personal tasks created by the user (project: null, createdBy: userId).
 * - Project tasks assigned to the user (assignee: userId) where the user has active membership.
 * - Scores each candidate with calculateTaskUrgency.
 * - Ranks tasks descending by urgencyScore, then dueDate ascending.
 * - Returns top N items (default: 5).
 */
const getRecommendedTasksForUser = async (userId, options = {}) => {
    const limit = Math.min(20, Math.max(1, parseInt(options.limit, 10) || 5));
    const referenceDate = options.referenceDate ? new Date(options.referenceDate) : new Date();

    // 1. Fetch user's active project memberships to enforce authorization
    const memberships = await ProjectMembership.find({ user: userId }).select("project");
    const userProjectIds = memberships.map((m) => m.project);

    // 2. Query actionable (non-completed) personal and project tasks
    const query = {
        status: { $ne: "COMPLETED" },
        $or: [
            { project: null, createdBy: userId },
            { project: { $in: userProjectIds }, assignee: userId },
        ],
    };

    const candidateTasks = await Task.find(query)
        .populate("project", "_id name status dueDate")
        .populate("assignee", "_id name email profileImageURL")
        .populate("createdBy", "_id name email profileImageURL");

    // 3. Score and evaluate each candidate task
    const scoredTasks = candidateTasks.map((task) => {
        const intel = calculateTaskUrgency(task, referenceDate);
        return {
            task,
            urgencyScore: intel.urgencyScore,
            priority: task.priority || "MEDIUM",
            deadlineStatus: intel.deadlineStatus,
            progress: intel.progress,
            isAtRisk: intel.isAtRisk,
            riskReasons: intel.riskReasons,
            reasons: intel.reasons,
        };
    });

    // 4. Sort: Highest urgency score first; if tied, earlier due date first; then createdAt
    scoredTasks.sort((a, b) => {
        if (b.urgencyScore !== a.urgencyScore) {
            return b.urgencyScore - a.urgencyScore;
        }
        if (a.task.dueDate && b.task.dueDate) {
            return new Date(a.task.dueDate) - new Date(b.task.dueDate);
        }
        if (a.task.dueDate && !b.task.dueDate) return -1;
        if (!a.task.dueDate && b.task.dueDate) return 1;
        return new Date(a.task.createdAt || 0) - new Date(b.task.createdAt || 0);
    });

    // 5. Slice top recommendations
    return scoredTasks.slice(0, limit);
};

module.exports = {
    getTaskProgress,
    classifyDeadline,
    detectAtRisk,
    generateTaskReasons,
    calculateTaskUrgency,
    calculateMemberWorkload,
    getRecommendedTasksForUser,
};
