const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        const connUri = process.env.MONGO_URI || process.env.MONGODB_URI;
        if (!connUri) {
            throw new Error("MongoDB connection URI not found in environment variables");
        }
        const conn = await mongoose.connect(connUri);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error("Error connecting to MongoDB:", error.message);
        process.exit(1);
    }
};

module.exports = connectDB;

