/**
 * Phase 21 — Chat Security Hardening Test Suite
 *
 * Comprehensive tests for authentication, authorization, input validation,
 * message ownership, reaction validation, file upload security, rate limiting,
 * encryption integrity, and notification privacy.
 *
 * Usage: node scripts/testPhase21Security.js
 *
 * Prerequisites:
 * - Backend running on PORT (default 5000)
 * - MongoDB connected
 * - Two test users registered
 */

require("dotenv").config();
const mongoose = require("mongoose");
const http = require("http");
const { io: ioClient } = require("socket.io-client");
const User = require("../models/User");
const { generateAccessToken } = require("../services/tokenService");

const BASE_URL = `http://localhost:${process.env.PORT || 5000}`;
const createdUserIds = [];

// ─── Test Infrastructure ──────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const results = [];

const log = (icon, msg) => console.log(`  ${icon} ${msg}`);
const pass = (msg) => { passed++; results.push({ status: "PASS", msg }); log("✅", msg); };
const fail = (msg, detail = "") => { failed++; results.push({ status: "FAIL", msg }); log("❌", `${msg}${detail ? ` — ${detail}` : ""}`); };
const section = (title) => console.log(`\n${"═".repeat(60)}\n  ${title}\n${"═".repeat(60)}`);

// ─── HTTP Helpers ─────────────────────────────────────────────────────────────

const request = (method, path, body = null, headers = {}) => {
    return new Promise((resolve) => {
        const url = new URL(path, BASE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method,
            headers: {
                "Content-Type": "application/json",
                ...headers,
            },
        };

        const req = http.request(options, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
                let parsed = null;
                try { parsed = JSON.parse(data); } catch {}
                resolve({ status: res.statusCode, data: parsed, headers: res.headers });
            });
        });

        req.on("error", (err) => {
            resolve({ status: 0, data: null, error: err.message });
        });

        if (body) req.write(JSON.stringify(body));
        req.end();
    });
};

const get = (path, headers) => request("GET", path, null, headers);
const post = (path, body, headers) => request("POST", path, body, headers);
const patch = (path, body, headers) => request("PATCH", path, body, headers);
const del = (path, body, headers) => request("DELETE", path, null, headers);

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

// ─── User Login Helper ────────────────────────────────────────────────────────

const loginUser = async (email, password) => {
    const res = await post("/api/auth/login", { email, password });
    if (res.data?.data?.accessToken) {
        return {
            token: res.data.data.accessToken,
            user: res.data.data.user,
        };
    }
    return null;
};

// ─── Test Suites ──────────────────────────────────────────────────────────────

async function testAuthentication(userA) {
    section("1. AUTHENTICATION SECURITY");

    // Test: Unauthenticated REST request should be rejected
    const res1 = await get("/api/chat/conversations");
    if (res1.status === 401) {
        pass("Unauthenticated GET /conversations → 401");
    } else {
        fail("Unauthenticated GET /conversations should return 401", `Got ${res1.status}`);
    }

    // Test: Invalid token should be rejected
    const res2 = await get("/api/chat/conversations", authHeader("invalid-token-xyz"));
    if (res2.status === 401) {
        pass("Invalid token GET /conversations → 401");
    } else {
        fail("Invalid token should return 401", `Got ${res2.status}`);
    }

    // Test: Valid token should succeed
    const res3 = await get("/api/chat/conversations", authHeader(userA.token));
    if (res3.status === 200 && res3.data?.success) {
        pass("Valid token GET /conversations → 200");
    } else {
        fail("Valid token should return 200", `Got ${res3.status}`);
    }

    // Test: Unauthenticated POST message rejected
    const res4 = await post("/api/chat/conversations/000000000000000000000000/messages", { content: "test" });
    if (res4.status === 401) {
        pass("Unauthenticated POST /messages → 401");
    } else {
        fail("Unauthenticated POST /messages should return 401", `Got ${res4.status}`);
    }
}

async function testConversationAuthorization(userA, userB) {
    section("2. CONVERSATION AUTHORIZATION");

    // Create a direct conversation between A and B
    const convRes = await post("/api/chat/conversations/direct", { userId: userB.user._id }, authHeader(userA.token));
    if (!convRes.data?.conversation?._id) {
        fail("Could not create test conversation — skipping authorization tests");
        return null;
    }

    const conversationId = convRes.data.conversation._id;
    pass("Created direct conversation for authorization tests");

    // Test: Participant A can access
    const res1 = await get(`/api/chat/conversations/${conversationId}`, authHeader(userA.token));
    if (res1.status === 200) {
        pass("Participant A can access own conversation");
    } else {
        fail("Participant A should access own conversation", `Got ${res1.status}`);
    }

    // Test: Participant B can access
    const res2 = await get(`/api/chat/conversations/${conversationId}`, authHeader(userB.token));
    if (res2.status === 200) {
        pass("Participant B can access own conversation");
    } else {
        fail("Participant B should access own conversation", `Got ${res2.status}`);
    }

    // Test: Invalid conversation ID format
    const res3 = await get("/api/chat/conversations/not-a-valid-id", authHeader(userA.token));
    if (res3.status === 400 || res3.status === 404) {
        pass("Invalid conversation ID → 400/404");
    } else {
        fail("Invalid conversation ID should return 400/404", `Got ${res3.status}`);
    }

    // Test: Non-existent conversation ID
    const res4 = await get("/api/chat/conversations/000000000000000000000000", authHeader(userA.token));
    if (res4.status === 404 || res4.status === 403) {
        pass("Non-existent conversation → 404/403");
    } else {
        fail("Non-existent conversation should return 404/403", `Got ${res4.status}`);
    }

    return conversationId;
}

async function testMessageOwnership(userA, userB, conversationId) {
    section("3. MESSAGE OWNERSHIP SECURITY");

    if (!conversationId) {
        fail("No conversation available — skipping message ownership tests");
        return;
    }

    // User A sends a message
    const msgRes = await post(
        `/api/chat/conversations/${conversationId}/messages`,
        { content: "Test message for ownership check" },
        authHeader(userA.token)
    );

    if (!msgRes.data?.message?._id) {
        fail("Could not send test message — skipping ownership tests");
        return;
    }

    const messageId = msgRes.data.message._id;
    pass("User A sent test message");

    // Test: User A can edit own message
    const editRes1 = await patch(
        `/api/chat/conversations/${conversationId}/messages/${messageId}`,
        { content: "Edited by owner" },
        authHeader(userA.token)
    );
    if (editRes1.status === 200) {
        pass("User A can edit own message");
    } else {
        fail("User A should be able to edit own message", `Got ${editRes1.status}`);
    }

    // Test: User B CANNOT edit User A's message
    const editRes2 = await patch(
        `/api/chat/conversations/${conversationId}/messages/${messageId}`,
        { content: "Hijacked by B" },
        authHeader(userB.token)
    );
    if (editRes2.status === 403) {
        pass("User B cannot edit User A's message → 403");
    } else {
        fail("User B editing A's message should return 403", `Got ${editRes2.status}`);
    }

    // Test: User B CANNOT delete User A's message
    const delRes = await del(
        `/api/chat/conversations/${conversationId}/messages/${messageId}`,
        null,
        authHeader(userB.token)
    );
    if (delRes.status === 403) {
        pass("User B cannot delete User A's message → 403");
    } else {
        fail("User B deleting A's message should return 403", `Got ${delRes.status}`);
    }

    // Test: User A CAN delete own message
    const delRes2 = await del(
        `/api/chat/conversations/${conversationId}/messages/${messageId}`,
        null,
        authHeader(userA.token)
    );
    if (delRes2.status === 200) {
        pass("User A can delete own message");
    } else {
        fail("User A should be able to delete own message", `Got ${delRes2.status}`);
    }
}

async function testReactionValidation(userA, conversationId) {
    section("4. REACTION VALIDATION");

    if (!conversationId) {
        fail("No conversation available — skipping reaction tests");
        return;
    }

    // Send a message to react to
    const msgRes = await post(
        `/api/chat/conversations/${conversationId}/messages`,
        { content: "React to me" },
        authHeader(userA.token)
    );

    if (!msgRes.data?.message?._id) {
        fail("Could not send test message — skipping reaction tests");
        return;
    }

    const messageId = msgRes.data.message._id;

    // Test: Valid reaction emoji succeeds
    const validRes = await post(
        `/api/chat/conversations/${conversationId}/messages/${messageId}/reactions`,
        { emoji: "👍" },
        authHeader(userA.token)
    );
    if (validRes.status === 200) {
        pass("Valid reaction emoji (👍) accepted");
    } else {
        fail("Valid reaction should be accepted", `Got ${validRes.status}`);
    }

    // Test: Invalid reaction emoji rejected
    const invalidRes = await post(
        `/api/chat/conversations/${conversationId}/messages/${messageId}/reactions`,
        { emoji: "💀" },
        authHeader(userA.token)
    );
    if (invalidRes.status === 400) {
        pass("Invalid reaction emoji (💀) rejected → 400");
    } else {
        fail("Invalid reaction emoji should return 400", `Got ${invalidRes.status}`);
    }

    // Test: Empty emoji rejected
    const emptyRes = await post(
        `/api/chat/conversations/${conversationId}/messages/${messageId}/reactions`,
        { emoji: "" },
        authHeader(userA.token)
    );
    if (emptyRes.status === 400) {
        pass("Empty emoji rejected → 400");
    } else {
        fail("Empty emoji should return 400", `Got ${emptyRes.status}`);
    }
}

async function testInputValidation(userA, conversationId) {
    section("5. INPUT VALIDATION");

    if (!conversationId) {
        fail("No conversation available — skipping input validation tests");
        return;
    }

    // Test: Empty message rejected
    const emptyRes = await post(
        `/api/chat/conversations/${conversationId}/messages`,
        { content: "" },
        authHeader(userA.token)
    );
    if (emptyRes.status === 400) {
        pass("Empty message content rejected → 400");
    } else {
        fail("Empty message should return 400", `Got ${emptyRes.status}`);
    }

    // Test: Whitespace-only message rejected
    const wsRes = await post(
        `/api/chat/conversations/${conversationId}/messages`,
        { content: "   " },
        authHeader(userA.token)
    );
    if (wsRes.status === 400) {
        pass("Whitespace-only message rejected → 400");
    } else {
        fail("Whitespace-only message should return 400", `Got ${wsRes.status}`);
    }

    // Test: Oversized message rejected (>5000 chars)
    const bigContent = "A".repeat(5001);
    const bigRes = await post(
        `/api/chat/conversations/${conversationId}/messages`,
        { content: bigContent },
        authHeader(userA.token)
    );
    if (bigRes.status === 400) {
        pass("Oversized message (>5000 chars) rejected → 400");
    } else {
        fail("Oversized message should return 400", `Got ${bigRes.status}`);
    }

    // Test: Reply to message in same conversation succeeds
    const msgRes = await post(
        `/api/chat/conversations/${conversationId}/messages`,
        { content: "Original for reply test" },
        authHeader(userA.token)
    );
    if (msgRes.data?.message?._id) {
        const replyRes = await post(
            `/api/chat/conversations/${conversationId}/messages`,
            { content: "Reply message", replyTo: msgRes.data.message._id },
            authHeader(userA.token)
        );
        if (replyRes.status === 201) {
            pass("Reply to message in same conversation → 201");
        } else {
            fail("Reply in same conversation should succeed", `Got ${replyRes.status}`);
        }
    }

    // Test: Reply to non-existent message rejected
    const fakeReplyRes = await post(
        `/api/chat/conversations/${conversationId}/messages`,
        { content: "Bad reply", replyTo: "000000000000000000000000" },
        authHeader(userA.token)
    );
    if (fakeReplyRes.status === 404) {
        pass("Reply to non-existent message → 404");
    } else {
        fail("Reply to non-existent message should return 404", `Got ${fakeReplyRes.status}`);
    }
}

async function testEncryptionIntegrity() {
    section("6. ENCRYPTION INTEGRITY");

    // Test: Encryption key is set
    if (process.env.CHAT_ENCRYPTION_KEY) {
        pass("CHAT_ENCRYPTION_KEY environment variable is set");
    } else {
        fail("CHAT_ENCRYPTION_KEY is not set");
        return;
    }

    // Test: Key is valid format
    const key = process.env.CHAT_ENCRYPTION_KEY;
    if (/^[0-9a-fA-F]{64}$/.test(key)) {
        pass("Encryption key is valid 64-char hex");
    } else {
        fail("Encryption key format is invalid");
    }

    // Test: encrypt/decrypt round-trip
    try {
        const { encrypt, decrypt } = require("../utils/encryption");
        const plaintext = "Test message for encryption";
        const encrypted = encrypt(plaintext);

        // Verify encrypted text has proper format (iv:authTag:ciphertext)
        const parts = encrypted.split(":");
        if (parts.length === 3) {
            pass("Encrypted format is iv:authTag:ciphertext");
        } else {
            fail("Encrypted format should have 3 parts separated by :");
        }

        // Verify encrypted != plaintext
        if (!encrypted.includes(plaintext)) {
            pass("Encrypted content does not contain plaintext");
        } else {
            fail("Encrypted content should not contain plaintext");
        }

        // Verify decryption
        const decrypted = decrypt(encrypted);
        if (decrypted === plaintext) {
            pass("Decryption produces original plaintext");
        } else {
            fail("Decryption should produce original plaintext");
        }
    } catch (err) {
        fail("Encryption round-trip failed", err.message);
    }

    // Test: Stored messages should be encrypted in DB
    try {
        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(process.env.MONGO_URI);
        }
        const Message = require("../models/Message");
        const recentMessage = await Message.findOne({
            encryptedContent: { $ne: null },
            isDeleted: false,
        }).lean();

        if (recentMessage) {
            // Verify the stored content looks encrypted (not plaintext)
            const parts = recentMessage.encryptedContent.split(":");
            if (parts.length === 3 && parts[0].length === 24) {
                pass("Stored message content is encrypted in DB (iv:authTag:ciphertext)");
            } else {
                fail("Stored message content does not appear to be encrypted");
            }
        } else {
            log("⚠️", "No encrypted messages found in DB to verify (skipped)");
        }
    } catch (err) {
        fail("Could not verify DB encryption", err.message);
    }
}

async function testSecurityHeaders() {
    section("7. SECURITY HEADERS");

    const res = await get("/api/health");

    // Test: X-Powered-By should be absent (Helmet removes it)
    if (!res.headers["x-powered-by"]) {
        pass("X-Powered-By header is removed");
    } else {
        fail("X-Powered-By should be removed by Helmet", `Got: ${res.headers["x-powered-by"]}`);
    }

    // Test: X-Content-Type-Options should be nosniff
    if (res.headers["x-content-type-options"] === "nosniff") {
        pass("X-Content-Type-Options: nosniff");
    } else {
        fail("X-Content-Type-Options should be nosniff");
    }

    // Test: X-Frame-Options should be set
    if (res.headers["x-frame-options"]) {
        pass(`X-Frame-Options: ${res.headers["x-frame-options"]}`);
    } else {
        fail("X-Frame-Options should be set");
    }

    // Test: Referrer-Policy should be set
    if (res.headers["referrer-policy"]) {
        pass(`Referrer-Policy: ${res.headers["referrer-policy"]}`);
    } else {
        fail("Referrer-Policy should be set");
    }
}

async function testS3Security(userA, conversationId) {
    section("8. S3 / FILE ACCESS SECURITY");

    if (!conversationId) {
        fail("No conversation available — skipping S3 tests");
        return;
    }

    // Test: Attachment download for non-existent message
    const res1 = await get(
        `/api/chat/conversations/${conversationId}/messages/000000000000000000000000/attachment`,
        authHeader(userA.token)
    );
    if (res1.status === 404) {
        pass("Non-existent attachment → 404");
    } else {
        fail("Non-existent attachment should return 404", `Got ${res1.status}`);
    }

    // Test: S3 presigned URLs are temporary (check existing message with attachment)
    try {
        const Message = require("../models/Message");
        const attachmentMsg = await Message.findOne({
            conversation: conversationId,
            "attachment.storageKey": { $ne: null },
        }).lean();

        if (attachmentMsg) {
            // Verify storageKey is not a public URL
            if (!attachmentMsg.attachment.storageKey.startsWith("http")) {
                pass("S3 storageKey is not a public URL");
            } else {
                fail("S3 storageKey should not be a public URL");
            }
        } else {
            log("⚠️", "No attachment messages found — skipping S3 key format test");
        }
    } catch (err) {
        log("⚠️", `Could not verify S3 key format: ${err.message}`);
    }
}

async function testSocketAuthentication(userA) {
    section("9. SOCKET.IO AUTHENTICATION");

    // Test: Unauthenticated socket connection should be rejected
    await new Promise((resolve) => {
        const socket = ioClient(BASE_URL, {
            auth: { token: null },
            transports: ["websocket"],
            reconnection: false,
            timeout: 5000,
        });

        const timer = setTimeout(() => {
            socket.disconnect();
            fail("Unauthenticated socket should be rejected (timeout)");
            resolve();
        }, 5000);

        socket.on("connect_error", (err) => {
            clearTimeout(timer);
            if (err.message.includes("Authentication")) {
                pass("Unauthenticated socket rejected with auth error");
            } else {
                pass(`Unauthenticated socket rejected: ${err.message}`);
            }
            socket.disconnect();
            resolve();
        });

        socket.on("connect", () => {
            clearTimeout(timer);
            fail("Unauthenticated socket should NOT connect successfully");
            socket.disconnect();
            resolve();
        });
    });

    // Test: Invalid token socket connection should be rejected
    await new Promise((resolve) => {
        const socket = ioClient(BASE_URL, {
            auth: { token: "totally-invalid-token" },
            transports: ["websocket"],
            reconnection: false,
            timeout: 5000,
        });

        const timer = setTimeout(() => {
            socket.disconnect();
            fail("Invalid token socket should be rejected (timeout)");
            resolve();
        }, 5000);

        socket.on("connect_error", (err) => {
            clearTimeout(timer);
            pass("Invalid token socket rejected");
            socket.disconnect();
            resolve();
        });

        socket.on("connect", () => {
            clearTimeout(timer);
            fail("Invalid token socket should NOT connect");
            socket.disconnect();
            resolve();
        });
    });

    // Test: Valid token socket connection should succeed
    await new Promise((resolve) => {
        const socket = ioClient(BASE_URL, {
            auth: { token: userA.token },
            transports: ["websocket"],
            reconnection: false,
            timeout: 5000,
        });

        const timer = setTimeout(() => {
            socket.disconnect();
            fail("Valid token socket connection timed out");
            resolve();
        }, 5000);

        socket.on("connect", () => {
            clearTimeout(timer);
            pass("Valid token socket connection established");
            socket.disconnect();
            resolve();
        });

        socket.on("connect_error", (err) => {
            clearTimeout(timer);
            fail("Valid token socket should connect", err.message);
            socket.disconnect();
            resolve();
        });
    });
}

async function testNotificationPrivacy(userA) {
    section("10. NOTIFICATION SECURITY");

    // Test: Notifications are only accessible by the authenticated user
    const res = await get("/api/notifications", authHeader(userA.token));
    if (res.status === 200 && res.data?.success) {
        pass("Notifications accessible by authenticated user");

        // Verify no notifications expose encryption keys or S3 credentials
        const notifs = res.data.notifications || [];
        let exposedSecret = false;
        for (const n of notifs) {
            const str = JSON.stringify(n);
            if (str.includes("CHAT_ENCRYPTION_KEY") || str.includes("AWS_SECRET") || str.includes("JWT_SECRET")) {
                exposedSecret = true;
                break;
            }
        }
        if (!exposedSecret) {
            pass("Notification payloads do not expose secrets");
        } else {
            fail("Notification payloads expose sensitive secrets!");
        }
    } else {
        log("⚠️", `Notifications endpoint returned ${res.status} — may not be accessible`);
    }

    // Test: Unauthenticated notification access rejected
    const res2 = await get("/api/notifications");
    if (res2.status === 401) {
        pass("Unauthenticated notification access → 401");
    } else {
        fail("Unauthenticated notifications should return 401", `Got ${res2.status}`);
    }
}

async function testErrorLeakage() {
    section("11. ERROR INFORMATION LEAKAGE");

    // Test: 404 routes don't expose stack traces
    const res = await get("/api/nonexistent-route-xyz");
    if (res.status === 404) {
        const body = JSON.stringify(res.data || {});
        if (!body.includes("stack") && !body.includes("at ") && !body.includes("node_modules")) {
            pass("404 error does not expose stack traces");
        } else {
            fail("404 error exposes internal information");
        }
    }

    // Test: API error responses use consistent format
    if (res.data && typeof res.data.success === "boolean" && res.data.message) {
        pass("Error response uses {success, message} format");
    } else {
        fail("Error response should use {success, message} format");
    }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log("\n" + "═".repeat(60));
    console.log("  PHASE 21 — CHAT SECURITY HARDENING TESTS");
    console.log("═".repeat(60));
    console.log(`\nTarget: ${BASE_URL}`);

    // Login two test users
    console.log("\n📋 Logging in test users...");
    console.log("   (Using default test credentials — update if needed)\n");

    // Connect to MongoDB
    try {
        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(process.env.MONGO_URI);
        }
    } catch (err) {
        console.warn("⚠️ Direct MongoDB connection warning:", err.message);
    }

    // Try common test user credentials
    let userA = await loginUser("chathumi2@gmail.com", "Password@123");
    let userB = await loginUser("pasindu@gmail.com", "Password@123");

    if (!userA) {
        // Try alternative credentials
        userA = await loginUser("test1@studysync.com", "Test@1234");
    }
    if (!userB) {
        userB = await loginUser("test2@studysync.com", "Test@1234");
    }

    // Fallback: If login failed, look up verified users or auto-create test users
    if (!userA || !userB) {
        const existingUsers = await User.find({ isVerified: true }).limit(2);
        if (existingUsers.length >= 2) {
            if (!userA) {
                userA = {
                    token: generateAccessToken(existingUsers[0]._id, existingUsers[0].systemRole || "USER"),
                    user: existingUsers[0],
                };
            }
            if (!userB) {
                userB = {
                    token: generateAccessToken(existingUsers[1]._id, existingUsers[1].systemRole || "USER"),
                    user: existingUsers[1],
                };
            }
        } else {
            const ts = Date.now().toString().slice(-6);
            if (!userA) {
                const newA = await User.create({
                    name: `SecTestA_${ts}`,
                    email: `sectesta_${ts}@studysync.com`,
                    password: "Password123!",
                    isVerified: true,
                });
                createdUserIds.push(newA._id);
                userA = {
                    token: generateAccessToken(newA._id, newA.systemRole || "USER"),
                    user: newA,
                };
            }
            if (!userB) {
                const newB = await User.create({
                    name: `SecTestB_${ts}`,
                    email: `sectestb_${ts}@studysync.com`,
                    password: "Password123!",
                    isVerified: true,
                });
                createdUserIds.push(newB._id);
                userB = {
                    token: generateAccessToken(newB._id, newB.systemRole || "USER"),
                    user: newB,
                };
            }
        }
    }

    if (!userA) {
        console.error("❌ Could not obtain User A credentials or token.");
        process.exit(1);
    }

    log("👤", `User A: ${userA.user?.name || userA.user?.email || "Logged in"}`);

    if (!userB) {
        console.warn("⚠️ Could not log in User B — some tests will be skipped.\n");
    } else {
        log("👤", `User B: ${userB.user?.name || userB.user?.email || "Logged in"}`);
    }

    // Run test suites
    await testAuthentication(userA);

    let conversationId = null;
    if (userB) {
        conversationId = await testConversationAuthorization(userA, userB);
        await testMessageOwnership(userA, userB, conversationId);
    } else {
        log("⚠️", "Skipping authorization and ownership tests (User B not available)");
    }

    await testReactionValidation(userA, conversationId);
    await testInputValidation(userA, conversationId);
    await testEncryptionIntegrity();
    await testSecurityHeaders();
    await testS3Security(userA, conversationId);
    await testSocketAuthentication(userA);
    await testNotificationPrivacy(userA);
    await testErrorLeakage();

    // Summary
    console.log("\n" + "═".repeat(60));
    console.log("  TEST SUMMARY");
    console.log("═".repeat(60));
    console.log(`\n  ✅ Passed: ${passed}`);
    console.log(`  ❌ Failed: ${failed}`);
    console.log(`  📊 Total:  ${passed + failed}`);

    if (failed > 0) {
        console.log("\n  Failed tests:");
        results.filter((r) => r.status === "FAIL").forEach((r) => {
            console.log(`    ❌ ${r.msg}`);
        });
    }

    console.log("\n" + "═".repeat(60) + "\n");

    // Cleanup
    try {
        if (createdUserIds.length > 0) {
            await User.deleteMany({ _id: { $in: createdUserIds } });
        }
        await mongoose.disconnect();
    } catch {}

    process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error("Test runner failed:", err.message);
    process.exit(1);
});
