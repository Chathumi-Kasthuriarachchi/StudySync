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
            required: [true, "Message content is required"],
        },
        messageType: {
            type: String,
            enum: {
                values: ["TEXT"],
                message: "{VALUE} is not a valid message type",
            },
            default: "TEXT",
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
