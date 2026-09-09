require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const dns = require("dns");
try { dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]); } catch (_) {}
const mongoose = require("mongoose");
const User = require("../models/User");
const Project = require("../models/Project");
const ProjectMembership = require("../models/ProjectMembership");
const Task = require("../models/Task");
const Comment = require("../models/Comment");
const TaskActivity = require("../models/TaskActivity");

const {
    getProjectMembers,
    addProjectMember,
    updateMemberRole,
    removeProjectMember,
    getProjectWorkload,
} = require("../controllers/projectMemberController");

const {
    createTask,
    getProjectTasks,
    updateTask,
    updateTaskStatus,
    toggleSubtask,
    addSubtask,
} = require("../controllers/taskController");

const {
    getTaskComments,
    createTaskComment,
    updateTaskComment,
    deleteTaskComment,
    getTaskActivities,
} = require("../controllers/commentController");

const {
    requireProjectMember,
    requireProjectRole,
    requireTaskAccess,
} = require("../middleware/projectMiddleware");

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

async function runPhase6Tests() {
    console.log("==================================================");
    console.log("   STUDYSYNC PHASE 6 AUTOMATED INTEGRATION TESTS  ");
    console.log("==================================================\n");

    try {
        const mongoURI = process.env.MONGO_URI || "mongodb://localhost:27017/studysync";
        console.log(`Connecting to MongoDB at: ${mongoURI}...`);
        await mongoose.connect(mongoURI);
        console.log("✓ MongoDB Connected successfully.\n");

        // ── Step 1: Setup Test Users ──────────────────────────────────────────
        console.log("▶ Step 1: Setting up Test Users...");
        const users = {};
        const testRoles = ["owner", "manager", "member", "viewer", "outsider"];

        for (const role of testRoles) {
            const email = `phase6_${role}@studysync.com`;
            let u = await User.findOne({ email });
            if (!u) {
                u = await User.create({
                    name: `Phase6 ${role.toUpperCase()}`,
                    email,
                    password: "Password123!",
                    isVerified: true,
                    role: "USER",
                });
            }
            users[role] = u;
        }
        console.log("✓ Test users initialized.\n");

        // Cleanup any old test project/tasks/memberships
        const testUserIds = Object.values(users).map((u) => u._id);
        const existingProjects = await Project.find({ owner: users.owner._id });
        const existingProjectIds = existingProjects.map((p) => p._id);

        await Task.deleteMany({
            $or: [{ createdBy: { $in: testUserIds } }, { project: { $in: existingProjectIds } }],
        });
        await Comment.deleteMany({ author: { $in: testUserIds } });
        await TaskActivity.deleteMany({ actor: { $in: testUserIds } });
        await ProjectMembership.deleteMany({ user: { $in: testUserIds } });
        await Project.deleteMany({ owner: users.owner._id });

        // ── Step 2: Create Test Project & Memberships ──────────────────────────
        console.log("▶ Step 2: Creating Test Project and RBAC memberships...");
        const project = await Project.create({
            name: "Phase 6 Team Collab Hub",
            description: "Testing project-level collaboration and roles",
            owner: users.owner._id,
            status: "ACTIVE",
            startDate: new Date(),
            dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        });

        // Add memberships
        await ProjectMembership.create({ project: project._id, user: users.owner._id, role: "OWNER" });
        await ProjectMembership.create({ project: project._id, user: users.manager._id, role: "MANAGER" });
        await ProjectMembership.create({ project: project._id, user: users.member._id, role: "MEMBER" });
        await ProjectMembership.create({ project: project._id, user: users.viewer._id, role: "VIEWER" });
        console.log("✓ Project created with OWNER, MANAGER, MEMBER, and VIEWER roles.\n");

        // ── Step 3: Test Member Management Permissions ────────────────────────
        console.log("▶ Step 3: Testing Member Management Authorization...");

        // 3a. Member cannot add members (403)
        let nextCalled = false;
        const reqMemberAdd = {
            project,
            membership: { role: "MEMBER" },
        };
        const resMemberAdd = createMockRes();
        requireProjectRole("OWNER", "MANAGER")(reqMemberAdd, resMemberAdd, () => {
            nextCalled = true;
        });
        if (nextCalled || resMemberAdd.statusCode !== 403) {
            throw new Error("MEMBER should NOT be allowed to add members (expected 403)");
        }
        console.log("✓ MEMBER rejected from managing project members (403)");

        // 3b. Viewer cannot add members (403)
        nextCalled = false;
        const resViewerAdd = createMockRes();
        requireProjectRole("OWNER", "MANAGER")({ project, membership: { role: "VIEWER" } }, resViewerAdd, () => {
            nextCalled = true;
        });
        if (nextCalled || resViewerAdd.statusCode !== 403) {
            throw new Error("VIEWER should NOT be allowed to add members (expected 403)");
        }
        console.log("✓ VIEWER rejected from managing project members (403)");

        // 3c. Duplicate membership rejected (400)
        const reqDup = {
            project,
            body: { userId: users.member._id, role: "MEMBER" },
        };
        const resDup = createMockRes();
        await addProjectMember(reqDup, resDup);
        if (resDup.statusCode !== 400) {
            throw new Error(`Duplicate membership should be rejected with 400, got: ${resDup.statusCode}`);
        }
        console.log("✓ Duplicate membership rejected (400 Bad Request)");

        // 3d. Non-existent user rejected (404)
        const reqFakeUser = {
            project,
            body: { userId: new mongoose.Types.ObjectId(), role: "MEMBER" },
        };
        const resFakeUser = createMockRes();
        await addProjectMember(reqFakeUser, resFakeUser);
        if (resFakeUser.statusCode !== 404) {
            throw new Error("Non-existent user should return 404");
        }
        console.log("✓ Non-existent user rejected (404 Not Found)");

        // 3e. Manager cannot change Owner's role or promote to Owner (403)
        const reqMgrPromote = {
            project,
            user: users.manager,
            membership: { role: "MANAGER" },
            params: { userId: users.member._id.toString() },
            body: { role: "OWNER" },
        };
        const resMgrPromote = createMockRes();
        await updateMemberRole(reqMgrPromote, resMgrPromote);
        if (resMgrPromote.statusCode !== 403) {
            throw new Error("Manager should NOT be able to assign OWNER role (expected 403)");
        }
        console.log("✓ Manager prohibited from promoting anyone to OWNER (403)");

        // 3f. Cannot remove project OWNER (400)
        const reqRemoveOwner = {
            project,
            user: users.owner,
            membership: { role: "OWNER" },
            params: { userId: users.owner._id.toString() },
        };
        const resRemoveOwner = createMockRes();
        await removeProjectMember(reqRemoveOwner, resRemoveOwner);
        if (resRemoveOwner.statusCode !== 400) {
            throw new Error("Project OWNER cannot be removed (expected 400)");
        }
        console.log("✓ Project OWNER deletion blocked (400 Bad Request)\n");

        // ── Step 4: Task Assignment in Collaboration ──────────────────────────
        console.log("▶ Step 4: Testing Task Assignment & Role Boundaries...");

        // 4a. Cannot assign task to non-project member (Outsider) -> 400
        const reqAssignOutsider = {
            project,
            membership: { role: "OWNER" },
            user: users.owner,
            body: {
                title: "Invalid Assignment Task",
                assignee: users.outsider._id,
            },
        };
        const resAssignOutsider = createMockRes();
        await createTask(reqAssignOutsider, resAssignOutsider);
        if (resAssignOutsider.statusCode !== 400) {
            throw new Error(`Assigning task to non-member should return 400, got ${resAssignOutsider.statusCode}`);
        }
        console.log("✓ Correctly prevented assigning task to non-project member (400 Bad Request)");

        // 4b. Successfully assign task to active project member
        const reqCreateValid = {
            project,
            membership: { role: "OWNER" },
            user: users.owner,
            body: {
                title: "Build Collaboration API",
                description: "Implement comments and member workload",
                assignee: users.member._id,
                priority: "HIGH",
                subtasks: [
                    { title: "Define Comment model", completed: false },
                    { title: "Add TaskActivity logger", completed: false },
                ],
            },
        };
        const resCreateValid = createMockRes();
        await createTask(reqCreateValid, resCreateValid);
        if (resCreateValid.statusCode !== 201 || !resCreateValid.responseData.data.project) {
            throw new Error("Failed to create task with populated project");
        }
        const createdTask = resCreateValid.responseData.data;
        console.log("✓ Project task created with populated project reference and assigned to Member\n");

        // ── Step 5: Safe Member Removal (Unassign active tasks) ────────────────
        console.log("▶ Step 5: Testing Safe Member Removal and Task Unassignment...");
        const reqRemoveMember = {
            project,
            user: users.owner,
            membership: { role: "OWNER" },
            params: { userId: users.member._id.toString() },
        };
        const resRemoveMember = createMockRes();
        await removeProjectMember(reqRemoveMember, resRemoveMember);
        if (resRemoveMember.statusCode !== 200) {
            throw new Error(`Failed to remove member: ${resRemoveMember.responseData?.message}`);
        }

        // Verify that the task was automatically unassigned!
        const taskAfterRemoval = await Task.findById(createdTask._id);
        if (taskAfterRemoval.assignee !== null) {
            throw new Error("Task was NOT unassigned after member removal!");
        }
        console.log("✓ Member removed and their assigned tasks were safely set to null (unassigned)");

        // Re-add member for remaining tests
        await ProjectMembership.create({ project: project._id, user: users.member._id, role: "MEMBER" });
        taskAfterRemoval.assignee = users.member._id;
        await taskAfterRemoval.save();
        console.log("✓ Member re-added and task reassigned for collaboration tests.\n");

        // ── Step 6: Status Update Bug & Predictable Subtask Sync ───────────────
        console.log("▶ Step 6: Testing Status Update Flow & Subtask Synchronization...");

        // 6a. Update status to IN_PROGRESS
        const reqStatusProgress = {
            task: await Task.findById(createdTask._id),
            membership: { role: "MEMBER" },
            user: users.member,
            body: { status: "IN_PROGRESS" },
        };
        const resStatusProgress = createMockRes();
        await updateTaskStatus(reqStatusProgress, resStatusProgress);
        if (
            resStatusProgress.responseData.data.status !== "IN_PROGRESS" ||
            !resStatusProgress.responseData.data.project?._id
        ) {
            throw new Error("Status update failed or project reference was lost!");
        }
        console.log("✓ Task status updated to IN_PROGRESS (project populated intact)");

        // 6b. Manually setting status to COMPLETED should be BLOCKED while subtasks are incomplete
        const reqStatusCompleteBlocked = {
            task: await Task.findById(createdTask._id),
            membership: { role: "MEMBER" },
            user: users.member,
            body: { status: "COMPLETED" },
        };
        const resStatusCompleteBlocked = createMockRes();
        await updateTaskStatus(reqStatusCompleteBlocked, resStatusCompleteBlocked);
        if (resStatusCompleteBlocked.statusCode !== 400) {
            throw new Error(`Expected 400 Bad Request when setting COMPLETED with incomplete subtasks, got ${resStatusCompleteBlocked.statusCode}`);
        }
        console.log("✓ Correctly prevented marking task COMPLETED while subtasks are incomplete (400 Bad Request)");

        // 6c. Test editing subtask title
        const subtaskToEdit = createdTask.subtasks[0];
        const reqEditSubtask = {
            task: await Task.findById(createdTask._id),
            membership: { role: "MEMBER" },
            user: users.member,
            params: { taskId: createdTask._id, subtaskId: subtaskToEdit._id },
            body: { title: "Refactored schema models and indexes" },
        };
        const resEditSubtask = createMockRes();
        await toggleSubtask(reqEditSubtask, resEditSubtask);
        if (resEditSubtask.statusCode !== 200 || !resEditSubtask.responseData.data.subtasks.some((st) => st.title === "Refactored schema models and indexes")) {
            throw new Error("Editing subtask title failed");
        }
        console.log("✓ Successfully edited subtask title");

        // 6d. Complete all subtasks -> task transitions to COMPLETED
        for (const st of createdTask.subtasks) {
            const reqToggle = {
                task: await Task.findById(createdTask._id),
                membership: { role: "MEMBER" },
                user: users.member,
                params: { taskId: createdTask._id, subtaskId: st._id },
                body: { completed: true },
            };
            const resToggle = createMockRes();
            await toggleSubtask(reqToggle, resToggle);
        }
        const fullyCompletedTask = await Task.findById(createdTask._id);
        if (fullyCompletedTask.status !== "COMPLETED" || fullyCompletedTask.progress !== 100) {
            throw new Error(`Expected status COMPLETED and 100% progress, got status=${fullyCompletedTask.status}, progress=${fullyCompletedTask.progress}%`);
        }
        console.log("✓ Completing all subtasks transitions task to COMPLETED (Progress = 100%)");

        // 6e. Reopening a subtask automatically sets status back to IN_PROGRESS
        const reqReopenSubtask = {
            task: await Task.findById(createdTask._id),
            membership: { role: "MEMBER" },
            user: users.member,
            params: { taskId: createdTask._id, subtaskId: subtaskToEdit._id },
            body: { completed: false },
        };
        const resReopenSubtask = createMockRes();
        await toggleSubtask(reqReopenSubtask, resReopenSubtask);
        if (resReopenSubtask.responseData.data.status !== "IN_PROGRESS") {
            throw new Error(`Expected status IN_PROGRESS after reopening subtask, got ${resReopenSubtask.responseData.data.status}`);
        }
        console.log("✓ Reopening subtask automatically transitions task back to IN_PROGRESS\n");

        // ── Step 7: Task Comments & Security ──────────────────────────────────
        console.log("▶ Step 7: Testing Collaborative Comments & Authorization...");

        // 7a. Authorized member can create comment
        const reqCreateComment = {
            task: await Task.findById(createdTask._id),
            membership: { role: "MEMBER" },
            user: users.member,
            body: { content: "I have started working on the collaboration models!" },
        };
        const resCreateComment = createMockRes();
        await createTaskComment(reqCreateComment, resCreateComment);
        if (resCreateComment.statusCode !== 201) {
            throw new Error("Member failed to create comment");
        }
        const createdComment = resCreateComment.responseData.data;
        console.log("✓ Authorized Member created comment successfully");

        // 7b. Viewer cannot create comment (403)
        const reqViewerComment = {
            task: await Task.findById(createdTask._id),
            membership: { role: "VIEWER" },
            user: users.viewer,
            body: { content: "Viewer trying to post" },
        };
        const resViewerComment = createMockRes();
        await createTaskComment(reqViewerComment, resViewerComment);
        if (resViewerComment.statusCode !== 403) {
            throw new Error("Viewer should NOT be allowed to create comments (expected 403)");
        }
        console.log("✓ VIEWER blocked from posting comments (403 Forbidden)");

        // 7c. Author can edit own comment
        const reqEditOwnComment = {
            task: await Task.findById(createdTask._id),
            membership: { role: "MEMBER" },
            user: users.member,
            params: { commentId: createdComment._id },
            body: { content: "Updated: models and tests are ready!" },
        };
        const resEditOwnComment = createMockRes();
        await updateTaskComment(reqEditOwnComment, resEditOwnComment);
        if (resEditOwnComment.statusCode !== 200 || resEditOwnComment.responseData.data.content !== "Updated: models and tests are ready!") {
            throw new Error("Author failed to edit their own comment");
        }
        console.log("✓ Author edited their own comment successfully");

        // 7d. Another member CANNOT edit author's comment (403)
        const reqEditOtherComment = {
            task: await Task.findById(createdTask._id),
            membership: { role: "MANAGER" },
            user: users.manager,
            params: { commentId: createdComment._id },
            body: { content: "Manager trying to alter someone's words" },
        };
        const resEditOtherComment = createMockRes();
        await updateTaskComment(reqEditOtherComment, resEditOtherComment);
        if (resEditOtherComment.statusCode !== 403) {
            throw new Error("User should NOT be able to edit another user's comment (expected 403)");
        }
        console.log("✓ Editing another user's comment blocked (403 Forbidden)");

        // 7e. Member reads comments
        const reqGetComments = {
            task: await Task.findById(createdTask._id),
            membership: { role: "MEMBER" },
            user: users.member,
        };
        const resGetComments = createMockRes();
        await getTaskComments(reqGetComments, resGetComments);
        if (resGetComments.statusCode !== 200 || resGetComments.responseData.data.length !== 1) {
            throw new Error("Failed to read comments for task");
        }
        console.log("✓ Retrieved task comments successfully\n");

        // ── Step 8: Activity History Audit Trail ───────────────────────────────
        console.log("▶ Step 8: Testing Task Activity Log...");
        const reqGetActivities = {
            task: await Task.findById(createdTask._id),
            membership: { role: "MEMBER" },
            user: users.member,
        };
        const resGetActivities = createMockRes();
        await getTaskActivities(reqGetActivities, resGetActivities);
        if (resGetActivities.statusCode !== 200 || resGetActivities.responseData.data.length === 0) {
            throw new Error("Expected activity log entries to be recorded!");
        }
        console.log(`✓ Activity log captured ${resGetActivities.responseData.data.length} audit events`);
        console.log(`  Latest action: ${resGetActivities.responseData.data[0].action} - "${resGetActivities.responseData.data[0].details}"\n`);

        // ── Step 9: Member Workload Aggregation ────────────────────────────────
        console.log("▶ Step 9: Testing Project Member Workload Aggregation...");
        const reqWorkload = {
            project,
            membership: { role: "OWNER" },
            user: users.owner,
        };
        const resWorkload = createMockRes();
        await getProjectWorkload(reqWorkload, resWorkload);
        if (resWorkload.statusCode !== 200 || !resWorkload.responseData.data?.workload) {
            throw new Error("Failed to get member workload");
        }
        const memberStats = resWorkload.responseData.data.workload.find(
            (w) => w.member._id.toString() === users.member._id.toString()
        );
        if (!memberStats || memberStats.totalAssigned !== 1) {
            throw new Error(`Expected member to have 1 assigned task, got: ${JSON.stringify(memberStats)}`);
        }
        console.log("✓ Member workload accurately computed:", {
            member: memberStats.member.name,
            totalAssigned: memberStats.totalAssigned,
            completed: memberStats.completed,
            inProgress: memberStats.inProgress,
            todo: memberStats.todo,
        }, "\n");

        // ── Cleanup ────────────────────────────────────────────────────────────
        console.log("▶ Step 10: Cleaning up test data...");
        await Task.deleteMany({
            $or: [{ createdBy: { $in: testUserIds } }, { project: project._id }],
        });
        await Comment.deleteMany({ author: { $in: testUserIds } });
        await TaskActivity.deleteMany({ actor: { $in: testUserIds } });
        await ProjectMembership.deleteMany({ user: { $in: testUserIds } });
        await Project.findByIdAndDelete(project._id);
        await User.deleteMany({ _id: { $in: testUserIds } });
        console.log("✓ Test records cleanly removed.\n");

        console.log("==================================================");
        console.log("🎉 ALL PHASE 6 COLLABORATION TESTS PASSED!       ");
        console.log("==================================================");

        await mongoose.connection.close();
        process.exit(0);
    } catch (err) {
        console.error("\n❌ PHASE 6 TEST SUITE FAILED:", err);
        try {
            await mongoose.connection.close();
        } catch (_) {}
        process.exit(1);
    }
}

runPhase6Tests();
