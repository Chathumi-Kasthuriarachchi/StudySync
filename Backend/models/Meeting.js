const mongoose = require("mongoose");

const meetingSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, "Meeting title is required"],
            trim: true,
            maxlength: [200, "Meeting title cannot exceed 200 characters"],
        },
        description: {
            type: String,
            trim: true,
            maxlength: [2000, "Description cannot exceed 2000 characters"],
            default: "",
        },
        startTime: {
            type: Date,
            required: [true, "Start time is required"],
        },
        endTime: {
            type: Date,
            required: [true, "End time is required"],
        },
        meetingLink: {
            type: String,
            trim: true,
            maxlength: [500, "Meeting link cannot exceed 500 characters"],
            default: "",
        },
        location: {
            type: String,
            trim: true,
            maxlength: [200, "Location cannot exceed 200 characters"],
            default: "",
        },
        organizer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "Organizer is required"],
        },
        participants: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            default: null,
        },
        status: {
            type: String,
            enum: {
                values: ["SCHEDULED", "COMPLETED", "CANCELLED"],
                message: "{VALUE} is not a valid meeting status",
            },
            default: "SCHEDULED",
        },
    },
    {
        timestamps: true,
    }
);

// Validation: endTime must be after startTime
meetingSchema.pre("validate", function () {
    if (this.startTime && this.endTime) {
        const start = new Date(this.startTime);
        const end = new Date(this.endTime);
        if (end <= start) {
            this.invalidate("endTime", "End time must be after start time");
        }
    }
});

// Compound indexes for fast date-scoped queries
meetingSchema.index({ organizer: 1, startTime: 1 });
meetingSchema.index({ participants: 1, startTime: 1 });
meetingSchema.index({ project: 1, startTime: 1 });
meetingSchema.index({ startTime: 1, endTime: 1 });

module.exports = mongoose.model("Meeting", meetingSchema);
