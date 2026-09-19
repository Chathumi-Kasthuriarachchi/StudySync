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
        const { content, replyTo } = req.body;

        const message = await chatService.sendMessage(
            req.params.conversationId,
            req.user._id,
            content,
            { replyTo, emitSocket: true }
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

/**
 * @desc    Upload an attachment and send it as a message
 * @route   POST /api/chat/conversations/:conversationId/attachments
 * @access  Private
 */
const sendAttachment = async (req, res) => {
    try {
        const { content, replyTo } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({
                success: false,
                message: "No attachment file provided",
            });
        }

        const message = await chatService.sendAttachmentMessage(
            req.params.conversationId,
            req.user._id,
            file,
            content,
            { replyTo }
        );

        return res.status(201).json({
            success: true,
            message,
        });
    } catch (err) {
        console.error("sendAttachment error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to upload and send attachment",
        });
    }
};

/**
 * @desc    Get a presigned download URL for an attachment
 * @route   GET /api/chat/conversations/:conversationId/messages/:messageId/attachment
 * @access  Private
 */
const getAttachmentDownloadUrl = async (req, res) => {
    try {
        const data = await chatService.getAttachmentDownloadUrl(
            req.params.conversationId,
            req.params.messageId,
            req.user._id
        );

        return res.status(200).json({
            success: true,
            ...data,
        });
    } catch (err) {
        console.error("getAttachmentDownloadUrl error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to get attachment download URL",
        });
    }
};

/**
 * @desc    Edit a message (Sender-only)
 * @route   PATCH /api/chat/conversations/:conversationId/messages/:messageId
 * @access  Private
 */
const editMessage = async (req, res) => {
    try {
        const { content } = req.body;
        const updated = await chatService.editMessage(
            req.params.conversationId,
            req.params.messageId,
            req.user._id,
            content
        );

        return res.status(200).json({
            success: true,
            message: updated,
        });
    } catch (err) {
        console.error("editMessage error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to edit message",
        });
    }
};

/**
 * @desc    Soft delete a message (Sender-only)
 * @route   DELETE /api/chat/conversations/:conversationId/messages/:messageId
 * @access  Private
 */
const deleteMessage = async (req, res) => {
    try {
        const result = await chatService.deleteMessage(
            req.params.conversationId,
            req.params.messageId,
            req.user._id
        );

        return res.status(200).json({
            success: true,
            ...result,
        });
    } catch (err) {
        console.error("deleteMessage error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to delete message",
        });
    }
};

/**
 * @desc    Add a reaction to a message
 * @route   POST /api/chat/conversations/:conversationId/messages/:messageId/reactions
 * @access  Private
 */
const addReaction = async (req, res) => {
    try {
        const { emoji } = req.body;
        const reactions = await chatService.addReaction(
            req.params.conversationId,
            req.params.messageId,
            req.user._id,
            emoji
        );

        return res.status(200).json({
            success: true,
            reactions,
        });
    } catch (err) {
        console.error("addReaction error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to add reaction",
        });
    }
};

/**
 * @desc    Remove a reaction from a message
 * @route   DELETE /api/chat/conversations/:conversationId/messages/:messageId/reactions
 * @access  Private
 */
const removeReaction = async (req, res) => {
    try {
        const reactions = await chatService.removeReaction(
            req.params.conversationId,
            req.params.messageId,
            req.user._id
        );

        return res.status(200).json({
            success: true,
            reactions,
        });
    } catch (err) {
        console.error("removeReaction error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to remove reaction",
        });
    }
};

/**
 * @desc    Mark conversation as read for authenticated user
 * @route   POST /api/chat/conversations/:conversationId/read
 * @access  Private
 */
const markConversationRead = async (req, res) => {
    try {
        const result = await chatService.markConversationRead(
            req.params.conversationId,
            req.user._id
        );

        return res.status(200).json({
            success: true,
            ...result,
        });
    } catch (err) {
        console.error("markConversationRead error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to mark conversation as read",
        });
    }
};

/**
 * @desc    Search messages in a conversation
 * @route   GET /api/chat/conversations/:conversationId/search
 * @access  Private
 */
const searchMessages = async (req, res) => {
    try {
        const { q } = req.query;
        const result = await chatService.searchMessages(
            req.params.conversationId,
            req.user._id,
            q
        );

        return res.status(200).json({
            success: true,
            ...result,
        });
    } catch (err) {
        console.error("searchMessages error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to search messages",
        });
    }
};

module.exports = {
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
};

