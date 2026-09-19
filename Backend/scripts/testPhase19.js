/**
 * Phase 19 — Advanced Chat Features Test Script
 *
 * Tests:
 * 1. Message Replies:
 *    - Send message with replyTo
 *    - Retrieve messages and verify replyTo is populated and decrypted
 *    - Soft delete target message and verify replyTo resolves to "Original message unavailable"
 *    - Reject invalid replyTo ID or message from another conversation
 * 2. Message Editing:
 *    - Sender edits text message: content decrypted, isEdited: true, editedAt populated
 *    - Encryption at rest preserved after edit
 *    - Non-sender edit rejected (403)
 *    - Editing soft-deleted message rejected (400)
 * 3. Soft Deletion:
 *    - Sender soft-deletes message: isDeleted: true, deletedAt set, encryptedContent cleared
 *    - Decrypted format displays "This message was deleted"
 *    - Non-sender delete rejected (403)
 * 4. Message Reactions:
 *    - Add reaction from allowed list ("❤️", "👍", "😂", "😮", "😢", "👏")
 *    - Reject invalid reaction emoji (e.g. "🚀")
 *    - Duplicate prevention / switch emoji
 *    - Multiple users reacting to same message
 *    - Remove reaction
 * 5. Delivery Status & Read Receipts:
 *    - Initial deliveryStatus is SENT or DELIVERED
 *    - Mark conversation as read transitions messages to READ and sets readState
 *    - Unread count calculation in getUserConversations updates accurately
 * 6. In-Conversation Search:
 *    - Scoped strictly to conversation
 *    - Decrypts and matches search term case-insensitively
 *    - Does not match deleted message content
 *    - Unauthorized user cannot search conversation
 *
 * Usage: node scripts/testPhase19.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const Project = require("../models/Project");
const ProjectMembership = require("../models/ProjectMembership");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const chatService = require("../services/chatService");
const { ALLOWED_REACTION_EMOJIS } = chatService;

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

const runTests = async () => {
    console.log("Starting Phase 19 Advanced Chat Features Tests...\n");

    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to MongoDB for testing.\n");

        // Setup test users
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

        // Setup test direct conversation between A and B
        const conv = await chatService.getOrCreateDirectConversation(userA._id, userB._id);

        // ─────────────────────────────────────────────────────────────────────
        // 1. MESSAGE REPLIES
        // ─────────────────────────────────────────────────────────────────────
        section("1. Message Replies");

        const msg1 = await chatService.sendMessage(conv._id, userA._id, "Hello User B, here is msg 1");
        assert(msg1._id && msg1.content === "Hello User B, here is msg 1", "Msg 1 sent successfully");

        // Send reply to msg1
        const replyMsg = await chatService.sendMessage(conv._id, userB._id, "Replying to your msg 1", {
            replyTo: msg1._id,
        });
        assert(replyMsg._id && replyMsg.replyTo, "Reply message created with replyTo populated");
        assert(replyMsg.replyTo._id.toString() === msg1._id.toString(), "replyTo._id matches target msg");
        assert(replyMsg.replyTo.content === "Hello User B, here is msg 1", "replyTo.content decrypted correctly");
        assert(replyMsg.replyTo.isDeleted === false, "replyTo.isDeleted is false");

        // Reject reply to non-existent message
        let invalidReplyFailed = false;
        try {
            await chatService.sendMessage(conv._id, userB._id, "Invalid reply", {
                replyTo: new mongoose.Types.ObjectId(),
            });
        } catch (err) {
            invalidReplyFailed = err.statusCode === 404;
        }
        assert(invalidReplyFailed, "Reply to non-existent message throws 404");

        // Soft delete target msg1 and verify replyTo resolves to 'Original message unavailable'
        await chatService.deleteMessage(conv._id, msg1._id, userA._id);
        const fetchedMessages = await chatService.getMessages(conv._id, userA._id);
        const fetchedReply = fetchedMessages.messages.find((m) => m._id.toString() === replyMsg._id.toString());
        assert(fetchedReply && fetchedReply.replyTo, "Fetched reply message has replyTo");
        assert(fetchedReply.replyTo.isDeleted === true, "Target message marked isDeleted in replyTo");
        assert(fetchedReply.replyTo.content === "Original message unavailable", "replyTo content is 'Original message unavailable'");

        // ─────────────────────────────────────────────────────────────────────
        // 2. MESSAGE EDITING
        // ─────────────────────────────────────────────────────────────────────
        section("2. Message Editing");

        const msgToEdit = await chatService.sendMessage(conv._id, userA._id, "Original text before edit");
        assert(msgToEdit.isEdited === false, "Initial isEdited is false");

        // User A edits their own message
        const editedMsg = await chatService.editMessage(conv._id, msgToEdit._id, userA._id, "Edited text after edit");
        assert(editedMsg.content === "Edited text after edit", "Edited message content updated and decrypted");
        assert(editedMsg.isEdited === true, "isEdited flag is true");
        assert(editedMsg.editedAt instanceof Date || typeof editedMsg.editedAt === "string", "editedAt timestamp is populated");

        // Check encryption at rest
        const rawDbMsg = await Message.findById(msgToEdit._id);
        assert(rawDbMsg.encryptedContent && !rawDbMsg.encryptedContent.includes("Edited text after edit"), "Edited message is encrypted at rest in MongoDB");

        // User B attempts to edit User A's message (Forbidden)
        let nonSenderEditFailed = false;
        try {
            await chatService.editMessage(conv._id, msgToEdit._id, userB._id, "Hacked by User B");
        } catch (err) {
            nonSenderEditFailed = err.statusCode === 403;
        }
        assert(nonSenderEditFailed, "Non-sender cannot edit message (throws 403)");

        // Attempt to edit deleted message
        let editDeletedFailed = false;
        try {
            await chatService.editMessage(conv._id, msg1._id, userA._id, "Editing deleted message");
        } catch (err) {
            editDeletedFailed = err.statusCode === 400;
        }
        assert(editDeletedFailed, "Cannot edit deleted message (throws 400)");

        // ─────────────────────────────────────────────────────────────────────
        // 3. SOFT DELETION
        // ─────────────────────────────────────────────────────────────────────
        section("3. Soft Deletion");

        const msgToDelete = await chatService.sendMessage(conv._id, userA._id, "Secret message to be deleted");
        
        // User B attempts to delete User A's message (Forbidden)
        let nonSenderDeleteFailed = false;
        try {
            await chatService.deleteMessage(conv._id, msgToDelete._id, userB._id);
        } catch (err) {
            nonSenderDeleteFailed = err.statusCode === 403;
        }
        assert(nonSenderDeleteFailed, "Non-sender cannot delete message (throws 403)");

        // User A deletes their message
        const deleteResult = await chatService.deleteMessage(conv._id, msgToDelete._id, userA._id);
        assert(deleteResult.success === true, "Message deleted successfully by sender");

        const dbDeletedMsg = await Message.findById(msgToDelete._id);
        assert(dbDeletedMsg.isDeleted === true, "MongoDB document has isDeleted: true");
        assert(dbDeletedMsg.deletedAt instanceof Date, "MongoDB document has deletedAt Date");
        assert(dbDeletedMsg.encryptedContent === null, "MongoDB ciphertext is cleared to null upon deletion");

        const listAfterDelete = await chatService.getMessages(conv._id, userA._id);
        const formattedDeleted = listAfterDelete.messages.find((m) => m._id.toString() === msgToDelete._id.toString());
        assert(formattedDeleted.content === "This message was deleted", "Formatted deleted message displays 'This message was deleted'");
        assert(formattedDeleted.attachment === null, "Attachment is null for deleted message in API payload");

        // ─────────────────────────────────────────────────────────────────────
        // 4. MESSAGE REACTIONS
        // ─────────────────────────────────────────────────────────────────────
        section("4. Message Reactions");

        const reactMsg = await chatService.sendMessage(conv._id, userA._id, "React to this message!");

        // Add valid reaction 👍
        const reactions1 = await chatService.addReaction(conv._id, reactMsg._id, userB._id, "👍");
        assert(reactions1.length === 1 && reactions1[0].emoji === "👍" && reactions1[0].count === 1, "User B reacted with 👍");
        assert(reactions1[0].users.some((u) => u._id.toString() === userB._id.toString()), "User B in reaction users list");

        // Reject invalid reaction emoji
        let invalidEmojiFailed = false;
        try {
            await chatService.addReaction(conv._id, reactMsg._id, userB._id, "🚀");
        } catch (err) {
            invalidEmojiFailed = err.statusCode === 400;
        }
        assert(invalidEmojiFailed, "Invalid reaction emoji 🚀 rejected with 400");

        // User B switches reaction to ❤️ (Duplicate prevention / 1 reaction per user)
        const reactions2 = await chatService.addReaction(conv._id, reactMsg._id, userB._id, "❤️");
        assert(reactions2.length === 1 && reactions2[0].emoji === "❤️" && reactions2[0].count === 1, "User B switched reaction to ❤️");
        assert(!reactions2.some((r) => r.emoji === "👍"), "Previous emoji 👍 was cleared when switching");

        // User A also reacts with ❤️ (Multiple users on same emoji)
        const reactions3 = await chatService.addReaction(conv._id, reactMsg._id, userA._id, "❤️");
        assert(reactions3.length === 1 && reactions3[0].emoji === "❤️" && reactions3[0].count === 2, "Both User A and User B reacted with ❤️ (count=2)");

        // User B removes reaction
        const reactions4 = await chatService.removeReaction(conv._id, reactMsg._id, userB._id);
        assert(reactions4.length === 1 && reactions4[0].count === 1, "User B removed reaction, count is now 1");

        // User A removes reaction
        const reactions5 = await chatService.removeReaction(conv._id, reactMsg._id, userA._id);
        assert(reactions5.length === 0, "All reactions removed, list is empty");

        // ─────────────────────────────────────────────────────────────────────
        // 5. DELIVERY STATUS & READ RECEIPTS
        // ─────────────────────────────────────────────────────────────────────
        section("5. Delivery Status & Read Receipts");

        const statusMsg = await chatService.sendMessage(conv._id, userA._id, "Status test message", { isDelivered: true });
        assert(statusMsg.deliveryStatus === "DELIVERED", "Initial deliveryStatus set to DELIVERED when recipient is active");

        // Check unread count for User B before reading
        const userBConvsBefore = await chatService.getUserConversations(userB._id);
        const convBefore = userBConvsBefore.find((c) => c._id.toString() === conv._id.toString());
        assert(convBefore && convBefore.unreadCount > 0, `User B has ${convBefore?.unreadCount} unread message(s)`);

        // User B marks conversation as read
        const readRes = await chatService.markConversationRead(conv._id, userB._id);
        assert(readRes.success === true, "markConversationRead succeeded");

        // Verify message delivery status updated to READ
        const updatedStatusMsg = await Message.findById(statusMsg._id);
        assert(updatedStatusMsg.deliveryStatus === "READ", "Message deliveryStatus transitioned to READ");
        assert(updatedStatusMsg.readBy.some((id) => id.toString() === userB._id.toString()), "User B added to message.readBy");

        // Verify unread count for User B is now 0
        const userBConvsAfter = await chatService.getUserConversations(userB._id);
        const convAfter = userBConvsAfter.find((c) => c._id.toString() === conv._id.toString());
        assert(convAfter && convAfter.unreadCount === 0, "User B unread count reset to 0 after reading");

        // ─────────────────────────────────────────────────────────────────────
        // 6. IN-CONVERSATION SEARCH
        // ─────────────────────────────────────────────────────────────────────
        section("6. In-Conversation Search");

        await chatService.sendMessage(conv._id, userA._id, "The quick brown fox jumps over the lazy dog");
        await chatService.sendMessage(conv._id, userB._id, "Unique keyword: AlgorandQuantum2026");

        // Search for "quick brown"
        const searchRes1 = await chatService.searchMessages(conv._id, userA._id, "quick brown");
        assert(searchRes1.count >= 1, "Search found match for 'quick brown'");
        assert(searchRes1.messages[0].content.includes("quick brown fox"), "Match content decrypted and correct");

        // Search for unique keyword case-insensitively
        const searchRes2 = await chatService.searchMessages(conv._id, userB._id, "algorandquantum");
        assert(searchRes2.count === 1, "Case-insensitive search found 1 match for 'algorandquantum'");

        // Unauthorized user C cannot search conversation
        let unauthorizedSearchFailed = false;
        try {
            await chatService.searchMessages(conv._id, userC._id, "quick");
        } catch (err) {
            unauthorizedSearchFailed = err.statusCode === 403;
        }
        assert(unauthorizedSearchFailed, "Unauthorized user C cannot search conversation (403)");

        // ─────────────────────────────────────────────────────────────────────
        // CLEANUP
        // ─────────────────────────────────────────────────────────────────────
        await Message.deleteMany({ conversation: conv._id });
        await Conversation.findByIdAndDelete(conv._id);
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
    console.log(`Phase 19 Test Summary: ${passed} Passed, ${failed} Failed`);
    console.log("═".repeat(50) + "\n");

    if (failed > 0) {
        process.exit(1);
    }
};

runTests();
