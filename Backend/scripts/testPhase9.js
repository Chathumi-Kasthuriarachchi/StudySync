/**
 * Phase 9 — Time Tracking & Focus Integration Tests
 *
 * Tests:
 * 1. Task estimatedMinutes creation and validation
 * 2. Starting timer on personal task
 * 3. Starting timer on project task
 * 4. Active timer retrieval (GET /api/time/active)
 * 5. Single active timer enforcement (one active timer per user)
 * 6. Unauthorized personal task time tracking rejected (403)
 * 7. Unauthorized project task time tracking rejected (403)
 * 8. Invalid task ID rejected (400)
 * 9. Non-existent task rejected (404)
 * 10. Completed task time tracking blocked (400)
 * 11. Stopping timer: server-authoritative duration calculation & persistence
 * 12. Stopping when no timer exists rejected (400)
 * 13. Cancel timer discards active session
 * 14. Multiple sessions accumulation and Task Time Summary (estimated vs. actual)
 * 15. User today focus summary
 * 16. User isolation (User A's timer does not affect User B's timer)
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

const {
    startTimer,
    stopTimer,
    cancelTimer,
    getActiveTimer,
    getTaskTimeSummary,
    getTodaySummary,
} = require("../controllers/timeController");

const {
    createPersonalTask,
    createTask,
    updateTask,
} = require("../controllers/taskController");

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

function assert(condition, label) {
    if (condition) {
        console.log(`  ✓ ${label}`);
        passed++;
    } else {
        console.error(`  ✗ FAIL: ${label}`);
        failed++;
    }
}

async function runPhase9Tests() {
    console.log("\n╔══════════════════════════════════════════════════════════╗");
    console.log("║         Phase 9 — Time Tracking & Focus Tests           ║");
    console.log("╚══════════════════════════════════════════════════════════╝\n");

    const mongoURI = process.env.MONGO_URI || "mongodb://localhost:27017/studysync";
    console.log(`Connecting to MongoDB...`);
    await mongoose.connect(mongoURI);
    console.log("✓ MongoDB Connected successfully.\n");

    const testPrefix = `p9test_${Date.now()}`;

    // ── SETUP ─────────────────────────────────────────────────────────────────
    console.log("── Setup: Creating test users and tasks ───────────────────");

    const userA = await User.create({
        name: "P9 UserA",
        email: `${testPrefix}_a@test.com`,
        password: "TestPass123!",
        isEmailVerified: true,
    });

    const userB = await User.create({
        name: "P9 UserB",
        email: `${testPrefix}_b@test.com`,
        password: "TestPass123!",
        isEmailVerified: true,
    });

    const project = await Project.create({
        name: `${testPrefix} Study Project`,
        description: "Project for Phase 9 testing",
        owner: userA._id,
        startDate: new Date(),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    await ProjectMembership.create({
        project: project._id,
        user: userA._id,
        role: "OWNER",
    });

    console.log("  ✓ Test users and project created\n");

    try {
        // ── Test 1: Task estimatedMinutes creation & validation ──────────────
        console.log("── Test 1: Task estimatedMinutes Creation & Validation ────");
        {
            // Personal task with valid estimatedMinutes (120 mins = 2h)
            const req = {
                user: userA,
                body: {
                    title: "Personal Task with Estimate",
                    estimatedMinutes: 120,
                },
            };
            const res = createMockRes();
            await createPersonalTask(req, res);
            assert(res.statusCode === 201, "Personal task with estimatedMinutes created (201)");
            assert(res.responseData.data.estimatedMinutes === 120, "estimatedMinutes equals 120");

            // Project task with valid estimatedMinutes
            const reqP = {
                user: userA,
                project,
                membership: { role: "OWNER" },
                body: {
                    title: "Project Task with Estimate",
                    estimatedMinutes: 90,
                },
            };
            const resP = createMockRes();
            await createTask(reqP, resP);
            assert(resP.statusCode === 201, "Project task with estimatedMinutes created (201)");
            assert(resP.responseData.data.estimatedMinutes === 90, "Project task estimatedMinutes equals 90");

            // Negative estimatedMinutes rejected
            const reqNeg = {
                user: userA,
                body: {
                    title: "Negative Estimate Task",
                    estimatedMinutes: -15,
                },
            };
            const resNeg = createMockRes();
            await createPersonalTask(reqNeg, resNeg);
            assert(resNeg.statusCode === 400, "Negative estimatedMinutes rejected with 400");
        }

        // ── Test 2: Starting Timer on Personal Task ───────────────────────────
        console.log("\n── Test 2: Starting Timer on Personal Task ──────────────");
        let personalTask;
        {
            personalTask = await Task.create({
                title: "Personal Coding Session",
                createdBy: userA._id,
                assignee: userA._id,
                estimatedMinutes: 60,
                status: "TODO",
            });

            const req = {
                user: userA,
                body: { taskId: personalTask._id.toString() },
            };
            const res = createMockRes();
            await startTimer(req, res);

            assert(res.statusCode === 201, "Timer started on personal task (201)");
            assert(res.responseData.success === true, "Response reports success = true");
            assert(res.responseData.data.task._id.toString() === personalTask._id.toString(), "Session references correct task");
            assert(res.responseData.data.endedAt === null, "Active session has endedAt = null");
            assert(res.responseData.data.startedAt instanceof Date, "Session startedAt is a Date object");
        }

        // ── Test 3: Single Active Timer Enforcement ───────────────────────────
        console.log("\n── Test 3: Single Active Timer Enforcement ──────────────");
        {
            const secondTask = await Task.create({
                title: "Second Personal Task",
                createdBy: userA._id,
                assignee: userA._id,
            });

            const req = {
                user: userA,
                body: { taskId: secondTask._id.toString() },
            };
            const res = createMockRes();
            await startTimer(req, res);

            assert(res.statusCode === 400, "Starting second timer while one is active rejected (400)");
            assert(res.responseData.code === "ACTIVE_TIMER_EXISTS", "Error code is ACTIVE_TIMER_EXISTS");
            assert(res.responseData.message.includes("Personal Coding Session"), "Error mentions active task title");
        }

        // ── Test 4: Active Timer Retrieval ────────────────────────────────────
        console.log("\n── Test 4: Active Timer Retrieval (GET /api/time/active) ─");
        {
            const req = { user: userA };
            const res = createMockRes();
            await getActiveTimer(req, res);

            assert(res.statusCode === 200, "GET /api/time/active succeeded (200)");
            assert(res.responseData.data.active === true, "active flag is true");
            assert(res.responseData.data.session.task._id.toString() === personalTask._id.toString(), "Active session points to personalTask");
            assert(typeof res.responseData.data.elapsedSeconds === "number", "elapsedSeconds returned as a number");
            assert(res.responseData.data.elapsedSeconds >= 0, "elapsedSeconds >= 0");
        }

        // ── Test 5: Stopping Timer ────────────────────────────────────────────
        console.log("\n── Test 5: Stopping Timer & Duration Calculation ────────");
        {
            // Let a tiny fraction of time pass
            await new Promise((r) => setTimeout(r, 1100));

            const req = { user: userA };
            const res = createMockRes();
            await stopTimer(req, res);

            assert(res.statusCode === 200, "Timer stopped successfully (200)");
            assert(res.responseData.data.endedAt !== null, "Session has endedAt recorded");
            assert(res.responseData.data.durationSeconds >= 1, "Duration calculated server-side (durationSeconds >= 1)");

            // Verifying active timer is now cleared
            const reqActive = { user: userA };
            const resActive = createMockRes();
            await getActiveTimer(reqActive, resActive);
            assert(resActive.responseData.data.active === false, "Active timer now reports false");
            assert(resActive.responseData.data.session === null, "Active session is null");
        }

        // ── Test 6: Stopping When No Timer Exists ──────────────────────────────
        console.log("\n── Test 6: Stopping When No Active Timer Exists ─────────");
        {
            const req = { user: userA };
            const res = createMockRes();
            await stopTimer(req, res);

            assert(res.statusCode === 400, "Stopping without active timer rejected (400)");
            assert(res.responseData.code === "NO_ACTIVE_TIMER", "Error code is NO_ACTIVE_TIMER");
        }

        // ── Test 7: Starting Timer on Project Task ────────────────────────────
        console.log("\n── Test 7: Starting & Stopping Timer on Project Task ────");
        let projectTask;
        {
            projectTask = await Task.create({
                project: project._id,
                title: "Project Backend Task",
                createdBy: userA._id,
                assignee: userA._id,
                estimatedMinutes: 45,
            });

            const req = {
                user: userA,
                body: { taskId: projectTask._id.toString() },
            };
            const res = createMockRes();
            await startTimer(req, res);

            assert(res.statusCode === 201, "Project member can start timer on project task (201)");
            assert(res.responseData.data.project._id.toString() === project._id.toString(), "Session points to correct project");

            // Stop timer
            const resStop = createMockRes();
            await stopTimer({ user: userA }, resStop);
            assert(resStop.statusCode === 200, "Project task timer stopped successfully");
        }

        // ── Test 8: Authorization Enforcement ─────────────────────────────────
        console.log("\n── Test 8: Authorization Enforcement ────────────────────");
        {
            // UserB attempts to track time on UserA's personal task
            const reqB = {
                user: userB,
                body: { taskId: personalTask._id.toString() },
            };
            const resB = createMockRes();
            await startTimer(reqB, resB);

            assert(resB.statusCode === 403, "Non-owner rejected from personal task (403)");

            // UserB attempts to track time on project task where UserB is NOT a member
            const reqBProj = {
                user: userB,
                body: { taskId: projectTask._id.toString() },
            };
            const resBProj = createMockRes();
            await startTimer(reqBProj, resBProj);

            assert(resBProj.statusCode === 403, "Non-member rejected from project task (403)");
        }

        // ── Test 9: Completed Task Rule ───────────────────────────────────────
        console.log("\n── Test 9: Completed Task Rule ──────────────────────────");
        {
            const completedTask = await Task.create({
                title: "Already Finished Task",
                createdBy: userA._id,
                status: "COMPLETED",
            });

            const req = {
                user: userA,
                body: { taskId: completedTask._id.toString() },
            };
            const res = createMockRes();
            await startTimer(req, res);

            assert(res.statusCode === 400, "Starting timer on COMPLETED task rejected (400)");
            assert(res.responseData.code === "TASK_ALREADY_COMPLETED", "Error code is TASK_ALREADY_COMPLETED");
            assert(res.responseData.message.includes("Cannot track time on a completed task"), "Clear instructional error message returned");
        }

        // ── Test 10: Cancel Timer ─────────────────────────────────────────────
        console.log("\n── Test 10: Cancel Timer (Focus Mode / Pomodoro Discard) ─");
        {
            // Start a timer
            const reqStart = {
                user: userA,
                body: { taskId: personalTask._id.toString() },
            };
            const resStart = createMockRes();
            await startTimer(reqStart, resStart);
            assert(resStart.statusCode === 201, "Timer started before cancel test");

            // Cancel the timer
            const reqCancel = { user: userA };
            const resCancel = createMockRes();
            await cancelTimer(reqCancel, resCancel);

            assert(resCancel.statusCode === 200, "Timer cancelled successfully (200)");
            assert(resCancel.responseData.data.cancelled === true, "Response reports cancelled = true");

            // Active timer should be gone
            const resActive = createMockRes();
            await getActiveTimer({ user: userA }, resActive);
            assert(resActive.responseData.data.active === false, "Active timer cleared after cancellation");
        }

        // ── Test 11: Task Time Summary & Estimated vs. Actual ─────────────────
        console.log("\n── Test 11: Task Time Summary & Estimated vs Actual ────");
        {
            // Create specific historical sessions for personalTask:
            // Session 1: 30 minutes (1800s)
            // Session 2: 45 minutes (2700s)
            // Total = 75 minutes. personalTask estimatedMinutes = 60 minutes.
            // Therefore: Tracked = 75m, Over by = 15m, Remaining = 0m.
            await TimeSession.create({
                user: userA._id,
                task: personalTask._id,
                startedAt: new Date(Date.now() - 3600000),
                endedAt: new Date(Date.now() - 1800000),
                durationSeconds: 1800,
            });

            await TimeSession.create({
                user: userA._id,
                task: personalTask._id,
                startedAt: new Date(Date.now() - 1700000),
                endedAt: new Date(Date.now() - 1000000),
                durationSeconds: 2700,
            });

            const req = {
                user: userA,
                params: { taskId: personalTask._id.toString() },
            };
            const res = createMockRes();
            await getTaskTimeSummary(req, res);

            assert(res.statusCode === 200, "GET /api/time/tasks/:taskId succeeded (200)");
            const data = res.responseData.data;
            assert(data.estimatedMinutes === 60, "Task estimatedMinutes is 60");
            assert(data.totalTrackedMinutes >= 75, `Total tracked minutes is ${data.totalTrackedMinutes} (expected >= 75)`);
            assert(data.isOverEstimate === true, "Task flagged as over estimate");
            assert(data.overMinutes >= 15, `overMinutes is ${data.overMinutes} (expected >= 15)`);
            assert(data.remainingMinutes === 0, "remainingMinutes is 0 when over estimate");
            assert(Array.isArray(data.sessions), "Historical sessions array returned");
            assert(data.sessions.length >= 2, "Sessions history contains completed sessions");
        }

        // ── Test 12: User Today Focus Summary ─────────────────────────────────
        console.log("\n── Test 12: User Today Focus Summary (Dashboard Widget) ─");
        {
            const req = { user: userA };
            const res = createMockRes();
            await getTodaySummary(req, res);

            assert(res.statusCode === 200, "GET /api/time/today succeeded (200)");
            const data = res.responseData.data;
            assert(typeof data.totalTrackedMinutes === "number", "totalTrackedMinutes returned");
            assert(data.sessionsCount >= 2, `Today sessionsCount is ${data.sessionsCount} (expected >= 2)`);
            assert(Array.isArray(data.sessions), "Today sessions list returned");
        }

        // ── Test 13: User Isolation ───────────────────────────────────────────
        console.log("\n── Test 13: User Isolation ──────────────────────────────");
        {
            // UserB has their own personal task
            const userBTask = await Task.create({
                title: "UserB's Private Assignment",
                createdBy: userB._id,
                assignee: userB._id,
            });

            // Start timer for UserA
            const resA = createMockRes();
            await startTimer({ user: userA, body: { taskId: personalTask._id.toString() } }, resA);
            assert(resA.statusCode === 201, "UserA started timer");

            // UserB should ALSO be able to start their own timer independently!
            const resB = createMockRes();
            await startTimer({ user: userB, body: { taskId: userBTask._id.toString() } }, resB);
            assert(resB.statusCode === 201, "UserB started timer concurrently without conflict");

            // UserA active timer check
            const resActiveA = createMockRes();
            await getActiveTimer({ user: userA }, resActiveA);
            assert(resActiveA.responseData.data.session.task._id.toString() === personalTask._id.toString(), "UserA active session is UserA's task");

            // UserB active timer check
            const resActiveB = createMockRes();
            await getActiveTimer({ user: userB }, resActiveB);
            assert(resActiveB.responseData.data.session.task._id.toString() === userBTask._id.toString(), "UserB active session is UserB's task");

            // Clean up running timers
            await stopTimer({ user: userA }, createMockRes());
            await stopTimer({ user: userB }, createMockRes());
        }

        // ── Test 14: Invalid & Nonexistent Task ────────────────────────────────
        console.log("\n── Test 14: Invalid & Nonexistent Task IDs ──────────────");
        {
            const resInvalid = createMockRes();
            await startTimer({ user: userA, body: { taskId: "123-invalid-id" } }, resInvalid);
            assert(resInvalid.statusCode === 400, "Malformed taskId rejected (400)");

            const fakeId = new mongoose.Types.ObjectId();
            const resNonExistent = createMockRes();
            await startTimer({ user: userA, body: { taskId: fakeId.toString() } }, resNonExistent);
            assert(resNonExistent.statusCode === 404, "Non-existent task rejected (404)");
        }

    } finally {
        // ── CLEANUP ───────────────────────────────────────────────────────────
        console.log("\n── Cleanup: Removing test data ──────────────────────────");
        await TimeSession.deleteMany({ user: { $in: [userA._id, userB._id] } });
        await Task.deleteMany({ createdBy: { $in: [userA._id, userB._id] } });
        await ProjectMembership.deleteMany({ user: { $in: [userA._id, userB._id] } });
        await Project.deleteMany({ _id: project._id });
        await User.deleteMany({ _id: { $in: [userA._id, userB._id] } });
        console.log("  ✓ Test data cleaned up\n");
    }

    console.log("╔══════════════════════════════════════════════════════════╗");
    console.log(`║  Phase 9 Results: ${passed} passed, ${failed} failed`);
    console.log("╚══════════════════════════════════════════════════════════╝\n");

    await mongoose.disconnect();
    if (failed > 0) {
        process.exit(1);
    }
}

runPhase9Tests().catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
