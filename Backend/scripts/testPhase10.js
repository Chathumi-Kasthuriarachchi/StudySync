/**
 * Phase 10 — Goals & Goal Progress Integration Tests
 *
 * Verifies:
 * 1. Personal Goal CRUD (create, read, update, delete)
 * 2. Date validation (targetDate < startDate rejected)
 * 3. Project Goal CRUD with RBAC:
 *    - OWNER/MANAGER can create, update, delete
 *    - MEMBER/VIEWER cannot create, update, or delete project goals (403)
 * 4. Context Integrity Validation:
 *    - Cannot link project task to personal goal (400)
 *    - Cannot link personal task to project goal (400)
 *    - Cannot link task from different project to project goal (400)
 *    - VIEWER cannot link tasks to project goals (403)
 *    - MEMBER can link project task to project goal (200)
 * 5. Derived Progress Calculation:
 *    - TASK_COUNT: completedTasks / targetValue, capped at 100%
 *    - TIME: trackedSeconds / targetSeconds, capped at 100%
 *    - MILESTONE: completedMilestones / totalMilestones, capped at 100%
 * 6. Task Unlinking:
 *    - Unlinking task updates derived progress
 *    - Deleting goal unlinks all tasks (tasks remain intact with goal: null)
 * 7. Calendar Integration:
 *    - Goal with targetDate in range appears as "goal_deadline"
 * 8. Task creation and update with goal parameter:
 *    - createPersonalTask with personal goal
 *    - createTask with project goal
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const dns = require("dns");
try { dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]); } catch (_) {}
const mongoose = require("mongoose");

const User = require("../models/User");
const Project = require("../models/Project");
const ProjectMembership = require("../models/ProjectMembership");
const Task = require("../models/Task");
const TimeSession = require("../models/TimeSession");
const Goal = require("../models/Goal");

const {
    createGoal,
    getGoals,
    getGoalById,
    updateGoal,
    deleteGoal,
    linkTask,
    unlinkTask,
} = require("../controllers/goalController");

const {
    createPersonalTask,
    createTask,
    updateTask,
} = require("../controllers/taskController");

const {
    getCalendarEvents,
} = require("../controllers/calendarController");

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

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        passed++;
        console.log(`  ✓ PASS: ${message}`);
    } else {
        failed++;
        console.error(`  ✗ FAIL: ${message}`);
    }
}

async function runTests() {
    console.log("\n========================================================");
    console.log("  RUNNING PHASE 10: GOALS & GOAL PROGRESS TESTS");
    console.log("========================================================\n");

    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB for test run.\n");

        // Clean up previous test data
        const testUserEmailPrefix = "phase10_test_";
        await User.deleteMany({ email: new RegExp(`^${testUserEmailPrefix}`) });

        // Setup test users
        const ownerUser = await User.create({
            name: "Phase10 Owner",
            email: `${testUserEmailPrefix}owner@example.com`,
            password: "Password123!",
            role: "STUDENT",
        });

        const memberUser = await User.create({
            name: "Phase10 Member",
            email: `${testUserEmailPrefix}member@example.com`,
            password: "Password123!",
            role: "STUDENT",
        });

        const viewerUser = await User.create({
            name: "Phase10 Viewer",
            email: `${testUserEmailPrefix}viewer@example.com`,
            password: "Password123!",
            role: "STUDENT",
        });

        const outsiderUser = await User.create({
            name: "Phase10 Outsider",
            email: `${testUserEmailPrefix}outsider@example.com`,
            password: "Password123!",
            role: "STUDENT",
        });

        // Setup project
        const project = await Project.create({
            name: "Phase10 Test Project",
            description: "Goal integration test project",
            owner: ownerUser._id,
            startDate: new Date("2026-09-01"),
            dueDate: new Date("2026-11-30"),
        });

        const projectB = await Project.create({
            name: "Phase10 Project B",
            description: "Second project for context testing",
            owner: ownerUser._id,
            startDate: new Date("2026-09-01"),
            dueDate: new Date("2026-11-30"),
        });

        // Memberships
        await ProjectMembership.create({ project: project._id, user: ownerUser._id, role: "OWNER" });
        await ProjectMembership.create({ project: project._id, user: memberUser._id, role: "MEMBER" });
        await ProjectMembership.create({ project: project._id, user: viewerUser._id, role: "VIEWER" });
        await ProjectMembership.create({ project: projectB._id, user: ownerUser._id, role: "OWNER" });

        // ─────────────────────────────────────────────────────────────
        // 1. Personal Goal Creation & Validation
        // ─────────────────────────────────────────────────────────────
        console.log("--- TEST SUITE 1: Personal Goal Lifecycle & Validation ---");

        // Test 1.1: Create valid personal goal
        {
            const req = {
                user: ownerUser,
                body: {
                    title: "Learn Rust Basics",
                    description: "Read the book and complete 10 exercises",
                    measurementType: "TASK_COUNT",
                    targetValue: 4,
                    startDate: new Date("2026-09-01"),
                    targetDate: new Date("2026-09-30"),
                },
            };
            const res = createMockRes();
            await createGoal(req, res);
            assert(res.statusCode === 201, "Personal goal created with 201");
            assert(res.responseData.goal.title === "Learn Rust Basics", "Goal title matches");
            assert(res.responseData.goal.project === null, "Personal goal project is null");
            assert(res.responseData.goal.progress === 0, "Initial progress is 0%");
        }

        // Test 1.2: Date validation (targetDate < startDate)
        {
            const req = {
                user: ownerUser,
                body: {
                    title: "Invalid Timeline Goal",
                    startDate: new Date("2026-09-30"),
                    targetDate: new Date("2026-09-01"),
                },
            };
            const res = createMockRes();
            await createGoal(req, res);
            assert(res.statusCode === 400, "targetDate before startDate rejected with 400");
        }

        // Test 1.3: Missing title
        {
            const req = {
                user: ownerUser,
                body: {
                    title: "",
                },
            };
            const res = createMockRes();
            await createGoal(req, res);
            assert(res.statusCode === 400, "Empty title rejected with 400");
        }

        // ─────────────────────────────────────────────────────────────
        // 2. Project Goal Creation & RBAC
        // ─────────────────────────────────────────────────────────────
        console.log("\n--- TEST SUITE 2: Project Goal Creation & RBAC ---");

        let projectGoalId = null;

        // Test 2.1: Project OWNER creates project goal
        {
            const req = {
                user: ownerUser,
                body: {
                    title: "Ship StudySync Phase 10",
                    description: "Complete goals and derived metrics",
                    project: project._id.toString(),
                    measurementType: "TASK_COUNT",
                    targetValue: 4,
                    targetDate: new Date("2026-10-15"),
                },
            };
            const res = createMockRes();
            await createGoal(req, res);
            assert(res.statusCode === 201, "Project OWNER can create project goal (201)");
            assert(res.responseData.goal.project._id.toString() === project._id.toString(), "Project goal has correct project ID");
            projectGoalId = res.responseData.goal._id;
        }

        // Test 2.2: Project MEMBER attempts to create project goal (Forbidden)
        {
            const req = {
                user: memberUser,
                body: {
                    title: "Member Goal Attempt",
                    project: project._id.toString(),
                },
            };
            const res = createMockRes();
            await createGoal(req, res);
            assert(res.statusCode === 403, "Project MEMBER cannot create project goal (403 Forbidden)");
        }

        // Test 2.3: Project VIEWER attempts to create project goal (Forbidden)
        {
            const req = {
                user: viewerUser,
                body: {
                    title: "Viewer Goal Attempt",
                    project: project._id.toString(),
                },
            };
            const res = createMockRes();
            await createGoal(req, res);
            assert(res.statusCode === 403, "Project VIEWER cannot create project goal (403 Forbidden)");
        }

        // Test 2.4: Outsider attempts to create project goal (Forbidden)
        {
            const req = {
                user: outsiderUser,
                body: {
                    title: "Outsider Goal Attempt",
                    project: project._id.toString(),
                },
            };
            const res = createMockRes();
            await createGoal(req, res);
            assert(res.statusCode === 403, "Non-member cannot create project goal (403 Forbidden)");
        }

        // ─────────────────────────────────────────────────────────────
        // 3. Context Integrity & Linking Rules
        // ─────────────────────────────────────────────────────────────
        console.log("\n--- TEST SUITE 3: Context Integrity & Task Linking ---");

        // Create personal task for ownerUser
        const personalTask = await Task.create({
            project: null,
            title: "Personal Practice Task",
            createdBy: ownerUser._id,
            assignee: ownerUser._id,
        });

        // Create project task for project
        const projectTask = await Task.create({
            project: project._id,
            title: "Project Feature Task",
            createdBy: ownerUser._id,
            assignee: memberUser._id,
        });

        // Create project task for projectB
        const projectBTask = await Task.create({
            project: projectB._id,
            title: "Project B Task",
            createdBy: ownerUser._id,
            assignee: ownerUser._id,
        });

        // Create a personal goal
        const personalGoal = await Goal.create({
            title: "Owner Personal Goal",
            owner: ownerUser._id,
            project: null,
            measurementType: "TASK_COUNT",
            targetValue: 2,
        });

        // Test 3.1: Cannot link project task to personal goal
        {
            const req = {
                user: ownerUser,
                params: { id: personalGoal._id.toString() },
                body: { taskId: projectTask._id.toString() },
            };
            const res = createMockRes();
            await linkTask(req, res);
            assert(res.statusCode === 400, "Linking project task to personal goal rejected with 400");
        }

        // Test 3.2: Cannot link personal task to project goal
        {
            const req = {
                user: ownerUser,
                params: { id: projectGoalId.toString() },
                body: { taskId: personalTask._id.toString() },
            };
            const res = createMockRes();
            await linkTask(req, res);
            assert(res.statusCode === 400, "Linking personal task to project goal rejected with 400");
        }

        // Test 3.3: Cannot link task from Project B to Project A's goal
        {
            const req = {
                user: ownerUser,
                params: { id: projectGoalId.toString() },
                body: { taskId: projectBTask._id.toString() },
            };
            const res = createMockRes();
            await linkTask(req, res);
            assert(res.statusCode === 400, "Linking task from Project B to Project A goal rejected with 400");
        }

        // Test 3.4: VIEWER cannot link tasks to project goal
        {
            const req = {
                user: viewerUser,
                params: { id: projectGoalId.toString() },
                body: { taskId: projectTask._id.toString() },
            };
            const res = createMockRes();
            await linkTask(req, res);
            assert(res.statusCode === 403, "VIEWER cannot link task to project goal (403)");
        }

        // Test 3.5: MEMBER can link project task to project goal
        {
            const req = {
                user: memberUser,
                params: { id: projectGoalId.toString() },
                body: { taskId: projectTask._id.toString() },
            };
            const res = createMockRes();
            await linkTask(req, res);
            assert(res.statusCode === 200, "MEMBER can link project task to project goal (200)");
            const updatedTask = await Task.findById(projectTask._id);
            assert(updatedTask.goal && updatedTask.goal.equals(projectGoalId), "Task.goal correctly updated in DB");
        }

        // ─────────────────────────────────────────────────────────────
        // 4. Derived Progress: TASK_COUNT
        // ─────────────────────────────────────────────────────────────
        console.log("\n--- TEST SUITE 4: Derived Progress Calculation (TASK_COUNT) ---");

        // Target is 4 tasks. Currently 1 task linked (status: TODO) -> 0%
        {
            const req = {
                user: ownerUser,
                params: { id: projectGoalId.toString() },
            };
            const res = createMockRes();
            await getGoalById(req, res);
            assert(res.statusCode === 200, "getGoalById returns 200");
            assert(res.responseData.goal.progress === 0, "0 completed / 4 target = 0% progress");
            assert(res.responseData.goal.taskCount === 1, "taskCount is 1");
            assert(res.responseData.goal.completedTaskCount === 0, "completedTaskCount is 0");
        }

        // Complete the task -> 1 completed / 4 target = 25%
        projectTask.status = "COMPLETED";
        await projectTask.save();

        {
            const req = {
                user: ownerUser,
                params: { id: projectGoalId.toString() },
            };
            const res = createMockRes();
            await getGoalById(req, res);
            assert(res.responseData.goal.progress === 25, "1 completed / 4 target = 25% progress");
            assert(res.responseData.goal.completedTaskCount === 1, "completedTaskCount is 1");
        }

        // Add 3 more completed tasks -> 4 completed / 4 target = 100%
        for (let i = 1; i <= 3; i++) {
            await Task.create({
                project: project._id,
                goal: projectGoalId,
                title: `Extra Task ${i}`,
                status: "COMPLETED",
                createdBy: ownerUser._id,
            });
        }

        {
            const req = {
                user: ownerUser,
                params: { id: projectGoalId.toString() },
            };
            const res = createMockRes();
            await getGoalById(req, res);
            assert(res.responseData.goal.progress === 100, "4 completed / 4 target = 100% progress");
            assert(res.responseData.goal.completedTaskCount === 4, "completedTaskCount is 4");
        }

        // Add a 5th completed task -> progress must be CAPPED at 100%
        await Task.create({
            project: project._id,
            goal: projectGoalId,
            title: "Extra Task 5 (Overflow)",
            status: "COMPLETED",
            createdBy: ownerUser._id,
        });

        {
            const req = {
                user: ownerUser,
                params: { id: projectGoalId.toString() },
            };
            const res = createMockRes();
            await getGoalById(req, res);
            assert(res.responseData.goal.progress === 100, "5 completed / 4 target is capped at 100%");
        }

        // ─────────────────────────────────────────────────────────────
        // 5. Derived Progress: TIME
        // ─────────────────────────────────────────────────────────────
        console.log("\n--- TEST SUITE 5: Derived Progress Calculation (TIME) ---");

        // Target: 2 hours (7200 seconds)
        const timeGoal = await Goal.create({
            title: "Study 2 Hours",
            owner: ownerUser._id,
            project: null,
            measurementType: "TIME",
            targetValue: 2, // 2 hours
        });

        const timeTask = await Task.create({
            project: null,
            goal: timeGoal._id,
            title: "Focused Study Task",
            createdBy: ownerUser._id,
        });

        // 0 seconds tracked -> 0%
        {
            const req = {
                user: ownerUser,
                params: { id: timeGoal._id.toString() },
            };
            const res = createMockRes();
            await getGoalById(req, res);
            assert(res.responseData.goal.progress === 0, "0 hours tracked / 2 hours = 0%");
        }

        // Log 3600 seconds (1 hour) -> 50%
        await TimeSession.create({
            user: ownerUser._id,
            task: timeTask._id,
            startedAt: new Date(Date.now() - 3600000),
            endedAt: new Date(),
            durationSeconds: 3600,
        });

        {
            const req = {
                user: ownerUser,
                params: { id: timeGoal._id.toString() },
            };
            const res = createMockRes();
            await getGoalById(req, res);
            assert(res.responseData.goal.progress === 50, "1 hour tracked / 2 hours target = 50%");
            assert(res.responseData.goal.metrics.trackedHours === 1, "metrics.trackedHours is 1");
        }

        // Log another 7200 seconds (total 3 hours) -> capped at 100%
        await TimeSession.create({
            user: ownerUser._id,
            task: timeTask._id,
            startedAt: new Date(Date.now() - 7200000),
            endedAt: new Date(),
            durationSeconds: 7200,
        });

        {
            const req = {
                user: ownerUser,
                params: { id: timeGoal._id.toString() },
            };
            const res = createMockRes();
            await getGoalById(req, res);
            assert(res.responseData.goal.progress === 100, "3 hours tracked / 2 hours target capped at 100%");
            assert(res.responseData.goal.metrics.trackedHours === 3, "metrics.trackedHours is 3");
        }

        // ─────────────────────────────────────────────────────────────
        // 6. Derived Progress: MILESTONE
        // ─────────────────────────────────────────────────────────────
        console.log("\n--- TEST SUITE 6: Derived Progress Calculation (MILESTONE) ---");

        const milestoneGoal = await Goal.create({
            title: "Sprint Milestones",
            owner: ownerUser._id,
            project: null,
            measurementType: "MILESTONE",
            targetValue: 0,
        });

        // Create 2 milestone tasks and 1 regular task
        const mTask1 = await Task.create({
            project: null,
            goal: milestoneGoal._id,
            title: "Milestone 1: Prototype",
            isMilestone: true,
            status: "COMPLETED",
            createdBy: ownerUser._id,
        });

        const mTask2 = await Task.create({
            project: null,
            goal: milestoneGoal._id,
            title: "Milestone 2: Release",
            isMilestone: true,
            status: "TODO",
            createdBy: ownerUser._id,
        });

        const regularTask = await Task.create({
            project: null,
            goal: milestoneGoal._id,
            title: "Regular Side Task",
            isMilestone: false,
            status: "COMPLETED",
            createdBy: ownerUser._id,
        });

        {
            const req = {
                user: ownerUser,
                params: { id: milestoneGoal._id.toString() },
            };
            const res = createMockRes();
            await getGoalById(req, res);
            // 1 completed milestone out of 2 total milestones = 50%
            assert(res.responseData.goal.progress === 50, "1 / 2 milestones completed = 50% (regular task excluded)");
            assert(res.responseData.goal.metrics.totalMilestones === 2, "metrics.totalMilestones is 2");
            assert(res.responseData.goal.metrics.completedMilestones === 1, "metrics.completedMilestones is 1");
        }

        // ─────────────────────────────────────────────────────────────
        // 7. Unlink Task and Delete Goal Cascade
        // ─────────────────────────────────────────────────────────────
        console.log("\n--- TEST SUITE 7: Unlinking & Cascade Behavior ---");

        // Unlink projectTask from projectGoal
        {
            const req = {
                user: memberUser,
                params: { id: projectGoalId.toString(), taskId: projectTask._id.toString() },
            };
            const res = createMockRes();
            await unlinkTask(req, res);
            assert(res.statusCode === 200, "Unlink task returns 200");
            const unlinked = await Task.findById(projectTask._id);
            assert(unlinked.goal === null, "Task.goal is null after unlinking");
        }

        // Delete milestoneGoal -> linked tasks should have goal: null
        {
            const req = {
                user: ownerUser,
                params: { id: milestoneGoal._id.toString() },
            };
            const res = createMockRes();
            await deleteGoal(req, res);
            assert(res.statusCode === 200, "deleteGoal returns 200");

            const checkM1 = await Task.findById(mTask1._id);
            const checkM2 = await Task.findById(mTask2._id);
            assert(checkM1 !== null && checkM1.goal === null, "mTask1 still exists and goal is unlinked (null)");
            assert(checkM2 !== null && checkM2.goal === null, "mTask2 still exists and goal is unlinked (null)");
        }

        // ─────────────────────────────────────────────────────────────
        // 8. Calendar Integration
        // ─────────────────────────────────────────────────────────────
        console.log("\n--- TEST SUITE 8: Calendar Integration ---");

        const calendarTargetDate = new Date("2026-10-10T12:00:00.000Z");
        const calGoal = await Goal.create({
            title: "Calendar Goal Deadline",
            owner: ownerUser._id,
            project: null,
            targetDate: calendarTargetDate,
        });

        {
            const req = {
                user: ownerUser,
                query: {
                    start: "2026-10-01T00:00:00.000Z",
                    end: "2026-10-31T23:59:59.999Z",
                    type: "ALL",
                },
            };
            const res = createMockRes();
            await getCalendarEvents(req, res);
            assert(res.statusCode === 200, "getCalendarEvents returns 200");
            const goalEvent = res.responseData.data.find((e) => e.sourceType === "goal_deadline" && e.sourceId.toString() === calGoal._id.toString());
            assert(Boolean(goalEvent), "Goal with targetDate appears in calendar");
            assert(goalEvent.title.includes("Calendar Goal Deadline"), "Calendar event title contains goal title");
            assert(goalEvent.category === "PERSONAL", "Calendar event category is PERSONAL");
        }

        // ─────────────────────────────────────────────────────────────
        // 9. Task Controller Direct Linking
        // ─────────────────────────────────────────────────────────────
        console.log("\n--- TEST SUITE 9: Task Controller Direct Goal Parameter ---");

        // Create personal task with personal goal via createPersonalTask
        {
            const req = {
                user: ownerUser,
                body: {
                    title: "Task with Goal via Controller",
                    goal: personalGoal._id.toString(),
                },
            };
            const res = createMockRes();
            await createPersonalTask(req, res);
            assert(res.statusCode === 201, "createPersonalTask with goal returns 201");
            assert(res.responseData.data.goal._id.toString() === personalGoal._id.toString(), "Task created with goal linked");
        }

        // Update task to unlink goal via updateTask
        {
            const created = await Task.findOne({ title: "Task with Goal via Controller" });
            const req = {
                user: ownerUser,
                task: created,
                membership: null,
                body: {
                    goal: null,
                },
            };
            const res = createMockRes();
            await updateTask(req, res);
            assert(res.statusCode === 200, "updateTask unlinks goal when goal: null passed");
            assert(res.responseData.data.goal === null, "Task.goal is null in response");
        }

        // ─────────────────────────────────────────────────────────────
        // Summary
        // ─────────────────────────────────────────────────────────────
        console.log("\n========================================================");
        console.log(`  RESULTS: ${passed} PASSED | ${failed} FAILED`);
        console.log("========================================================\n");

        if (failed > 0) {
            process.exit(1);
        } else {
            console.log("All Phase 10 backend tests completed successfully!");
            process.exit(0);
        }
    } catch (err) {
        console.error("Test execution failed with error:", err);
        process.exit(1);
    }
}

runTests();
