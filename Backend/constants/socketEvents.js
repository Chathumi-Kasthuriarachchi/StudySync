/**
 * Socket.IO Event Constants — Phase 16
 *
 * Centralized definition of all socket event names used between client and server.
 */
module.exports = {
    // Connection lifecycle
    CONNECTION: "connection",
    DISCONNECT: "disconnect",

    // Room operations
    CONVERSATION_JOIN: "conversation:join",
    CONVERSATION_LEAVE: "conversation:leave",

    // Messaging
    MESSAGE_SEND: "message:send",
    MESSAGE_NEW: "message:new",

    // Conversation updates (e.g. preview / lastMessage changed)
    CONVERSATION_UPDATED: "conversation:updated",

    // General error event
    ERROR: "error",
};
