const User = require("../models/User");
const jwt = require("jsonwebtoken");

/**
 * Generate JWT Token Helper
 * 
 * Token contains minimal, non-sensitive payload needed for authorization:
 * - user ID (for querying the user)
 * - systemRole (for fast role verification)
 */
const generateToken = (id, systemRole) => {
    return jwt.sign(
        { id, systemRole },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
    );
};

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // 1. Validation: required fields
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Please provide name, email, and password",
            });
        }

        // 2. Validation: password strength
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters long",
            });
        }

        // 3. Validation: email uniqueness
        const userExists = await User.findOne({ email: email.toLowerCase().trim() });
        if (userExists) {
            return res.status(400).json({
                success: false,
                message: "A user with this email already exists",
            });
        }

        // 4. Create User: System Role is STRICTLY set to 'USER' on registration
        // (Client request body can NEVER assign ADMIN status)
        const user = await User.create({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            password, // Will be hashed automatically by UserSchema.pre('save')
            systemRole: "USER",
        });

        // 5. Generate authentication token
        const token = generateToken(user._id, user.systemRole);

        return res.status(201).json({
            success: true,
            message: "Registration successful",
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    systemRole: user.systemRole,
                    createdAt: user.createdAt,
                },
                token,
            },
        });
    } catch (error) {
        console.error("Register Controller Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error during registration",
            error: error.message,
        });
    }
};

/**
 * @desc    Authenticate user & get token
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Validation: check presence
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Please provide email and password",
            });
        }

        // 2. Lookup user by email (case-insensitive)
        const user = await User.findOne({ email: email.toLowerCase().trim() });

        // 3. Verify user existence and password comparison via bcrypt
        if (!user || !(await user.matchPassword(password))) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        // 4. Generate token
        const token = generateToken(user._id, user.systemRole);

        return res.status(200).json({
            success: true,
            message: "Login successful",
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    systemRole: user.systemRole,
                    createdAt: user.createdAt,
                },
                token,
            },
        });
    } catch (error) {
        console.error("Login Controller Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error during login",
            error: error.message,
        });
    }
};

/**
 * @desc    Get currently authenticated user profile
 * @route   GET /api/auth/me
 * @access  Private (Requires valid JWT)
 */
const getMe = async (req, res) => {
    try {
        // req.user was populated by `protect` middleware
        return res.status(200).json({
            success: true,
            data: {
                user: {
                    id: req.user._id,
                    name: req.user.name,
                    email: req.user.email,
                    systemRole: req.user.systemRole,
                    createdAt: req.user.createdAt,
                    profileImageURL: req.user.profileImageURL,
                },
            },
        });
    } catch (error) {
        console.error("GetMe Controller Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error retrieving profile",
            error: error.message,
        });
    }
};

/**
 * @desc    Verify Admin Authorization
 * @route   GET /api/auth/admin-check
 * @access  Private (Requires systemRole === 'ADMIN')
 */
const checkAdmin = async (req, res) => {
    return res.status(200).json({
        success: true,
        message: "Admin authorization verified successfully",
        data: {
            admin: {
                id: req.user._id,
                name: req.user.name,
                email: req.user.email,
                systemRole: req.user.systemRole,
            },
        },
    });
};

/**
 * @desc    Update user profile
 * @route   PUT /api/auth/profile
 * @access  Private
 */
const updateProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (req.body.name) user.name = req.body.name.trim();
        if (req.body.password) user.password = req.body.password; // Triggers pre('save') hash

        await user.save();

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    systemRole: user.systemRole,
                },
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server error updating profile",
            error: error.message,
        });
    }
};

module.exports = {
    register,
    login,
    getMe,
    getUserProfile: getMe, // backward compatibility
    checkAdmin,
    updateProfile,
};