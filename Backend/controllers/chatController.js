const chatService = require("../services/chatService");

/**
 * Chat Controller — Phase 15
 *
 * Handles HTTP requests for chat conversations and messages.
 * Follows existing StudySync controller pattern (try/catch, success envelope).
 */

/**
 * @desc    Get all conversations for the authenticated user
 * @route   GET /api/chat/conversations
 * @access  Private
 */
const getConversations = async (req, res) => {
    try {
        const conversations = await chatService.getUserConversations(req.user._id);
        return res.status(200).json({
            success: true,
            count: conversations.length,
            conversations,
        });
    } catch (err) {
        console.error("getConversations error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to retrieve conversations",
        });
    }
};

/**
 * @desc    Create or find a direct conversation with another user
 * @route   POST /api/chat/conversations/direct
 * @access  Private
 */
const createDirectConversation = async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "Target user ID is required",
            });
        }

        const conversation = await chatService.getOrCreateDirectConversation(
            req.user._id,
            userId
        );

        return res.status(200).json({
            success: true,
            conversation,
        });
    } catch (err) {
        console.error("createDirectConversation error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to create direct conversation",
        });
    }
};

/**
 * @desc    Get a single conversation by ID
 * @route   GET /api/chat/conversations/:conversationId
 * @access  Private
 */
const getConversation = async (req, res) => {
    try {
        const conversation = await chatService.getConversationById(
            req.params.conversationId,
            req.user._id
        );

        return res.status(200).json({
            success: true,
            conversation,
        });
    } catch (err) {
        console.error("getConversation error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to retrieve conversation",
        });
    }
};

/**
 * @desc    Get paginated messages for a conversation
 * @route   GET /api/chat/conversations/:conversationId/messages
 * @access  Private
 */
const getMessages = async (req, res) => {
    try {
        const result = await chatService.getMessages(
            req.params.conversationId,
            req.user._id,
            req.query
        );

        return res.status(200).json({
            success: true,
            ...result,
        });
    } catch (err) {
        console.error("getMessages error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to retrieve messages",
        });
    }
};

/**
 * @desc    Send a message in a conversation
 * @route   POST /api/chat/conversations/:conversationId/messages
 * @access  Private
 */
const sendMessage = async (req, res) => {
    try {
        const { content } = req.body;

        const message = await chatService.sendMessage(
            req.params.conversationId,
            req.user._id,
            content
        );

        return res.status(201).json({
            success: true,
            message,
        });
    } catch (err) {
        console.error("sendMessage error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to send message",
        });
    }
};

module.exports = {
    getConversations,
    createDirectConversation,
    getConversation,
    getMessages,
    sendMessage,
};
