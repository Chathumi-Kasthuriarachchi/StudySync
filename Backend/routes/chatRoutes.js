const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
    getConversations,
    createDirectConversation,
    getConversation,
    getMessages,
    sendMessage,
} = require("../controllers/chatController");

// All chat routes require authentication
router.use(protect);

// Conversation endpoints
router.get("/conversations", getConversations);
router.post("/conversations/direct", createDirectConversation);
router.get("/conversations/:conversationId", getConversation);

// Message endpoints
router.get("/conversations/:conversationId/messages", getMessages);
router.post("/conversations/:conversationId/messages", sendMessage);

module.exports = router;
