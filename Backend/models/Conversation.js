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
        // Phase 19: Per-user read tracking for unread counts and delivery status
        readState: [
            {
                user: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                },
                lastReadAt: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],
    },
    {
        timestamps: true,
    }
);

// One project conversation per project (partialFilterExpression: only applies when type is PROJECT)
ConversationSchema.index(
    { project: 1 },
    { unique: true, partialFilterExpression: { type: "PROJECT" } }
);

// Efficiently find conversations a user participates in
ConversationSchema.index({ participants: 1 });

// Sort conversations by most recent activity
ConversationSchema.index({ type: 1, lastMessageAt: -1 });

// Lookup read states by user
ConversationSchema.index({ "readState.user": 1 });

module.exports = mongoose.model("Conversation", ConversationSchema);
