const mongoose = require("mongoose");

/**
 * Conversation Model — Phase 15
 *
 * Supports two conversation types:
 * - PROJECT: One per project, participants = project members
 * - DIRECT: Exactly two users, deduplicated
 */
const ConversationSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: {
                values: ["PROJECT", "DIRECT"],
                message: "{VALUE} is not a valid conversation type",
            },
            required: [true, "Conversation type is required"],
        },
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            default: null,
        },
        participants: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],
        lastMessage: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Message",
            default: null,
        },
        lastMessageAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// One project conversation per project (sparse: ignores nulls for DIRECT type)
ConversationSchema.index({ project: 1 }, { unique: true, sparse: true });

// Efficiently find conversations a user participates in
ConversationSchema.index({ participants: 1 });

// Sort conversations by most recent activity
ConversationSchema.index({ type: 1, lastMessageAt: -1 });

module.exports = mongoose.model("Conversation", ConversationSchema);
