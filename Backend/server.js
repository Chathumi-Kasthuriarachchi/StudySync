require("dotenv").config();
const http = require("http");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const connectDB = require("./config/db");
const socketService = require("./services/socketService");
const { securityHeaders } = require("./middleware/securityMiddleware");

const authRoutes = require("./routes/authRoutes");
const projectRoutes = require("./routes/projectRoutes");
const taskRoutes = require("./routes/taskRoutes");
const userRoutes = require("./routes/userRoutes");
const reportRoutes = require("./routes/reportRoutes");
const meetingRoutes = require("./routes/meetingRoutes");
const calendarRoutes = require("./routes/calendarRoutes");
const timeRoutes = require("./routes/timeRoutes");
const goalRoutes = require("./routes/goalRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const chatRoutes = require("./routes/chatRoutes");

const app = express();

// Connect to Database
connectDB();

// Phase 21: Security headers (Helmet) — applied before all other middleware
app.use(securityHeaders);

// CORS Middleware Configuration
// credentials: true is required for HttpOnly cookies to be sent cross-origin
const isProduction = process.env.NODE_ENV === "production";
const allowedOrigins = isProduction
    ? [process.env.CLIENT_URL].filter(Boolean)
    : [
          process.env.CLIENT_URL,
          "http://localhost:5173",
          "http://localhost:3000",
          "http://localhost:5174",
          "http://127.0.0.1:5173",
          "http://127.0.0.1:5174",
      ].filter(Boolean);

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
                return callback(null, true);
            }
            return callback(new Error("CORS policy violation"), false);
        },
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true, // Required for HttpOnly cookie refresh tokens
    })
);

// Body parser middleware — Phase 21: limit payload size to prevent abuse
app.use(express.json({ limit: "1mb" }));

// Cookie parser — required to read HttpOnly refresh token cookies
app.use(cookieParser());

// Health check endpoint
app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "API is running",
        environment: process.env.NODE_ENV || "development",
    });
});

// Root informational endpoint
app.get("/", (req, res) => {
    res.json({ message: "StudySync API is active" });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/users", userRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/time", timeRoutes);
app.use("/api/goals", goalRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/chat", chatRoutes);

// Global 404 handler for unknown routes
app.use((req, res) => {
    res.status(404).json({ success: false, message: "Route not found" });
});

// Global Error Handling Middleware — Phase 21: sanitized for production
app.use((err, req, res, next) => {
    // Log full error server-side for debugging
    if (process.env.NODE_ENV !== "production") {
        console.error("Global Server Error:", err.stack);
    } else {
        console.error("Global Server Error:", err.message);
    }

    // Never expose stack traces or internal details to clients in production
    const statusCode = err.status || err.statusCode || 500;
    res.status(statusCode).json({
        success: false,
        message: process.env.NODE_ENV === "production"
            ? "Internal Server Error"
            : err.message || "Internal Server Error",
    });
});

// Create HTTP Server & Initialize Socket.IO
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
socketService.init(server, allowedOrigins);

// Start Server
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT} [${process.env.NODE_ENV || "development"}]`);
});
