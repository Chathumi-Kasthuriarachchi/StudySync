/**
 * Phase 20 — Chat & Notification Integration Test Script
 *
 * Tests:
 * 1. Direct Message Notification:
 *    - Recipient receives CHAT_MESSAGE notification with safe preview.
 *    - Sender does not receive notification.
 *    - Unrelated users do not receive notification.
 * 2. Project Message Notification:
 *    - Authorized project members receive notification.
 *    - Non-members are excluded.
 *    - Sender is excluded.
 * 3. Active Conversation Suppression:
 *    - Active viewers in conversation room are suppressed from notification creation.
 * 4. Mention Notifications:
 *    - User mentioned via @name receives CHAT_MENTION notification.
 *    - Mentioned user does NOT receive duplicate generic message notification.
 * 5. Reply Notifications:
 *    - User whose message is replied to receives reply notification.
 * 6. Attachment Notifications:
 *    - File/media attachment produces safe label ("sent a photo", "sent a file: ...").
 *    - Notification body and title never leak private S3 URLs.
 * 7. Deterministic Deduplication:
 *    - Same message event cannot create duplicate notification for same recipient (eventKey enforcement).
 * 8. Notification Source References & Deep Link Readiness:
 *    - Source references (sourceType, sourceId, metadata.conversationId, metadata.messageId) correctly populated.
 *
 * Usage: node scripts/testPhase20.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const Project = require("../models/Project");
const ProjectMembership = require("../models/ProjectMembership");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const Notification = require("../models/Notification");
const chatService = require("../services/chatService");
const notificationService = require("../services/notificationService");
const { NOTIFICATION_TYPES, SOURCE_TYPES } = require("../constants/notificationConstants");

const MONGO_URI = process.env.MONGO_URI;
let passed = 0;
let failed = 0;
const results = [];

const assert = (condition, testName) => {
    if (condition) {
        passed++;
        results.push(`  ✅ ${testName}`);
    } else {
        failed++;
        results.push(`  ❌ ${testName}`);
    }
};

const section = (name) => {
    results.push(`\n📋 ${name}`);
    results.push("─".repeat(50));
};

const waitForNotifications = async (filter, expectedCount = 1, timeoutMs = 2500) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const found = await Notification.find(filter);
        if (found.length >= expectedCount) return found;
        await new Promise((r) => setTimeout(r, 100));
    }
    return await Notification.find(filter);
};

const runTests = async () => {
    console.log("Starting Phase 20 Chat & Notification Integration Tests...\n");

    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to MongoDB for testing.\n");

        const testRunId = Date.now().toString().slice(-6);
        const userA = await User.create({
            name: `UserA_${testRunId}`,
            email: `usera_${testRunId}@test.com`,
            password: "Password123!",
            isVerified: true,
        });

        const userB = await User.create({
            name: `UserB_${testRunId}`,
            email: `userb_${testRunId}@test.com`,
            password: "Password123!",
            isVerified: true,
        });

        const userC = await User.create({
            name: `UserC_${testRunId}`,
            email: `userc_${testRunId}@test.com`,
            password: "Password123!",
            isVerified: true,
        });

        // Setup direct conversation between A and B
        const directConv = await chatService.getOrCreateDirectConversation(userA._id, userB._id);

        // Setup Project Alpha with A and B as members, C is NOT a member
        const projectAlpha = await Project.create({
            name: `ProjectAlpha_${testRunId}`,
            description: "Phase 20 test project",
            owner: userA._id,
            startDate: new Date(),
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        await ProjectMembership.create({
            project: projectAlpha._id,
            user: userA._id,
            role: "OWNER",
        });

        await ProjectMembership.create({
            project: projectAlpha._id,
            user: userB._id,
            role: "MEMBER",
        });

        const projectConv = await chatService.getOrCreateProjectConversation(projectAlpha._id, userA._id);

        // ─────────────────────────────────────────────────────────────────────
        // 1. DIRECT MESSAGE NOTIFICATION
        // ─────────────────────────────────────────────────────────────────────
        section("1. Direct Message Notification");

        const directMsg = await chatService.sendMessage(
            directConv._id,
            userA._id,
            "Hey User B, can you check the API?",
            { skipNotificationUserIds: [] }
        );

        // Wait brief moment for async notification creation
        await new Promise((r) => setTimeout(r, 200));

        const notifsUserB = await waitForNotifications({ recipient: userB._id, sourceType: SOURCE_TYPES.CONVERSATION }, 1);
        assert(notifsUserB.length >= 1, "User B received notification for direct message");

        const latestB = notifsUserB[notifsUserB.length - 1];
        assert(latestB.type === NOTIFICATION_TYPES.CHAT_MESSAGE, "Notification type is CHAT_MESSAGE");
        assert(latestB.title.includes(userA.name), "Notification title contains sender name");
        assert(latestB.message.toLowerCase().includes("can you check the api?"), "Notification body contains safe preview snippet");
        assert(latestB.sourceId.toString() === directConv._id.toString(), "sourceId points to conversation");
        assert(latestB.metadata?.messageId?.toString() === directMsg._id.toString(), "metadata contains messageId");

        // Sender A exclusion
        const notifsUserA = await Notification.find({
            recipient: userA._id,
            "metadata.messageId": directMsg._id.toString(),
        });
        assert(notifsUserA.length === 0, "Sender User A did NOT receive notification for own message");

        // Unrelated User C exclusion
        const notifsUserC = await Notification.find({
            recipient: userC._id,
            "metadata.messageId": directMsg._id.toString(),
        });
        assert(notifsUserC.length === 0, "Unrelated User C did NOT receive notification");

        // ─────────────────────────────────────────────────────────────────────
        // 2. PROJECT MESSAGE NOTIFICATION & MEMBER FILTERING
        // ─────────────────────────────────────────────────────────────────────
        section("2. Project Message Notification & Member Filtering");

        const projectMsg = await chatService.sendMessage(
            projectConv._id,
            userA._id,
            "Sprint status meeting at 3 PM",
            { skipNotificationUserIds: [] }
        );

        const projNotifsB = await waitForNotifications({
            recipient: userB._id,
            "metadata.messageId": projectMsg._id.toString(),
        }, 1);
        assert(projNotifsB.length === 1, "Project member User B received notification");
        assert(projNotifsB[0]?.title.includes(projectAlpha.name), "Project notification title mentions Project Alpha");
        assert(projNotifsB[0]?.project?.toString() === projectAlpha._id.toString(), "Notification project field set to Project Alpha");

        const projNotifsC = await Notification.find({
            recipient: userC._id,
            "metadata.messageId": projectMsg._id.toString(),
        });
        assert(projNotifsC.length === 0, "Non-member User C did NOT receive project notification");

        // ─────────────────────────────────────────────────────────────────────
        // 3. ACTIVE CONVERSATION SUPPRESSION
        // ─────────────────────────────────────────────────────────────────────
        section("3. Active Conversation Suppression");

        // User B is actively viewing projectConv (skipNotificationUserIds includes User B)
        const suppressedMsg = await chatService.sendMessage(
            projectConv._id,
            userA._id,
            "Real-time update while User B is viewing chat",
            { skipNotificationUserIds: [userB._id.toString()] }
        );

        await new Promise((r) => setTimeout(r, 300));

        const suppressedNotifsB = await Notification.find({
            recipient: userB._id,
            "metadata.messageId": suppressedMsg._id.toString(),
        });
        assert(suppressedNotifsB.length === 0, "Active conversation viewer User B was suppressed (0 notifications created)");

        // ─────────────────────────────────────────────────────────────────────
        // 4. MENTION NOTIFICATIONS
        // ─────────────────────────────────────────────────────────────────────
        section("4. Mention Notifications");

        // User A mentions User B: "@UserB_xxxx please review this"
        const mentionMsg = await chatService.sendMessage(
            projectConv._id,
            userA._id,
            `Hey @${userB.name} please review this PR immediately!`,
            { skipNotificationUserIds: [] }
        );

        const mentionNotifsB = await waitForNotifications({
            recipient: userB._id,
            "metadata.messageId": mentionMsg._id.toString(),
        }, 1);
        assert(mentionNotifsB.length === 1, "User B received exactly 1 notification for mention event (no duplicate)");
        assert(mentionNotifsB[0]?.type === NOTIFICATION_TYPES.CHAT_MENTION, "Notification type is CHAT_MENTION");
        assert(mentionNotifsB[0]?.title.toLowerCase().includes("mentioned"), "Notification title indicates mention");

        // ─────────────────────────────────────────────────────────────────────
        // 5. REPLY NOTIFICATIONS
        // ─────────────────────────────────────────────────────────────────────
        section("5. Reply Notifications");

        // User B sends a message
        const targetMsg = await chatService.sendMessage(
            projectConv._id,
            userB._id,
            "I have a question about the database schema",
            { skipNotificationUserIds: [userA._id.toString()] }
        );

        // User A replies to User B's message
        const replyMsg = await chatService.sendMessage(
            projectConv._id,
            userA._id,
            "Here is the answer to your question",
            { replyTo: targetMsg._id, skipNotificationUserIds: [] }
        );

        const replyNotifsB = await waitForNotifications({
            recipient: userB._id,
            "metadata.messageId": replyMsg._id.toString(),
        }, 1);
        assert(replyNotifsB.length === 1, "User B received reply notification");
        assert(replyNotifsB[0]?.title.toLowerCase().includes("replied"), "Notification title indicates reply");

        // ─────────────────────────────────────────────────────────────────────
        // 6. ATTACHMENT NOTIFICATIONS & PRIVACY
        // ─────────────────────────────────────────────────────────────────────
        section("6. Attachment Notifications & Privacy");

        // Fake buffer file upload
        const fakeFile = {
            originalname: "Q3_Report.pdf",
            mimetype: "application/pdf",
            size: 1024 * 50,
            buffer: Buffer.from("%PDF-1.4 test file content"),
        };

        const attachMsg = await chatService.sendAttachmentMessage(
            projectConv._id,
            userA._id,
            fakeFile,
            "Quarterly analysis document",
            { skipNotificationUserIds: [] }
        );

        const attachNotifsB = await waitForNotifications({
            recipient: userB._id,
            "metadata.messageId": attachMsg._id.toString(),
        }, 1);
        assert(attachNotifsB.length === 1, "User B received attachment notification");
        assert(!attachNotifsB[0]?.message.includes("amazonaws.com"), "Notification does NOT leak AWS S3 URL");
        assert(!attachNotifsB[0]?.message.includes("X-Amz-Signature"), "Notification does NOT leak presigned signature");
        assert(attachNotifsB[0]?.message.includes("Quarterly analysis document"), "Notification contains user caption");

        // ─────────────────────────────────────────────────────────────────────
        // 7. DETERMINISTIC DEDUPLICATION
        // ─────────────────────────────────────────────────────────────────────
        section("7. Deterministic Deduplication");

        const duplicateCountBefore = await Notification.countDocuments({
            recipient: userB._id,
            "metadata.messageId": projectMsg._id.toString(),
        });

        // Trigger notifyChatMessage again with the same projectMsg
        await notificationService.notifyChatMessage({
            message: projectMsg,
            conversation: projectConv,
            sender: userA._id,
            content: "Sprint status meeting at 3 PM",
            options: { skipNotificationUserIds: [] },
        });

        const duplicateCountAfter = await Notification.countDocuments({
            recipient: userB._id,
            "metadata.messageId": projectMsg._id.toString(),
        });
        assert(duplicateCountAfter === duplicateCountBefore, "Duplicate eventKey prevented second notification from being stored");

        // ─────────────────────────────────────────────────────────────────────
        // CLEANUP
        // ─────────────────────────────────────────────────────────────────────
        await Notification.deleteMany({ recipient: { $in: [userA._id, userB._id, userC._id] } });
        await Message.deleteMany({ conversation: { $in: [directConv._id, projectConv._id] } });
        await Conversation.deleteMany({ _id: { $in: [directConv._id, projectConv._id] } });
        await ProjectMembership.deleteMany({ project: projectAlpha._id });
        await Project.findByIdAndDelete(projectAlpha._id);
        await User.deleteMany({ _id: { $in: [userA._id, userB._id, userC._id] } });

    } catch (err) {
        console.error("Test execution failed with error:", err);
        failed++;
        results.push(`  ❌ Unexpected test exception: ${err.message}`);
    } finally {
        await mongoose.disconnect();
    }

    // Print summary
    console.log(results.join("\n"));
    console.log("\n" + "═".repeat(50));
    console.log(`Phase 20 Test Summary: ${passed} Passed, ${failed} Failed`);
    console.log("═".repeat(50) + "\n");

    if (failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
};

runTests();
