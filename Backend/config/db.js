const mongoose = require("mongoose");
const dns = require("dns");

// Ensure reliable DNS resolution for MongoDB Atlas SRV records on Windows networks
try {
    dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
} catch (_) {}

const connectDB = async () => {
    try {
        const connUri = process.env.MONGO_URI || process.env.MONGODB_URI;
        if (!connUri) {
            throw new Error("MongoDB connection URI not found in environment variables");
        }
        const conn = await mongoose.connect(connUri, {
            // Allows connection when local Windows security suites or antivirus intercept TLS certificates
            tlsAllowInvalidCertificates: true,
        });
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error("Error connecting to MongoDB:", error.message);
        process.exit(1);
    }
};

module.exports = connectDB;

