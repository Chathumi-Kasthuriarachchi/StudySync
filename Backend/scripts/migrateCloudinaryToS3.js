/**
 * migrateCloudinaryToS3.js
 *
 * One-time migration script to move existing Cloudinary profile images to AWS S3.
 *
 * IMPORTANT:
 * - This script does NOT delete Cloudinary assets — it only downloads, re-uploads to S3,
 *   and updates MongoDB references.
 * - Run this AFTER the S3 code migration is live and tested.
 * - Run this manually: node scripts/migrateCloudinaryToS3.js
 * - Review the output carefully before considering any Cloudinary cleanup.
 *
 * Prerequisites:
 * - Backend .env must have valid AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET_NAME
 * - MongoDB must be accessible
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const mongoose = require("mongoose");
const https = require("https");
const http = require("http");
const User = require("../models/User");
const { uploadFile, generatePresignedUrl, buildProfileImageKey } = require("../services/s3Service");

/**
 * Download a file from a URL and return it as a Buffer.
 */
const downloadFile = (url) => {
    return new Promise((resolve, reject) => {
        const client = url.startsWith("https") ? https : http;
        client.get(url, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                // Follow redirect
                return downloadFile(res.headers.location).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`Failed to download: HTTP ${res.statusCode}`));
            }
            const chunks = [];
            res.on("data", (chunk) => chunks.push(chunk));
            res.on("end", () => resolve(Buffer.concat(chunks)));
            res.on("error", reject);
        }).on("error", reject);
    });
};

/**
 * Determine content type from URL or default to image/jpeg.
 */
const getContentTypeFromUrl = (url) => {
    const lower = url.toLowerCase();
    if (lower.includes(".png")) return "image/png";
    if (lower.includes(".webp")) return "image/webp";
    if (lower.includes(".gif")) return "image/gif";
    return "image/jpeg";
};

/**
 * Get file extension from URL or content type.
 */
const getExtensionFromUrl = (url) => {
    const lower = url.toLowerCase();
    if (lower.includes(".png")) return "png";
    if (lower.includes(".webp")) return "webp";
    if (lower.includes(".gif")) return "gif";
    return "jpg";
};

async function migrate() {
    console.log("=== StudySync: Cloudinary → S3 Migration Script ===\n");

    // Validate AWS config
    const requiredVars = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION", "AWS_S3_BUCKET_NAME"];
    const missing = requiredVars.filter((v) => !process.env[v]);
    if (missing.length > 0) {
        console.error(`ABORT: Missing environment variables: ${missing.join(", ")}`);
        process.exit(1);
    }

    // Connect to MongoDB
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB.\n");

    // Find users with Cloudinary URLs (contain "cloudinary" in the URL) that haven't been migrated yet
    const users = await User.find({
        profileImageURL: { $ne: null, $regex: /cloudinary/i },
        $or: [
            { profileImageS3Key: null },
            { profileImageS3Key: { $exists: false } },
        ],
    });

    console.log(`Found ${users.length} user(s) with Cloudinary profile images to migrate.\n`);

    if (users.length === 0) {
        console.log("Nothing to migrate. All profile images are already on S3 or no Cloudinary URLs found.");
        await mongoose.disconnect();
        process.exit(0);
    }

    let successCount = 0;
    let failCount = 0;
    const failures = [];

    for (const user of users) {
        const userId = user._id.toString();
        const cloudinaryUrl = user.profileImageURL;

        console.log(`[${userId}] ${user.name} (${user.email})`);
        console.log(`  Cloudinary URL: ${cloudinaryUrl}`);

        try {
            // 1. Download from Cloudinary
            console.log("  Downloading from Cloudinary...");
            const imageBuffer = await downloadFile(cloudinaryUrl);
            console.log(`  Downloaded ${imageBuffer.length} bytes.`);

            // 2. Determine content type and build S3 key
            const contentType = getContentTypeFromUrl(cloudinaryUrl);
            const ext = getExtensionFromUrl(cloudinaryUrl);
            const s3Key = buildProfileImageKey(userId, `avatar.${ext}`);

            // 3. Upload to S3
            console.log(`  Uploading to S3 as: ${s3Key}`);
            await uploadFile(imageBuffer, s3Key, contentType, {
                migratedFrom: "cloudinary",
                originalUrl: cloudinaryUrl,
            });

            // 4. Generate presigned URL
            const presignedUrl = await generatePresignedUrl(s3Key);

            // 5. Update MongoDB
            user.profileImageS3Key = s3Key;
            user.profileImageURL = presignedUrl;
            await user.save();

            console.log("  ✓ Migration successful.\n");
            successCount++;
        } catch (err) {
            console.error(`  ✗ Migration FAILED: ${err.message}\n`);
            failCount++;
            failures.push({ userId, email: user.email, error: err.message });
        }
    }

    // Summary
    console.log("=== Migration Summary ===");
    console.log(`  Total:     ${users.length}`);
    console.log(`  Success:   ${successCount}`);
    console.log(`  Failed:    ${failCount}`);

    if (failures.length > 0) {
        console.log("\n  Failed users:");
        failures.forEach((f) => {
            console.log(`    - ${f.userId} (${f.email}): ${f.error}`);
        });
    }

    console.log("\nIMPORTANT: Cloudinary assets have NOT been deleted.");
    console.log("Verify the migration before manually removing Cloudinary assets.\n");

    await mongoose.disconnect();
    process.exit(failCount > 0 ? 1 : 0);
}

migrate().catch((err) => {
    console.error("Unhandled migration error:", err);
    process.exit(1);
});
