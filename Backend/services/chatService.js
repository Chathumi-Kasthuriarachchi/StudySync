const mongoose = require("mongoose");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const ProjectMembership = require("../models/ProjectMembership");
const User = require("../models/User");
const { encrypt, decrypt } = require("../utils/encryption");
const notificationService = require("./notificationService");
const { NOTIFICATION_TYPES, SOURCE_TYPES } = require("../constants/notificationConstants");

/**
 * Chat Service — Phase 15
 *
 * Core business logic for chat conversations and messages.
 * Handles conversation access control, message encryption/decryption,
 * and pagination.
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATION OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all conversations accessible to the authenticated user.
 * Returns project conversations (where user is a member) and direct conversations.
 */
const getUserConversations = async (userId) => {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Get all project IDs the user is a member of
    const memberships = await ProjectMembership.find({ user: userObjectId }).select("project");
    const projectIds = memberships.map((m) => m.project);

    // Find conversations where user is a participant OR is a member of the conversation's project
    const conversations = await Conversation.find({
        $or: [
            { participants: userObjectId },
            { type: "PROJECT", project: { $in: projectIds } },
        ],
    })
        .populate("project", "name status")
        .populate("participants", "_id name email profileImageURL")
        .populate({
            path: "lastMessage",
            select: "sender encryptedContent createdAt",
            populate: { path: "sender", select: "_id name" },
        })
        .sort({ lastMessageAt: -1, updatedAt: -1 })
        .lean();

    // Decrypt last message preview for each conversation
    const result = conversations.map((conv) => {
        const formatted = { ...conv };
        if (conv.lastMessage && conv.lastMessage.encryptedContent) {
            try {
                formatted.lastMessage = {
                    ...conv.lastMessage,
                    content: decrypt(conv.lastMessage.encryptedContent),
                };
                delete formatted.lastMessage.encryptedContent;
            } catch {
                formatted.lastMessage = {
                    ...conv.lastMessage,
                    content: "[Unable to decrypt]",
                };
                delete formatted.lastMessage.encryptedContent;
            }
        }
        return formatted;
    });

    return result;
};

/**
 * Get or create a PROJECT conversation for a given project.
 * Verifies the user is a project member before granting access.
 */
const getOrCreateProjectConversation = async (projectId, userId) => {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        const error = new Error("Invalid project ID format");
        error.statusCode = 400;
        throw error;
    }

    // Verify membership
    const membership = await ProjectMembership.findOne({
        project: projectId,
        user: userObjectId,
    });

    if (!membership) {
        const error = new Error("Access denied. You are not a member of this project.");
        error.statusCode = 403;
        throw error;
    }

    // Try to find existing project conversation
    let conversation = await Conversation.findOne({
        type: "PROJECT",
        project: projectId,
    });

    if (!conversation) {
        // Get all project members as participants
        const allMemberships = await ProjectMembership.find({ project: projectId }).select("user");
        const participantIds = allMemberships.map((m) => m.user);

        conversation = await Conversation.create({
            type: "PROJECT",
            project: projectId,
            participants: participantIds,
        });
    }

    // Populate and return
    conversation = await Conversation.findById(conversation._id)
        .populate("project", "name status")
        .populate("participants", "_id name email profileImageURL")
        .populate({
            path: "lastMessage",
            select: "sender encryptedContent createdAt",
            populate: { path: "sender", select: "_id name" },
        })
        .lean();

    // Decrypt last message if present
    if (conversation.lastMessage && conversation.lastMessage.encryptedContent) {
        try {
            conversation.lastMessage.content = decrypt(conversation.lastMessage.encryptedContent);
        } catch {
            conversation.lastMessage.content = "[Unable to decrypt]";
        }
        delete conversation.lastMessage.encryptedContent;
    }

    return conversation;
};

/**
 * Get or create a DIRECT conversation between two users.
 * Prevents duplicates and self-conversations.
 */
const getOrCreateDirectConversation = async (userId, targetUserId) => {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    if (!targetUserId || !mongoose.Types.ObjectId.isValid(targetUserId)) {
        const error = new Error("Invalid target user ID format");
        error.statusCode = 400;
        throw error;
    }

    // Prevent self-conversation
    if (userId.toString() === targetUserId.toString()) {
        const error = new Error("Cannot create a conversation with yourself");
        error.statusCode = 400;
        throw error;
    }

    // Verify target user exists
    const targetUser = await User.findById(targetUserId).select("_id name email");
    if (!targetUser) {
        const error = new Error("Target user not found");
        error.statusCode = 404;
        throw error;
    }

    const targetObjectId = new mongoose.Types.ObjectId(targetUserId);

    // Check for existing direct conversation between these two users
    let conversation = await Conversation.findOne({
        type: "DIRECT",
        participants: { $all: [userObjectId, targetObjectId], $size: 2 },
    });

    if (!conversation) {
        conversation = await Conversation.create({
            type: "DIRECT",
            participants: [userObjectId, targetObjectId],
        });
    }

    // Populate and return
    conversation = await Conversation.findById(conversation._id)
        .populate("project", "name status")
        .populate("participants", "_id name email profileImageURL")
        .populate({
            path: "lastMessage",
            select: "sender encryptedContent createdAt",
            populate: { path: "sender", select: "_id name" },
        })
        .lean();

    // Decrypt last message if present
    if (conversation.lastMessage && conversation.lastMessage.encryptedContent) {
        try {
            conversation.lastMessage.content = decrypt(conversation.lastMessage.encryptedContent);
        } catch {
            conversation.lastMessage.content = "[Unable to decrypt]";
        }
        delete conversation.lastMessage.encryptedContent;
    }

    return conversation;
};

/**
 * Get a single conversation by ID, with access verification.
 */
const getConversationById = async (conversationId, userId) => {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        const error = new Error("Invalid conversation ID format");
        error.statusCode = 400;
        throw error;
    }

    const conversation = await Conversation.findById(conversationId)
        .populate("project", "name status")
        .populate("participants", "_id name email profileImageURL")
        .populate({
            path: "lastMessage",
            select: "sender encryptedContent createdAt",
            populate: { path: "sender", select: "_id name" },
        })
        .lean();

    if (!conversation) {
        const error = new Error("Conversation not found");
        error.statusCode = 404;
        throw error;
    }

    // Verify access
    await verifyConversationAccess(conversation, userObjectId);

    // Decrypt last message if present
    if (conversation.lastMessage && conversation.lastMessage.encryptedContent) {
        try {
            conversation.lastMessage.content = decrypt(conversation.lastMessage.encryptedContent);
        } catch {
            conversation.lastMessage.content = "[Unable to decrypt]";
        }
        delete conversation.lastMessage.encryptedContent;
    }

    return conversation;
};

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get paginated messages for a conversation.
 * Decrypts message content before returning.
 */
const getMessages = async (conversationId, userId, options = {}) => {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        const error = new Error("Invalid conversation ID format");
        error.statusCode = 400;
        throw error;
    }

    // Verify conversation exists and user has access
    const conversation = await Conversation.findById(conversationId).lean();
    if (!conversation) {
        const error = new Error("Conversation not found");
        error.statusCode = 404;
        throw error;
    }

    await verifyConversationAccess(conversation, userObjectId);

    // Pagination
    const page = Math.max(1, parseInt(options.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(options.limit, 10) || 30));
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
        Message.find({ conversation: conversationId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate("sender", "_id name email profileImageURL")
            .lean(),
        Message.countDocuments({ conversation: conversationId }),
    ]);

    // Decrypt message contents
    const decryptedMessages = messages.map((msg) => {
        const formatted = { ...msg };
        try {
            formatted.content = decrypt(msg.encryptedContent);
        } catch {
            formatted.content = "[Unable to decrypt]";
        }
        delete formatted.encryptedContent;
        return formatted;
    });

    return {
        messages: decryptedMessages,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        hasMore: skip + messages.length < total,
    };
};

/**
 * Send a message in a conversation.
 * Encrypts content before storing, updates conversation's lastMessage.
 */
const sendMessage = async (conversationId, userId, content, options = {}) => {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        const error = new Error("Invalid conversation ID format");
        error.statusCode = 400;
        throw error;
    }

    // Validate message content
    if (!content || typeof content !== "string" || content.trim().length === 0) {
        const error = new Error("Message content cannot be empty");
        error.statusCode = 400;
        throw error;
    }

    const trimmedContent = content.trim();

    if (trimmedContent.length > 5000) {
        const error = new Error("Message content cannot exceed 5000 characters");
        error.statusCode = 400;
        throw error;
    }

    // Verify conversation exists and user has access
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
        const error = new Error("Conversation not found");
        error.statusCode = 404;
        throw error;
    }

    await verifyConversationAccess(conversation.toObject(), userObjectId);

    // Encrypt the message content
    let encryptedContent;
    try {
        encryptedContent = encrypt(trimmedContent);
    } catch (encErr) {
        console.error("Message encryption failed:", encErr.message);
        const error = new Error("Failed to process message");
        error.statusCode = 500;
        throw error;
    }

    // Create the message
    const message = await Message.create({
        conversation: conversationId,
        sender: userObjectId,
        encryptedContent,
        messageType: "TEXT",
    });

    // Update conversation's last message tracking
    await Conversation.findByIdAndUpdate(conversationId, {
        lastMessage: message._id,
        lastMessageAt: message.createdAt,
    });

    // Populate sender for response
    const populatedMessage = await Message.findById(message._id)
        .populate("sender", "_id name email profileImageURL")
        .lean();

    // Build decrypted response
    const result = {
        ...populatedMessage,
        content: trimmedContent,
    };
    delete result.encryptedContent;

    // ── Notification Integration ──────────────────────────────────────────
    // Notify other participants about the new message
    try {
        const senderUser = await User.findById(userObjectId).select("name").lean();
        const senderName = senderUser ? senderUser.name : "Someone";

        // Determine notification title based on conversation type
        let notifTitle = "New Message";
        let notifMessage = `${senderName} sent a message.`;

        if (conversation.type === "PROJECT" && conversation.project) {
            const Project = require("../models/Project");
            const project = await Project.findById(conversation.project).select("name").lean();
            if (project) {
                notifTitle = `New Message in ${project.name}`;
                notifMessage = `${senderName}: "${trimmedContent.substring(0, 80)}${trimmedContent.length > 80 ? "..." : ""}"`;
            }
        } else if (conversation.type === "DIRECT") {
            notifTitle = `New Message from ${senderName}`;
            notifMessage = `${trimmedContent.substring(0, 80)}${trimmedContent.length > 80 ? "..." : ""}`;
        }

        // Get participants to notify (exclude sender)
        let recipientIds;
        if (conversation.type === "PROJECT") {
            // For project conversations, get current project members
            const memberships = await ProjectMembership.find({ project: conversation.project }).select("user");
            recipientIds = memberships
                .map((m) => m.user.toString())
                .filter((id) => id !== userObjectId.toString());
        } else {
            recipientIds = conversation.participants
                .map((p) => p.toString())
                .filter((id) => id !== userObjectId.toString());
        }

        // Phase 16: Exclude recipients currently active in the conversation room
        if (options.skipNotificationUserIds && Array.isArray(options.skipNotificationUserIds)) {
            const skipSet = new Set(options.skipNotificationUserIds.map((id) => id.toString()));
            recipientIds = recipientIds.filter((id) => !skipSet.has(id));
        }

        if (recipientIds.length > 0) {
            // Create notifications (non-blocking — don't fail the message send on notification errors)
            const notificationItems = recipientIds.map((recipientId) => ({
                recipient: recipientId,
                type: NOTIFICATION_TYPES.CHAT_MESSAGE,
                title: notifTitle,
                message: notifMessage,
                sourceType: SOURCE_TYPES.CONVERSATION,
                sourceId: conversationId,
                project: conversation.project || null,
                metadata: {
                    conversationId,
                    messageId: message._id,
                    senderId: userObjectId,
                    senderName,
                },
            }));

            // Fire and don't await — notifications should not block message sending
            notificationService.createNotifications(notificationItems).catch((err) => {
                console.error("Chat notification creation failed:", err.message);
            });
        }
    } catch (notifErr) {
        // Never fail message sending due to notification issues
        console.error("Chat notification error:", notifErr.message);
    }

    return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// ACCESS CONTROL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verify that a user has access to a conversation.
 * - PROJECT: user must be a project member
 * - DIRECT: user must be one of the two participants
 */
const verifyConversationAccess = async (conversation, userObjectId) => {
    if (conversation.type === "PROJECT") {
        // Check project membership
        const membership = await ProjectMembership.findOne({
            project: conversation.project?._id || conversation.project,
            user: userObjectId,
        });

        if (!membership) {
            const error = new Error("Access denied. You are not a member of this project.");
            error.statusCode = 403;
            throw error;
        }
    } else if (conversation.type === "DIRECT") {
        // Check participant list
        const isParticipant = conversation.participants.some((p) => {
            const participantId = p._id || p;
            return participantId.toString() === userObjectId.toString();
        });

        if (!isParticipant) {
            const error = new Error("Access denied. You are not a participant in this conversation.");
            error.statusCode = 403;
            throw error;
        }
    }
};

module.exports = {
    getUserConversations,
    getOrCreateProjectConversation,
    getOrCreateDirectConversation,
    getConversationById,
    getMessages,
    sendMessage,
    verifyConversationAccess,
};
