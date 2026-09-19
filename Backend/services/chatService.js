const mongoose = require("mongoose");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const ProjectMembership = require("../models/ProjectMembership");
const User = require("../models/User");
const { encrypt, decrypt } = require("../utils/encryption");
const notificationService = require("./notificationService");
const { NOTIFICATION_TYPES, SOURCE_TYPES } = require("../constants/notificationConstants");
const {
    uploadFile,
    deleteFile,
    generatePresignedUrl,
    buildChatAttachmentKey,
} = require("./s3Service");
const { ALLOWED_MIME_TYPES } = require("../middleware/chatUploadMiddleware");
const socketService = require("./socketService");
const socketEvents = require("../constants/socketEvents");

/**
 * Chat Service — Phase 15 & 18
 *
 * Core business logic for chat conversations, messages, and attachments.
 * Handles conversation access control, message encryption/decryption,
 * S3 attachment storage, presigned URLs, and pagination.
 */

/**
 * Helper to decrypt and format the lastMessage preview for a conversation.
 */
const formatLastMessage = (lastMsg) => {
    if (!lastMsg) return null;
    const formatted = { ...lastMsg };
    let content = "";
    if (lastMsg.encryptedContent) {
        try {
            content = decrypt(lastMsg.encryptedContent);
        } catch {
            content = "[Unable to decrypt]";
        }
    }
    // If content is empty or absent, format a friendly preview based on messageType
    if (!content && lastMsg.messageType && lastMsg.messageType !== "TEXT") {
        const type = lastMsg.messageType;
        if (type === "IMAGE") content = "📷 Photo";
        else if (type === "VIDEO") content = "🎥 Video";
        else if (type === "AUDIO") content = "🎵 Audio";
        else if (type === "FILE") content = `📎 ${lastMsg.attachment?.originalName || "Attachment"}`;
    }
    formatted.content = content;
    delete formatted.encryptedContent;
    return formatted;
};

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
            select: "sender encryptedContent messageType attachment createdAt",
            populate: { path: "sender", select: "_id name" },
        })
        .sort({ lastMessageAt: -1, updatedAt: -1 })
        .lean();

    // Decrypt last message preview for each conversation
    const result = conversations.map((conv) => {
        const formatted = { ...conv };
        if (conv.lastMessage) {
            formatted.lastMessage = formatLastMessage(conv.lastMessage);
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
            select: "sender encryptedContent messageType attachment createdAt",
            populate: { path: "sender", select: "_id name" },
        })
        .lean();

    // Decrypt and format last message if present
    if (conversation.lastMessage) {
        conversation.lastMessage = formatLastMessage(conversation.lastMessage);
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
            select: "sender encryptedContent messageType attachment createdAt",
            populate: { path: "sender", select: "_id name" },
        })
        .lean();

    // Decrypt and format last message if present
    if (conversation.lastMessage) {
        conversation.lastMessage = formatLastMessage(conversation.lastMessage);
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
            select: "sender encryptedContent messageType attachment createdAt",
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

    // Decrypt and format last message if present
    if (conversation.lastMessage) {
        conversation.lastMessage = formatLastMessage(conversation.lastMessage);
    }

    return conversation;
};

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get paginated messages for a conversation.
 * Decrypts message content and generates presigned URLs for attachments.
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

    // Decrypt message contents and attach presigned URLs
    const formattedMessages = await Promise.all(
        messages.map(async (msg) => {
            const formatted = { ...msg };
            if (msg.encryptedContent) {
                try {
                    formatted.content = decrypt(msg.encryptedContent);
                } catch {
                    formatted.content = "[Unable to decrypt]";
                }
            } else {
                formatted.content = "";
            }
            delete formatted.encryptedContent;

            // Generate presigned URL for attachment if present
            if (formatted.attachment && formatted.attachment.storageKey) {
                try {
                    const presignedUrl = await generatePresignedUrl(formatted.attachment.storageKey);
                    formatted.attachment = {
                        ...formatted.attachment,
                        url: presignedUrl,
                        downloadUrl: presignedUrl,
                    };
                } catch (presignErr) {
                    console.warn(`Presigned URL warning for ${formatted.attachment.storageKey}:`, presignErr.message);
                    formatted.attachment = {
                        ...formatted.attachment,
                        url: null,
                        downloadUrl: null,
                    };
                }
            }

            return formatted;
        })
    );

    return {
        messages: formattedMessages,
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

/**
 * Send an attachment message in a conversation.
 * Uploads file to S3, encrypts optional caption, persists message in MongoDB,
 * handles orphan cleanup if DB fails, emits Socket.IO events, and sends notifications.
 */
const sendAttachmentMessage = async (conversationId, userId, file, content = "", options = {}) => {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        const error = new Error("Invalid conversation ID format");
        error.statusCode = 400;
        throw error;
    }

    if (!file || !file.buffer) {
        const error = new Error("File is required for attachment upload");
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

    // Determine messageType from MIME type
    const mimeInfo = ALLOWED_MIME_TYPES[file.mimetype];
    const messageType = mimeInfo?.messageType || "FILE";

    // Validate caption content if provided
    let trimmedContent = "";
    let encryptedContent = null;
    if (content && typeof content === "string" && content.trim().length > 0) {
        trimmedContent = content.trim();
        if (trimmedContent.length > 5000) {
            const error = new Error("Message caption cannot exceed 5000 characters");
            error.statusCode = 400;
            throw error;
        }
        try {
            encryptedContent = encrypt(trimmedContent);
        } catch (encErr) {
            console.error("Attachment caption encryption failed:", encErr.message);
            const error = new Error("Failed to process message caption");
            error.statusCode = 500;
            throw error;
        }
    }

    // Construct S3 key
    const s3Key = buildChatAttachmentKey(
        conversationId,
        conversation.type,
        file.originalname
    );

    // Upload to S3
    try {
        await uploadFile(
            file.buffer,
            s3Key,
            file.mimetype,
            {
                conversationId: conversationId.toString(),
                senderId: userId.toString(),
                originalName: encodeURIComponent(file.originalname || "attachment"),
            }
        );
    } catch (s3Err) {
        console.error("S3 upload failed for chat attachment:", s3Err.message);
        const error = new Error(`Failed to upload attachment: ${s3Err.message}`);
        error.statusCode = 500;
        throw error;
    }

    // Create Message in MongoDB, ensuring orphan cleanup on DB failure
    let message;
    try {
        message = await Message.create({
            conversation: conversationId,
            sender: userObjectId,
            encryptedContent,
            messageType,
            attachment: {
                originalName: file.originalname,
                storageKey: s3Key,
                mimeType: file.mimetype,
                size: file.size,
                uploadedAt: new Date(),
            },
        });
    } catch (dbErr) {
        console.error("MongoDB message creation failed after S3 upload. Cleaning up orphaned S3 object:", s3Key);
        await deleteFile(s3Key).catch((delErr) => {
            console.error("Failed to delete orphaned S3 object:", delErr.message);
        });
        const error = new Error(`Failed to save message: ${dbErr.message}`);
        error.statusCode = 500;
        throw error;
    }

    // Update conversation's last message tracking
    await Conversation.findByIdAndUpdate(conversationId, {
        lastMessage: message._id,
        lastMessageAt: message.createdAt,
    });

    // Generate immediate presigned URL for response
    let presignedUrl = null;
    try {
        presignedUrl = await generatePresignedUrl(s3Key);
    } catch (presignErr) {
        console.warn("Presigned URL generation warning:", presignErr.message);
    }

    // Populate sender
    const populatedMessage = await Message.findById(message._id)
        .populate("sender", "_id name email profileImageURL")
        .lean();

    const result = {
        ...populatedMessage,
        content: trimmedContent,
        attachment: {
            ...populatedMessage.attachment,
            url: presignedUrl,
            downloadUrl: presignedUrl,
        },
    };
    delete result.encryptedContent;

    // Send notifications to other participants
    try {
        const senderUser = await User.findById(userObjectId).select("name").lean();
        const senderName = senderUser ? senderUser.name : "Someone";

        let notifTitle = "New Attachment";
        let previewText = trimmedContent
            ? `"${trimmedContent.substring(0, 60)}${trimmedContent.length > 60 ? "..." : ""}"`
            : messageType === "IMAGE"
            ? "sent a photo"
            : messageType === "VIDEO"
            ? "sent a video"
            : messageType === "AUDIO"
            ? "sent an audio file"
            : `sent a file: ${file.originalname}`;

        if (conversation.type === "PROJECT" && conversation.project) {
            const Project = require("../models/Project");
            const project = await Project.findById(conversation.project).select("name").lean();
            if (project) {
                notifTitle = `New Attachment in ${project.name}`;
            }
        } else if (conversation.type === "DIRECT") {
            notifTitle = `New Message from ${senderName}`;
        }

        let notifMessage = `${senderName} ${previewText}`;

        let recipientIds;
        if (conversation.type === "PROJECT") {
            const memberships = await ProjectMembership.find({ project: conversation.project }).select("user");
            recipientIds = memberships
                .map((m) => m.user.toString())
                .filter((id) => id !== userObjectId.toString());
        } else {
            recipientIds = conversation.participants
                .map((p) => p.toString())
                .filter((id) => id !== userObjectId.toString());
        }

        if (options.skipNotificationUserIds && Array.isArray(options.skipNotificationUserIds)) {
            const skipSet = new Set(options.skipNotificationUserIds.map((id) => id.toString()));
            recipientIds = recipientIds.filter((id) => !skipSet.has(id));
        }

        if (recipientIds.length > 0) {
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

            notificationService.createNotifications(notificationItems).catch((err) => {
                console.error("Chat attachment notification creation failed:", err.message);
            });
        }
    } catch (notifErr) {
        console.error("Chat attachment notification error:", notifErr.message);
    }

    // Real-time Socket.IO emission
    try {
        const io = socketService.getIO();
        if (io) {
            const roomName = `conversation:${conversationId}`;
            io.to(roomName).emit(socketEvents.MESSAGE_NEW, result);
            io.to(roomName).emit(socketEvents.CONVERSATION_UPDATED, {
                conversationId: conversationId.toString(),
                lastMessage: result,
                lastMessageAt: result.createdAt,
            });
        }
    } catch (socketErr) {
        // Socket.IO may not be initialized in non-server contexts (e.g. testing)
    }

    return result;
};

/**
 * Generate a presigned download URL for an attachment in a conversation.
 * Enforces conversation access authorization before issuing URL.
 */
const getAttachmentDownloadUrl = async (conversationId, messageId, userId) => {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    if (!mongoose.Types.ObjectId.isValid(conversationId) || !mongoose.Types.ObjectId.isValid(messageId)) {
        const error = new Error("Invalid conversation or message ID format");
        error.statusCode = 400;
        throw error;
    }

    const conversation = await Conversation.findById(conversationId).lean();
    if (!conversation) {
        const error = new Error("Conversation not found");
        error.statusCode = 404;
        throw error;
    }

    await verifyConversationAccess(conversation, userObjectId);

    const message = await Message.findOne({
        _id: messageId,
        conversation: conversationId,
    }).lean();

    if (!message || !message.attachment || !message.attachment.storageKey) {
        const error = new Error("Attachment not found for this message");
        error.statusCode = 404;
        throw error;
    }

    // Generate a fresh presigned download URL (valid for 1 hour)
    const downloadUrl = await generatePresignedUrl(message.attachment.storageKey, 3600);

    return {
        downloadUrl,
        fileName: message.attachment.originalName,
        mimeType: message.attachment.mimeType,
        size: message.attachment.size,
    };
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
    sendAttachmentMessage,
    getAttachmentDownloadUrl,
    verifyConversationAccess,
};
