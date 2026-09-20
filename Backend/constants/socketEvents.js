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
    MESSAGE_EDIT: "message:edit",
    MESSAGE_UPDATED: "message:updated",
    MESSAGE_DELETE: "message:delete",
    MESSAGE_DELETED: "message:deleted",

    // Reactions
    REACTION_ADD: "reaction:add",
    REACTION_REMOVE: "reaction:remove",
    REACTION_UPDATED: "reaction:updated",

    // Typing Indicators
    TYPING_START: "typing:start",
    TYPING_STOP: "typing:stop",

    // Delivery & Read Status
    MESSAGE_DELIVERED: "message:delivered",
    MESSAGE_READ: "message:read",
    CONVERSATION_READ: "conversation:read",

    // Conversation updates (e.g. preview / lastMessage changed)
    CONVERSATION_UPDATED: "conversation:updated",

    // General error event
    ERROR: "error",
};
