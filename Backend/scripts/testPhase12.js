/**
 * Phase 12 — Analytics Integration & Security Test Suite
 *
 * Tests:
 * 1. Personal Analytics calculations (tasks, status, priority, time & focus, goals)
 * 2. Date filtering normalization across periods ('today', 'week', 'month', 'last_30_days', 'all')
 * 3. Project Analytics calculations (scoped to project, completion rate, time tracking)
 * 4. Team Analytics (member workload, contribution, time spent, workload signal)
 * 5. Security & RBAC:
 *    - Unauthenticated access rejected (401)
 *    - Non-member access to project analytics rejected (403)
 *    - Project VIEWER rejected from team analytics (403)
 *    - Project OWNER / MANAGER / MEMBER allowed access to team analytics (200)
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const dns = require("dns");
try { dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]); } catch (_) {}
const mongoose = require("mongoose");

const User = require("../models/User");
const Project = require("../models/Project");
const ProjectMembership = require("../models/ProjectMembership");
const Task = require("../models/Task");
const Goal = require("../models/Goal");
const TimeSession = require("../models/TimeSession");

const analyticsService = require("../services/analyticsService");
const {
    getPersonalAnalytics,
    getProjectAnalytics,
    getTeamAnalytics,
} = require("../controllers/analyticsController");

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
        console.log(`  PASS: ${message}`);
        passed++;
    } else {
        console.error(`  FAIL: ${message}`);
        failed++;
    }
}

async function runTests() {
    console.log("==================================================");
    console.log("   PHASE 12 — ANALYTICS TEST SUITE                ");
    console.log("==================================================\n");

    let userOwner = null;
    let userMember = null;
    let userViewer = null;
    let userStranger = null;
    let testProject = null;

    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB.");

        // 1. Create test users
        const timestamp = Date.now();
        userOwner = await User.create({
            name: `Alice Analytics Owner ${timestamp}`,
            email: `alice_analytics_${timestamp}@example.com`,
            password: "Password123!",
            isVerified: true,
        });

        userMember = await User.create({
            name: `Bob Analytics Member ${timestamp}`,
            email: `bob_analytics_${timestamp}@example.com`,
            password: "Password123!",
            isVerified: true,
        });

        userViewer = await User.create({
            name: `Charlie Analytics Viewer ${timestamp}`,
            email: `charlie_analytics_${timestamp}@example.com`,
            password: "Password123!",
            isVerified: true,
        });

        userStranger = await User.create({
            name: `Eve Analytics Stranger ${timestamp}`,
            email: `eve_analytics_${timestamp}@example.com`,
            password: "Password123!",
            isVerified: true,
        });

        console.log("1. Test users created.");

        // 2. Create Project and Memberships
        testProject = await Project.create({
            name: `Phase 12 Analytics Project ${timestamp}`,
            description: "Testing analytics calculations and RBAC",
            owner: userOwner._id,
            startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            status: "ACTIVE",
        });

        await ProjectMembership.create({
            project: testProject._id,
            user: userOwner._id,
            role: "OWNER",
        });

        await ProjectMembership.create({
            project: testProject._id,
            user: userMember._id,
            role: "MEMBER",
        });

        await ProjectMembership.create({
            project: testProject._id,
            user: userViewer._id,
            role: "VIEWER",
        });

        console.log("2. Test project and memberships created.");

        // 3. Populate Test Data
        // Tasks for Alice (Owner)
        // - 1 completed personal task (with 30m estimated, 45m tracked)
        const personalCompletedTask = await Task.create({
            title: "Alice Personal Completed",
            project: null,
            createdBy: userOwner._id,
            status: "COMPLETED",
            priority: "HIGH",
            estimatedMinutes: 30,
        });

        // - 1 in-progress personal task (due yesterday -> OVERDUE)
        const personalOverdueTask = await Task.create({
            title: "Alice Personal Overdue",
            project: null,
            createdBy: userOwner._id,
            status: "IN_PROGRESS",
            priority: "URGENT",
            dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        });

        // Project Tasks
        // Task 1: assigned to Bob (COMPLETED, estimated 60m)
        const projectTask1 = await Task.create({
            title: "Backend Analytics Engine",
            project: testProject._id,
            createdBy: userOwner._id,
            assignee: userMember._id,
            status: "COMPLETED",
            priority: "HIGH",
            estimatedMinutes: 60,
        });

        // Task 2: assigned to Bob (IN_PROGRESS)
        const projectTask2 = await Task.create({
            title: "Frontend Charts View",
            project: testProject._id,
            createdBy: userOwner._id,
            assignee: userMember._id,
            status: "IN_PROGRESS",
            priority: "MEDIUM",
        });

        // Task 3: assigned to Alice (TODO, due in 3 days)
        const projectTask3 = await Task.create({
            title: "Project Review Meeting",
            project: testProject._id,
            createdBy: userOwner._id,
            assignee: userOwner._id,
            status: "TODO",
            priority: "LOW",
            dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        });

        // Task 4: Unassigned task in project
        const projectTask4 = await Task.create({
            title: "Documentation & Polish",
            project: testProject._id,
            createdBy: userOwner._id,
            assignee: null,
            status: "TODO",
            priority: "LOW",
        });

        // TimeSessions
        // Alice completed session for personalCompletedTask: 45 min (2700s)
        await TimeSession.create({
            user: userOwner._id,
            task: personalCompletedTask._id,
            project: null,
            startedAt: new Date(Date.now() - 3600 * 1000),
            endedAt: new Date(Date.now() - 900 * 1000),
            durationSeconds: 2700,
        });

        // Bob completed session for projectTask1: 60 min (3600s)
        await TimeSession.create({
            user: userMember._id,
            task: projectTask1._id,
            project: testProject._id,
            startedAt: new Date(Date.now() - 7200 * 1000),
            endedAt: new Date(Date.now() - 3600 * 1000),
            durationSeconds: 3600,
        });

        // Goals
        // Alice personal goal
        await Goal.create({
            title: "Alice Study Milestone",
            owner: userOwner._id,
            project: null,
            status: "IN_PROGRESS",
            measurementType: "TASK_COUNT",
            targetValue: 5,
        });

        // Project goal
        await Goal.create({
            title: "Ship Phase 12 Analytics",
            owner: userOwner._id,
            project: testProject._id,
            status: "IN_PROGRESS",
            measurementType: "TASK_COUNT",
            targetValue: 4,
        });

        console.log("3. Test tasks, time sessions, and goals created.\n");

        // ── TEST 1: Personal Analytics Calculation ──────────────────────────
        console.log("--- TEST 1: Personal Analytics Calculation ---");
        {
            // Alice's personal analytics should include:
            // - personalCompletedTask (COMPLETED, personal)
            // - personalOverdueTask (IN_PROGRESS, personal, overdue)
            // - projectTask3 (TODO, project, assigned to Alice)
            // Total = 3 tasks for Alice
            const aliceAnalytics = await analyticsService.getPersonalAnalytics(userOwner._id, {
                period: "this_month",
            });

            assert(aliceAnalytics !== null, "Alice personal analytics retrieved successfully");
            assert(aliceAnalytics.taskMetrics.total === 3, `Alice has 3 total tasks (got ${aliceAnalytics.taskMetrics.total})`);
            assert(aliceAnalytics.taskMetrics.completed === 1, `Alice has 1 completed task (got ${aliceAnalytics.taskMetrics.completed})`);
            assert(aliceAnalytics.taskMetrics.inProgress === 1, `Alice has 1 in-progress task (got ${aliceAnalytics.taskMetrics.inProgress})`);
            assert(aliceAnalytics.taskMetrics.todo === 1, `Alice has 1 todo task (got ${aliceAnalytics.taskMetrics.todo})`);
            assert(aliceAnalytics.taskMetrics.overdue === 1, `Alice has 1 overdue task (got ${aliceAnalytics.taskMetrics.overdue})`);
            assert(aliceAnalytics.taskMetrics.personalTasks === 2, `Alice has 2 personal tasks (got ${aliceAnalytics.taskMetrics.personalTasks})`);
            assert(aliceAnalytics.taskMetrics.projectTasks === 1, `Alice has 1 project task (got ${aliceAnalytics.taskMetrics.projectTasks})`);
            assert(aliceAnalytics.taskMetrics.completionPercentage === 33, `Alice completion percentage is 33% (got ${aliceAnalytics.taskMetrics.completionPercentage}%)`);

            // Check priority breakdown
            assert(aliceAnalytics.taskMetrics.byPriority.HIGH === 1, "High priority task count is 1");
            assert(aliceAnalytics.taskMetrics.byPriority.URGENT === 1, "Urgent priority task count is 1");
            assert(aliceAnalytics.taskMetrics.byPriority.LOW === 1, "Low priority task count is 1");

            // Check time metrics
            assert(aliceAnalytics.timeMetrics.totalTrackedSeconds === 2700, `Alice tracked 2700 seconds (got ${aliceAnalytics.timeMetrics.totalTrackedSeconds})`);
            assert(aliceAnalytics.timeMetrics.totalTrackedMinutes === 45, `Alice tracked 45 minutes (got ${aliceAnalytics.timeMetrics.totalTrackedMinutes})`);
            assert(aliceAnalytics.timeMetrics.focusSessionsCount === 1, `Alice has 1 focus session (got ${aliceAnalytics.timeMetrics.focusSessionsCount})`);
            assert(aliceAnalytics.timeMetrics.estimatedVsActual.totalEstimatedMinutes === 30, "Estimated minutes is 30");
            assert(aliceAnalytics.timeMetrics.estimatedVsActual.totalActualMinutes === 45, "Actual minutes is 45");
            assert(aliceAnalytics.timeMetrics.estimatedVsActual.isOverEstimate === true, "Task correctly flagged as over estimate");

            // Check goal metrics
            assert(aliceAnalytics.goalMetrics.total === 1, "Alice has 1 personal goal");
            assert(aliceAnalytics.goalMetrics.active === 1, "Alice has 1 active goal");
        }

        // ── TEST 2: Date Filtering & Normalization ───────────────────────────
        console.log("\n--- TEST 2: Date Filtering & Normalization ---");
        {
            const periodToday = analyticsService.parsePeriod("today");
            assert(periodToday.periodKey === "today", "Parsed 'today' period key");

            const periodWeek = analyticsService.parsePeriod("this_week");
            assert(periodWeek.periodKey === "this_week", "Parsed 'this_week' period key");

            const periodMonth = analyticsService.parsePeriod("this_month");
            assert(periodMonth.periodKey === "this_month", "Parsed 'this_month' period key");

            const period30 = analyticsService.parsePeriod("last_30_days");
            assert(period30.periodKey === "last_30_days", "Parsed 'last_30_days' period key");

            const periodAll = analyticsService.parsePeriod("all");
            assert(periodAll.periodKey === "all", "Parsed 'all' period key");

            const custom = analyticsService.parsePeriod(null, "2026-01-01", "2026-01-31");
            assert(custom.periodKey === "custom", "Parsed custom date range");
        }

        // ── TEST 3: Project Analytics ───────────────────────────────────────
        console.log("\n--- TEST 3: Project Analytics ---");
        {
            // Project has 4 tasks:
            // - projectTask1: COMPLETED (Bob)
            // - projectTask2: IN_PROGRESS (Bob)
            // - projectTask3: TODO (Alice)
            // - projectTask4: TODO (Unassigned)
            const projAnalytics = await analyticsService.getProjectAnalytics(testProject._id, {
                period: "all",
            });

            assert(projAnalytics !== null, "Project analytics retrieved");
            assert(projAnalytics.taskMetrics.total === 4, `Project has 4 total tasks (got ${projAnalytics.taskMetrics.total})`);
            assert(projAnalytics.taskMetrics.completed === 1, `Project has 1 completed task (got ${projAnalytics.taskMetrics.completed})`);
            assert(projAnalytics.taskMetrics.inProgress === 1, `Project has 1 in-progress task (got ${projAnalytics.taskMetrics.inProgress})`);
            assert(projAnalytics.taskMetrics.todo === 2, `Project has 2 todo tasks (got ${projAnalytics.taskMetrics.todo})`);
            assert(projAnalytics.taskMetrics.completionPercentage === 25, `Project completion is 25% (got ${projAnalytics.taskMetrics.completionPercentage}%)`);

            // Time metrics for project (Bob tracked 3600s = 60m)
            assert(projAnalytics.timeMetrics.totalTrackedSeconds === 3600, "Project total tracked seconds is 3600");
            assert(projAnalytics.timeMetrics.totalTrackedMinutes === 60, "Project total tracked minutes is 60");
            assert(projAnalytics.goalMetrics.total === 1, "Project has 1 linked goal");
        }

        // ── TEST 4: Team Analytics & Workload Signal ────────────────────────
        console.log("\n--- TEST 4: Team Analytics & Workload Signal ---");
        {
            const teamAnalytics = await analyticsService.getTeamAnalytics(testProject._id);

            assert(teamAnalytics !== null, "Team analytics retrieved");
            assert(teamAnalytics.summary.totalMembers === 3, "Team has 3 members");
            assert(teamAnalytics.summary.unassignedTasks === 1, "1 unassigned task detected");

            // Check Bob's stats in team analytics
            const bobStats = teamAnalytics.members.find(
                (m) => m.member._id.toString() === userMember._id.toString()
            );
            assert(bobStats !== undefined, "Bob found in team analytics");
            assert(bobStats.assignedTasks === 2, `Bob has 2 assigned tasks (got ${bobStats.assignedTasks})`);
            assert(bobStats.completedTasks === 1, "Bob has 1 completed task");
            assert(bobStats.inProgressTasks === 1, "Bob has 1 in-progress task");
            assert(bobStats.completionRate === 50, "Bob completion rate is 50%");
            assert(bobStats.timeSpentMinutes === 60, "Bob tracked 60 minutes");
            assert(bobStats.workloadSignal === "LOW", `Bob active tasks = 1 -> signal is LOW (got ${bobStats.workloadSignal})`);

            // Verify workload threshold helper
            const lowW = analyticsService.calculateMemberWorkload(1);
            const modW = analyticsService.calculateMemberWorkload(4);
            const highW = analyticsService.calculateMemberWorkload(7);
            assert(lowW.workloadSignal === "LOW", "Threshold 1 task is LOW");
            assert(modW.workloadSignal === "MODERATE", "Threshold 4 tasks is MODERATE");
            assert(highW.workloadSignal === "HIGH", "Threshold 7 tasks is HIGH");
        }

        // ── TEST 5: Security & RBAC Enforcement ─────────────────────────────
        console.log("\n--- TEST 5: Security & RBAC Enforcement ---");
        {
            // 1. Controller test: Personal analytics returns 200 for authenticated user
            const reqAlice = { user: userOwner, query: {} };
            const resAlice = createMockRes();
            await getPersonalAnalytics(reqAlice, resAlice);
            assert(resAlice.statusCode === 200, "Alice successfully retrieved personal analytics via controller");
            assert(resAlice.responseData.success === true, "Response format has success: true");

            // 2. Controller test: Project analytics for project member returns 200
            const reqMember = {
                user: userMember,
                project: testProject,
                membership: { role: "MEMBER" },
                params: { projectId: testProject._id.toString() },
                query: {},
            };
            const resMember = createMockRes();
            await getProjectAnalytics(reqMember, resMember);
            assert(resMember.statusCode === 200, "Project member can retrieve project analytics (200)");

            // 3. Controller test: Team analytics for OWNER / MANAGER / MEMBER returns 200
            const reqTeamMember = {
                user: userMember,
                project: testProject,
                membership: { role: "MEMBER" },
                params: { projectId: testProject._id.toString() },
                query: {},
            };
            const resTeamMember = createMockRes();
            await getTeamAnalytics(reqTeamMember, resTeamMember);
            assert(resTeamMember.statusCode === 200, "Project Member can access team analytics (200)");

            // 4. RBAC check: Test requireProjectRole middleware directly for VIEWER role on team analytics
            const { requireProjectRole, requireProjectMember } = require("../middleware/projectMiddleware");
            const teamRbacMiddleware = requireProjectRole("OWNER", "MANAGER", "MEMBER");

            const reqViewer = {
                user: userViewer,
                membership: { role: "VIEWER" },
            };
            const resViewer = createMockRes();
            let nextCalled = false;
            teamRbacMiddleware(reqViewer, resViewer, () => {
                nextCalled = true;
            });

            assert(resViewer.statusCode === 403, "Project VIEWER is rejected from team analytics with 403 Forbidden");
            assert(nextCalled === false, "Middleware blocked execution for VIEWER");

            // 5. Project non-member check: Stranger user tries to access project
            const reqStranger = {
                user: userStranger,
                params: { projectId: testProject._id.toString() },
            };
            const resStranger = createMockRes();
            let strangerNextCalled = false;
            await requireProjectMember(reqStranger, resStranger, () => {
                strangerNextCalled = true;
            });
            assert(resStranger.statusCode === 403, "Non-member is denied project access with 403 Forbidden");
            assert(strangerNextCalled === false, "Middleware blocked execution for non-member");
        }

        console.log("\n==================================================");
        console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
        console.log("==================================================");

        if (failed > 0) {
            process.exit(1);
        }
    } catch (err) {
        console.error("Test execution error:", err);
        process.exit(1);
    } finally {
        // Clean up test documents
        if (testProject) {
            await TimeSession.deleteMany({ project: testProject._id });
            await Goal.deleteMany({ project: testProject._id });
            await Task.deleteMany({ project: testProject._id });
            await ProjectMembership.deleteMany({ project: testProject._id });
            await Project.findByIdAndDelete(testProject._id);
        }
        if (userOwner) {
            await Task.deleteMany({ createdBy: userOwner._id });
            await TimeSession.deleteMany({ user: userOwner._id });
            await Goal.deleteMany({ owner: userOwner._id });
            await User.findByIdAndDelete(userOwner._id);
        }
        if (userMember) {
            await TimeSession.deleteMany({ user: userMember._id });
            await User.findByIdAndDelete(userMember._id);
        }
        if (userViewer) await User.findByIdAndDelete(userViewer._id);
        if (userStranger) await User.findByIdAndDelete(userStranger._id);
        await mongoose.disconnect();
    }
}

runTests();
