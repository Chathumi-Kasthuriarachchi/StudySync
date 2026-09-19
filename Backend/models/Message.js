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
                    return (v && v.trim().length > 0) || (this.attachment && this.attachment.storageKey);
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
    },
    {
        timestamps: true,
    }
);

// Primary query pattern: fetch messages for a conversation, sorted by newest
MessageSchema.index({ conversation: 1, createdAt: -1 });

// Optional: lookup messages by sender
MessageSchema.index({ sender: 1 });

module.exports = mongoose.model("Message", MessageSchema);
