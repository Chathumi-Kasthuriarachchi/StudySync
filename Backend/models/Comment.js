const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
    {
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
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "Author reference is required"],
        },
        content: {
            type: String,
            required: [true, "Comment content cannot be empty"],
            trim: true,
            maxlength: [2000, "Comment cannot exceed 2000 characters"],
        },
    },
    {
        timestamps: true,
    }
);

commentSchema.index({ task: 1, createdAt: 1 });

module.exports = mongoose.model("Comment", commentSchema);
