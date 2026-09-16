/**
 * Phase 14 — Reports Integration & Export Test Suite
 *
 * Tests:
 * 1. Personal Productivity Report calculations (tasks, completion %, subtasks, time sessions)
 * 2. Project Report calculations (progress, timeline, linked goals, contributions)
 * 3. Team Report calculations and RBAC (member workload, time spent, VIEWER rejection)
 * 4. Task Details Report (filtering by scope, status, priority)
 * 5. CSV Export generation (RFC-4180 format, headers, data rows)
 * 6. PDF Export generation (binary buffer with %PDF- header, document structure)
 * 7. Security & Authorization (non-member 403, viewer 403 on team reports)
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

const { Writable } = require("stream");
const reportService = require("../services/reportService");
const {
    getPersonalReport,
    getProjectReport,
    getTeamReport,
    getTaskDetailReport,
    exportReport,
} = require("../controllers/reportController");

function createMockRes() {
    const headers = {};
    const chunks = [];

    const res = new Writable({
        write(chunk, encoding, callback) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            callback();
        },
    });

    res.statusCode = 200;
    res.headers = headers;
    res.responseData = null;

    res.status = function (code) {
        this.statusCode = code;
        return this;
    };

    res.setHeader = function (name, value) {
        headers[name.toLowerCase()] = value;
        return this;
    };

    res.json = function (data) {
        this.responseData = data;
        this.emit("finish");
        return this;
    };

    res.send = function (data) {
        this.responseData = data;
        this.emit("finish");
        return this;
    };

    res.on("finish", () => {
        if (chunks.length > 0 && !res.responseData) {
            res.responseData = Buffer.concat(chunks);
        }
    });

    res.waitForFinish = function () {
        if (this.writableEnded || this.responseData) {
            if (chunks.length > 0 && !this.responseData) {
                this.responseData = Buffer.concat(chunks);
            }
            return Promise.resolve(this);
        }
        return new Promise((resolve) => {
            this.once("finish", () => {
                if (chunks.length > 0 && !this.responseData) {
                    this.responseData = Buffer.concat(chunks);
                }
                resolve(this);
            });
        });
    };

    return res;
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
    console.log("   PHASE 14 — REPORTS TEST SUITE                  ");
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
            name: `Alice Report Owner ${timestamp}`,
            email: `alice_report_${timestamp}@example.com`,
            password: "Password123!",
            isVerified: true,
        });

        userMember = await User.create({
            name: `Bob Report Member ${timestamp}`,
            email: `bob_report_${timestamp}@example.com`,
            password: "Password123!",
            isVerified: true,
        });

        userViewer = await User.create({
            name: `Charlie Report Viewer ${timestamp}`,
            email: `charlie_report_${timestamp}@example.com`,
            password: "Password123!",
            isVerified: true,
        });

        userStranger = await User.create({
            name: `Eve Report Stranger ${timestamp}`,
            email: `eve_report_${timestamp}@example.com`,
            password: "Password123!",
            isVerified: true,
        });

        console.log("1. Test users created.");

        // 2. Create Project and Memberships
        testProject = await Project.create({
            name: `Phase 14 Reports Project ${timestamp}`,
            description: "Testing reports calculations, exports, and RBAC",
            owner: userOwner._id,
            startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
            status: "ACTIVE",
        });

        await ProjectMembership.create({ project: testProject._id, user: userOwner._id, role: "OWNER" });
        await ProjectMembership.create({ project: testProject._id, user: userMember._id, role: "MEMBER" });
        await ProjectMembership.create({ project: testProject._id, user: userViewer._id, role: "VIEWER" });

        console.log("2. Test project and memberships created.");

        // 3. Populate Test Tasks, Subtasks, TimeSessions, and Goals
        // Personal Task with 3 subtasks (2 completed)
        const personalTask = await Task.create({
            title: "Alice Study Chapter 1",
            project: null,
            createdBy: userOwner._id,
            status: "IN_PROGRESS",
            priority: "HIGH",
            dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
            subtasks: [
                { title: "Read pages 1-20", completed: true },
                { title: "Solve practice problems", completed: true },
                { title: "Summary notes", completed: false },
            ],
            estimatedMinutes: 60,
        });

        // Project Task 1 for Bob: Completed
        const projectTask1 = await Task.create({
            title: "Database Indexing & Queries",
            project: testProject._id,
            createdBy: userOwner._id,
            assignee: userMember._id,
            status: "COMPLETED",
            priority: "URGENT",
            subtasks: [
                { title: "Index compounds", completed: true },
                { title: "Benchmark queries", completed: true },
            ],
            estimatedMinutes: 45,
        });

        // Project Task 2 for Bob: Overdue TODO
        const projectTask2 = await Task.create({
            title: "CSV Export Optimization",
            project: testProject._id,
            createdBy: userOwner._id,
            assignee: userMember._id,
            status: "TODO",
            priority: "MEDIUM",
            dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Overdue
        });

        // Project Task 3 for Alice: Completed
        const projectTask3 = await Task.create({
            title: "PDF Styling & Layout",
            project: testProject._id,
            createdBy: userOwner._id,
            assignee: userOwner._id,
            status: "COMPLETED",
            priority: "HIGH",
        });

        // TimeSessions
        // Alice tracked 30 mins (1800s) on personalTask
        await TimeSession.create({
            user: userOwner._id,
            task: personalTask._id,
            project: null,
            startedAt: new Date(Date.now() - 3600 * 1000),
            endedAt: new Date(Date.now() - 1800 * 1000),
            durationSeconds: 1800,
        });

        // Bob tracked 45 mins (2700s) on projectTask1
        await TimeSession.create({
            user: userMember._id,
            task: projectTask1._id,
            project: testProject._id,
            startedAt: new Date(Date.now() - 5400 * 1000),
            endedAt: new Date(Date.now() - 2700 * 1000),
            durationSeconds: 2700,
        });

        // Linked Project Goal
        await Goal.create({
            title: "Release Reports Engine",
            owner: userOwner._id,
            project: testProject._id,
            status: "IN_PROGRESS",
            measurementType: "TASK_COUNT",
            targetValue: 3,
        });

        console.log("3. Test tasks, subtasks, time sessions, and goals created.\n");

        // ── TEST 1: Personal Productivity Report ────────────────────────────
        console.log("--- TEST 1: Personal Productivity Report ---");
        {
            // Alice's personal productivity includes:
            // - personalTask (IN_PROGRESS, personal)
            // - projectTask3 (COMPLETED, project, assigned to Alice)
            // Total = 2 tasks
            const report = await reportService.getPersonalProductivityReport(userOwner._id, {
                period: "all",
            });

            assert(report !== null, "Personal report generated successfully");
            assert(report.summary.totalTasks === 2, `Alice has 2 total tasks (got ${report.summary.totalTasks})`);
            assert(report.summary.completedTasks === 1, `Alice has 1 completed task (got ${report.summary.completedTasks})`);
            assert(report.summary.inProgressTasks === 1, `Alice has 1 in-progress task (got ${report.summary.inProgressTasks})`);
            assert(report.summary.completionPercentage === 50, `Alice completion percentage is 50% (got ${report.summary.completionPercentage}%)`);
            assert(report.summary.personalTasks === 1, "1 personal task identified");
            assert(report.summary.projectTasks === 1, "1 project task identified");

            // Subtask metrics
            assert(report.summary.totalSubtasks === 3, `Total subtasks is 3 (got ${report.summary.totalSubtasks})`);
            assert(report.summary.completedSubtasks === 2, `Completed subtasks is 2 (got ${report.summary.completedSubtasks})`);
            assert(report.summary.subtaskCompletionRate === 67, `Subtask completion rate is 67% (got ${report.summary.subtaskCompletionRate}%)`);

            // Time metrics (Alice tracked 1800s = 30m)
            assert(report.summary.totalTrackedMinutes === 30, `Alice tracked 30 minutes (got ${report.summary.totalTrackedMinutes})`);
            assert(report.tasks.length === 2, "Task details array contains 2 tasks");
        }

        // ── TEST 2: Project Report ──────────────────────────────────────────
        console.log("\n--- TEST 2: Project Report ---");
        {
            // Project has 3 tasks:
            // - projectTask1: COMPLETED (Bob)
            // - projectTask2: TODO, Overdue (Bob)
            // - projectTask3: COMPLETED (Alice)
            const projReport = await reportService.getProjectReport(testProject._id, userOwner._id, {
                period: "all",
            });

            assert(projReport !== null, "Project report generated successfully");
            assert(projReport.project.name === testProject.name, "Project name matches");
            assert(projReport.summary.totalTasks === 3, `Project total tasks is 3 (got ${projReport.summary.totalTasks})`);
            assert(projReport.summary.completedTasks === 2, `Project completed tasks is 2 (got ${projReport.summary.completedTasks})`);
            assert(projReport.summary.overdueTasks === 1, `Project overdue tasks is 1 (got ${projReport.summary.overdueTasks})`);
            assert(projReport.summary.completionPercentage === 67, `Project completion is 67% (got ${projReport.summary.completionPercentage}%)`);

            // Timeline check: project due in 10 days
            assert(projReport.project.timeline.isOverdue === false, "Project timeline is not overdue");
            assert(projReport.project.timeline.daysRemaining > 0, "Days remaining is positive");

            // Goals check
            assert(projReport.goals.length === 1, "1 linked project goal reported");
            assert(projReport.goals[0].title === "Release Reports Engine", "Goal title reported correctly");

            // Member contribution check
            assert(projReport.memberContributions.length === 3, "3 members reported in contributions");
            const bobContrib = projReport.memberContributions.find((m) => m.member.name.includes("Bob"));
            assert(bobContrib.assignedTasks === 2, "Bob assigned 2 tasks");
            assert(bobContrib.completedTasks === 1, "Bob completed 1 task");
            assert(bobContrib.overdueTasks === 1, "Bob has 1 overdue task");
            assert(bobContrib.trackedMinutes === 45, "Bob tracked 45 minutes");
        }

        // ── TEST 3: Team Report & RBAC ──────────────────────────────────────
        console.log("\n--- TEST 3: Team Report & RBAC ---");
        {
            const teamReport = await reportService.getTeamReport(testProject._id, userOwner._id);

            assert(teamReport !== null, "Team report generated successfully");
            assert(teamReport.summary.totalMembers === 3, "3 members reported");
            assert(teamReport.summary.totalProjectTasks === 3, "3 total project tasks");

            const bobTeam = teamReport.members.find((m) => m.member.name.includes("Bob"));
            assert(bobTeam !== undefined, "Bob found in team report");
            assert(bobTeam.activeTasks === 1, "Bob has 1 active task");
            assert(bobTeam.workloadSignal === "LOW", `Bob workload signal is LOW (got ${bobTeam.workloadSignal})`);
            assert(bobTeam.completionRate === 50, "Bob completion rate is 50%");

            // Controller RBAC test: VIEWER must be rejected from Team Report
            const reqViewer = {
                user: userViewer,
                project: testProject,
                membership: { role: "VIEWER" },
                params: { projectId: testProject._id.toString() },
                query: {},
            };
            const resViewer = createMockRes();

            const { requireProjectRole } = require("../middleware/projectMiddleware");
            const teamRoleGuard = requireProjectRole("OWNER", "MANAGER", "MEMBER");

            let viewerNextCalled = false;
            teamRoleGuard(reqViewer, resViewer, () => {
                viewerNextCalled = true;
            });

            assert(resViewer.statusCode === 403, "Project VIEWER is blocked from team report with 403 Forbidden");
            assert(viewerNextCalled === false, "Middleware stopped execution for VIEWER");
        }

        // ── TEST 4: Task Details Report ─────────────────────────────────────
        console.log("\n--- TEST 4: Task Details Report ---");
        {
            // 1. All tasks report
            const allTasksReport = await reportService.getTaskDetailReport(userOwner._id, {
                scope: "all",
                period: "all",
            });
            assert(allTasksReport.summary.totalTasks === 4, `4 total tasks accessible to Alice (got ${allTasksReport.summary.totalTasks})`);

            // 2. Filter by status: COMPLETED
            const completedReport = await reportService.getTaskDetailReport(userOwner._id, {
                scope: "all",
                status: "COMPLETED",
                period: "all",
            });
            assert(completedReport.tasks.length === 2, `2 completed tasks returned (got ${completedReport.tasks.length})`);
            assert(completedReport.tasks.every((t) => t.status === "COMPLETED"), "All filtered tasks have status COMPLETED");

            // 3. Filter by priority: URGENT
            const urgentReport = await reportService.getTaskDetailReport(userOwner._id, {
                scope: "all",
                priority: "URGENT",
                period: "all",
            });
            assert(urgentReport.tasks.length === 1, `1 urgent task returned (got ${urgentReport.tasks.length})`);
            assert(urgentReport.tasks[0].priority === "URGENT", "Priority is URGENT");
        }

        // ── TEST 5: CSV Export Generation ───────────────────────────────────
        console.log("\n--- TEST 5: CSV Export Generation ---");
        {
            const reqCsv = {
                user: userOwner,
                query: { type: "personal", format: "csv", period: "all" },
            };
            const resCsv = createMockRes();
            await exportReport(reqCsv, resCsv);

            assert(resCsv.headers["content-type"].includes("text/csv"), `Header Content-Type is text/csv (got ${resCsv.headers["content-type"]})`);
            assert(resCsv.headers["content-disposition"].includes(".csv"), "Content-Disposition specifies .csv attachment");
            assert(typeof resCsv.responseData === "string", "CSV responseData is a string");
            assert(resCsv.responseData.includes("StudySync Workspace Report"), "CSV contains title header");
            assert(resCsv.responseData.includes("Alice Study Chapter 1"), "CSV contains task row");
            assert(resCsv.responseData.includes("Completion Rate"), "CSV contains summary block");
        }

        // ── TEST 6: PDF Export Generation (PDFKit) ──────────────────────────
        console.log("\n--- TEST 6: PDF Export Generation ---");
        {
            const reqPdf = {
                user: userOwner,
                query: { type: "project", format: "pdf", projectId: testProject._id.toString(), period: "all" },
            };
            const resPdf = createMockRes();
            await exportReport(reqPdf, resPdf);
            await resPdf.waitForFinish();

            assert(resPdf.headers["content-type"] === "application/pdf", "Header Content-Type is application/pdf");
            assert(resPdf.headers["content-disposition"].includes(".pdf"), "Content-Disposition specifies .pdf attachment");
            assert(Buffer.isBuffer(resPdf.responseData), "PDF responseData is a binary Buffer");
            assert(resPdf.responseData.length > 500, `PDF buffer has non-empty size (${resPdf.responseData.length} bytes)`);

            // Verify standard PDF header magic bytes "%PDF-"
            const pdfMagicBytes = resPdf.responseData.subarray(0, 5).toString("utf-8");
            assert(pdfMagicBytes === "%PDF-", `PDF buffer starts with magic bytes "%PDF-" (got "${pdfMagicBytes}")`);
        }

        // ── TEST 7: Security & Unauthorized Access ──────────────────────────
        console.log("\n--- TEST 7: Security & Unauthorized Access ---");
        {
            // Stranger tries to export project report
            const reqStranger = {
                user: userStranger,
                query: { type: "project", projectId: testProject._id.toString() },
            };
            const resStranger = createMockRes();
            await exportReport(reqStranger, resStranger);

            assert(resStranger.statusCode === 403, "Non-member is denied access to export project report (403)");

            // Viewer tries to export team report
            const reqViewerExport = {
                user: userViewer,
                query: { type: "team", projectId: testProject._id.toString() },
            };
            const resViewerExport = createMockRes();
            await exportReport(reqViewerExport, resViewerExport);

            assert(resViewerExport.statusCode === 403, "Project Viewer is denied access to export team report (403)");
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
