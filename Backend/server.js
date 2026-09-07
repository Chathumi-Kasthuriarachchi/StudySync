require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const taskRoutes = require("./routes/taskRoutes");
const userRoutes = require("./routes/userRoutes");
const reportRoutes = require("./routes/reportRoutes");

const app = express();

// Connect to Database
connectDB();

// CORS Middleware Configuration
const allowedOrigins = [
    process.env.CLIENT_URL,
    "http://localhost:5173",
    "http://localhost:3000",
].filter(Boolean);

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
                return callback(null, true);
            }
            return callback(new Error("CORS policy violation"), false);
        },
        methods: ["GET", "POST", "PUT", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true,
    })
);

// Body parser middleware
app.use(express.json());

// Health check endpoint
app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "API is running",
    });
});

// Root informational endpoint
app.get("/", (req, res) => {
    res.json({ message: "StudySync API is active" });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/users", userRoutes);
app.use("/api/reports", reportRoutes);

// Global 404 handler for unknown routes
app.use((req, res) => {
    res.status(404).json({ success: false, message: "Route not found" });
});

// Global Error Handling Middleware
app.use((err, req, res, next) => {
    console.error("Global Server Error:", err.stack);
    res.status(500).json({
        success: false,
        message: err.message || "Internal Server Error",
    });
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
