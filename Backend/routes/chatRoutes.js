const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { uploadChatAttachment } = require("../middleware/chatUploadMiddleware");
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
router.post("/conversations/direct", createDirectConversation);
router.get("/conversations/:conversationId", getConversation);
router.post("/conversations/:conversationId/read", markConversationRead);
router.get("/conversations/:conversationId/search", searchMessages);

// Message endpoints
router.get("/conversations/:conversationId/messages", getMessages);
router.post("/conversations/:conversationId/messages", sendMessage);
router.patch("/conversations/:conversationId/messages/:messageId", editMessage);
router.delete("/conversations/:conversationId/messages/:messageId", deleteMessage);
router.post("/conversations/:conversationId/messages/:messageId/reactions", addReaction);
router.delete("/conversations/:conversationId/messages/:messageId/reactions", removeReaction);

// Attachment endpoints — Phase 18
router.post(
    "/conversations/:conversationId/attachments",
    uploadChatAttachment("file"),
    sendAttachment
);
router.get(
    "/conversations/:conversationId/messages/:messageId/attachment",
    getAttachmentDownloadUrl
);

module.exports = router;
