const { Server } = require("socket.io");
const mongoose = require("mongoose");
const { verifyAccessToken } = require("./tokenService");
const User = require("../models/User");
const Conversation = require("../models/Conversation");
const chatService = require("./chatService");
const socketEvents = require("../constants/socketEvents");

let io = null;

// Rate limiting map: userId -> [timestamp1, timestamp2, ...]
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 2000; // 2 seconds
const MAX_MESSAGES_PER_WINDOW = 5;

// Phase 21: Typing throttle map — userId:conversationId -> lastTimestamp
const typingThrottleMap = new Map();
const TYPING_THROTTLE_MS = 2000; // Max 1 typing event per 2 seconds per conversation

// Phase 21: Generic socket event rate limiter for non-message events
const eventRateLimitMap = new Map();
const EVENT_RATE_LIMIT_WINDOW_MS = 5000; // 5 seconds
const MAX_EVENTS_PER_WINDOW = 15; // 15 events per 5 seconds

/**
 * Check if a user is exceeding message rate limits.
 */
const isRateLimited = (userId) => {
    const now = Date.now();
    const timestamps = rateLimitMap.get(userId) || [];

    // Filter out timestamps older than the window
    const validTimestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

    if (validTimestamps.length >= MAX_MESSAGES_PER_WINDOW) {
        return true;
    }

    validTimestamps.push(now);
    rateLimitMap.set(userId, validTimestamps);
    return false;
};

/**
 * Phase 21: Check if a typing event should be throttled.
 */
const isTypingThrottled = (userId, conversationId) => {
    const key = `${userId}:${conversationId}`;
    const now = Date.now();
    const lastTime = typingThrottleMap.get(key) || 0;

    if (now - lastTime < TYPING_THROTTLE_MS) {
        return true;
    }

    typingThrottleMap.set(key, now);
    return false;
};

/**
 * Phase 21: Generic event rate limiter for socket operations.
 */
const isEventRateLimited = (userId) => {
    const now = Date.now();
    const timestamps = eventRateLimitMap.get(userId) || [];
    const validTimestamps = timestamps.filter((t) => now - t < EVENT_RATE_LIMIT_WINDOW_MS);

    if (validTimestamps.length >= MAX_EVENTS_PER_WINDOW) {
        return true;
    }

    validTimestamps.push(now);
    eventRateLimitMap.set(userId, validTimestamps);
    return false;
};

/**
 * Phase 21: Check if a socket has joined a specific conversation room.
 */
const isInRoom = (socket, conversationId) => {
    const roomName = `conversation:${conversationId}`;
    return socket.rooms.has(roomName);
};

/**
 * Clean up rate limit map entries periodically
 */
setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of rateLimitMap.entries()) {
        const valid = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
        if (valid.length === 0) {
            rateLimitMap.delete(key);
        } else {
            rateLimitMap.set(key, valid);
        }
    }
    // Clean up typing throttle entries older than 30 seconds
    for (const [key, lastTime] of typingThrottleMap.entries()) {
        if (now - lastTime > 30000) {
            typingThrottleMap.delete(key);
        }
    }
    // Clean up event rate limit entries
    for (const [key, timestamps] of eventRateLimitMap.entries()) {
        const valid = timestamps.filter((t) => now - t < EVENT_RATE_LIMIT_WINDOW_MS);
        if (valid.length === 0) {
            eventRateLimitMap.delete(key);
        } else {
            eventRateLimitMap.set(key, valid);
        }
    }
}, 30000);

/**
 * Initialize Socket.IO server attached to the given HTTP server instance.
 */
const init = (server, allowedOrigins = []) => {
    io = new Server(server, {
        cors: {
            origin: (origin, callback) => {
                if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
                    return callback(null, true);
                }
                return callback(new Error("CORS policy violation"), false);
            },
            methods: ["GET", "POST"],
            allowedHeaders: ["Content-Type", "Authorization"],
            credentials: true,
        },
        pingTimeout: 20000,
        pingInterval: 25000,
    });

    // ── Authentication Middleware ───────────────────────────────────────────
    io.use(async (socket, next) => {
        try {
            // Extract token from handshake auth or Authorization header
            let token = socket.handshake.auth?.token;
            if (!token && socket.handshake.headers?.authorization) {
                const parts = socket.handshake.headers.authorization.split(" ");
                if (parts.length === 2 && parts[0] === "Bearer") {
                    token = parts[1];
                }
            }

            if (!token) {
                return next(new Error("Authentication error: No token provided"));
            }

            // Verify access token
            let decoded;
            try {
                decoded = verifyAccessToken(token);
            } catch (jwtErr) {
                return next(new Error("Authentication error: Invalid or expired token"));
            }

            // Fetch user from DB
            const user = await User.findById(decoded.id)
                .select("-password -loginAttempts -lockUntil")
                .lean();

            if (!user) {
                return next(new Error("Authentication error: User no longer exists"));
            }

            // Attach user identity to socket
            socket.user = user;
            socket.userId = user._id.toString();

            return next();
        } catch (err) {
            console.error("Socket authentication error:", err.message);
            return next(new Error("Authentication error: Server failed to authenticate socket"));
        }
    });

    // ── Connection Handler ──────────────────────────────────────────────────
    io.on(socketEvents.CONNECTION, (socket) => {
        const userId = socket.userId;
        const userName = socket.user?.name || "Unknown";

        // Join user-specific room for targeted events
        socket.join(`user:${userId}`);

        // ── 1. Join Conversation Room ───────────────────────────────────────
        socket.on(socketEvents.CONVERSATION_JOIN, async (data, callback) => {
            try {
                const conversationId = data?.conversationId;

                if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
                    const errPayload = { success: false, message: "Invalid conversation ID" };
                    if (typeof callback === "function") callback(errPayload);
                    return socket.emit(socketEvents.ERROR, errPayload);
                }

                // Verify conversation exists
                const conversation = await Conversation.findById(conversationId).lean();
                if (!conversation) {
                    const errPayload = { success: false, message: "Conversation not found" };
                    if (typeof callback === "function") callback(errPayload);
                    return socket.emit(socketEvents.ERROR, errPayload);
                }

                // Verify access using Phase 15 authorization logic
                try {
                    await chatService.verifyConversationAccess(conversation, socket.user._id);
                } catch (authErr) {
                    const errPayload = { success: false, message: authErr.message || "Access denied" };
                    if (typeof callback === "function") callback(errPayload);
                    return socket.emit(socketEvents.ERROR, errPayload);
                }

                const roomName = `conversation:${conversationId}`;
                socket.join(roomName);

                if (typeof callback === "function") {
                    callback({ success: true, conversationId });
                }
            } catch (err) {
                console.error("Socket conversation:join error:", err.message);
                const errPayload = { success: false, message: "Failed to join conversation room" };
                if (typeof callback === "function") callback(errPayload);
                socket.emit(socketEvents.ERROR, errPayload);
            }
        });

        // ── 2. Leave Conversation Room ──────────────────────────────────────
        socket.on(socketEvents.CONVERSATION_LEAVE, (data, callback) => {
            try {
                const conversationId = data?.conversationId;
                if (conversationId && mongoose.Types.ObjectId.isValid(conversationId)) {
                    socket.leave(`conversation:${conversationId}`);
                }
                if (typeof callback === "function") {
                    callback({ success: true });
                }
            } catch (err) {
                console.error("Socket conversation:leave error:", err.message);
                if (typeof callback === "function") {
                    callback({ success: false, message: "Failed to leave conversation room" });
                }
            }
        });

        // ── 3. Send Message ─────────────────────────────────────────────────
        socket.on(socketEvents.MESSAGE_SEND, async (data, callback) => {
            try {
                const { conversationId, content, replyTo } = data || {};

                // Rate limit check
                if (isRateLimited(userId)) {
                    const errPayload = {
                        success: false,
                        message: "You are sending messages too quickly. Please slow down.",
                    };
                    if (typeof callback === "function") callback(errPayload);
                    return socket.emit(socketEvents.ERROR, errPayload);
                }

                // Input validation
                if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
                    const errPayload = { success: false, message: "Invalid conversation ID" };
                    if (typeof callback === "function") callback(errPayload);
                    return socket.emit(socketEvents.ERROR, errPayload);
                }

                if (!content || typeof content !== "string" || content.trim().length === 0) {
                    const errPayload = { success: false, message: "Message content cannot be empty" };
                    if (typeof callback === "function") callback(errPayload);
                    return socket.emit(socketEvents.ERROR, errPayload);
                }

                if (content.trim().length > 5000) {
                    const errPayload = { success: false, message: "Message content exceeds 5000 characters" };
                    if (typeof callback === "function") callback(errPayload);
                    return socket.emit(socketEvents.ERROR, errPayload);
                }

                const roomName = `conversation:${conversationId}`;

                // Find active users in this conversation room to avoid duplicate notifications (Requirement 17)
                let activeUserIds = [];
                let isDelivered = false;
                try {
                    const roomSockets = await io.in(roomName).fetchSockets();
                    activeUserIds = roomSockets.map((s) => s.userId).filter(Boolean);
                    isDelivered = activeUserIds.some((id) => id !== userId);
                } catch (roomErr) {
                    console.warn("Could not fetch room sockets for notification suppression:", roomErr.message);
                }

                // Persist & encrypt message via chatService (Sender is strictly socket.userId)
                const savedMessage = await chatService.sendMessage(
                    conversationId,
                    userId,
                    content,
                    {
                        skipNotificationUserIds: activeUserIds,
                        replyTo,
                        isDelivered,
                    }
                );

                // Emit real-time message to everyone in the conversation room (including sender)
                io.to(roomName).emit(socketEvents.MESSAGE_NEW, savedMessage);

                // Emit conversation preview update to the room
                io.to(roomName).emit(socketEvents.CONVERSATION_UPDATED, {
                    conversationId,
                    lastMessage: savedMessage,
                    lastMessageAt: savedMessage.createdAt,
                });

                // Acknowledge to sender
                if (typeof callback === "function") {
                    callback({ success: true, message: savedMessage });
                }
            } catch (err) {
                console.error("Socket message:send error:", err.message);
                const statusCode = err.statusCode || 500;
                const errPayload = {
                    success: false,
                    message: statusCode === 403
                        ? "Access denied to this conversation"
                        : statusCode === 404
                        ? "Conversation not found"
                        : err.message || "Failed to send message",
                };
                if (typeof callback === "function") callback(errPayload);
                socket.emit(socketEvents.ERROR, errPayload);
            }
        });

        // ── 4. Edit Message ─────────────────────────────────────────────────
        socket.on(socketEvents.MESSAGE_EDIT, async (data, callback) => {
            try {
                const { conversationId, messageId, content } = data || {};
                if (!conversationId || !messageId || !content) {
                    const errPayload = { success: false, message: "Missing conversationId, messageId, or content" };
                    if (typeof callback === "function") callback(errPayload);
                    return socket.emit(socketEvents.ERROR, errPayload);
                }

                // Phase 21: Rate limit edit events
                if (isEventRateLimited(userId)) {
                    const errPayload = { success: false, message: "Too many requests. Please slow down." };
                    if (typeof callback === "function") callback(errPayload);
                    return socket.emit(socketEvents.ERROR, errPayload);
                }

                const updatedMessage = await chatService.editMessage(conversationId, messageId, userId, content);
                if (typeof callback === "function") {
                    callback({ success: true, message: updatedMessage });
                }
            } catch (err) {
                console.error("Socket message:edit error:", err.message);
                const errPayload = { success: false, message: err.message || "Failed to edit message" };
                if (typeof callback === "function") callback(errPayload);
                socket.emit(socketEvents.ERROR, errPayload);
            }
        });

        // ── 5. Delete Message ───────────────────────────────────────────────
        socket.on(socketEvents.MESSAGE_DELETE, async (data, callback) => {
            try {
                const { conversationId, messageId } = data || {};
                if (!conversationId || !messageId) {
                    const errPayload = { success: false, message: "Missing conversationId or messageId" };
                    if (typeof callback === "function") callback(errPayload);
                    return socket.emit(socketEvents.ERROR, errPayload);
                }

                // Phase 21: Rate limit delete events
                if (isEventRateLimited(userId)) {
                    const errPayload = { success: false, message: "Too many requests. Please slow down." };
                    if (typeof callback === "function") callback(errPayload);
                    return socket.emit(socketEvents.ERROR, errPayload);
                }

                const result = await chatService.deleteMessage(conversationId, messageId, userId);
                if (typeof callback === "function") {
                    callback({ success: true, ...result });
                }
            } catch (err) {
                console.error("Socket message:delete error:", err.message);
                const errPayload = { success: false, message: err.message || "Failed to delete message" };
                if (typeof callback === "function") callback(errPayload);
                socket.emit(socketEvents.ERROR, errPayload);
            }
        });

        // ── 6. Add Reaction ─────────────────────────────────────────────────
        socket.on(socketEvents.REACTION_ADD, async (data, callback) => {
            try {
                const { conversationId, messageId, emoji } = data || {};
                if (!conversationId || !messageId || !emoji) {
                    const errPayload = { success: false, message: "Missing conversationId, messageId, or emoji" };
                    if (typeof callback === "function") callback(errPayload);
                    return socket.emit(socketEvents.ERROR, errPayload);
                }

                // Phase 21: Rate limit reaction events
                if (isEventRateLimited(userId)) {
                    const errPayload = { success: false, message: "Too many reactions. Please slow down." };
                    if (typeof callback === "function") callback(errPayload);
                    return socket.emit(socketEvents.ERROR, errPayload);
                }

                const reactions = await chatService.addReaction(conversationId, messageId, userId, emoji);
                if (typeof callback === "function") {
                    callback({ success: true, reactions });
                }
            } catch (err) {
                console.error("Socket reaction:add error:", err.message);
                const errPayload = { success: false, message: err.message || "Failed to add reaction" };
                if (typeof callback === "function") callback(errPayload);
                socket.emit(socketEvents.ERROR, errPayload);
            }
        });

        // ── 7. Remove Reaction ──────────────────────────────────────────────
        socket.on(socketEvents.REACTION_REMOVE, async (data, callback) => {
            try {
                const { conversationId, messageId } = data || {};
                if (!conversationId || !messageId) {
                    const errPayload = { success: false, message: "Missing conversationId or messageId" };
                    if (typeof callback === "function") callback(errPayload);
                    return socket.emit(socketEvents.ERROR, errPayload);
                }

                // Phase 21: Rate limit reaction events
                if (isEventRateLimited(userId)) {
                    const errPayload = { success: false, message: "Too many reactions. Please slow down." };
                    if (typeof callback === "function") callback(errPayload);
                    return socket.emit(socketEvents.ERROR, errPayload);
                }

                const reactions = await chatService.removeReaction(conversationId, messageId, userId);
                if (typeof callback === "function") {
                    callback({ success: true, reactions });
                }
            } catch (err) {
                console.error("Socket reaction:remove error:", err.message);
                const errPayload = { success: false, message: err.message || "Failed to remove reaction" };
                if (typeof callback === "function") callback(errPayload);
                socket.emit(socketEvents.ERROR, errPayload);
            }
        });

        // ── 8. Typing Indicators — Phase 21: throttled + room-verified ──────
        socket.on(socketEvents.TYPING_START, (data) => {
            try {
                const conversationId = data?.conversationId;
                if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) return;

                // Phase 21: Only allow typing to rooms the socket has joined
                if (!isInRoom(socket, conversationId)) return;

                // Phase 21: Throttle typing events (max 1 per 2s per user+conversation)
                if (isTypingThrottled(userId, conversationId)) return;

                const roomName = `conversation:${conversationId}`;
                socket.to(roomName).emit(socketEvents.TYPING_START, {
                    conversationId,
                    userId,
                    userName,
                });
            } catch (err) {
                console.error("Socket typing:start error:", err.message);
            }
        });

        socket.on(socketEvents.TYPING_STOP, (data) => {
            try {
                const conversationId = data?.conversationId;
                if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) return;

                // Phase 21: Only allow typing to rooms the socket has joined
                if (!isInRoom(socket, conversationId)) return;

                const roomName = `conversation:${conversationId}`;
                socket.to(roomName).emit(socketEvents.TYPING_STOP, {
                    conversationId,
                    userId,
                    userName,
                });
            } catch (err) {
                console.error("Socket typing:stop error:", err.message);
            }
        });

        // ── 9. Conversation Read ────────────────────────────────────────────
        socket.on(socketEvents.CONVERSATION_READ, async (data, callback) => {
            try {
                const conversationId = data?.conversationId;
                if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
                    const errPayload = { success: false, message: "Invalid conversation ID" };
                    if (typeof callback === "function") callback(errPayload);
                    return;
                }

                // Phase 21: Rate limit read events
                if (isEventRateLimited(userId)) {
                    if (typeof callback === "function") {
                        callback({ success: false, message: "Too many requests. Please slow down." });
                    }
                    return;
                }

                const result = await chatService.markConversationRead(conversationId, userId);
                if (typeof callback === "function") {
                    callback(result);
                }
            } catch (err) {
                console.error("Socket conversation:read error:", err.message);
                if (typeof callback === "function") {
                    callback({ success: false, message: err.message });
                }
            }
        });

        // ── Disconnect ──────────────────────────────────────────────────────
        socket.on(socketEvents.DISCONNECT, (reason) => {
            // Socket disconnected
        });
    });

    return io;
};

/**
 * Get active Socket.IO server instance.
 */
const getIO = () => {
    if (!io) {
        throw new Error("Socket.IO has not been initialized. Call init(server) first.");
    }
    return io;
};

module.exports = {
    init,
    getIO,
};
