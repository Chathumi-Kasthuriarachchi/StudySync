const mongoose = require("mongoose");

/**
 * Message Model — Phase 15
 *
 * Stores chat messages with encrypted content (AES-256-GCM).
 * The `encryptedContent` field contains the ciphertext — never plaintext.
 *
 * Phase 15 supports only TEXT messages.
 */
const MessageSchema = new mongoose.Schema(
    {
        conversation: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Conversation",
            required: [true, "Conversation reference is required"],
        },
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "Sender is required"],
        },
        encryptedContent: {
            type: String,
            default: null,
            validate: {
                validator: function (v) {
                    return (
                        (v && v.trim().length > 0) ||
                        (this.attachment && this.attachment.storageKey) ||
                        this.isDeleted
                    );
                },
                message: "Message must have either text content or an attachment",
            },
        },
        messageType: {
            type: String,
            enum: {
                values: ["TEXT", "IMAGE", "FILE", "VIDEO", "AUDIO"],
                message: "{VALUE} is not a valid message type",
            },
            default: "TEXT",
        },
        attachment: {
            originalName: { type: String },
            storageKey: { type: String },
            mimeType: { type: String },
            size: { type: Number },
            uploadedAt: { type: Date, default: Date.now },
        },
        // Phase 19: Reply relationship
        replyTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Message",
            default: null,
        },
        // Phase 19: Edit tracking
        isEdited: {
            type: Boolean,
            default: false,
        },
        editedAt: {
            type: Date,
            default: null,
        },
        // Phase 19: Soft deletion
        isDeleted: {
            type: Boolean,
            default: false,
        },
        deletedAt: {
            type: Date,
            default: null,
        },
        // Phase 19: Reactions (grouped by emoji with user list)
        reactions: [
            {
                emoji: {
                    type: String,
                    required: true,
                },
                users: [
                    {
                        type: mongoose.Schema.Types.ObjectId,
                        ref: "User",
                    },
                ],
                count: {
                    type: Number,
                    default: 0,
                },
            },
        ],
        // Phase 19: Delivery and read tracking
        deliveryStatus: {
            type: String,
            enum: ["SENT", "DELIVERED", "READ"],
            default: "SENT",
        },
        readBy: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],
    },
    {
        timestamps: true,
    }
);

// Primary query pattern: fetch messages for a conversation, sorted by newest
MessageSchema.index({ conversation: 1, createdAt: -1 });

// Lookup messages by sender
MessageSchema.index({ sender: 1 });

// Lookup replies
MessageSchema.index({ conversation: 1, replyTo: 1 });

module.exports = mongoose.model("Message", MessageSchema);
