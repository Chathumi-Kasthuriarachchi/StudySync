require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const dns = require("dns");
try { dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]); } catch (_) {}
const mongoose = require("mongoose");
const User = require("../models/User");
const Task = require("../models/Task");
const {
    createPersonalTask,
    getPersonalTasks,
    getMyTasks,
    getTaskById,
    updateTask,
    updateTaskStatus,
    deleteTask,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
} = require("../controllers/taskController");
const { requireTaskAccess } = require("../middleware/projectMiddleware");

// Helper to create mock Express req & res
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

async function runPhase5Tests() {
    console.log("==================================================");
    console.log("   STUDYSYNC PHASE 5 AUTOMATED TEST SUITE        ");
    console.log("==================================================");

    try {
        const mongoURI = process.env.MONGO_URI || "mongodb://localhost:27017/studysync";
        console.log(`Connecting to MongoDB at: ${mongoURI}...`);
        await mongoose.connect(mongoURI);
        console.log("✓ MongoDB Connected successfully.\n");

        // 1. Setup Test Users
        console.log("▶ Step 1: Setting up Test Users...");
        let userA = await User.findOne({ email: "phase5_test_user_a@studysync.com" });
        if (!userA) {
            userA = await User.create({
                name: "Phase5 User A",
                email: "phase5_test_user_a@studysync.com",
                password: "Password123!",
                isVerified: true,
                role: "USER",
            });
        }

        let userB = await User.findOne({ email: "phase5_test_user_b@studysync.com" });
        if (!userB) {
            userB = await User.create({
                name: "Phase5 User B",
                email: "phase5_test_user_b@studysync.com",
                password: "Password123!",
                isVerified: true,
                role: "USER",
            });
        }
        console.log(`✓ User A: ${userA.name} (${userA._id})`);
        console.log(`✓ User B: ${userB.name} (${userB._id})\n`);

        // Clean up any previous test tasks for these users
        await Task.deleteMany({ createdBy: { $in: [userA._id, userB._id] } });

        // 2. Test Task Model Virtual Property 'progress'
        console.log("▶ Step 2: Testing Task Model 'progress' Virtual Property...");
        const rawTask = new Task({
            project: null,
            title: "Model Virtual Test",
            createdBy: userA._id,
            assignee: userA._id,
            subtasks: [
                { title: "Step 1", completed: true },
                { title: "Step 2", completed: false },
                { title: "Step 3", completed: false },
                { title: "Step 4", completed: false },
            ],
        });
        const taskJSON = rawTask.toJSON();
        if (taskJSON.progress !== 25) {
            throw new Error(`Expected progress 25%, got ${taskJSON.progress}%`);
        }
        console.log(`✓ Progress virtual accurately calculates 25% (1 of 4 completed)\n`);

        // 3. Test Controller: createPersonalTask
        console.log("▶ Step 3: Testing createPersonalTask Controller...");
        const reqCreate = {
            user: userA,
            body: {
                title: "Study Operating Systems Virtual Memory",
                description: "Review page tables, TLB miss handling, and inverted page tables",
                priority: "HIGH",
                tags: ["studies", "os", "exam"],
                subtasks: [
                    { title: "Read Chapter 18", completed: false },
                    { title: "Solve practice problem set 4", completed: false },
                ],
            },
        };
        const resCreate = createMockRes();
        await createPersonalTask(reqCreate, resCreate);

        if (resCreate.statusCode !== 201 || !resCreate.responseData?.success) {
            throw new Error(`Failed to create personal task: ${JSON.stringify(resCreate.responseData)}`);
        }

        const createdTask = resCreate.responseData.data;
        if (createdTask.project !== null) {
            throw new Error(`Expected task.project to be null for personal task, got ${createdTask.project}`);
        }
        if (createdTask.createdBy._id.toString() !== userA._id.toString()) {
            throw new Error(`Expected createdBy to be userA, got ${createdTask.createdBy}`);
        }
        if (createdTask.assignee._id.toString() !== userA._id.toString()) {
            throw new Error(`Expected assignee to be userA, got ${createdTask.assignee}`);
        }
        if (createdTask.status !== "TODO") {
            throw new Error(`Expected initial status TODO, got ${createdTask.status}`);
        }
        console.log(`✓ Personal task created successfully (ID: ${createdTask._id})`);
        console.log(`  Title: "${createdTask.title}", Project: ${createdTask.project}, Priority: ${createdTask.priority}\n`);

        // 4. Test Controller: getPersonalTasks
        console.log("▶ Step 4: Testing getPersonalTasks Controller & Stats...");
        const reqGetPersonal = {
            user: userA,
            query: {},
        };
        const resGetPersonal = createMockRes();
        await getPersonalTasks(reqGetPersonal, resGetPersonal);

        if (resGetPersonal.statusCode !== 200 || !resGetPersonal.responseData?.success) {
            throw new Error(`Failed to get personal tasks: ${JSON.stringify(resGetPersonal.responseData)}`);
        }
        const personalTasks = resGetPersonal.responseData.data;
        const stats = resGetPersonal.responseData.stats;
        if (personalTasks.length !== 1) {
            throw new Error(`Expected 1 personal task for userA, got ${personalTasks.length}`);
        }
        if (stats.totalTasks !== 1 || stats.subtasksTotal !== 2) {
            throw new Error(`Stats mismatch: expected totalTasks=1, subtasksTotal=2, got ${JSON.stringify(stats)}`);
        }
        console.log(`✓ Retrieved personal tasks with stats:`, stats, "\n");

        // 5. Test Access Control: requireTaskAccess Middleware
        console.log("▶ Step 5: Testing Authorization & Isolation with requireTaskAccess...");
        
        // 5a. User A (Owner) accesses personal task -> Must succeed and grant OWNER role
        let nextCalled = false;
        const reqAuthA = {
            user: userA,
            params: { taskId: createdTask._id },
        };
        const resAuthA = createMockRes();
        await requireTaskAccess(reqAuthA, resAuthA, () => {
            nextCalled = true;
        });
        if (!nextCalled || reqAuthA.userProjectRole !== "OWNER") {
            throw new Error(`User A should be granted OWNER access to their personal task. Role: ${reqAuthA.userProjectRole}`);
        }
        console.log(`✓ User A authorized as ${reqAuthA.userProjectRole} on their personal task`);

        // 5b. User B accesses User A's personal task -> Must be 403 Forbidden!
        let nextCalledB = false;
        const reqAuthB = {
            user: userB,
            params: { taskId: createdTask._id },
        };
        const resAuthB = createMockRes();
        await requireTaskAccess(reqAuthB, resAuthB, () => {
            nextCalledB = true;
        });
        if (nextCalledB || resAuthB.statusCode !== 403) {
            throw new Error(`User B should be FORBIDDEN (403) from accessing User A's personal task. Got status: ${resAuthB.statusCode}`);
        }
        console.log(`✓ User B correctly rejected with 403 Forbidden when attempting to access User A's personal task\n`);

        // 6. Test Personal Task Reassignment Prevention
        console.log("▶ Step 6: Testing Assignee Constraint on Personal Tasks...");
        const reqUpdateAssignee = {
            user: userA,
            task: reqAuthA.task,
            body: { assignee: userB._id },
        };
        const resUpdateAssignee = createMockRes();
        await updateTask(reqUpdateAssignee, resUpdateAssignee);

        if (resUpdateAssignee.statusCode !== 400) {
            throw new Error(`Expected 400 Bad Request when assigning personal task to other user, got: ${resUpdateAssignee.statusCode}`);
        }
        console.log(`✓ Correctly prevented reassigning personal task to another user (400 Bad Request)\n`);

        // 7. Test Subtasks & Real-time Status Synchronization
        console.log("▶ Step 7: Testing Subtask Mutations & Auto Status Synchronization...");
        const taskDoc = await Task.findById(createdTask._id);
        const subtask1 = taskDoc.subtasks[0];
        const subtask2 = taskDoc.subtasks[1];

        // 7a. Toggle Subtask 1 to completed -> 1 of 2 done -> status should be IN_PROGRESS
        const reqToggle1 = {
            user: userA,
            task: await Task.findById(createdTask._id),
            params: { taskId: createdTask._id, subtaskId: subtask1._id },
            body: { completed: true },
        };
        const resToggle1 = createMockRes();
        await toggleSubtask(reqToggle1, resToggle1);
        if (resToggle1.responseData.data.status !== "IN_PROGRESS") {
            throw new Error(`Expected status IN_PROGRESS after 1 of 2 subtasks done, got ${resToggle1.responseData.data.status}`);
        }
        console.log(`✓ Subtask 1 completed -> Task auto-transitioned to IN_PROGRESS`);

        // 7b. Toggle Subtask 2 to completed -> 2 of 2 done -> status should auto-transition to COMPLETED
        const reqToggle2 = {
            user: userA,
            task: await Task.findById(createdTask._id),
            params: { taskId: createdTask._id, subtaskId: subtask2._id },
            body: { completed: true },
        };
        const resToggle2 = createMockRes();
        await toggleSubtask(reqToggle2, resToggle2);
        if (resToggle2.responseData.data.status !== "COMPLETED") {
            throw new Error(`Expected status COMPLETED after 2 of 2 subtasks done, got ${resToggle2.responseData.data.status}`);
        }
        console.log(`✓ Subtask 2 completed -> Task auto-transitioned to COMPLETED (100% progress)`);

        // 7c. Add new incomplete subtask -> 2 of 3 done -> status should auto-transition back to IN_PROGRESS
        const reqAddSubtask = {
            user: userA,
            task: await Task.findById(createdTask._id),
            params: { taskId: createdTask._id },
            body: { title: "Draft summary cheat sheet" },
        };
        const resAddSubtask = createMockRes();
        await addSubtask(reqAddSubtask, resAddSubtask);
        if (resAddSubtask.responseData.data.status !== "IN_PROGRESS") {
            throw new Error(`Expected status IN_PROGRESS after adding incomplete subtask, got ${resAddSubtask.responseData.data.status}`);
        }
        console.log(`✓ Added Subtask 3 -> Task auto-transitioned back to IN_PROGRESS`);

        // 7d. Manual status override takes precedence
        const reqManualStatus = {
            user: userA,
            task: await Task.findById(createdTask._id),
            body: { status: "COMPLETED" },
        };
        const resManualStatus = createMockRes();
        await updateTaskStatus(reqManualStatus, resManualStatus);
        if (resManualStatus.responseData.data.status !== "COMPLETED") {
            throw new Error(`Manual status override failed`);
        }
        console.log(`✓ Manual status update to COMPLETED verified\n`);

        // 8. Test getMyTasks with Personal and All Types
        console.log("▶ Step 8: Testing getMyTasks Query Branching...");
        const reqMyAll = {
            user: userA,
            query: { type: "ALL" },
        };
        const resMyAll = createMockRes();
        await getMyTasks(reqMyAll, resMyAll);
        if (resMyAll.statusCode !== 200 || resMyAll.responseData.data.length === 0) {
            throw new Error(`getMyTasks (type=ALL) failed to return personal tasks`);
        }
        console.log(`✓ getMyTasks(type=ALL) returned ${resMyAll.responseData.data.length} task(s) including personal tasks`);

        const reqMyPersonal = {
            user: userA,
            query: { type: "PERSONAL" },
        };
        const resMyPersonal = createMockRes();
        await getMyTasks(reqMyPersonal, resMyPersonal);
        if (resMyPersonal.statusCode !== 200 || resMyPersonal.responseData.data.length !== 1) {
            throw new Error(`getMyTasks (type=PERSONAL) failed`);
        }
        console.log(`✓ getMyTasks(type=PERSONAL) returned exactly 1 personal task\n`);

        // 9. Clean up test records
        console.log("▶ Step 9: Cleaning up test data...");
        await Task.deleteMany({ createdBy: { $in: [userA._id, userB._id] } });
        await User.deleteMany({ email: { $in: ["phase5_test_user_a@studysync.com", "phase5_test_user_b@studysync.com"] } });
        console.log("✓ Test records cleaned up.\n");

        console.log("==================================================");
        console.log("🎉 ALL PHASE 5 BACKEND INTEGRATION TESTS PASSED!  ");
        console.log("==================================================");

        await mongoose.connection.close();
        process.exit(0);
    } catch (err) {
        console.error("\n❌ PHASE 5 TEST FAILED:", err);
        try {
            await mongoose.connection.close();
        } catch (_) {}
        process.exit(1);
    }
}

runPhase5Tests();
