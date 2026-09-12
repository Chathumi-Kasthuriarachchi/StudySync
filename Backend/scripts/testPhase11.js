/**
 * Phase 11 — Notifications Integration Tests
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
const Notification = require("../models/Notification");
const Comment = require("../models/Comment");
const { NOTIFICATION_TYPES, SOURCE_TYPES } = require("../constants/notificationConstants");

const notificationService = require("../services/notificationService");
const {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    checkDeadlines,
} = require("../controllers/notificationController");

const {
    createTask,
    updateTask,
    updateTaskStatus,
} = require("../controllers/taskController");

const {
    createTaskComment,
} = require("../controllers/commentController");

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
    console.log("   PHASE 11 — NOTIFICATIONS TEST SUITE            ");
    console.log("==================================================\n");

    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!uri) {
        console.error("No MONGODB_URI or MONGO_URI in .env");
        process.exit(1);
    }

    await mongoose.connect(uri);
    console.log("Connected to MongoDB.");

    let userA, userB, userC;
    let testProject;
    let membershipA, membershipB, membershipC;

    try {
        // Clean test artifacts
        const testEmails = [
            "test11_usera@studysync.com",
            "test11_userb@studysync.com",
            "test11_userc@studysync.com",
        ];
        const existingUsers = await User.find({ email: { $in: testEmails } });
        const existingUserIds = existingUsers.map((u) => u._id);

        await Notification.deleteMany({ recipient: { $in: existingUserIds } });
        await Task.deleteMany({ createdBy: { $in: existingUserIds } });
        await Goal.deleteMany({ owner: { $in: existingUserIds } });
        await Project.deleteMany({ owner: { $in: existingUserIds } });
        await ProjectMembership.deleteMany({ user: { $in: existingUserIds } });
        await User.deleteMany({ email: { $in: testEmails } });

        // 1. Create test users
        userA = await User.create({
            name: "Alice Notif",
            email: testEmails[0],
            password: "Password123!",
            systemRole: "USER",
        });

        userB = await User.create({
            name: "Bob Receiver",
            email: testEmails[1],
            password: "Password123!",
            systemRole: "USER",
        });

        userC = await User.create({
            name: "Charlie Mentioned",
            email: testEmails[2],
            password: "Password123!",
            systemRole: "USER",
        });

        console.log("1. Test users created.");

        // 2. Create project with memberships
        const pStart = new Date();
        const pDue = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        testProject = await Project.create({
            name: "Phase 11 Notif Project",
            description: "Testing notifications",
            owner: userA._id,
            startDate: pStart,
            dueDate: pDue,
        });

        membershipA = await ProjectMembership.create({
            project: testProject._id,
            user: userA._id,
            role: "OWNER",
        });

        membershipB = await ProjectMembership.create({
            project: testProject._id,
            user: userB._id,
            role: "MEMBER",
        });

        membershipC = await ProjectMembership.create({
            project: testProject._id,
            user: userC._id,
            role: "MEMBER",
        });

        console.log("2. Test project and memberships created.\n");

        // ── TEST 1: Task Assignment Notification ────────────────────────────────
        console.log("--- TEST 1: Task Assignment Notification ---");
        {
            // Alice assigns task to Bob
            const req = {
                user: userA,
                project: testProject,
                membership: membershipA,
                body: {
                    title: "Implement API Gateway",
                    description: "Set up the reverse proxy",
                    assignee: userB._id.toString(),
                },
            };
            const res = createMockRes();
            await createTask(req, res);
            assert(res.statusCode === 201, "Task created successfully with assignee");
            const createdTask = res.responseData.data;

            // Check notifications for Bob
            const bobNotifs = await Notification.find({ recipient: userB._id });
            assert(bobNotifs.length === 1, "Bob received exactly 1 notification");
            assert(bobNotifs[0].type === NOTIFICATION_TYPES.TASK_ASSIGNED, "Notification type is TASK_ASSIGNED");
            assert(bobNotifs[0].title === "New Task Assigned", "Notification title is 'New Task Assigned'");

            // Check Alice got NO notification (actor is Alice)
            const aliceNotifs = await Notification.find({ recipient: userA._id });
            assert(aliceNotifs.length === 0, "Alice received NO notification for assigning task");

            // Test self-assignment does NOT create notification
            const reqSelf = {
                user: userA,
                project: testProject,
                membership: membershipA,
                body: {
                    title: "Alice's Own Task",
                    assignee: userA._id.toString(),
                },
            };
            const resSelf = createMockRes();
            await createTask(reqSelf, resSelf);
            const aliceNotifsAfter = await Notification.find({ recipient: userA._id });
            assert(aliceNotifsAfter.length === 0, "Self-assignment does not generate notification");
        }

        // ── TEST 2: Task Completion & Dependency Unblocking ─────────────────────
        console.log("\n--- TEST 2: Task Completion & Dependency Unblocking ---");
        {
            // Create Task 1 (Prerequisite) assigned to Bob, created by Alice
            const reqT1 = {
                user: userA,
                project: testProject,
                membership: membershipA,
                body: {
                    title: "Prerequisite Database Setup",
                    assignee: userB._id.toString(),
                },
            };
            const resT1 = createMockRes();
            await createTask(reqT1, resT1);
            const task1 = resT1.responseData.data;

            // Create Task 2 (Dependent) assigned to Charlie, depending on Task 1
            const reqT2 = {
                user: userA,
                project: testProject,
                membership: membershipA,
                body: {
                    title: "Deploy Application Backend",
                    assignee: userC._id.toString(),
                    dependencies: [task1._id],
                },
            };
            const resT2 = createMockRes();
            await createTask(reqT2, resT2);
            const task2 = resT2.responseData.data;

            // Clear existing notifications to isolate completion test
            await Notification.deleteMany({});

            // Bob completes Task 1 via updateTaskStatus
            const reqComplete = {
                user: userB,
                task: await Task.findById(task1._id),
                membership: membershipB,
                body: {
                    status: "COMPLETED",
                },
            };
            const resComplete = createMockRes();
            await updateTaskStatus(reqComplete, resComplete);
            assert(resComplete.statusCode === 200, "Task 1 marked as COMPLETED");

            // 1. Check Task Completed notification sent to Alice (task creator and project owner)
            const aliceNotifs = await Notification.find({
                recipient: userA._id,
                type: NOTIFICATION_TYPES.TASK_COMPLETED,
            });
            assert(aliceNotifs.length === 1, "Alice received TASK_COMPLETED notification");

            // 2. Check Dependency Unblocked notification sent to Charlie (assignee of Task 2)
            const charlieNotifs = await Notification.find({
                recipient: userC._id,
                type: NOTIFICATION_TYPES.TASK_UNBLOCKED,
            });
            assert(charlieNotifs.length === 1, "Charlie received TASK_UNBLOCKED notification for Task 2");
            assert(
                charlieNotifs[0].message.includes("Deploy Application Backend"),
                "Message mentions the unblocked task title"
            );
        }

        // ── TEST 3: Comments and Mentions Deduplication ─────────────────────────
        console.log("\n--- TEST 3: Comments & Mentions Deduplication ---");
        {
            await Notification.deleteMany({});

            // Create a task owned by Alice, assigned to Bob
            const reqTask = {
                user: userA,
                project: testProject,
                membership: membershipA,
                body: {
                    title: "Collaboration Task",
                    assignee: userB._id.toString(),
                },
            };
            const resTask = createMockRes();
            await createTask(reqTask, resTask);
            const collabTask = resTask.responseData.data;

            await Notification.deleteMany({});

            // Alice comments and mentions Charlie: "@test11_userc@studysync.com check this out!"
            const reqComment = {
                user: userA,
                task: collabTask,
                membership: membershipA,
                body: {
                    content: "Hey @test11_userc@studysync.com can you take a look at the deployment logs?",
                },
            };
            const resComment = createMockRes();
            await createTaskComment(reqComment, resComment);
            assert(resComment.statusCode === 201, "Comment created successfully");

            // Bob (assignee) should get COMMENT_ADDED
            const bobNotifs = await Notification.find({
                recipient: userB._id,
                type: NOTIFICATION_TYPES.COMMENT_ADDED,
            });
            assert(bobNotifs.length === 1, "Bob (assignee) received COMMENT_ADDED notification");

            // Charlie (mentioned) should get MENTIONED
            const charlieMention = await Notification.find({
                recipient: userC._id,
                type: NOTIFICATION_TYPES.MENTIONED,
            });
            assert(charlieMention.length === 1, "Charlie received MENTIONED notification");

            // Charlie must NOT also get a duplicate COMMENT_ADDED
            const charlieComment = await Notification.find({
                recipient: userC._id,
                type: NOTIFICATION_TYPES.COMMENT_ADDED,
            });
            assert(charlieComment.length === 0, "Charlie was deduplicated from COMMENT_ADDED");

            // Alice (author) should get NO notification
            const aliceNotifs = await Notification.find({ recipient: userA._id });
            assert(aliceNotifs.length === 0, "Author Alice received NO self-notifications");
        }

        // ── TEST 4: Goal Progress Milestones & Completion ───────────────────────
        console.log("\n--- TEST 4: Goal Progress Milestones & Completion ---");
        {
            await Notification.deleteMany({});

            // Create personal goal for Alice with targetValue 2 tasks
            const goal = await Goal.create({
                title: "Complete 2 Core Modules",
                owner: userA._id,
                project: null,
                measurementType: "TASK_COUNT",
                targetValue: 2,
                status: "IN_PROGRESS",
            });

            // 50% milestone (1 of 2 completed)
            const notify50 = await notificationService.notifyGoalProgress(goal, 50);
            assert(notify50 !== null, "50% milestone generated notification");
            assert(notify50.type === NOTIFICATION_TYPES.GOAL_PROGRESS, "Type is GOAL_PROGRESS");
            assert(notify50.eventKey === `GOAL_PROGRESS:${goal._id}:50`, "Correct eventKey for 50% milestone");

            // Duplicate call for 50% milestone must be deduplicated
            const duplicate50 = await notificationService.notifyGoalProgress(goal, 50);
            assert(duplicate50 === null, "Second 50% milestone call is deduplicated");

            // 100% completion
            const notify100 = await notificationService.notifyGoalProgress(goal, 100);
            assert(notify100 !== null, "100% completion generated notification");
            assert(notify100.type === NOTIFICATION_TYPES.GOAL_COMPLETED, "Type is GOAL_COMPLETED");
            assert(notify100.eventKey === `GOAL_COMPLETED:${goal._id}`, "Correct eventKey for completion");

            // Duplicate call for completion must be deduplicated
            const duplicate100 = await notificationService.notifyGoalProgress(goal, 100);
            assert(duplicate100 === null, "Second 100% completion call is deduplicated");
        }

        // ── TEST 5: Deadline & Overdue Scanner with Deduplication ───────────────
        console.log("\n--- TEST 5: Deadline & Overdue Scanner ---");
        {
            await Notification.deleteMany({});

            const now = new Date();
            // Task 1: Due in 12 hours (Approaching)
            const dueSoon = new Date(now.getTime() + 12 * 60 * 60 * 1000);
            await Task.create({
                title: "Urgent Security Patch",
                assignee: userA._id,
                createdBy: userA._id,
                dueDate: dueSoon,
                status: "TODO",
            });

            // Task 2: Due yesterday (Overdue)
            const overdue = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            await Task.create({
                title: "Overdue Incident Report",
                assignee: userA._id,
                createdBy: userA._id,
                dueDate: overdue,
                status: "TODO",
            });

            // Run scanner for Alice
            const scanResult1 = await notificationService.checkDeadlinesAndOverdue(userA._id);
            assert(scanResult1.createdCount === 2, `Scanner created 2 notifications (got ${scanResult1.createdCount})`);

            // Verify the types created
            const aliceNotifs = await Notification.find({ recipient: userA._id });
            const hasApproaching = aliceNotifs.some((n) => n.type === NOTIFICATION_TYPES.TASK_DEADLINE_APPROACHING);
            const hasOverdue = aliceNotifs.some((n) => n.type === NOTIFICATION_TYPES.TASK_OVERDUE);
            assert(hasApproaching, "TASK_DEADLINE_APPROACHING notification created");
            assert(hasOverdue, "TASK_OVERDUE notification created");

            // Run scanner a second time immediately — duplicate prevention must return 0 new notifications
            const scanResult2 = await notificationService.checkDeadlinesAndOverdue(userA._id);
            assert(scanResult2.createdCount === 0, "Second scan on same day created 0 duplicates");
        }

        // ── TEST 6: Notification API & Security Isolation ───────────────────────
        console.log("\n--- TEST 6: Notification API & Security Isolation ---");
        {
            // Bob creates a notification for Bob
            const bobNotification = await Notification.create({
                recipient: userB._id,
                type: NOTIFICATION_TYPES.TASK_ASSIGNED,
                title: "Confidential Task for Bob",
                message: "Private details",
                sourceType: SOURCE_TYPES.TASK,
                sourceId: new mongoose.Types.ObjectId(),
            });

            // 1. Alice tries to mark Bob's notification as read -> should 404 (or 403 not found)
            const reqAliceMark = {
                user: userA,
                params: { id: bobNotification._id.toString() },
            };
            const resAliceMark = createMockRes();
            await markAsRead(reqAliceMark, resAliceMark);
            assert(resAliceMark.statusCode === 404, "Alice cannot mark Bob's notification as read (404)");

            // 2. Alice tries to delete Bob's notification -> should 404
            const reqAliceDelete = {
                user: userA,
                params: { id: bobNotification._id.toString() },
            };
            const resAliceDelete = createMockRes();
            await deleteNotification(reqAliceDelete, resAliceDelete);
            assert(resAliceDelete.statusCode === 404, "Alice cannot delete Bob's notification (404)");

            // 3. Bob marks his notification as read
            const reqBobMark = {
                user: userB,
                params: { id: bobNotification._id.toString() },
            };
            const resBobMark = createMockRes();
            await markAsRead(reqBobMark, resBobMark);
            assert(resBobMark.statusCode === 200, "Bob can mark his own notification as read (200)");
            const updatedBobNotif = await Notification.findById(bobNotification._id);
            assert(updatedBobNotif.isRead === true, "Notification isRead is now true");

            // 4. Bob checks unread count
            const reqBobCount = { user: userB };
            const resBobCount = createMockRes();
            await getUnreadCount(reqBobCount, resBobCount);
            assert(resBobCount.responseData.unreadCount === 0, "Bob unread count is 0");

            // 5. Bob marks all as read
            const reqBobMarkAll = { user: userB };
            const resBobMarkAll = createMockRes();
            await markAllAsRead(reqBobMarkAll, resBobMarkAll);
            assert(resBobMarkAll.statusCode === 200, "Mark all as read succeeded");

            // 6. Bob clears all notifications
            const reqBobClear = { user: userB };
            const resBobClear = createMockRes();
            await clearAllNotifications(reqBobClear, resBobClear);
            assert(resBobClear.statusCode === 200, "Clear all notifications succeeded");
            const bobRemaining = await Notification.countDocuments({ recipient: userB._id });
            assert(bobRemaining === 0, "Bob has 0 remaining notifications after clearAll");
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
        // Clean up
        if (testProject) {
            await Notification.deleteMany({ project: testProject._id });
            await Task.deleteMany({ project: testProject._id });
            await ProjectMembership.deleteMany({ project: testProject._id });
            await Project.findByIdAndDelete(testProject._id);
        }
        if (userA) await User.findByIdAndDelete(userA._id);
        if (userB) await User.findByIdAndDelete(userB._id);
        if (userC) await User.findByIdAndDelete(userC._id);
        await mongoose.disconnect();
    }
}

runTests();
