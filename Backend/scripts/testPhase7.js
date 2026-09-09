require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const dns = require("dns");
try { dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]); } catch (_) {}
const mongoose = require("mongoose");
const User = require("../models/User");
const Project = require("../models/Project");
const ProjectMembership = require("../models/ProjectMembership");
const Task = require("../models/Task");

const {
    calculateTaskUrgency,
    classifyDeadline,
    detectAtRisk,
    generateTaskReasons,
    calculateMemberWorkload,
    getRecommendedTasksForUser,
} = require("../services/taskIntelligenceService");

const { getProjectWorkload } = require("../controllers/projectMemberController");
const { getRecommendedTasks } = require("../controllers/taskController");

// Helper to create mock Express response
function createMockRes() {
    return {
        statusCode: 200,
        responseData: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(data) {
            this.responseData = data;
            return this;
        },
    };
}

async function runPhase7Tests() {
    console.log("==================================================");
    console.log("   STUDYSYNC PHASE 7 TASK INTELLIGENCE TESTS      ");
    console.log("==================================================\n");

    const createdUserIds = [];
    let testProject = null;
    let otherProject = null;

    try {
        const mongoURI = process.env.MONGO_URI || "mongodb://localhost:27017/studysync";
        console.log(`Connecting to MongoDB at: ${mongoURI}...`);
        await mongoose.connect(mongoURI);
        console.log("✓ MongoDB Connected successfully.\n");

        const testId = Date.now();
        const now = new Date();
        const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0, 0);
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const inTwoDays = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
        const inTenDays = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        // ── Unit / Pure Algorithm Tests ──────────────────────────────────────────
        console.log("▶ Step 1: Testing Pure Intelligence Algorithm & Formulas...");

        // 1.1: Urgent vs Low priority
        const taskUrgent = { priority: "URGENT", status: "TODO", dueDate: tomorrow, subtasks: [] };
        const taskLow = { priority: "LOW", status: "TODO", dueDate: tomorrow, subtasks: [] };
        const scoreUrgent = calculateTaskUrgency(taskUrgent, now);
        const scoreLow = calculateTaskUrgency(taskLow, now);

        if (scoreUrgent.urgencyScore <= scoreLow.urgencyScore) {
            throw new Error(`Expected Urgent (${scoreUrgent.urgencyScore}) to score higher than Low (${scoreLow.urgencyScore})`);
        }
        console.log(`✓ Urgent task scores higher than low-priority task (${scoreUrgent.urgencyScore} > ${scoreLow.urgencyScore})`);

        // 1.2: Near deadline increases urgency
        const taskNear = { priority: "HIGH", status: "TODO", dueDate: tomorrow, subtasks: [] };
        const taskFar = { priority: "HIGH", status: "TODO", dueDate: inTenDays, subtasks: [] };
        const scoreNear = calculateTaskUrgency(taskNear, now);
        const scoreFar = calculateTaskUrgency(taskFar, now);

        if (scoreNear.urgencyScore <= scoreFar.urgencyScore) {
            throw new Error(`Expected near deadline (${scoreNear.urgencyScore}) to score higher than far deadline (${scoreFar.urgencyScore})`);
        }
        console.log(`✓ Near deadline increases urgency (${scoreNear.urgencyScore} > ${scoreFar.urgencyScore})`);

        // 1.3: Overdue task detection
        const taskOverdue = { priority: "MEDIUM", status: "TODO", dueDate: yesterday, subtasks: [] };
        const scoreOverdue = calculateTaskUrgency(taskOverdue, now);

        if (scoreOverdue.deadlineStatus !== "OVERDUE" || !scoreOverdue.isAtRisk) {
            throw new Error(`Expected overdue task to be classified as OVERDUE and at-risk. Got status: ${scoreOverdue.deadlineStatus}, isAtRisk: ${scoreOverdue.isAtRisk}`);
        }
        console.log(`✓ Overdue task is detected & flagged at-risk (Score: ${scoreOverdue.urgencyScore}, Status: ${scoreOverdue.deadlineStatus})`);

        // 1.4: Due-today task detection
        const taskToday = { priority: "MEDIUM", status: "TODO", dueDate: todayMid, subtasks: [] };
        const scoreToday = calculateTaskUrgency(taskToday, now);

        if (scoreToday.deadlineStatus !== "DUE_TODAY") {
            throw new Error(`Expected due-today task to have deadlineStatus DUE_TODAY, got: ${scoreToday.deadlineStatus}`);
        }
        console.log(`✓ Due-today task is detected (Status: ${scoreToday.deadlineStatus})`);

        // 1.5: Progress affects urgency appropriately
        const taskZeroProgress = {
            priority: "HIGH",
            status: "TODO",
            dueDate: tomorrow,
            subtasks: [
                { title: "Sub 1", completed: false },
                { title: "Sub 2", completed: false },
            ],
        };
        const taskHighProgress = {
            priority: "HIGH",
            status: "IN_PROGRESS",
            dueDate: tomorrow,
            subtasks: [
                { title: "Sub 1", completed: true },
                { title: "Sub 2", completed: false },
            ],
        };
        const scoreZero = calculateTaskUrgency(taskZeroProgress, now);
        const scoreHigh = calculateTaskUrgency(taskHighProgress, now);

        console.log(`✓ Progress weight calculation verified (0% incomplete weight = ${scoreZero.components.progressWeight}, 50% incomplete weight = ${scoreHigh.components.progressWeight})`);

        // 1.6: Completed task scores 0
        const taskCompleted = { priority: "URGENT", status: "COMPLETED", dueDate: yesterday, subtasks: [] };
        const scoreCompleted = calculateTaskUrgency(taskCompleted, now);

        if (scoreCompleted.urgencyScore !== 0) {
            throw new Error(`Expected completed task to score 0, got ${scoreCompleted.urgencyScore}`);
        }
        console.log("✓ Completed task receives urgency score of 0");

        // 1.7: Tasks without due date handle safely
        const taskNoDue = { priority: "MEDIUM", status: "TODO", dueDate: null, subtasks: [] };
        const scoreNoDue = calculateTaskUrgency(taskNoDue, now);

        if (scoreNoDue.deadlineStatus !== "NO_DEADLINE" || isNaN(scoreNoDue.urgencyScore)) {
            throw new Error(`Expected safe calculation for task without due date. Got: ${JSON.stringify(scoreNoDue)}`);
        }
        console.log(`✓ Tasks without due dates do not break calculation (Status: ${scoreNoDue.deadlineStatus}, Score: ${scoreNoDue.urgencyScore})`);

        // 1.8: Explainable reasons generation
        const testReasonTask = {
            priority: "HIGH",
            status: "IN_PROGRESS",
            dueDate: tomorrow,
            subtasks: [
                { title: "Part 1", completed: false },
                { title: "Part 2", completed: false },
            ],
        };
        const intelReason = calculateTaskUrgency(testReasonTask, now);
        if (!intelReason.reasons || intelReason.reasons.length === 0) {
            throw new Error("Expected human-readable reasons to be generated");
        }
        console.log(`✓ Explainable reasons generated: ${JSON.stringify(intelReason.reasons)}`);

        // 1.9: Member Workload Signal calculation
        const lowSignal = calculateMemberWorkload(1);
        const modSignal = calculateMemberWorkload(4);
        const highSignal = calculateMemberWorkload(7);

        if (lowSignal.workloadSignal !== "LOW" || modSignal.workloadSignal !== "MODERATE" || highSignal.workloadSignal !== "HIGH") {
            throw new Error(`Workload signal thresholds failed. Got: ${lowSignal.workloadSignal}, ${modSignal.workloadSignal}, ${highSignal.workloadSignal}`);
        }
        console.log("✓ Member workload signals computed correctly (1 -> LOW, 4 -> MODERATE, 7 -> HIGH)");

        // ── Database Integration & RBAC Scope Tests ──────────────────────────────
        console.log("\n▶ Step 2: Setting up Test Users and Projects for Recommendation Testing...");

        const userAlice = await User.create({
            name: `Alice Phase7 ${testId}`,
            email: `alice.phase7.${testId}@test.com`,
            password: "Password123!",
            isEmailVerified: true,
        });
        createdUserIds.push(userAlice._id);

        const userBob = await User.create({
            name: `Bob Phase7 ${testId}`,
            email: `bob.phase7.${testId}@test.com`,
            password: "Password123!",
            isEmailVerified: true,
        });
        createdUserIds.push(userBob._id);

        // Alice's project
        testProject = await Project.create({
            name: `Phase 7 Project ${testId}`,
            description: "Testing Task Intelligence Engine",
            owner: userAlice._id,
            startDate: now,
            dueDate: inTenDays,
        });

        await ProjectMembership.create({
            project: testProject._id,
            user: userAlice._id,
            role: "OWNER",
        });

        // Other project Alice is NOT a member of
        otherProject = await Project.create({
            name: `Phase 7 Secret Project ${testId}`,
            description: "Alice cannot access this",
            owner: userBob._id,
            startDate: now,
            dueDate: inTenDays,
        });

        await ProjectMembership.create({
            project: otherProject._id,
            user: userBob._id,
            role: "OWNER",
        });

        console.log("✓ Test users and projects initialized.");

        // ── Step 3: Create Various Test Tasks ────────────────────────────────────
        console.log("\n▶ Step 3: Creating Database Tasks for Recommendation Validation...");

        // Task A: Alice's Personal Task (High Priority, Due Tomorrow)
        const personalTask = await Task.create({
            title: "Alice Personal Study Session",
            project: null,
            createdBy: userAlice._id,
            priority: "HIGH",
            status: "IN_PROGRESS",
            dueDate: tomorrow,
            subtasks: [{ title: "Review chapter 1", completed: false }],
        });

        // Task B: Alice's Assigned Project Task (Urgent, Overdue)
        const urgentProjectTask = await Task.create({
            title: "Urgent Server Migration",
            project: testProject._id,
            createdBy: userAlice._id,
            assignee: userAlice._id,
            priority: "URGENT",
            status: "TODO",
            dueDate: yesterday,
        });

        // Task C: Completed Task (Should be EXCLUDED from recommendations)
        const completedTask = await Task.create({
            title: "Already Finished Homework",
            project: null,
            createdBy: userAlice._id,
            priority: "URGENT",
            status: "COMPLETED",
            dueDate: yesterday,
        });

        // Task D: Project task assigned to Bob (Alice is NOT assignee)
        const bobAssignedTask = await Task.create({
            title: "Bob's Task in Shared Project",
            project: testProject._id,
            createdBy: userAlice._id,
            assignee: userBob._id,
            priority: "URGENT",
            status: "TODO",
            dueDate: tomorrow,
        });

        // Task E: Task in Unauthorized Project (Bob's private project)
        const unauthorizedTask = await Task.create({
            title: "Bob's Secret Task",
            project: otherProject._id,
            createdBy: userBob._id,
            assignee: userBob._id,
            priority: "URGENT",
            status: "TODO",
            dueDate: yesterday,
        });

        console.log("✓ Sample database tasks created.");

        // ── Step 4: Test Recommendation Engine ──────────────────────────────────
        console.log("\n▶ Step 4: Testing GET /api/tasks/recommended for Alice...");

        const recommendations = await getRecommendedTasksForUser(userAlice._id, { limit: 5 });

        const recTitles = recommendations.map((r) => r.task.title);
        console.log("Recommended tasks for Alice:", recTitles);

        // Check 1: Personal task is recommended
        const hasPersonal = recommendations.some((r) => r.task._id.toString() === personalTask._id.toString());
        if (!hasPersonal) {
            throw new Error("Personal task was expected in recommendations, but was missing");
        }
        console.log("✓ Personal task is successfully included in recommendations");

        // Check 2: Assigned project task is recommended
        const hasProjectTask = recommendations.some((r) => r.task._id.toString() === urgentProjectTask._id.toString());
        if (!hasProjectTask) {
            throw new Error("Assigned project task was expected in recommendations, but was missing");
        }
        console.log("✓ Assigned project task is successfully included in recommendations");

        // Check 3: Completed task is EXCLUDED
        const hasCompleted = recommendations.some((r) => r.task._id.toString() === completedTask._id.toString());
        if (hasCompleted) {
            throw new Error("COMPLETED task should be excluded from recommendations, but was found");
        }
        console.log("✓ Completed task is strictly excluded from recommendations");

        // Check 4: Bob's assigned task is EXCLUDED for Alice
        const hasBobTask = recommendations.some((r) => r.task._id.toString() === bobAssignedTask._id.toString());
        if (hasBobTask) {
            throw new Error("Task assigned to another user should not be recommended to Alice");
        }
        console.log("✓ Project tasks assigned to other members are excluded");

        // Check 5: Unauthorized project task is EXCLUDED
        const hasUnauthorized = recommendations.some((r) => r.task._id.toString() === unauthorizedTask._id.toString());
        if (hasUnauthorized) {
            throw new Error("Unauthorized project task was leaked into recommendations!");
        }
        console.log("✓ Unauthorized project tasks are strictly excluded");

        // Check 6: Urgency ordering (Overdue Urgent should be ranked #1)
        if (recommendations[0].task._id.toString() !== urgentProjectTask._id.toString()) {
            throw new Error(`Expected Urgent Overdue task to be ranked #1, instead got: ${recommendations[0].task.title}`);
        }
        console.log(`✓ Highest urgency task ranked #1: "${recommendations[0].task.title}" (Score: ${recommendations[0].urgencyScore})`);

        // Check 7: Recommendation structure contains explainable reasons
        const topRec = recommendations[0];
        if (!topRec.reasons || topRec.reasons.length === 0 || typeof topRec.urgencyScore !== "number") {
            throw new Error("Recommendation missing reasons or urgencyScore");
        }
        console.log(`✓ Top recommendation reasons: ${JSON.stringify(topRec.reasons)}`);

        // ── Step 5: Test getRecommendedTasks Controller Handler ──────────────────
        console.log("\n▶ Step 5: Testing taskController.getRecommendedTasks Handler...");
        const mockReq = {
            user: userAlice,
            query: { limit: "3" },
        };
        const mockRes = createMockRes();
        await getRecommendedTasks(mockReq, mockRes);

        if (mockRes.statusCode !== 200 || !mockRes.responseData.success) {
            throw new Error(`Controller failed with code ${mockRes.statusCode}: ${JSON.stringify(mockRes.responseData)}`);
        }
        if (mockRes.responseData.data.length !== 2) { // We have 2 actionable tasks for Alice
            throw new Error(`Expected 2 recommended tasks in controller response, got ${mockRes.responseData.data.length}`);
        }
        console.log(`✓ Controller GET /api/tasks/recommended returned ${mockRes.responseData.count} tasks with status 200`);

        // ── Step 6: Test getProjectWorkload Integration ──────────────────────────
        console.log("\n▶ Step 6: Testing Project Member Workload Enrichment...");
        const workloadReq = {
            project: testProject,
            membership: { role: "OWNER" },
            user: userAlice,
        };
        const workloadRes = createMockRes();
        await getProjectWorkload(workloadReq, workloadRes);

        if (workloadRes.statusCode !== 200 || !workloadRes.responseData.success) {
            throw new Error("Failed to get project workload");
        }
        const aliceWorkload = workloadRes.responseData.data.workload.find((w) => w.member._id.toString() === userAlice._id.toString());
        if (!aliceWorkload || !aliceWorkload.workloadSignal) {
            throw new Error(`Expected workloadSignal on member workload, got: ${JSON.stringify(aliceWorkload)}`);
        }
        console.log(`✓ Member workload enriched with signal: ${aliceWorkload.workloadSignal} (Active: ${aliceWorkload.activeAssigned}, Total: ${aliceWorkload.totalAssigned})`);

        // ── Step 7: Clean Up ─────────────────────────────────────────────────────
        console.log("\n▶ Step 7: Cleaning up test records...");
        await Task.deleteMany({
            _id: {
                $in: [
                    personalTask._id,
                    urgentProjectTask._id,
                    completedTask._id,
                    bobAssignedTask._id,
                    unauthorizedTask._id,
                ],
            },
        });
        await ProjectMembership.deleteMany({ project: { $in: [testProject._id, otherProject._id] } });
        await Project.deleteMany({ _id: { $in: [testProject._id, otherProject._id] } });
        await User.deleteMany({ _id: { $in: createdUserIds } });
        console.log("✓ Test records cleanly removed.");

        console.log("\n==================================================");
        console.log("🎉 ALL PHASE 7 TASK INTELLIGENCE TESTS PASSED!   ");
        console.log("==================================================\n");
    } catch (err) {
        console.error("\n❌ Phase 7 Test Failure:", err);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
        console.log("MongoDB connection closed.");
    }
}

runPhase7Tests();
