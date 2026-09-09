/**
 * Phase 8 — Calendar & Planning Integration Tests
 *
 * Uses direct controller/service calls with mock req/res (consistent with Phase 6/7 tests).
 *
 * Tests:
 * 1. Meeting model creation and time validation
 * 2. Meeting controller CRUD
 * 3. Calendar controller aggregation (tasks + meetings)
 * 4. Authorization: personal tasks restricted to owner
 * 5. Authorization: project tasks restricted to members
 * 6. Normalized calendar item structure
 * 7. Phase 7 intelligence enrichment in calendar items
 * 8. Date range filtering
 * 9. Type and scope filtering
 * 10. Overdue and due-today detection
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const dns = require("dns");
try { dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]); } catch (_) {}
const mongoose = require("mongoose");

const User = require("../models/User");
const Project = require("../models/Project");
const ProjectMembership = require("../models/ProjectMembership");
const Task = require("../models/Task");
const Meeting = require("../models/Meeting");

const {
    createMeeting,
    getMeetings,
    getMeetingById,
    updateMeeting,
    deleteMeeting,
} = require("../controllers/meetingController");

const { getCalendarEvents } = require("../controllers/calendarController");

// Mock Express response helper (same pattern as Phase 6/7 tests)
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

async function runPhase8Tests() {
    console.log("\n╔══════════════════════════════════════════════════════════╗");
    console.log("║         Phase 8 — Calendar & Planning Tests             ║");
    console.log("╚══════════════════════════════════════════════════════════╝\n");

    const mongoURI = process.env.MONGO_URI || "mongodb://localhost:27017/studysync";
    console.log(`Connecting to MongoDB at: ${mongoURI}...`);
    await mongoose.connect(mongoURI);
    console.log("✓ MongoDB Connected successfully.\n");

    const testPrefix = `p8test_${Date.now()}`;
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // ── SETUP ─────────────────────────────────────────────────────────────────
    console.log("── Setup: Creating test data ─────────────────────────────");

    const userA = await User.create({
        name: "P8 UserA",
        email: `${testPrefix}_a@test.com`,
        password: "TestPass123!",
        isEmailVerified: true,
    });

    const userB = await User.create({
        name: "P8 UserB",
        email: `${testPrefix}_b@test.com`,
        password: "TestPass123!",
        isEmailVerified: true,
    });

    const project = await Project.create({
        name: `P8 Test Project ${testPrefix}`,
        description: "Phase 8 test project",
        owner: userA._id,
        startDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        dueDate: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000),
        status: "ACTIVE",
    });

    await ProjectMembership.create({ project: project._id, user: userA._id, role: "OWNER" });
    await ProjectMembership.create({ project: project._id, user: userB._id, role: "MEMBER" });

    // Create test tasks
    const personalTask = await Task.create({
        title: "P8 Personal Task Due Today",
        createdBy: userA._id,
        project: null,
        status: "IN_PROGRESS",
        priority: "HIGH",
        dueDate: now,
    });

    const projectTaskA = await Task.create({
        title: "P8 Project Task Tomorrow",
        createdBy: userA._id,
        project: project._id,
        assignee: userA._id,
        status: "TODO",
        priority: "URGENT",
        startDate: yesterday,
        dueDate: tomorrow,
    });

    const projectTaskB = await Task.create({
        title: "P8 Task For UserB Only",
        createdBy: userA._id,
        project: project._id,
        assignee: userB._id,
        status: "TODO",
        priority: "MEDIUM",
        dueDate: tomorrow,
    });

    const overdueTask = await Task.create({
        title: "P8 Overdue Personal Task",
        createdBy: userA._id,
        project: null,
        status: "TODO",
        priority: "HIGH",
        dueDate: threeDaysAgo,
    });

    console.log("  ✓ Test users, project, memberships, and tasks created\n");

    // ══════════════════════════════════════════════════════════════════════════
    // TEST 1: Meeting Model — Time Validation
    // ══════════════════════════════════════════════════════════════════════════
    console.log("── Test 1: Meeting Model Time Validation ────────────────");

    try {
        const badMeeting = new Meeting({
            title: "Bad Meeting",
            startTime: tomorrow,
            endTime: yesterday, // end before start
            organizer: userA._id,
        });
        await badMeeting.validate();
        assert(false, "Should have thrown validation error for endTime < startTime");
    } catch (err) {
        assert(err.errors?.endTime, "endTime < startTime validation rejected");
    }

    try {
        const equalMeeting = new Meeting({
            title: "Equal Time Meeting",
            startTime: now,
            endTime: now, // same time
            organizer: userA._id,
        });
        await equalMeeting.validate();
        assert(false, "Should have thrown validation error for endTime == startTime");
    } catch (err) {
        assert(err.errors?.endTime, "endTime == startTime validation rejected");
    }

    // Valid meeting should pass
    const validMeeting = new Meeting({
        title: "Valid Meeting",
        startTime: now,
        endTime: tomorrow,
        organizer: userA._id,
    });
    try {
        await validMeeting.validate();
        assert(true, "Valid meeting passes validation");
    } catch (err) {
        assert(false, `Valid meeting should not throw: ${err.message}`);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // TEST 2: Meeting Controller — Create
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n── Test 2: Meeting Controller — Create ──────────────────");

    const meetingStart = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const meetingEnd = new Date(now.getTime() + 3 * 60 * 60 * 1000);

    const createReq = {
        user: { _id: userA._id },
        body: {
            title: "P8 Team Standup",
            description: "Daily standup meeting",
            startTime: meetingStart.toISOString(),
            endTime: meetingEnd.toISOString(),
            meetingLink: "https://meet.example.com/standup",
            location: "Room A",
            participants: [userB._id.toString()],
            project: project._id.toString(),
        },
    };
    const createRes = createMockRes();
    await createMeeting(createReq, createRes);

    assert(createRes.statusCode === 201, `Meeting created (status: ${createRes.statusCode})`);
    assert(createRes.responseData?.data?.title === "P8 Team Standup", "Meeting title matches");
    assert(createRes.responseData?.data?.organizer?.name === "P8 UserA", "Organizer populated");
    assert(createRes.responseData?.data?.participants?.length === 1, "Participant count is 1");
    assert(createRes.responseData?.data?.project?.name?.includes("P8 Test Project"), "Project populated");

    const createdMeetingId = createRes.responseData?.data?._id;

    // ══════════════════════════════════════════════════════════════════════════
    // TEST 3: Meeting Controller — Time Validation on Create
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n── Test 3: Meeting Controller — Time Validation ─────────");

    const badCreateReq = {
        user: { _id: userA._id },
        body: {
            title: "Invalid Meeting",
            startTime: meetingEnd.toISOString(),
            endTime: meetingStart.toISOString(), // end before start
        },
    };
    const badCreateRes = createMockRes();
    await createMeeting(badCreateReq, badCreateRes);
    assert(badCreateRes.statusCode === 400, `Invalid time rejected (status: ${badCreateRes.statusCode})`);

    // ══════════════════════════════════════════════════════════════════════════
    // TEST 4: Meeting Controller — Read (by ID and list)
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n── Test 4: Meeting Controller — Read ────────────────────");

    // Get by ID as organizer
    const getByIdReq = { user: { _id: userA._id }, params: { id: createdMeetingId.toString() } };
    const getByIdRes = createMockRes();
    await getMeetingById(getByIdReq, getByIdRes);
    assert(getByIdRes.statusCode === 200, "GET meeting by ID (organizer) succeeded");
    assert(getByIdRes.responseData?.data?.title === "P8 Team Standup", "Title matches on GET");

    // Get by ID as participant (UserB)
    const getByIdBReq = { user: { _id: userB._id }, params: { id: createdMeetingId.toString() } };
    const getByIdBRes = createMockRes();
    await getMeetingById(getByIdBReq, getByIdBRes);
    assert(getByIdBRes.statusCode === 200, "Participant (UserB) can view meeting");

    // List meetings for UserA
    const listReq = { user: { _id: userA._id }, query: {} };
    const listRes = createMockRes();
    await getMeetings(listReq, listRes);
    assert(listRes.statusCode === 200, "GET meetings list succeeded");
    assert(listRes.responseData?.data?.length >= 1, `Meetings list has >= 1 item (${listRes.responseData?.data?.length})`);

    // ══════════════════════════════════════════════════════════════════════════
    // TEST 5: Meeting Controller — Update
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n── Test 5: Meeting Controller — Update ──────────────────");

    // Organizer updates
    const updateReq = {
        user: { _id: userA._id },
        params: { id: createdMeetingId.toString() },
        body: { title: "P8 Team Standup (Updated)", location: "Room B" },
    };
    const updateRes = createMockRes();
    await updateMeeting(updateReq, updateRes);
    assert(updateRes.statusCode === 200, `Update succeeded (status: ${updateRes.statusCode})`);
    assert(updateRes.responseData?.data?.title === "P8 Team Standup (Updated)", "Updated title matches");
    assert(updateRes.responseData?.data?.location === "Room B", "Updated location matches");

    // Non-organizer (UserB) should be blocked
    const updateBReq = {
        user: { _id: userB._id },
        params: { id: createdMeetingId.toString() },
        body: { title: "Hacked" },
    };
    const updateBRes = createMockRes();
    await updateMeeting(updateBReq, updateBRes);
    assert(updateBRes.statusCode === 403, `Non-organizer update blocked (status: ${updateBRes.statusCode})`);

    // ══════════════════════════════════════════════════════════════════════════
    // TEST 6: Calendar Endpoint — Aggregation
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n── Test 6: Calendar Endpoint — Aggregation ──────────────");

    const rangeStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const rangeEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const calReq = {
        user: { _id: userA._id },
        query: { start: rangeStart, end: rangeEnd },
    };
    const calRes = createMockRes();
    await getCalendarEvents(calReq, calRes);

    assert(calRes.statusCode === 200, "Calendar endpoint returned 200");
    assert(calRes.responseData?.success === true, "Calendar success flag is true");
    assert(Array.isArray(calRes.responseData?.data), "Calendar data is an array");

    const calItems = calRes.responseData?.data || [];
    const taskItems = calItems.filter((i) => i.sourceType === "task");
    const meetingItems = calItems.filter((i) => i.sourceType === "meeting");

    assert(taskItems.length >= 2, `Tasks in calendar: ${taskItems.length} (expected >= 2)`);
    assert(meetingItems.length >= 1, `Meetings in calendar: ${meetingItems.length} (expected >= 1)`);

    // ══════════════════════════════════════════════════════════════════════════
    // TEST 7: Normalized Calendar Item Structure
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n── Test 7: Normalized Item Structure ────────────────────");

    const firstTask = calItems.find((i) => i.sourceType === "task");
    if (firstTask) {
        assert(typeof firstTask.id === "string" && firstTask.id.startsWith("task_"), "Task ID format correct");
        assert(typeof firstTask.title === "string", "Task has title");
        assert(typeof firstTask.start === "string" || firstTask.start instanceof Date, "Task has start");
        assert(typeof firstTask.end === "string" || firstTask.end instanceof Date, "Task has end");
        assert(firstTask.allDay === true, "Tasks are all-day");
        assert(["PERSONAL", "PROJECT"].includes(firstTask.category), "Task has valid category");
        assert(typeof firstTask.urgencyScore === "number", "Task has urgency score (Phase 7)");
        assert(typeof firstTask.deadlineClassification === "string", "Task has deadline classification");
        assert(typeof firstTask.isAtRisk === "boolean", "Task has isAtRisk flag");
        assert(Array.isArray(firstTask.reasons), "Task has reasons array");
    } else {
        assert(false, "No task found in calendar");
    }

    const firstMeeting = calItems.find((i) => i.sourceType === "meeting");
    if (firstMeeting) {
        assert(typeof firstMeeting.id === "string" && firstMeeting.id.startsWith("meeting_"), "Meeting ID format correct");
        assert(firstMeeting.allDay === false, "Meetings are NOT all-day");
        assert(firstMeeting.organizer !== null, "Meeting has organizer");
        assert(Array.isArray(firstMeeting.participants), "Meeting has participants array");
    } else {
        assert(false, "No meeting found in calendar");
    }

    // ══════════════════════════════════════════════════════════════════════════
    // TEST 8: Authorization — UserB's Calendar
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n── Test 8: Authorization — UserB Calendar ───────────────");

    const calBReq = {
        user: { _id: userB._id },
        query: { start: rangeStart, end: rangeEnd },
    };
    const calBRes = createMockRes();
    await getCalendarEvents(calBReq, calBRes);

    assert(calBRes.statusCode === 200, "UserB calendar returned 200");
    const bItems = calBRes.responseData?.data || [];

    // UserB should NOT see UserA's personal tasks
    const bPersonal = bItems.filter(
        (i) => i.sourceType === "task" && i.category === "PERSONAL"
    );
    assert(bPersonal.length === 0, "UserA's personal tasks NOT visible to UserB");

    // UserB should see their assigned project task
    const bAssigned = bItems.filter(
        (i) => i.sourceType === "task" && i.title.includes("P8 Task For UserB Only")
    );
    assert(bAssigned.length === 1, "UserB sees their assigned project task");

    // UserB should see the meeting (participant)
    const bMeetings = bItems.filter((i) => i.sourceType === "meeting");
    assert(bMeetings.length >= 1, "UserB sees meetings they participate in");

    // ══════════════════════════════════════════════════════════════════════════
    // TEST 9: Type Filtering
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n── Test 9: Type Filtering ───────────────────────────────");

    // Tasks only
    const tasksOnlyReq = {
        user: { _id: userA._id },
        query: { start: rangeStart, end: rangeEnd, type: "TASKS" },
    };
    const tasksOnlyRes = createMockRes();
    await getCalendarEvents(tasksOnlyReq, tasksOnlyRes);
    const tasksOnlyMeetings = (tasksOnlyRes.responseData?.data || []).filter((i) => i.sourceType === "meeting");
    assert(tasksOnlyMeetings.length === 0, "No meetings when type=TASKS");

    // Meetings only
    const meetingsOnlyReq = {
        user: { _id: userA._id },
        query: { start: rangeStart, end: rangeEnd, type: "MEETINGS" },
    };
    const meetingsOnlyRes = createMockRes();
    await getCalendarEvents(meetingsOnlyReq, meetingsOnlyRes);
    const meetingsOnlyTasks = (meetingsOnlyRes.responseData?.data || []).filter((i) => i.sourceType === "task");
    assert(meetingsOnlyTasks.length === 0, "No tasks when type=MEETINGS");

    // ══════════════════════════════════════════════════════════════════════════
    // TEST 10: Scope Filtering
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n── Test 10: Scope Filtering ─────────────────────────────");

    const personalScopeReq = {
        user: { _id: userA._id },
        query: { start: rangeStart, end: rangeEnd, scope: "PERSONAL" },
    };
    const personalScopeRes = createMockRes();
    await getCalendarEvents(personalScopeReq, personalScopeRes);
    const personalProjectTasks = (personalScopeRes.responseData?.data || []).filter(
        (i) => i.category === "PROJECT" && i.sourceType === "task"
    );
    assert(personalProjectTasks.length === 0, "No project tasks in PERSONAL scope");

    // ══════════════════════════════════════════════════════════════════════════
    // TEST 11: Intelligence Enrichment (Overdue & Due Today)
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n── Test 11: Intelligence Enrichment ─────────────────────");

    const overdueItem = calItems.find(
        (i) => i.title === "P8 Overdue Personal Task" && i.sourceType === "task"
    );
    if (overdueItem) {
        assert(overdueItem.deadlineClassification === "OVERDUE", "Overdue task classified as OVERDUE");
        assert(overdueItem.isAtRisk === true, "Overdue task flagged at-risk");
        assert(overdueItem.urgencyScore > 0, `Overdue urgency score > 0 (${overdueItem.urgencyScore})`);
    } else {
        assert(false, "Overdue task not found in calendar");
    }

    const dueTodayItem = calItems.find(
        (i) => i.title === "P8 Personal Task Due Today" && i.sourceType === "task"
    );
    if (dueTodayItem) {
        assert(
            dueTodayItem.deadlineClassification === "DUE_TODAY",
            "Due-today task classified as DUE_TODAY"
        );
    } else {
        assert(false, "Due-today task not found in calendar");
    }

    // ══════════════════════════════════════════════════════════════════════════
    // TEST 12: Meeting Delete Authorization
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n── Test 12: Meeting Delete Authorization ────────────────");

    // Non-organizer should be blocked
    const delBReq = {
        user: { _id: userB._id },
        params: { id: createdMeetingId.toString() },
    };
    const delBRes = createMockRes();
    await deleteMeeting(delBReq, delBRes);
    assert(delBRes.statusCode === 403, `Non-organizer delete blocked (status: ${delBRes.statusCode})`);

    // Organizer can delete
    const delAReq = {
        user: { _id: userA._id },
        params: { id: createdMeetingId.toString() },
    };
    const delARes = createMockRes();
    await deleteMeeting(delAReq, delARes);
    assert(delARes.statusCode === 200, `Organizer delete succeeded (status: ${delARes.statusCode})`);

    // Verify deleted
    const getDeletedReq = { user: { _id: userA._id }, params: { id: createdMeetingId.toString() } };
    const getDeletedRes = createMockRes();
    await getMeetingById(getDeletedReq, getDeletedRes);
    assert(getDeletedRes.statusCode === 404, "Meeting not found after deletion");

    // ══════════════════════════════════════════════════════════════════════════
    // TEST 13: Date Range Filtering (narrow range excludes overdue)
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n── Test 13: Narrow Date Range ───────────────────────────");

    const tomorrowStart = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 0, 0, 0).toISOString();
    const tomorrowEnd = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 23, 59, 59).toISOString();

    const narrowReq = {
        user: { _id: userA._id },
        query: { start: tomorrowStart, end: tomorrowEnd },
    };
    const narrowRes = createMockRes();
    await getCalendarEvents(narrowReq, narrowRes);

    assert(narrowRes.statusCode === 200, "Narrow range query succeeded");
    const narrowOverdue = (narrowRes.responseData?.data || []).filter(
        (i) => i.title.includes("Overdue") && i.sourceType === "task"
    );
    assert(narrowOverdue.length === 0, "Overdue task excluded from narrow tomorrow range");

    // ══════════════════════════════════════════════════════════════════════════
    // CLEANUP
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n── Cleanup ─────────────────────────────────────────────");

    await Task.deleteMany({ createdBy: { $in: [userA._id, userB._id] } });
    await Meeting.deleteMany({ organizer: { $in: [userA._id, userB._id] } });
    await ProjectMembership.deleteMany({ project: project._id });
    await Project.findByIdAndDelete(project._id);
    await User.findByIdAndDelete(userA._id);
    await User.findByIdAndDelete(userB._id);

    console.log("  ✓ Test data cleaned up");

    // ══════════════════════════════════════════════════════════════════════════
    // SUMMARY
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n╔══════════════════════════════════════════════════════════╗");
    console.log(`║  Results: ${passed} passed, ${failed} failed`);
    console.log("╚══════════════════════════════════════════════════════════╝\n");

    await mongoose.disconnect();
    process.exit(failed > 0 ? 1 : 0);
}

runPhase8Tests().catch((err) => {
    console.error("Test runner error:", err);
    process.exit(1);
});
