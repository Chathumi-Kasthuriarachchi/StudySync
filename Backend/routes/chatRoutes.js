const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { uploadChatAttachment } = require("../middleware/chatUploadMiddleware");
const {
    chatMessageLimiter,
    chatConversationLimiter,
    chatReactionLimiter,
    chatSearchLimiter,
    chatUploadLimiter,
    chatGeneralLimiter,
} = require("../middleware/rateLimitMiddleware");
const {
    getConversations,
    createDirectConversation,
    getConversation,
    getMessages,
    sendMessage,
    sendAttachment,
    getAttachmentDownloadUrl,
    editMessage,
    deleteMessage,
    addReaction,
    removeReaction,
    markConversationRead,
    searchMessages,
} = require("../controllers/chatController");

// All chat routes require authentication
router.use(protect);

// Conversation endpoints
router.get("/conversations", getConversations);
router.post("/conversations/direct", chatConversationLimiter, createDirectConversation);
router.get("/conversations/:conversationId", getConversation);
router.post("/conversations/:conversationId/read", chatGeneralLimiter, markConversationRead);
router.get("/conversations/:conversationId/search", chatSearchLimiter, searchMessages);

// Message endpoints
router.get("/conversations/:conversationId/messages", getMessages);
router.post("/conversations/:conversationId/messages", chatMessageLimiter, sendMessage);
router.patch("/conversations/:conversationId/messages/:messageId", chatGeneralLimiter, editMessage);
router.delete("/conversations/:conversationId/messages/:messageId", chatGeneralLimiter, deleteMessage);
router.post("/conversations/:conversationId/messages/:messageId/reactions", chatReactionLimiter, addReaction);
router.delete("/conversations/:conversationId/messages/:messageId/reactions", chatReactionLimiter, removeReaction);

// Attachment endpoints — Phase 18
router.post(
    "/conversations/:conversationId/attachments",
    chatUploadLimiter,
    uploadChatAttachment("file"),
    sendAttachment
);
router.get(
    "/conversations/:conversationId/messages/:messageId/attachment",
    getAttachmentDownloadUrl
);

module.exports = router;

