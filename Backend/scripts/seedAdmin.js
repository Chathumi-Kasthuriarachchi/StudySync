require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const mongoose = require("mongoose");
const User = require("../models/User");

const seedAdmin = async () => {
    try {
        const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
        if (!mongoUri) {
            console.error("Error: MONGO_URI not found in environment variables");
            process.exit(1);
        }

        await mongoose.connect(mongoUri);
        console.log("Connected to MongoDB for admin seeding...");

        const adminEmail = process.env.INITIAL_ADMIN_EMAIL || "admin@studysync.com";
        const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || "Admin123!";
        const adminName = "System Administrator";

        let adminUser = await User.findOne({ email: adminEmail });

        if (adminUser) {
            console.log(`Admin account (${adminEmail}) already exists.`);
            if (adminUser.systemRole !== "ADMIN") {
                adminUser.systemRole = "ADMIN";
                await adminUser.save();
                console.log(`Promoted existing user to systemRole: ADMIN`);
            }
        } else {
            adminUser = await User.create({
                name: adminName,
                email: adminEmail,
                password: adminPassword, // Will be hashed by pre('save') hook
                systemRole: "ADMIN",
            });
            console.log(`Created new ADMIN user: ${adminEmail}`);
        }

        console.log("-----------------------------------------");
        console.log("ADMIN Credentials for Testing:");
        console.log(`Email:    ${adminEmail}`);
        console.log(`Password: ${adminPassword}`);
        console.log(`Role:     ${adminUser.systemRole}`);
        console.log("-----------------------------------------");

        await mongoose.disconnect();
        console.log("MongoDB disconnected. Admin seed complete.");
        process.exit(0);
    } catch (error) {
        console.error("Admin seeding failed:", error);
        process.exit(1);
    }
};

seedAdmin();
