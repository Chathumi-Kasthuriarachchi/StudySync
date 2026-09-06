const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Name is required"],
            trim: true,
            maxlength: [50, "Name cannot exceed 50 characters"],
        },
        email: {
            type: String,
            required: [true, "Email is required"],
            unique: true,
            lowercase: true,
            trim: true,
            match: [
                /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
                "Please provide a valid email address",
            ],
        },
        password: {
            type: String,
            required: [true, "Password is required"],
            minlength: [6, "Password must be at least 6 characters long"],
            select: true, // Selected by default for auth checks, stripped in toJSON
        },
        systemRole: {
            type: String,
            enum: {
                values: ["ADMIN", "USER"],
                message: "{VALUE} is not a valid system role",
            },
            default: "USER",
        },
        profileImageURL: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: true,
        toJSON: {
            transform: function (doc, ret) {
                delete ret.password;
                delete ret.__v;
                return ret;
            },
        },
        toObject: {
            transform: function (doc, ret) {
                delete ret.password;
                delete ret.__v;
                return ret;
            },
        },
    }
);

/**
 * Pre-save Middleware: Hash Password
 * 
 * Why this hook exists:
 * Ensures passwords are automatically hashed with a strong salt (10 rounds) before
 * being persisted to MongoDB. If a user's details are updated without touching the
 * password, the hash is untouched.
 */
UserSchema.pre("save", async function () {
    if (!this.isModified("password")) {
        return;
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});


/**
 * Compare Password Instance Method
 * 
 * Securely checks plaintext password against stored bcrypt hash using constant-time comparison.
 */
UserSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", UserSchema);