require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const app = express();

// Connect to Database
connectDB();

// CORS Middleware Configuration
const allowedOrigins = [
    process.env.CLIENT_URL,
    "http://localhost:5173",
    "http://localhost:3000"
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, Postman)
        if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
            return callback(null, true);
        }
        return callback(new Error("CORS policy violation"), false);
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
}));

// Body parser middleware
app.use(express.json());

// Base health check endpoint (Phase 0 Foundation)
app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "API is running"
    });
});

// Root informational endpoint
app.get("/", (req, res) => {
    res.json({ message: "StudyFlow API is active" });
});

// Future API routes (preserved for Phase 1+)
// app.use("/api/auth", require("./routes/authRoutes"));
// app.use("/api/tasks", require("./routes/taskRoutes"));
// app.use("/api/users", require("./routes/userRoutes"));
// app.use("/api/reports", require("./routes/reportRoutes"));

// Global 404 handler for unknown routes
app.use((req, res) => {
    res.status(404).json({ success: false, message: "Route not found" });
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

