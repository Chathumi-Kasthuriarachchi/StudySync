const mongoose = require("mongoose");
const { NOTIFICATION_TYPES, SOURCE_TYPES } = require("../constants/notificationConstants");

/**
 * Notification Model — Phase 11
 *
 * Dedicated collection for in-app notifications.
 * Architected to be delivery-channel agnostic so email/push can be added later.
 */
const notificationSchema = new mongoose.Schema(
    {
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "Recipient is required"],
            index: true,
        },
        type: {
            type: String,
            enum: {
                values: Object.values(NOTIFICATION_TYPES),
                message: "{VALUE} is not a valid notification type",
            },
            required: [true, "Notification type is required"],
            index: true,
        },
        title: {
            type: String,
            required: [true, "Notification title is required"],
            trim: true,
            maxlength: [200, "Title cannot exceed 200 characters"],
        },
        message: {
            type: String,
            required: [true, "Notification message is required"],
            trim: true,
            maxlength: [1000, "Message cannot exceed 1000 characters"],
        },
        sourceType: {
            type: String,
            enum: {
                values: Object.values(SOURCE_TYPES),
                message: "{VALUE} is not a valid source type",
            },
            required: [true, "Source type is required"],
        },
        sourceId: {
            type: mongoose.Schema.Types.ObjectId,
            required: [true, "Source reference ID is required"],
        },
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            default: null,
            index: true,
        },
        isRead: {
            type: Boolean,
            default: false,
            index: true,
        },
        readAt: {
            type: Date,
            default: null,
        },
        eventKey: {
            type: String,
            default: null,
            index: true, // Used for deterministic duplicate prevention (e.g. TASK_OVERDUE:taskId:YYYY-MM-DD)
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
    },
    {
        timestamps: true,
    }
);

// Compound indexes for optimal query performance
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ recipient: 1, eventKey: 1 });
notificationSchema.index({ sourceType: 1, sourceId: 1 });

module.exports = mongoose.model("Notification", notificationSchema);
