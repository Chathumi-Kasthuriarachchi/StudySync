const mongoose = require("mongoose");

/**
 * TimeSession Model — Phase 9
 *
 * Represents an individual continuous work/focus session for a task.
 * Total actual time spent on a task is aggregated from completed sessions.
 * Timestamps and duration are calculated and persisted server-side.
 */
const timeSessionSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "User reference is required"],
            index: true,
        },
        task: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Task",
            required: [true, "Task reference is required"],
            index: true,
        },
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            default: null,
            index: true,
        },
        startedAt: {
            type: Date,
            required: [true, "Start time is required"],
        },
        endedAt: {
            type: Date,
            default: null,
        },
        durationSeconds: {
            type: Number,
            default: 0,
            min: [0, "Duration cannot be negative"],
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for high-frequency queries:
// 1. Finding a user's active session (endedAt: null) — single active timer rule
timeSessionSchema.index({ user: 1, endedAt: 1 });
// 2. Fetching all sessions for a specific task
timeSessionSchema.index({ task: 1, endedAt: 1 });
// 3. User daily session logs ordered by time
timeSessionSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("TimeSession", timeSessionSchema);
