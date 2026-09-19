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

// Phase 19: Fixed allowed reaction emoji set
const ALLOWED_REACTION_EMOJIS = ["❤️", "👍", "😂", "😮", "😢", "👏"];

/**
 * Chat Service — Phase 15, 18 & 19
 *
 * Core business logic for chat conversations, messages, attachments,
 * replies, reactions, editing, soft deletion, read tracking, and search.
 */

/**
 * Helper to decrypt and format the lastMessage preview for a conversation.
 */
const formatLastMessage = (lastMsg) => {
    if (!lastMsg) return null;
    const formatted = { ...lastMsg };

    // Phase 19: Soft deleted messages
    if (lastMsg.isDeleted) {
        formatted.content = "This message was deleted";
        formatted.attachment = null;
        delete formatted.encryptedContent;
        return formatted;
    }

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

/**
 * Helper to decrypt and format a message document (including replyTo, reactions, and attachments).
 */
const formatMessage = async (msg) => {
    if (!msg) return null;
    const formatted = { ...msg };

    if (msg.isDeleted) {
        formatted.content = "This message was deleted";
        formatted.attachment = null;
        delete formatted.encryptedContent;
    } else {
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
                formatted.attachment = {
                    ...formatted.attachment,
                    url: null,
                    downloadUrl: null,
                };
            }
        }
    }

    // Format replyTo reference if present
    if (formatted.replyTo && typeof formatted.replyTo === "object" && formatted.replyTo._id) {
        const rep = formatted.replyTo;
        if (rep.isDeleted) {
            formatted.replyTo = {
                _id: rep._id,
                isDeleted: true,
                content: "Original message unavailable",
                messageType: rep.messageType || "TEXT",
                sender: rep.sender || null,
            };
        } else {
            let replyContent = "";
            if (rep.encryptedContent) {
                try {
                    replyContent = decrypt(rep.encryptedContent);
                } catch {
                    replyContent = "[Unable to decrypt]";
                }
            }
            if (!replyContent && rep.messageType && rep.messageType !== "TEXT") {
                if (rep.messageType === "IMAGE") replyContent = "📷 Photo";
                else if (rep.messageType === "VIDEO") replyContent = "🎥 Video";
                else if (rep.messageType === "AUDIO") replyContent = "🎵 Audio";
                else if (rep.messageType === "FILE") replyContent = `📎 ${rep.attachment?.originalName || "Attachment"}`;
            }
            formatted.replyTo = {
                _id: rep._id,
                sender: rep.sender || null,
                content: replyContent,
                messageType: rep.messageType || "TEXT",
                attachment: rep.attachment
                    ? {
                          originalName: rep.attachment.originalName,
                          mimeType: rep.attachment.mimeType,
                          size: rep.attachment.size,
                      }
                    : null,
                isDeleted: false,
                createdAt: rep.createdAt,
            };
        }
    }

    formatted.reactions = formatted.reactions || [];
    formatted.isEdited = Boolean(formatted.isEdited);
    formatted.deliveryStatus = formatted.deliveryStatus || "SENT";
    formatted.readBy = formatted.readBy || [];

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
            select: "sender encryptedContent messageType attachment isDeleted isEdited deliveryStatus createdAt",
            populate: { path: "sender", select: "_id name" },
        })
        .sort({ lastMessageAt: -1, updatedAt: -1 })
        .lean();

    // Decrypt last message preview and calculate unread count for each conversation
    const result = await Promise.all(
        conversations.map(async (conv) => {
            const formatted = { ...conv };
            if (conv.lastMessage) {
                formatted.lastMessage = formatLastMessage(conv.lastMessage);
            }

            // Phase 19: Unread count calculation
            const userReadState = conv.readState?.find(
                (rs) => rs.user?.toString() === userObjectId.toString()
            );
            const lastReadAt = userReadState ? userReadState.lastReadAt : new Date(0);
            const unreadCount = await Message.countDocuments({
                conversation: conv._id,
                sender: { $ne: userObjectId },
                createdAt: { $gt: lastReadAt },
                isDeleted: false,
            });
            formatted.unreadCount = unreadCount;

            return formatted;
        })
    );

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
            select: "sender encryptedContent messageType attachment isDeleted isEdited deliveryStatus createdAt",
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
            select: "sender encryptedContent messageType attachment isDeleted isEdited deliveryStatus createdAt",
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
            select: "sender encryptedContent messageType attachment isDeleted isEdited deliveryStatus createdAt",
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
 * Decrypts message content, resolves presigned URLs, formats replies and reactions.
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
            .populate({
                path: "replyTo",
                select: "_id sender encryptedContent messageType attachment isDeleted createdAt",
                populate: { path: "sender", select: "_id name" },
            })
            .populate({
                path: "reactions.users",
                select: "_id name",
            })
            .lean(),
        Message.countDocuments({ conversation: conversationId }),
    ]);

    // Format and decrypt all messages using formatMessage helper
    const formattedMessages = await Promise.all(messages.map(formatMessage));

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
 * Helper to update or upsert a user's readState for a conversation.
 */
const updateConversationReadState = async (conversationId, userId, readAt = new Date()) => {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const updated = await Conversation.updateOne(
        { _id: conversationId, "readState.user": userObjectId },
        { $set: { "readState.$.lastReadAt": readAt } }
    );
    if (updated.matchedCount === 0) {
        await Conversation.updateOne(
            { _id: conversationId },
            { $push: { readState: { user: userObjectId, lastReadAt: readAt } } }
        );
    }
};

/**
 * Send a message in a conversation.
 * Encrypts content before storing, updates conversation's lastMessage,
 * supports replyTo, deliveryStatus, and readState tracking.
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

    // Validate replyTo if present
    let replyToId = null;
    if (options.replyTo) {
        if (!mongoose.Types.ObjectId.isValid(options.replyTo)) {
            const error = new Error("Invalid replyTo message ID format");
            error.statusCode = 400;
            throw error;
        }
        const targetMsg = await Message.findOne({
            _id: options.replyTo,
            conversation: conversationId,
        });
        if (!targetMsg) {
            const error = new Error("Reply target message not found in this conversation");
            error.statusCode = 404;
            throw error;
        }
        replyToId = targetMsg._id;
    }

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

    // Determine initial delivery status
    const deliveryStatus = options.isDelivered ? "DELIVERED" : "SENT";

    // Create the message
    const message = await Message.create({
        conversation: conversationId,
        sender: userObjectId,
        encryptedContent,
        messageType: "TEXT",
        replyTo: replyToId,
        deliveryStatus,
        readBy: [userObjectId],
    });

    // Update conversation's last message tracking
    await Conversation.findByIdAndUpdate(conversationId, {
        lastMessage: message._id,
        lastMessageAt: message.createdAt,
    });

    // Update sender's readState
    await updateConversationReadState(conversationId, userObjectId, message.createdAt);

    // Populate sender, replyTo, and reactions for response
    const populatedMessage = await Message.findById(message._id)
        .populate("sender", "_id name email profileImageURL")
        .populate({
            path: "replyTo",
            select: "_id sender encryptedContent messageType attachment isDeleted createdAt",
            populate: { path: "sender", select: "_id name" },
        })
        .populate({
            path: "reactions.users",
            select: "_id name",
        })
        .lean();

    const result = await formatMessage(populatedMessage);

    // ── Notification Integration ──────────────────────────────────────────
    notificationService.notifyChatMessage({
        message,
        conversation,
        sender: userObjectId,
        content: trimmedContent,
        options: {
            ...options,
            replyTo: result.replyTo,
        },
    }).catch((notifErr) => {
        console.error("Chat notification error:", notifErr.message);
    });

    // If requested or sent via HTTP API, emit socket events
    if (options.emitSocket) {
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
        } catch {}
    }

    return result;
};

/**
 * Send an attachment message in a conversation.
 * Uploads file to S3, encrypts optional caption, persists message in MongoDB,
 * supports replyTo, deliveryStatus, and readState tracking.
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

    // Validate replyTo if present
    let replyToId = null;
    if (options.replyTo) {
        if (!mongoose.Types.ObjectId.isValid(options.replyTo)) {
            const error = new Error("Invalid replyTo message ID format");
            error.statusCode = 400;
            throw error;
        }
        const targetMsg = await Message.findOne({
            _id: options.replyTo,
            conversation: conversationId,
        });
        if (!targetMsg) {
            const error = new Error("Reply target message not found in this conversation");
            error.statusCode = 404;
            throw error;
        }
        replyToId = targetMsg._id;
    }

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

    // Determine initial delivery status
    const deliveryStatus = options.isDelivered ? "DELIVERED" : "SENT";

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
            replyTo: replyToId,
            deliveryStatus,
            readBy: [userObjectId],
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

    // Update sender's readState
    await updateConversationReadState(conversationId, userObjectId, message.createdAt);

    // Populate sender, replyTo, reactions
    const populatedMessage = await Message.findById(message._id)
        .populate("sender", "_id name email profileImageURL")
        .populate({
            path: "replyTo",
            select: "_id sender encryptedContent messageType attachment isDeleted createdAt",
            populate: { path: "sender", select: "_id name" },
        })
        .populate({
            path: "reactions.users",
            select: "_id name",
        })
        .lean();

    const result = await formatMessage(populatedMessage);

    // ── Notification Integration ──────────────────────────────────────────
    notificationService.notifyChatMessage({
        message,
        conversation,
        sender: userObjectId,
        content: trimmedContent,
        options: {
            ...options,
            replyTo: result.replyTo,
        },
    }).catch((notifErr) => {
        console.error("Chat attachment notification error:", notifErr.message);
    });

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
 * Edit an existing message (Sender-only, text/caption only).
 * Preserves AES-256-GCM encryption at rest, sets isEdited and editedAt,
 * broadcasts MESSAGE_UPDATED to room.
 */
const editMessage = async (conversationId, messageId, userId, newContent) => {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    if (!mongoose.Types.ObjectId.isValid(conversationId) || !mongoose.Types.ObjectId.isValid(messageId)) {
        const error = new Error("Invalid conversation or message ID format");
        error.statusCode = 400;
        throw error;
    }

    if (!newContent || typeof newContent !== "string" || newContent.trim().length === 0) {
        const error = new Error("Message content cannot be empty");
        error.statusCode = 400;
        throw error;
    }

    const trimmedContent = newContent.trim();
    if (trimmedContent.length > 5000) {
        const error = new Error("Message content cannot exceed 5000 characters");
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

    const message = await Message.findOne({ _id: messageId, conversation: conversationId });
    if (!message) {
        const error = new Error("Message not found");
        error.statusCode = 404;
        throw error;
    }

    if (message.sender.toString() !== userObjectId.toString()) {
        const error = new Error("You can only edit your own messages");
        error.statusCode = 403;
        throw error;
    }

    if (message.isDeleted) {
        const error = new Error("Cannot edit a deleted message");
        error.statusCode = 400;
        throw error;
    }

    // Encrypt updated content
    try {
        message.encryptedContent = encrypt(trimmedContent);
    } catch (encErr) {
        const error = new Error("Failed to process updated message");
        error.statusCode = 500;
        throw error;
    }

    message.isEdited = true;
    message.editedAt = new Date();
    await message.save();

    // Populate and format
    const populated = await Message.findById(message._id)
        .populate("sender", "_id name email profileImageURL")
        .populate({
            path: "replyTo",
            select: "_id sender encryptedContent messageType attachment isDeleted createdAt",
            populate: { path: "sender", select: "_id name" },
        })
        .populate({
            path: "reactions.users",
            select: "_id name",
        })
        .lean();

    const formatted = await formatMessage(populated);

    // Socket.IO emission
    try {
        const io = socketService.getIO();
        if (io) {
            const roomName = `conversation:${conversationId}`;
            io.to(roomName).emit(socketEvents.MESSAGE_UPDATED, formatted);

            // If this message was the lastMessage, emit CONVERSATION_UPDATED
            if (conversation.lastMessage?.toString() === messageId.toString()) {
                io.to(roomName).emit(socketEvents.CONVERSATION_UPDATED, {
                    conversationId: conversationId.toString(),
                    lastMessage: formatted,
                    lastMessageAt: formatted.createdAt,
                });
            }
        }
    } catch {}

    return formatted;
};

/**
 * Soft delete a message (Sender-only).
 * Sets isDeleted: true, deletedAt: now, clears encryptedContent at rest,
 * retains S3 attachment safely, broadcasts MESSAGE_DELETED to room.
 */
const deleteMessage = async (conversationId, messageId, userId) => {
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

    const message = await Message.findOne({ _id: messageId, conversation: conversationId });
    if (!message) {
        const error = new Error("Message not found");
        error.statusCode = 404;
        throw error;
    }

    if (message.sender.toString() !== userObjectId.toString()) {
        const error = new Error("You can only delete your own messages");
        error.statusCode = 403;
        throw error;
    }

    if (message.isDeleted) {
        return { success: true, messageId: message._id };
    }

    // Soft delete: clear ciphertext, mark deleted, keep S3 attachment safely
    message.isDeleted = true;
    message.deletedAt = new Date();
    message.encryptedContent = null;
    await message.save();

    // Socket.IO emission
    try {
        const io = socketService.getIO();
        if (io) {
            const roomName = `conversation:${conversationId}`;
            io.to(roomName).emit(socketEvents.MESSAGE_DELETED, {
                conversationId: conversationId.toString(),
                messageId: messageId.toString(),
            });

            // If this message was the lastMessage, update conversation preview
            if (conversation.lastMessage?.toString() === messageId.toString()) {
                io.to(roomName).emit(socketEvents.CONVERSATION_UPDATED, {
                    conversationId: conversationId.toString(),
                    lastMessage: {
                        _id: message._id,
                        conversation: conversationId,
                        sender: message.sender,
                        content: "This message was deleted",
                        isDeleted: true,
                        createdAt: message.createdAt,
                    },
                    lastMessageAt: message.createdAt,
                });
            }
        }
    } catch {}

    return { success: true, messageId: message._id };
};

/**
 * Add or replace a reaction on a message.
 * Validates emoji against ALLOWED_REACTION_EMOJIS, prevents duplicate reactions per user.
 * Broadcasts REACTION_UPDATED to room.
 */
const addReaction = async (conversationId, messageId, userId, emoji) => {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    if (!mongoose.Types.ObjectId.isValid(conversationId) || !mongoose.Types.ObjectId.isValid(messageId)) {
        const error = new Error("Invalid conversation or message ID format");
        error.statusCode = 400;
        throw error;
    }

    if (!emoji || !ALLOWED_REACTION_EMOJIS.includes(emoji)) {
        const error = new Error(`Invalid reaction emoji. Allowed: ${ALLOWED_REACTION_EMOJIS.join(", ")}`);
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

    const message = await Message.findOne({ _id: messageId, conversation: conversationId });
    if (!message) {
        const error = new Error("Message not found");
        error.statusCode = 404;
        throw error;
    }

    if (message.isDeleted) {
        const error = new Error("Cannot react to a deleted message");
        error.statusCode = 400;
        throw error;
    }

    // Remove user's previous reaction from all emojis on this message
    message.reactions.forEach((r) => {
        r.users = r.users.filter((u) => u.toString() !== userObjectId.toString());
        r.count = r.users.length;
    });

    // Find or create target emoji group
    let emojiGroup = message.reactions.find((r) => r.emoji === emoji);
    if (!emojiGroup) {
        emojiGroup = { emoji, users: [userObjectId], count: 1 };
        message.reactions.push(emojiGroup);
    } else {
        emojiGroup.users.push(userObjectId);
        emojiGroup.count = emojiGroup.users.length;
    }

    // Clean up empty reaction groups
    message.reactions = message.reactions.filter((r) => r.users && r.users.length > 0);
    message.reactions.forEach((r) => {
        r.count = r.users.length;
    });
    await message.save();

    // Populate reaction users
    const populated = await Message.findById(message._id)
        .populate({
            path: "reactions.users",
            select: "_id name",
        })
        .lean();

    // Socket.IO emission
    try {
        const io = socketService.getIO();
        if (io) {
            io.to(`conversation:${conversationId}`).emit(socketEvents.REACTION_UPDATED, {
                conversationId: conversationId.toString(),
                messageId: messageId.toString(),
                reactions: populated.reactions,
            });
        }
    } catch {}

    return populated.reactions;
};

/**
 * Remove a user's reaction from a message.
 * Broadcasts REACTION_UPDATED to room.
 */
const removeReaction = async (conversationId, messageId, userId) => {
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

    const message = await Message.findOne({ _id: messageId, conversation: conversationId });
    if (!message) {
        const error = new Error("Message not found");
        error.statusCode = 404;
        throw error;
    }

    // Remove user from all reaction groups
    message.reactions.forEach((r) => {
        r.users = r.users.filter((u) => u.toString() !== userObjectId.toString());
        r.count = r.users.length;
    });

    message.reactions = message.reactions.filter((r) => r.users && r.users.length > 0);
    message.reactions.forEach((r) => {
        r.count = r.users.length;
    });
    await message.save();

    const populated = await Message.findById(message._id)
        .populate({
            path: "reactions.users",
            select: "_id name",
        })
        .lean();

    // Socket.IO emission
    try {
        const io = socketService.getIO();
        if (io) {
            io.to(`conversation:${conversationId}`).emit(socketEvents.REACTION_UPDATED, {
                conversationId: conversationId.toString(),
                messageId: messageId.toString(),
                reactions: populated.reactions,
            });
        }
    } catch {}

    return populated.reactions;
};

/**
 * Mark a conversation as read for a user.
 * Updates readState in Conversation, transitions unread messages to READ,
 * broadcasts CONVERSATION_READ and MESSAGE_READ to room.
 */
const markConversationRead = async (conversationId, userId) => {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        const error = new Error("Invalid conversation ID format");
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

    const readAt = new Date();

    // Update conversation readState
    await updateConversationReadState(conversationId, userObjectId, readAt);

    // Update unread messages from other senders
    await Message.updateMany(
        {
            conversation: conversationId,
            sender: { $ne: userObjectId },
            createdAt: { $lte: readAt },
            readBy: { $ne: userObjectId },
        },
        {
            $addToSet: { readBy: userObjectId },
            $set: { deliveryStatus: "READ" },
        }
    );

    // Socket.IO emission
    try {
        const io = socketService.getIO();
        if (io) {
            const roomName = `conversation:${conversationId}`;
            io.to(roomName).emit(socketEvents.CONVERSATION_READ, {
                conversationId: conversationId.toString(),
                userId: userId.toString(),
                lastReadAt: readAt,
            });
            io.to(roomName).emit(socketEvents.MESSAGE_READ, {
                conversationId: conversationId.toString(),
                readerId: userId.toString(),
                readAt,
            });
        }
    } catch {}

    return { success: true, conversationId, lastReadAt: readAt };
};

/**
 * Search messages within a conversation.
 * Scoped strictly to the specified conversation. Decrypts messages on-demand server-side
 * and filters by search query case-insensitively without storing plaintext index.
 */
const searchMessages = async (conversationId, userId, query) => {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        const error = new Error("Invalid conversation ID format");
        error.statusCode = 400;
        throw error;
    }

    if (!query || typeof query !== "string" || query.trim().length === 0) {
        return { messages: [], query: "", count: 0 };
    }

    const trimmedQuery = query.trim().toLowerCase();

    const conversation = await Conversation.findById(conversationId).lean();
    if (!conversation) {
        const error = new Error("Conversation not found");
        error.statusCode = 404;
        throw error;
    }

    await verifyConversationAccess(conversation, userObjectId);

    // Fetch non-deleted messages from this conversation
    const rawMessages = await Message.find({
        conversation: conversationId,
        isDeleted: false,
    })
        .sort({ createdAt: -1 })
        .limit(500)
        .populate("sender", "_id name email profileImageURL")
        .populate({
            path: "replyTo",
            select: "_id sender encryptedContent messageType attachment isDeleted createdAt",
            populate: { path: "sender", select: "_id name" },
        })
        .populate({
            path: "reactions.users",
            select: "_id name",
        })
        .lean();

    // Decrypt and match query in content or attachment name
    const matches = [];
    for (const msg of rawMessages) {
        const formatted = await formatMessage(msg);
        const textContent = (formatted.content || "").toLowerCase();
        const fileName = (formatted.attachment?.originalName || "").toLowerCase();

        if (textContent.includes(trimmedQuery) || fileName.includes(trimmedQuery)) {
            matches.push(formatted);
            if (matches.length >= 50) break; // Limit to 50 results
        }
    }

    return {
        messages: matches,
        query: query.trim(),
        count: matches.length,
    };
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
    editMessage,
    deleteMessage,
    addReaction,
    removeReaction,
    markConversationRead,
    searchMessages,
    ALLOWED_REACTION_EMOJIS,
};

