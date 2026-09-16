require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const mongoose = require("mongoose");
const User = require("../models/User");
const { generateAccessToken } = require("../services/tokenService");

async function testEndpoints() {
    console.log("=== Testing Profile & Settings HTTP API Endpoints ===");
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    const baseURL = "http://localhost:5000";

    await mongoose.connect(mongoUri);

    const testEmail = `api_test_${Date.now()}@studysync.com`;
    const initialUsername = `handle_${Date.now().toString().slice(-6)}`;

    // Create a verified user for API testing
    const testUser = await User.create({
        name: "Endpoint Test User",
        email: testEmail,
        password: "Password123!",
        emailVerified: true,
        termsAccepted: true,
        username: initialUsername,
        bio: "Initial test bio",
        preferences: {
            theme: "system",
            language: "en",
            emailNotifications: true,
        },
    });

    const token = generateAccessToken(testUser._id, testUser.systemRole);
    const authHeaders = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
    };

    try {
        // 1. Unauthenticated request to /api/users/profile
        console.log("\n1. Testing unauthenticated GET /api/users/profile...");
        const unauthRes = await fetch(`${baseURL}/api/users/profile`);
        if (unauthRes.status === 401) {
            console.log("Passed: Unauthenticated access blocked with 401 Unauthorized.");
        } else {
            throw new Error(`Expected 401, got ${unauthRes.status}`);
        }

        // 2. Authenticated GET /api/users/profile
        console.log("\n2. Testing authenticated GET /api/users/profile...");
        const getRes = await fetch(`${baseURL}/api/users/profile`, { headers: authHeaders });
        const getData = await getRes.json();
        if (getRes.status === 200 && getData.success && getData.data?.user?.email === testEmail) {
            console.log("Passed: Retrieved user profile successfully:");
            console.log("- Name:", getData.data.user.name);
            console.log("- Username:", getData.data.user.username);
            console.log("- SystemRole:", getData.data.user.systemRole);
            console.log("- Preferences:", getData.data.user.preferences);
        } else {
            throw new Error(`GET profile failed: ${JSON.stringify(getData)}`);
        }

        // 3. Authenticated PUT /api/users/profile (update name, username, bio)
        console.log("\n3. Testing authenticated PUT /api/users/profile...");
        const updatedUsername = `new_${initialUsername}`;
        const putProfileRes = await fetch(`${baseURL}/api/users/profile`, {
            method: "PUT",
            headers: authHeaders,
            body: JSON.stringify({
                name: "Updated Name User",
                username: updatedUsername,
                bio: "Updated bio through API",
            }),
        });
        const putProfileData = await putProfileRes.json();
        if (
            putProfileRes.status === 200 &&
            putProfileData.success &&
            putProfileData.data?.user?.username === updatedUsername &&
            putProfileData.data?.user?.name === "Updated Name User"
        ) {
            console.log("Passed: Updated profile successfully.");
        } else {
            throw new Error(`PUT profile failed: ${JSON.stringify(putProfileData)}`);
        }

        // 4. Authenticated PUT /api/users/preferences (theme, language, emailNotifications)
        console.log("\n4. Testing authenticated PUT /api/users/preferences...");
        const putPrefRes = await fetch(`${baseURL}/api/users/preferences`, {
            method: "PUT",
            headers: authHeaders,
            body: JSON.stringify({
                theme: "dark",
                language: "en-GB",
                emailNotifications: false,
            }),
        });
        const putPrefData = await putPrefRes.json();
        if (
            putPrefRes.status === 200 &&
            putPrefData.success &&
            putPrefData.data?.preferences?.theme === "dark" &&
            putPrefData.data?.preferences?.language === "en-GB" &&
            putPrefData.data?.preferences?.emailNotifications === false
        ) {
            console.log("Passed: Updated preferences successfully:", putPrefData.data.preferences);
        } else {
            throw new Error(`PUT preferences failed: ${JSON.stringify(putPrefData)}`);
        }

        // 5. Test invalid preference rejection
        console.log("\n5. Testing invalid preference rejection (PUT /api/users/preferences)...");
        const invalidPrefRes = await fetch(`${baseURL}/api/users/preferences`, {
            method: "PUT",
            headers: authHeaders,
            body: JSON.stringify({
                theme: "invalid_theme_value",
            }),
        });
        if (invalidPrefRes.status === 400) {
            console.log("Passed: Invalid theme rejected with 400 Bad Request.");
        } else {
            throw new Error(`Expected 400 for invalid theme, got ${invalidPrefRes.status}`);
        }

        console.log("\n>>> ALL PROFILE & SETTINGS HTTP API TESTS PASSED! <<<");
    } finally {
        await User.deleteOne({ _id: testUser._id });
        console.log("Cleaned up API test user.");
        await mongoose.disconnect();
    }
}

testEndpoints()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Endpoint test failed:", err);
        process.exit(1);
    });
