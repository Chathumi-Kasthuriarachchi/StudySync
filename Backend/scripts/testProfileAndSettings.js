require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const mongoose = require("mongoose");
const User = require("../models/User");
const { formatUserResponse } = require("../controllers/userController");

async function runTests() {
    console.log("=== Testing Profile & Settings Data Model & Controllers ===");
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

    if (!mongoUri) {
        console.error("FAIL: MONGO_URI missing in .env");
        process.exit(1);
    }

    try {
        await mongoose.connect(mongoUri);
        console.log("Connected to MongoDB successfully.");

        const testEmail1 = `profile_user1_${Date.now()}@studysync.com`;
        const testEmail2 = `profile_user2_${Date.now()}@studysync.com`;
        const testUsername = `user_${Date.now().toString().slice(-6)}`;

        // 1. Create a test user with default preferences
        console.log("\n1. Testing user creation with preferences and profile fields...");
        const user1 = await User.create({
            name: "Alex Profile Test",
            email: testEmail1,
            password: "Password123!",
            termsAccepted: true,
            emailVerified: true,
            username: testUsername,
            bio: "Building amazing things with StudySync!",
            preferences: {
                theme: "dark",
                language: "en",
                emailNotifications: false,
            },
        });

        console.log("User 1 created successfully with ID:", user1._id);
        console.log("- Username:", user1.username);
        console.log("- Bio:", user1.bio);
        console.log("- Preferences:", user1.preferences);

        // 2. Verify formatUserResponse
        console.log("\n2. Testing formatUserResponse serializer...");
        const formatted = formatUserResponse(user1);
        if (
            formatted.name === "Alex Profile Test" &&
            formatted.username === testUsername &&
            formatted.preferences.theme === "dark" &&
            formatted.preferences.emailNotifications === false &&
            !formatted.password
        ) {
            console.log("formatUserResponse returned sanitized, complete profile object!");
        } else {
            throw new Error("formatUserResponse validation failed");
        }

        // 3. Test duplicate username uniqueness
        console.log("\n3. Testing duplicate username rejection...");
        let duplicateCaught = false;
        try {
            await User.create({
                name: "Alex Duplicate",
                email: testEmail2,
                password: "Password123!",
                termsAccepted: true,
                username: testUsername, // Same username!
            });
        } catch (err) {
            duplicateCaught = true;
            console.log("Caught expected duplicate key error (E11000):", err.message);
        }

        if (!duplicateCaught) {
            throw new Error("FAIL: Duplicate username was allowed!");
        }

        // 4. Test invalid theme enum validation
        console.log("\n4. Testing invalid theme enum validation...");
        let themeErrorCaught = false;
        try {
            await User.create({
                name: "Alex Bad Theme",
                email: `bad_theme_${Date.now()}@studysync.com`,
                password: "Password123!",
                termsAccepted: true,
                preferences: {
                    theme: "neon-pink", // Invalid theme
                },
            });
        } catch (err) {
            themeErrorCaught = true;
            console.log("Caught expected invalid theme enum error:", err.message);
        }

        if (!themeErrorCaught) {
            throw new Error("FAIL: Invalid theme was allowed!");
        }

        // 5. Clean up test users
        console.log("\n5. Cleaning up test accounts...");
        await User.deleteMany({ email: { $in: [testEmail1, testEmail2] } });
        console.log("Test accounts cleaned up.");

        console.log("\n>>> ALL PROFILE & CORE SETTINGS TESTS PASSED SUCCESSFULLY! <<<");
        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error("Test failed with error:", err);
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
        process.exit(1);
    }
}

runTests();
