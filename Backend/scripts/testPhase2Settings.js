require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const mongoose = require("mongoose");
const User = require("../models/User");
const RefreshTokenSession = require("../models/RefreshTokenSession");
const Project = require("../models/Project");
const ProjectMembership = require("../models/ProjectMembership");
const Task = require("../models/Task");
const Notification = require("../models/Notification");
const {
    changePassword,
    getActiveSessions,
    logoutAllDevices,
    revokeSession,
    submitSupportTicket,
    deleteAccount,
} = require("../controllers/userController");
const {
    createRefreshSession,
    generateRefreshToken,
    hashToken,
} = require("../services/tokenService");

// Mock Express response helper
function createMockRes() {
    return {
        statusCode: 200,
        data: null,
        cookies: {},
        clearedCookies: [],
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.data = payload;
            return this;
        },
        cookie(name, val, opts) {
            this.cookies[name] = { val, opts };
            return this;
        },
        clearCookie(name, opts) {
            this.clearedCookies.push({ name, opts });
            return this;
        },
    };
}

async function runPhase2Tests() {
    console.log("=== Running Phase 2 Profile & Settings Integration Tests ===");
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

    if (!mongoUri) {
        console.error("FAIL: MONGO_URI missing in .env");
        process.exit(1);
    }

    try {
        await mongoose.connect(mongoUri);
        console.log("Connected to MongoDB successfully.");

        const timestamp = Date.now();
        const testEmail = `phase2_user_${timestamp}@studysync.com`;
        const initialPassword = "OldPassword123!";
        const newPassword = "NewPassword123@#";

        // 1. Create a test user
        console.log("\n1. Creating test user for Phase 2 flows...");
        const testUser = await User.create({
            name: "Phase2 Tester",
            email: testEmail,
            password: initialPassword,
            termsAccepted: true,
            emailVerified: true,
            username: `p2_${timestamp.toString().slice(-6)}`,
            preferences: { theme: "light", language: "en", emailNotifications: true },
        });
        console.log("Test user created with ID:", testUser._id);

        // 2. Create 2 test refresh sessions
        console.log("\n2. Creating test active sessions...");
        const rawToken1 = generateRefreshToken();
        const rawToken2 = generateRefreshToken();

        const mockReqSession1 = {
            ip: "192.168.1.100",
            headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36" },
        };
        const mockReqSession2 = {
            ip: "10.0.0.5",
            headers: { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148" },
        };

        const session1Result = await createRefreshSession(testUser._id, rawToken1, mockReqSession1);
        const session2Result = await createRefreshSession(testUser._id, rawToken2, mockReqSession2);

        const session1Doc = await RefreshTokenSession.findOne({ tokenHash: session1Result.tokenHash });
        const session2Doc = await RefreshTokenSession.findOne({ tokenHash: session2Result.tokenHash });
        console.log("Created 2 sessions. Session 1 ID:", session1Doc._id, "| Session 2 ID:", session2Doc._id);

        // 3. Test getActiveSessions
        console.log("\n3. Testing getActiveSessions with isCurrent tracking...");
        const getSessionsReq = {
            user: { _id: testUser._id },
            cookies: { studysync_refresh_token: rawToken1 },
        };
        const getSessionsRes = createMockRes();
        await getActiveSessions(getSessionsReq, getSessionsRes);

        if (getSessionsRes.statusCode !== 200 || !getSessionsRes.data?.success) {
            throw new Error(`getActiveSessions failed: ${JSON.stringify(getSessionsRes.data)}`);
        }

        const sessionsList = getSessionsRes.data.data.sessions;
        console.log(`Retrieved ${sessionsList.length} sessions.`);
        const curSession = sessionsList.find((s) => s.isCurrent === true);
        if (!curSession || curSession.id !== session1Doc._id.toString()) {
            throw new Error("FAIL: isCurrent session tracking failed to identify current token.");
        }
        console.log(`Current session correctly identified: ${curSession.browser} on ${curSession.os}`);

        // 4. Test revokeSession (revoke session 2)
        console.log("\n4. Testing single session revocation...");
        const revokeReq = {
            user: { _id: testUser._id },
            params: { id: session2Doc._id.toString() },
            cookies: { studysync_refresh_token: rawToken1 },
        };
        const revokeRes = createMockRes();
        await revokeSession(revokeReq, revokeRes);

        if (revokeRes.statusCode !== 200 || !revokeRes.data?.success) {
            throw new Error(`revokeSession failed: ${JSON.stringify(revokeRes.data)}`);
        }
        const session2After = await RefreshTokenSession.findById(session2Doc._id);
        if (!session2After || !session2After.revoked) {
            throw new Error("FAIL: Session 2 was not revoked properly.");
        }
        console.log("Session 2 successfully revoked (revoked: true).");

        // 5. Test changePassword validations
        console.log("\n5. Testing changePassword validations...");

        // 5a. Incorrect current password
        const badCurrentReq = {
            user: { _id: testUser._id },
            body: { currentPassword: "WrongPassword!", newPassword },
        };
        const badCurrentRes = createMockRes();
        await changePassword(badCurrentReq, badCurrentRes);
        if (badCurrentRes.statusCode !== 400) {
            throw new Error("FAIL: Allowed changePassword with incorrect current password!");
        }
        console.log("Expected rejection for incorrect current password passed.");

        // 5b. Same password
        const samePassReq = {
            user: { _id: testUser._id },
            body: { currentPassword: initialPassword, newPassword: initialPassword },
        };
        const samePassRes = createMockRes();
        await changePassword(samePassReq, samePassRes);
        if (samePassRes.statusCode !== 400) {
            throw new Error("FAIL: Allowed changePassword with identical new password!");
        }
        console.log("Expected rejection for identical new password passed.");

        // 5c. Valid changePassword
        const validPassReq = {
            user: { _id: testUser._id },
            body: { currentPassword: initialPassword, newPassword, confirmPassword: newPassword },
            headers: mockReqSession1.headers,
            ip: mockReqSession1.ip,
        };
        const validPassRes = createMockRes();
        await changePassword(validPassReq, validPassRes);
        if (validPassRes.statusCode !== 200 || !validPassRes.data?.success) {
            throw new Error(`changePassword failed: ${JSON.stringify(validPassRes.data)}`);
        }
        console.log("Password changed successfully. New access token received.");

        // Verify that user can match new password
        const updatedUser = await User.findById(testUser._id);
        const matchesNew = await updatedUser.matchPassword(newPassword);
        const matchesOld = await updatedUser.matchPassword(initialPassword);
        if (!matchesNew || matchesOld) {
            throw new Error("FAIL: Password hash in DB was not correctly updated!");
        }
        console.log("Database hash verified with new password.");

        // 6. Test submitSupportTicket
        console.log("\n6. Testing submitSupportTicket...");
        const supportReq = {
            user: { _id: testUser._id },
            body: {
                name: "Phase2 Tester",
                email: testEmail,
                subject: "Question about study sessions",
                message: "How can I synchronize Pomodoro sprint sessions across devices?",
            },
        };
        const supportRes = createMockRes();
        await submitSupportTicket(supportReq, supportRes);
        if (supportRes.statusCode !== 200 || !supportRes.data?.success) {
            throw new Error(`submitSupportTicket failed: ${JSON.stringify(supportRes.data)}`);
        }
        console.log("Support ticket submitted successfully.");

        // 7. Test cascading deleteAccount
        console.log("\n7. Testing cascading deleteAccount...");

        // Create related documents for the user to verify cascading delete
        const testProject = await Project.create({
            name: "Phase2 Test Project",
            description: "Testing cascading deletion",
            owner: testUser._id,
            startDate: new Date(),
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        const testTask = await Task.create({
            title: "Phase2 Test Task",
            project: testProject._id,
            createdBy: testUser._id,
        });

        const testNotif = await Notification.create({
            recipient: testUser._id,
            type: "TASK_ASSIGNED",
            title: "Test Alert",
            message: "Testing cascading delete",
            sourceType: "TASK",
            sourceId: testTask._id,
        });

        console.log("Created associated project, task, and notification.");

        // 7a. Reject without confirmation text
        const badConfirmReq = {
            user: { _id: testUser._id },
            body: { confirmationText: "delete", password: newPassword },
        };
        const badConfirmRes = createMockRes();
        await deleteAccount(badConfirmReq, badConfirmRes);
        if (badConfirmRes.statusCode !== 400) {
            throw new Error("FAIL: Allowed deletion without exact DELETE confirmation text!");
        }
        console.log("Expected rejection for lowercase 'delete' passed.");

        // 7b. Reject with wrong password
        const badDeletePassReq = {
            user: { _id: testUser._id },
            body: { confirmationText: "DELETE", password: "WrongPassword!" },
        };
        const badDeletePassRes = createMockRes();
        await deleteAccount(badDeletePassReq, badDeletePassRes);
        if (badDeletePassRes.statusCode !== 400) {
            throw new Error("FAIL: Allowed deletion with wrong password!");
        }
        console.log("Expected rejection for wrong password passed.");

        // 7c. Execute valid cascading deletion
        const validDeleteReq = {
            user: { _id: testUser._id },
            body: { confirmationText: "DELETE", password: newPassword },
        };
        const validDeleteRes = createMockRes();
        await deleteAccount(validDeleteReq, validDeleteRes);

        if (validDeleteRes.statusCode !== 200 || !validDeleteRes.data?.success) {
            throw new Error(`deleteAccount failed: ${JSON.stringify(validDeleteRes.data)}`);
        }
        console.log("deleteAccount succeeded with status 200.");

        // Verify cascading cleanup
        const userDeleted = await User.findById(testUser._id);
        const projectDeleted = await Project.findById(testProject._id);
        const taskDeleted = await Task.findById(testTask._id);
        const notifDeleted = await Notification.findById(testNotif._id);
        const sessionsDeleted = await RefreshTokenSession.find({ userId: testUser._id });

        if (userDeleted || projectDeleted || taskDeleted || notifDeleted || sessionsDeleted.length > 0) {
            throw new Error("FAIL: Cascading cleanup left orphaned records!");
        }

        console.log("Cascading cleanup verified: User, owned projects, tasks, notifications, and sessions all removed.");
        console.log("\nALL PHASE 2 INTEGRATION TESTS PASSED PERFECTLY!");
    } catch (err) {
        console.error("Integration test error:", err);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected from MongoDB.");
    }
}

runPhase2Tests();
