/**
 * Phase 15 — Chat Foundation Test Script
 *
 * Tests:
 * 1. Encryption/Decryption correctness
 * 2. Conversation CRUD and deduplication
 * 3. Message send/retrieve and pagination
 * 4. Access control enforcement
 * 5. Encryption at rest verification
 *
 * Usage: node scripts/testChat.js
 * Requires: Running MongoDB, CHAT_ENCRYPTION_KEY in .env
 */

require("dotenv").config();
const mongoose = require("mongoose");
const crypto = require("crypto");

// Models
const User = require("../models/User");
const Project = require("../models/Project");
const ProjectMembership = require("../models/ProjectMembership");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");

// Services & Utils
const { encrypt, decrypt } = require("../utils/encryption");
const chatService = require("../services/chatService");

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

// ─────────────────────────────────────────────────────────────────────────────
// TEST ENCRYPTION
// ─────────────────────────────────────────────────────────────────────────────
const testEncryption = () => {
    section("Encryption Utility");

    // Test basic encrypt/decrypt
    const plaintext = "Hello StudySync";
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    assert(decrypted === plaintext, "Encrypt → Decrypt returns original plaintext");

    // Test encrypted format (iv:authTag:ciphertext)
    const parts = encrypted.split(":");
    assert(parts.length === 3, "Encrypted format has 3 parts (iv:authTag:ciphertext)");
    assert(parts[0].length === 24, "IV is 12 bytes (24 hex chars)");
    assert(parts[1].length === 32, "Auth tag is 16 bytes (32 hex chars)");

    // Test ciphertext is NOT plaintext
    assert(!encrypted.includes(plaintext), "Encrypted output does NOT contain plaintext");

    // Test unique IVs (no IV reuse)
    const encrypted2 = encrypt(plaintext);
    const iv1 = encrypted.split(":")[0];
    const iv2 = encrypted2.split(":")[0];
    assert(iv1 !== iv2, "Each encryption uses a unique IV");

    // Test tampered ciphertext fails
    let tamperedFailed = false;
    try {
        const tampered = encrypted.replace(/[0-9a-f]$/, encrypted.endsWith("0") ? "1" : "0");
        decrypt(tampered);
    } catch {
        tamperedFailed = true;
    }
    assert(tamperedFailed, "Tampered ciphertext decryption fails safely");

    // Test invalid format fails
    let invalidFormatFailed = false;
    try {
        decrypt("invalid-data");
    } catch {
        invalidFormatFailed = true;
    }
    assert(invalidFormatFailed, "Invalid encrypted format fails safely");

    // Test empty string fails
    let emptyFailed = false;
    try {
        encrypt("");
    } catch {
        emptyFailed = true;
    }
    assert(emptyFailed, "Encrypting empty string throws error");

    // Test various content types
    const unicode = "こんにちは 🎉 مرحبا";
    assert(decrypt(encrypt(unicode)) === unicode, "Unicode content encrypts/decrypts correctly");

    const longMsg = "A".repeat(5000);
    assert(decrypt(encrypt(longMsg)) === longMsg, "Long message (5000 chars) encrypts/decrypts correctly");
};

// ─────────────────────────────────────────────────────────────────────────────
// TEST CONVERSATIONS & MESSAGES
// ─────────────────────────────────────────────────────────────────────────────
const testConversationsAndMessages = async () => {
    section("Database Setup");

    // Create test users
    const testId = crypto.randomBytes(4).toString("hex");
    const userA = await User.create({
        name: `TestUser_A_${testId}`,
        email: `test_a_${testId}@studysync.test`,
        password: "TestPassword123!",
    });
    const userB = await User.create({
        name: `TestUser_B_${testId}`,
        email: `test_b_${testId}@studysync.test`,
        password: "TestPassword123!",
    });
    const userC = await User.create({
        name: `TestUser_C_${testId}`,
        email: `test_c_${testId}@studysync.test`,
        password: "TestPassword123!",
    });
    assert(userA && userB && userC, "Test users created");

    // Create test project
    const project = await Project.create({
        name: `TestProject_${testId}`,
        owner: userA._id,
        startDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 86400000),
    });
    assert(project, "Test project created");

    // Add memberships
    await ProjectMembership.create({ project: project._id, user: userA._id, role: "OWNER" });
    await ProjectMembership.create({ project: project._id, user: userB._id, role: "MEMBER" });
    assert(true, "Project memberships created (A=OWNER, B=MEMBER)");

    // ── DIRECT CONVERSATION TESTS ────────────────────────────────────────

    section("Direct Conversations");

    // Create direct conversation
    const directConvo = await chatService.getOrCreateDirectConversation(userA._id, userB._id);
    assert(directConvo && directConvo.type === "DIRECT", "Direct conversation created between A and B");
    assert(directConvo.participants.length === 2, "Direct conversation has exactly 2 participants");

    // Deduplication: creating again returns same conversation
    const directConvo2 = await chatService.getOrCreateDirectConversation(userA._id, userB._id);
    assert(directConvo2._id.toString() === directConvo._id.toString(), "Duplicate direct conversation prevented (returns existing)");

    // Reverse order also finds existing
    const directConvo3 = await chatService.getOrCreateDirectConversation(userB._id, userA._id);
    assert(directConvo3._id.toString() === directConvo._id.toString(), "Reverse-order lookup finds existing conversation");

    // Self-conversation rejected
    let selfConvoFailed = false;
    try {
        await chatService.getOrCreateDirectConversation(userA._id, userA._id);
    } catch (e) {
        selfConvoFailed = e.statusCode === 400;
    }
    assert(selfConvoFailed, "Self-conversation is rejected (400)");

    // Invalid target user rejected
    let invalidUserFailed = false;
    try {
        await chatService.getOrCreateDirectConversation(userA._id, new mongoose.Types.ObjectId());
    } catch (e) {
        invalidUserFailed = e.statusCode === 404;
    }
    assert(invalidUserFailed, "Non-existent target user rejected (404)");

    // ── PROJECT CONVERSATION TESTS ───────────────────────────────────────

    section("Project Conversations");

    // Create project conversation
    const projConvo = await chatService.getOrCreateProjectConversation(project._id, userA._id);
    assert(projConvo && projConvo.type === "PROJECT", "Project conversation created");

    // Deduplication
    const projConvo2 = await chatService.getOrCreateProjectConversation(project._id, userA._id);
    assert(projConvo2._id.toString() === projConvo._id.toString(), "Duplicate project conversation prevented");

    // Non-member access denied
    let nonMemberFailed = false;
    try {
        await chatService.getOrCreateProjectConversation(project._id, userC._id);
    } catch (e) {
        nonMemberFailed = e.statusCode === 403;
    }
    assert(nonMemberFailed, "Non-member project conversation access rejected (403)");

    // ── MESSAGE TESTS ─────────────────────────────────────────────────────

    section("Messages");

    // Send a message
    const msg1 = await chatService.sendMessage(directConvo._id, userA._id, "Hello from A!");
    assert(msg1 && msg1.content === "Hello from A!", "Message sent and returned with decrypted content");

    // Verify encryption at rest
    const rawMsg = await Message.findById(msg1._id).lean();
    assert(rawMsg.encryptedContent !== "Hello from A!", "Message stored as ciphertext (NOT plaintext) in MongoDB");
    assert(rawMsg.encryptedContent.split(":").length === 3, "Stored ciphertext has correct format (iv:tag:cipher)");

    // Verify decryption of stored content
    const decryptedFromDb = decrypt(rawMsg.encryptedContent);
    assert(decryptedFromDb === "Hello from A!", "Stored ciphertext decrypts to original message");

    // Send more messages for pagination
    for (let i = 0; i < 5; i++) {
        await chatService.sendMessage(directConvo._id, userB._id, `Reply ${i + 1} from B`);
    }
    assert(true, "5 additional messages sent for pagination testing");

    // Retrieve messages
    const messagesResult = await chatService.getMessages(directConvo._id, userA._id, { page: 1, limit: 3 });
    assert(messagesResult.messages.length === 3, "Message pagination returns correct limit");
    assert(messagesResult.total === 6, "Total message count is correct");
    assert(messagesResult.hasMore === true, "hasMore flag indicates more pages");

    // Verify all retrieved messages have decrypted content (not ciphertext)
    const allDecrypted = messagesResult.messages.every(
        (m) => m.content && !m.encryptedContent
    );
    assert(allDecrypted, "All retrieved messages have decrypted content (no ciphertext exposed)");

    // Empty message rejected
    let emptyMsgFailed = false;
    try {
        await chatService.sendMessage(directConvo._id, userA._id, "");
    } catch (e) {
        emptyMsgFailed = e.statusCode === 400;
    }
    assert(emptyMsgFailed, "Empty message rejected (400)");

    // Too-long message rejected
    let longMsgFailed = false;
    try {
        await chatService.sendMessage(directConvo._id, userA._id, "X".repeat(5001));
    } catch (e) {
        longMsgFailed = e.statusCode === 400;
    }
    assert(longMsgFailed, "Message exceeding 5000 chars rejected (400)");

    // ── ACCESS CONTROL TESTS ─────────────────────────────────────────────

    section("Access Control");

    // Unauthorized user cannot read direct messages
    let unauthorizedReadFailed = false;
    try {
        await chatService.getMessages(directConvo._id, userC._id);
    } catch (e) {
        unauthorizedReadFailed = e.statusCode === 403;
    }
    assert(unauthorizedReadFailed, "Unauthorized user cannot read direct messages (403)");

    // Unauthorized user cannot send to direct conversation
    let unauthorizedSendFailed = false;
    try {
        await chatService.sendMessage(directConvo._id, userC._id, "Hack attempt");
    } catch (e) {
        unauthorizedSendFailed = e.statusCode === 403;
    }
    assert(unauthorizedSendFailed, "Unauthorized user cannot send to direct conversation (403)");

    // Non-member cannot read project messages
    let nonMemberReadFailed = false;
    try {
        await chatService.getMessages(projConvo._id, userC._id);
    } catch (e) {
        nonMemberReadFailed = e.statusCode === 403;
    }
    assert(nonMemberReadFailed, "Non-member cannot read project messages (403)");

    // ── CONVERSATION LIST TEST ──────────────────────────────────────────

    section("Conversation List");

    const userAConvos = await chatService.getUserConversations(userA._id);
    assert(userAConvos.length >= 2, "User A can see their conversations (≥2)");

    const hasProject = userAConvos.some((c) => c.type === "PROJECT");
    const hasDirect = userAConvos.some((c) => c.type === "DIRECT");
    assert(hasProject, "Conversation list includes project conversation");
    assert(hasDirect, "Conversation list includes direct conversation");

    // User C should not see A-B conversations
    const userCConvos = await chatService.getUserConversations(userC._id);
    const canSeeAB = userCConvos.some((c) => c._id.toString() === directConvo._id.toString());
    assert(!canSeeAB, "User C cannot see A-B direct conversation in their list");

    // ── CLEANUP ──────────────────────────────────────────────────────────

    section("Cleanup");

    await Message.deleteMany({ conversation: { $in: [directConvo._id, projConvo._id] } });
    await Conversation.deleteMany({ _id: { $in: [directConvo._id, projConvo._id] } });
    await ProjectMembership.deleteMany({ project: project._id });
    await Project.findByIdAndDelete(project._id);
    await User.deleteMany({ _id: { $in: [userA._id, userB._id, userC._id] } });
    assert(true, "Test data cleaned up");
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
const main = async () => {
    console.log("\n🧪 Phase 15 — Chat Foundation Tests\n" + "═".repeat(55));

    try {
        // Test encryption (no DB needed)
        testEncryption();

        // Connect to DB for integration tests
        await mongoose.connect(MONGO_URI);
        results.push("\n✅ Connected to MongoDB");

        await testConversationsAndMessages();
    } catch (err) {
        results.push(`\n💥 FATAL ERROR: ${err.message}`);
        console.error(err);
        failed++;
    } finally {
        await mongoose.disconnect();
    }

    // Print results
    console.log(results.join("\n"));
    console.log("\n" + "═".repeat(55));
    console.log(`📊 Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
    console.log("═".repeat(55) + "\n");

    process.exit(failed > 0 ? 1 : 0);
};

main();
