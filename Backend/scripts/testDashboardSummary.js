require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const dns = require("dns");
try { dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]); } catch (_) {}
const mongoose = require("mongoose");
const User = require("../models/User");
const Task = require("../models/Task");
const TaskActivity = require("../models/TaskActivity");
const { getDashboardSummary, getMyTasks, createPersonalTask } = require("../controllers/taskController");

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

async function runDashboardTests() {
    console.log("==================================================");
    console.log("   STUDYSYNC DASHBOARD ENDPOINTS AUTOMATED TEST   ");
    console.log("==================================================");

    await mongoose.connect(process.env.MONGO_URI);
    console.log("✓ MongoDB Connected successfully.\n");

    const testTimestamp = Date.now();
    const testUser = await User.create({
        name: `DashboardTester_${testTimestamp}`,
        email: `dashboard_${testTimestamp}@example.com`,
        password: "TestPassword123!",
        isVerified: true,
    });
    console.log(`✓ Created test user: ${testUser.email}`);

    try {
        // 1. Create a task due today
        const today = new Date();
        const resTask1 = createMockRes();
        await createPersonalTask(
            {
                user: testUser,
                body: {
                    title: "Task Due Today",
                    priority: "HIGH",
                    dueDate: today.toISOString(),
                },
            },
            resTask1
        );
        if (resTask1.statusCode !== 201) throw new Error("Failed to create task due today");
        console.log("✓ Created task due today");

        // 2. Create an upcoming task due in 3 days
        const upcoming = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        const resTask2 = createMockRes();
        await createPersonalTask(
            {
                user: testUser,
                body: {
                    title: "Upcoming Task",
                    priority: "MEDIUM",
                    dueDate: upcoming.toISOString(),
                },
            },
            resTask2
        );
        if (resTask2.statusCode !== 201) throw new Error("Failed to create upcoming task");
        console.log("✓ Created upcoming task");

        // 3. Create an overdue task due 2 days ago
        const overdue = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
        const resTask3 = createMockRes();
        await createPersonalTask(
            {
                user: testUser,
                body: {
                    title: "Overdue Task",
                    priority: "URGENT",
                    dueDate: overdue.toISOString(),
                },
            },
            resTask3
        );
        if (resTask3.statusCode !== 201) throw new Error("Failed to create overdue task");
        console.log("✓ Created overdue task");

        // 4. Test getDashboardSummary
        console.log("\n▶ Testing getDashboardSummary endpoint...");
        const resSummary = createMockRes();
        await getDashboardSummary({ user: testUser }, resSummary);

        if (resSummary.statusCode !== 200 || !resSummary.responseData?.success) {
            throw new Error(`getDashboardSummary failed with status ${resSummary.statusCode}`);
        }

        const data = resSummary.responseData.data;
        console.log("✓ getDashboardSummary returned 200 OK");
        console.log("  Metrics:", data.metrics);
        console.log(`  Due today tasks count: ${data.dueTodayTasks.length}`);
        console.log(`  Upcoming tasks count: ${data.upcomingTasks.length}`);
        console.log(`  Overdue tasks count: ${data.overdueTasks.length}`);

        if (data.metrics.totalTasks !== 3) {
            throw new Error(`Expected totalTasks=3, got ${data.metrics.totalTasks}`);
        }
        if (data.dueTodayTasks.length !== 1) {
            throw new Error(`Expected 1 due today task, got ${data.dueTodayTasks.length}`);
        }
        if (data.overdueTasks.length !== 1) {
            throw new Error(`Expected 1 overdue task, got ${data.overdueTasks.length}`);
        }

        // 5. Test getMyTasks with due=today
        console.log("\n▶ Testing getMyTasks?due=today...");
        const resDueToday = createMockRes();
        await getMyTasks({ user: testUser, query: { due: "today" } }, resDueToday);
        if (resDueToday.statusCode !== 200 || resDueToday.responseData.count !== 1) {
            throw new Error(`Expected 1 task from getMyTasks?due=today, got ${resDueToday.responseData?.count}`);
        }
        console.log("✓ getMyTasks?due=today successfully filtered 1 task");

        // 6. Test getMyTasks with due=overdue
        console.log("▶ Testing getMyTasks?due=overdue...");
        const resOverdue = createMockRes();
        await getMyTasks({ user: testUser, query: { due: "overdue" } }, resOverdue);
        if (resOverdue.statusCode !== 200 || resOverdue.responseData.count !== 1) {
            throw new Error(`Expected 1 task from getMyTasks?due=overdue, got ${resOverdue.responseData?.count}`);
        }
        console.log("✓ getMyTasks?due=overdue successfully filtered 1 task");

        console.log("\n==================================================");
        console.log("🎉 ALL DASHBOARD ENDPOINTS TESTS PASSED!");
        console.log("==================================================");
    } finally {
        await Task.deleteMany({ createdBy: testUser._id });
        await TaskActivity.deleteMany({ actor: testUser._id });
        await User.deleteOne({ _id: testUser._id });
        await mongoose.disconnect();
    }
}

runDashboardTests().catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
});
