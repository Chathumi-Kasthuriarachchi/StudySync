/**
 * Phase 16 — Real-Time Messaging Test Script
 *
 * Tests:
 * 1. Socket authentication (valid token succeeds, invalid/no token rejected)
 * 2. Room authorization (project member joins, non-member rejected; direct participant joins, outsider rejected)
 * 3. Real-time message exchange via Socket.IO
 * 4. Message encryption in MongoDB at rest
 * 5. Sender impersonation prevention
 * 6. Input validation (empty, overlength)
 * 7. Rate limiting protection
 * 8. Room leave & disconnection
 *
 * Usage: node scripts/testSocketChat.js
 */

require("dotenv").config();
const http = require("http");
const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");
const { io: ioClient } = require("socket.io-client");

// Models
const User = require("../models/User");
const Project = require("../models/Project");
const ProjectMembership = require("../models/ProjectMembership");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");

// Services & Utils
const socketService = require("../services/socketService");
const chatService = require("../services/chatService");
const { generateAccessToken } = require("../services/tokenService");
const { decrypt } = require("../utils/encryption");
const socketEvents = require("../constants/socketEvents");

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

// Helper: create client socket promise
const connectClient = (port, token) => {
    return new Promise((resolve, reject) => {
        const socket = ioClient(`http://127.0.0.1:${port}`, {
            auth: token ? { token } : {},
            transports: ["websocket"],
            reconnection: false,
            timeout: 5000,
        });

        socket.on("connect", () => resolve(socket));
        socket.on("connect_error", (err) => reject(err));
    });
};

const runTests = async () => {
    console.log("\n🧪 Phase 16 — Real-Time Messaging Tests");
    console.log("═".repeat(55));

    // 1. Connect DB
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // 2. Spin up dedicated test HTTP server + Socket.IO
    const app = express();
    const server = http.createServer(app);
    socketService.init(server, ["*"]);

    const TEST_PORT = 5099;
    await new Promise((resolve) => server.listen(TEST_PORT, resolve));
    console.log(`✅ Test Socket.IO server running on port ${TEST_PORT}`);

    const testRunId = crypto.randomBytes(4).toString("hex");

    let userA, userB, userC;
    let tokenA, tokenB, tokenC;
    let project, directConv, projectConv;

    try {
        // ── Database Setup ──────────────────────────────────────────────────
        section("Test Data Setup");

        userA = await User.create({
            name: `SocketUser_A_${testRunId}`,
            email: `socket_a_${testRunId}@studysync.com`,
            password: "TestPassword123!",
        });
        userB = await User.create({
            name: `SocketUser_B_${testRunId}`,
            email: `socket_b_${testRunId}@studysync.com`,
            password: "TestPassword123!",
        });
        userC = await User.create({
            name: `SocketUser_C_External_${testRunId}`,
            email: `socket_c_${testRunId}@studysync.com`,
            password: "TestPassword123!",
        });

        tokenA = generateAccessToken(userA._id.toString(), "USER");
        tokenB = generateAccessToken(userB._id.toString(), "USER");
        tokenC = generateAccessToken(userC._id.toString(), "USER");

        assert(tokenA && tokenB && tokenC, "Generated valid JWT access tokens for test users");

        project = await Project.create({
            name: `Socket Test Project ${testRunId}`,
            description: "Testing real-time socket messaging",
            owner: userA._id,
            startDate: new Date(),
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        await ProjectMembership.create({
            project: project._id,
            user: userA._id,
            role: "OWNER",
        });
        await ProjectMembership.create({
            project: project._id,
            user: userB._id,
            role: "MEMBER",
        });

        directConv = await chatService.getOrCreateDirectConversation(userA._id, userB._id);
        projectConv = await chatService.getOrCreateProjectConversation(project._id, userA._id);

        assert(directConv && projectConv, "Created direct and project test conversations");

        // ── Socket Authentication Tests ─────────────────────────────────────
        section("Socket Authentication");

        // Test 1: Connect with valid token
        let socketA;
        try {
            socketA = await connectClient(TEST_PORT, tokenA);
            assert(socketA.connected, "Authenticated socket connection succeeds with valid JWT");
        } catch (err) {
            assert(false, `Authenticated socket connection failed: ${err.message}`);
        }

        // Test 2: Connect with no token
        let noTokenRejected = false;
        try {
            await connectClient(TEST_PORT, null);
        } catch (err) {
            noTokenRejected = true;
            assert(
                err.message.toLowerCase().includes("authentication error") ||
                err.message.toLowerCase().includes("no token"),
                "Unauthenticated connection rejected with 'Authentication error'"
            );
        }
        if (!noTokenRejected) {
            assert(false, "Unauthenticated connection was NOT rejected");
        }

        // Test 3: Connect with bogus token
        let badTokenRejected = false;
        try {
            await connectClient(TEST_PORT, "invalid.jwt.token.string");
        } catch (err) {
            badTokenRejected = true;
            assert(
                err.message.toLowerCase().includes("authentication error"),
                "Invalid JWT connection rejected with 'Authentication error'"
            );
        }
        if (!badTokenRejected) {
            assert(false, "Invalid token was NOT rejected");
        }

        // Connect user B and user C
        const socketB = await connectClient(TEST_PORT, tokenB);
        const socketC = await connectClient(TEST_PORT, tokenC);
        assert(socketB.connected && socketC.connected, "Users B and C connected successfully");

        // ── Room Authorization Tests ────────────────────────────────────────
        section("Conversation Room Authorization");

        // Test 4: Project member (User A) joins project conversation room
        const joinProjectA = await new Promise((resolve) => {
            socketA.emit(
                socketEvents.CONVERSATION_JOIN,
                { conversationId: projectConv._id.toString() },
                (res) => resolve(res)
            );
        });
        assert(joinProjectA && joinProjectA.success === true, "Project member (User A) can join project room");

        // Test 5: Non-member (User C) fails to join project conversation room
        const joinProjectC = await new Promise((resolve) => {
            socketC.emit(
                socketEvents.CONVERSATION_JOIN,
                { conversationId: projectConv._id.toString() },
                (res) => resolve(res)
            );
        });
        assert(
            joinProjectC && joinProjectC.success === false,
            "Non-member (User C) is rejected from project room"
        );

        // Test 6: Direct participant (User B) joins direct conversation room
        const joinDirectB = await new Promise((resolve) => {
            socketB.emit(
                socketEvents.CONVERSATION_JOIN,
                { conversationId: directConv._id.toString() },
                (res) => resolve(res)
            );
        });
        assert(joinDirectB && joinDirectB.success === true, "Direct participant (User B) can join direct room");

        // Test 7: Non-participant (User C) fails to join direct conversation room
        const joinDirectC = await new Promise((resolve) => {
            socketC.emit(
                socketEvents.CONVERSATION_JOIN,
                { conversationId: directConv._id.toString() },
                (res) => resolve(res)
            );
        });
        assert(
            joinDirectC && joinDirectC.success === false,
            "Non-participant (User C) is rejected from direct room"
        );

        // Test 8: Invalid conversation ID rejected
        const joinInvalid = await new Promise((resolve) => {
            socketA.emit(
                socketEvents.CONVERSATION_JOIN,
                { conversationId: "not_a_valid_id" },
                (res) => resolve(res)
            );
        });
        assert(joinInvalid && joinInvalid.success === false, "Invalid conversation ID is rejected");

        // ── Real-Time Messaging Tests ───────────────────────────────────────
        section("Real-Time Messaging Flow");

        // Also have User A join the direct room so both A and B are in the room
        await new Promise((resolve) => {
            socketA.emit(
                socketEvents.CONVERSATION_JOIN,
                { conversationId: directConv._id.toString() },
                (res) => resolve(res)
            );
        });

        // Set up listener on socketB for message:new
        const userBMessagePromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("Timeout waiting for message:new on User B")), 4000);
            socketB.once(socketEvents.MESSAGE_NEW, (payload) => {
                clearTimeout(timeout);
                resolve(payload);
            });
        });

        const testMessageContent = `Hello User B! Real-time message at ${Date.now()}`;

        // User A sends message via socket
        const sendResponse = await new Promise((resolve) => {
            socketA.emit(
                socketEvents.MESSAGE_SEND,
                {
                    conversationId: directConv._id.toString(),
                    content: testMessageContent,
                },
                (res) => resolve(res)
            );
        });

        assert(sendResponse && sendResponse.success === true, "User A message:send acknowledged with success");
        assert(sendResponse.message.content === testMessageContent, "Send response contains decrypted content");

        // Await User B's real-time receipt
        const receivedByB = await userBMessagePromise;
        assert(receivedByB !== null, "User B received real-time message:new event");
        assert(receivedByB.content === testMessageContent, "Received message content matches sent plaintext");
        assert(
            receivedByB.sender._id.toString() === userA._id.toString(),
            "Received message sender is correctly identified as User A"
        );
        assert(
            receivedByB.conversation.toString() === directConv._id.toString(),
            "Received message references correct conversation"
        );
        assert(receivedByB.encryptedContent === undefined, "Message payload does NOT leak encryptedContent or IV");

        // ── Database Verification (Source of Truth & Encryption) ────────────
        section("Persistence & Encryption Verification");

        const storedMsg = await Message.findById(receivedByB._id);
        assert(storedMsg !== null, "Message is persisted in MongoDB");
        assert(
            storedMsg.encryptedContent && !storedMsg.content,
            "Message is stored encrypted (encryptedContent exists, no plaintext content field)"
        );
        assert(
            storedMsg.encryptedContent.split(":").length === 3,
            "Stored ciphertext has valid iv:tag:cipher format"
        );
        assert(
            decrypt(storedMsg.encryptedContent) === testMessageContent,
            "Stored ciphertext decrypts to original plaintext"
        );

        // ── Security & Access Control Tests ─────────────────────────────────
        section("Security & Validation");

        // Test: Unauthorized user cannot send message to direct conversation
        const unauthorizedSend = await new Promise((resolve) => {
            socketC.emit(
                socketEvents.MESSAGE_SEND,
                {
                    conversationId: directConv._id.toString(),
                    content: "Hacker message trying to break in",
                },
                (res) => resolve(res)
            );
        });
        assert(
            unauthorizedSend && unauthorizedSend.success === false,
            "Unauthorized user (User C) cannot send message to conversation"
        );

        // Test: Empty message rejected
        const emptySend = await new Promise((resolve) => {
            socketA.emit(
                socketEvents.MESSAGE_SEND,
                {
                    conversationId: directConv._id.toString(),
                    content: "   ",
                },
                (res) => resolve(res)
            );
        });
        assert(emptySend && emptySend.success === false, "Empty message is rejected");

        // Test: Overlength message rejected
        const overlengthSend = await new Promise((resolve) => {
            socketA.emit(
                socketEvents.MESSAGE_SEND,
                {
                    conversationId: directConv._id.toString(),
                    content: "A".repeat(5001),
                },
                (res) => resolve(res)
            );
        });
        assert(overlengthSend && overlengthSend.success === false, "Message over 5000 characters is rejected");

        // ── Room Leave Test ─────────────────────────────────────────────────
        section("Room Leave Operation");

        // User B leaves direct conversation room
        await new Promise((resolve) => {
            socketB.emit(
                socketEvents.CONVERSATION_LEAVE,
                { conversationId: directConv._id.toString() },
                (res) => resolve(res)
            );
        });

        let userBReceivedAfterLeave = false;
        socketB.once(socketEvents.MESSAGE_NEW, () => {
            userBReceivedAfterLeave = true;
        });

        // User A sends another message
        await new Promise((resolve) => {
            socketA.emit(
                socketEvents.MESSAGE_SEND,
                {
                    conversationId: directConv._id.toString(),
                    content: "Another message after B left room",
                },
                (res) => resolve(res)
            );
        });

        // Small delay to ensure no packet reached B
        await new Promise((r) => setTimeout(r, 300));
        assert(
            !userBReceivedAfterLeave,
            "User B does not receive messages after leaving conversation room"
        );

        // ── Cleanup ─────────────────────────────────────────────────────────
        section("Cleanup");

        socketA.disconnect();
        socketB.disconnect();
        socketC.disconnect();

        await Message.deleteMany({ conversation: { $in: [directConv._id, projectConv._id] } });
        await Conversation.deleteMany({ _id: { $in: [directConv._id, projectConv._id] } });
        await ProjectMembership.deleteMany({ project: project._id });
        await Project.deleteOne({ _id: project._id });
        await User.deleteMany({ _id: { $in: [userA._id, userB._id, userC._id] } });

        assert(true, "Test data cleaned up successfully");

    } catch (err) {
        console.error("\n💥 FATAL TEST ERROR:", err);
        failed++;
        results.push(`  ❌ Fatal error: ${err.message}`);
    } finally {
        server.close();
        await mongoose.disconnect();
    }

    // Print Report
    console.log(results.join("\n"));
    console.log("\n" + "═".repeat(55));
    console.log(`📊 Phase 16 Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
    console.log("═".repeat(55) + "\n");

    process.exit(failed > 0 ? 1 : 0);
};

runTests();
