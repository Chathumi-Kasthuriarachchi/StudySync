/**
 * testProfileImageS3.js
 *
 * Self-contained end-to-end test of profile image upload, presigned URL
 * verification, refresh, and removal through the running StudySync API.
 *
 * Creates its own test user, runs all tests, then cleans up.
 *
 * Run: node scripts/testProfileImageS3.js
 * Requires: Backend server running on localhost:5000
 */

const dns = require("dns");
try {
    dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
} catch (_) {}

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const mongoose = require("mongoose");
const http = require("http");
const https = require("https");
const User = require("../models/User");
const { generateAccessToken } = require("../services/tokenService");

const BASE_URL = `http://127.0.0.1:${process.env.PORT || 5000}`;

// ── Helper: HTTP request ───────────────────────────────────────────────────
function apiRequest(method, path, options = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const opts = {
            method,
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            headers: { ...options.headers },
        };

        const req = http.request(opts, (res) => {
            const chunks = [];
            res.on("data", (c) => chunks.push(c));
            res.on("end", () => {
                const body = Buffer.concat(chunks).toString("utf8");
                let parsed;
                try { parsed = JSON.parse(body); } catch { parsed = body; }
                resolve({ status: res.statusCode, data: parsed });
            });
        });
        req.on("error", reject);
        if (options.body) {
            if (Buffer.isBuffer(options.body)) {
                req.write(options.body);
            } else {
                req.write(options.body);
            }
        }
        req.end();
    });
}

// ── Helper: Build multipart/form-data for image upload ─────────────────────
function buildMultipart(fieldName, fileName, contentType, buffer) {
    const boundary = "----TestBoundary" + Date.now();
    const crlf = "\r\n";
    let header = "";
    header += `--${boundary}${crlf}`;
    header += `Content-Disposition: form-data; name="${fieldName}"; filename="${fileName}"${crlf}`;
    header += `Content-Type: ${contentType}${crlf}${crlf}`;
    const headerBuf = Buffer.from(header, "utf8");
    const footerBuf = Buffer.from(`${crlf}--${boundary}--${crlf}`, "utf8");
    return {
        body: Buffer.concat([headerBuf, buffer, footerBuf]),
        contentType: `multipart/form-data; boundary=${boundary}`,
    };
}

let testUser = null;
let passed = 0;
let failed = 0;

function assert(condition, label) {
    if (condition) {
        console.log(`   ✓ ${label}`);
        passed++;
    } else {
        console.error(`   ✗ FAIL: ${label}`);
        failed++;
    }
}

async function runTests() {
    console.log("=== StudySync: Profile Image S3 End-to-End Tests ===\n");

    // Connect to MongoDB to create test user
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB.\n");

    // Create a verified test user
    const testEmail = `s3_test_${Date.now()}@studysync.com`;
    testUser = await User.create({
        name: "S3 Test User",
        email: testEmail,
        password: "TestPass123!",
        emailVerified: true,
        termsAccepted: true,
    });
    const token = generateAccessToken(testUser._id, testUser.systemRole);
    const authHeaders = { Authorization: `Bearer ${token}` };
    console.log(`Created test user: ${testEmail} (ID: ${testUser._id})\n`);

    // 1. Server health check
    console.log("1. Server Health Check");
    const health = await apiRequest("GET", "/api/health");
    assert(health.data?.success === true, "Server is healthy");
    console.log();

    // 2. Get profile - no image yet
    console.log("2. Get Profile (no image)");
    const profile1 = await apiRequest("GET", "/api/users/profile", { headers: authHeaders });
    assert(profile1.data?.success === true, "Profile fetched successfully");
    assert(profile1.data?.data?.user?.profileImageURL === null, "profileImageURL is null");
    console.log();

    // 3. Upload profile image
    console.log("3. Upload Profile Image");
    const redPixelPng = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/58BAwAI/AL+H1kN4gAAAABJRU5ErkJggg==",
        "base64"
    );
    const multipart = buildMultipart("image", "test_avatar.png", "image/png", redPixelPng);
    const uploadRes = await apiRequest("POST", "/api/users/profile-image", {
        headers: { ...authHeaders, "Content-Type": multipart.contentType },
        body: multipart.body,
    });
    assert(uploadRes.data?.success === true, "Upload returns success");
    assert(!!uploadRes.data?.data?.profileImageURL, "presigned URL returned");
    assert(uploadRes.data?.data?.profileImageURL?.includes("s3"), "URL contains 's3' (S3 presigned URL)");
    const uploadedUrl = uploadRes.data?.data?.profileImageURL;
    console.log();

    // 4. Verify the presigned URL is accessible
    console.log("4. Verify Presigned URL Accessibility");
    if (uploadedUrl) {
        try {
            const httpStatus = await new Promise((resolve, reject) => {
                https.get(uploadedUrl, (res) => {
                    resolve(res.statusCode);
                    res.resume();
                }).on("error", reject);
            });
            assert(httpStatus === 200, `Presigned URL returned HTTP ${httpStatus}`);
        } catch (err) {
            assert(false, `Presigned URL access error: ${err.message}`);
        }
    } else {
        assert(false, "No URL to verify");
    }
    console.log();

    // 5. Check MongoDB has both profileImageURL and profileImageS3Key
    console.log("5. Verify MongoDB Fields");
    const dbUser = await User.findById(testUser._id);
    assert(!!dbUser.profileImageURL, "profileImageURL saved in DB");
    assert(!!dbUser.profileImageS3Key, "profileImageS3Key saved in DB");
    assert(dbUser.profileImageS3Key.startsWith("studysync/users/"), "S3 key has correct prefix");
    assert(dbUser.profileImageS3Key.includes("/profile/avatar_"), "S3 key has correct structure");
    console.log(`   S3 Key: ${dbUser.profileImageS3Key}`);
    console.log();

    // 6. Test presigned URL refresh endpoint
    console.log("6. Refresh Presigned URL");
    const refreshRes = await apiRequest("GET", "/api/users/profile-image-url", { headers: authHeaders });
    assert(refreshRes.data?.success === true, "Refresh returns success");
    assert(!!refreshRes.data?.data?.profileImageURL, "Refreshed URL returned");
    console.log();

    // 7. Upload a replacement image (should delete old S3 object)
    console.log("7. Replace Profile Image");
    const bluePixelPng = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "base64"
    );
    const multipart2 = buildMultipart("image", "new_avatar.png", "image/png", bluePixelPng);
    const upload2Res = await apiRequest("POST", "/api/users/profile-image", {
        headers: { ...authHeaders, "Content-Type": multipart2.contentType },
        body: multipart2.body,
    });
    assert(upload2Res.data?.success === true, "Replacement upload returns success");
    const dbUser2 = await User.findById(testUser._id);
    assert(dbUser2.profileImageS3Key !== dbUser.profileImageS3Key, "S3 key changed after replacement");
    console.log(`   New S3 Key: ${dbUser2.profileImageS3Key}`);
    console.log();

    // 8. Test invalid file type
    console.log("8. Reject Invalid File Type");
    const fakeExe = Buffer.from("MZ fake executable content");
    const badMultipart = buildMultipart("image", "malware.exe", "application/x-msdownload", fakeExe);
    const badRes = await apiRequest("POST", "/api/users/profile-image", {
        headers: { ...authHeaders, "Content-Type": badMultipart.contentType },
        body: badMultipart.body,
    });
    assert(badRes.status === 400, `Invalid file type rejected with HTTP ${badRes.status}`);
    console.log();

    // 9. Test unauthenticated access
    console.log("9. Reject Unauthenticated Upload");
    const unauthRes = await apiRequest("POST", "/api/users/profile-image", {
        headers: { "Content-Type": multipart.contentType },
        body: multipart.body,
    });
    assert(unauthRes.status === 401, `Unauthenticated upload rejected with HTTP ${unauthRes.status}`);
    console.log();

    // 10. Remove profile image
    console.log("10. Remove Profile Image");
    const removeRes = await apiRequest("DELETE", "/api/users/profile-image", { headers: authHeaders });
    assert(removeRes.data?.success === true, "Remove returns success");
    assert(removeRes.data?.data?.profileImageURL === null, "profileImageURL is null after removal");
    const dbUser3 = await User.findById(testUser._id);
    assert(dbUser3.profileImageURL === null, "DB profileImageURL is null");
    assert(dbUser3.profileImageS3Key === null, "DB profileImageS3Key is null");
    console.log();

    // 11. Refresh with no image (should return null gracefully)
    console.log("11. Refresh When No Image Exists");
    const refreshEmpty = await apiRequest("GET", "/api/users/profile-image-url", { headers: authHeaders });
    assert(refreshEmpty.data?.success === true, "Refresh with no image returns success");
    assert(refreshEmpty.data?.data?.profileImageURL === null, "Returns null URL");
    console.log();
}

async function cleanup() {
    if (testUser) {
        await User.findByIdAndDelete(testUser._id);
        console.log("Cleaned up test user.\n");
    }
    await mongoose.disconnect();
}

async function main() {
    try {
        await runTests();
    } catch (err) {
        console.error("\nUnexpected test error:", err.message || err);
        failed++;
    } finally {
        await cleanup();
    }

    console.log("=== Test Results ===");
    console.log(`   Passed: ${passed}`);
    console.log(`   Failed: ${failed}`);
    console.log();

    if (failed === 0) {
        console.log(">>> ALL PROFILE IMAGE S3 TESTS PASSED! <<<");
    } else {
        console.error(`>>> ${failed} TEST(S) FAILED <<<`);
    }
    process.exit(failed > 0 ? 1 : 0);
}

main();
