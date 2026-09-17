/**
 * testS3Integration.js
 *
 * Tests the S3 service directly to verify AWS connectivity
 * and all core S3 operations (upload, metadata, presigned URL, delete).
 *
 * Run: node scripts/testS3Integration.js
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const {
    uploadFile,
    deleteFile,
    generatePresignedUrl,
    getFileMetadata,
    buildProfileImageKey,
} = require("../services/s3Service");

async function runTest() {
    console.log("=== Testing AWS S3 Integration ===");
    console.log(`Region: ${process.env.AWS_REGION}`);
    console.log(`Bucket: ${process.env.AWS_S3_BUCKET_NAME}`);
    console.log(`Access Key: ${process.env.AWS_ACCESS_KEY_ID ? "Present (ends in " + process.env.AWS_ACCESS_KEY_ID.slice(-4) + ")" : "MISSING"}`);
    console.log();

    // Validate env vars
    const required = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION", "AWS_S3_BUCKET_NAME"];
    const missing = required.filter((v) => !process.env[v]);
    if (missing.length > 0) {
        console.error(`FAIL: Missing environment variables: ${missing.join(", ")}`);
        process.exit(1);
    }

    try {
        // 1. Build a test S3 key
        const testUserId = "test_user_migration_check";
        const s3Key = buildProfileImageKey(testUserId, "test.png");
        console.log(`1. Generated S3 key: ${s3Key}`);

        // 2. Upload a 1x1 transparent PNG buffer
        console.log("2. Uploading test image to S3...");
        const sampleBase64Png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
        const testBuffer = Buffer.from(sampleBase64Png, "base64");

        const uploadResult = await uploadFile(testBuffer, s3Key, "image/png", {
            purpose: "integration_test",
        });
        console.log("   Upload SUCCESS!");
        console.log(`   - S3 Key: ${uploadResult.s3Key}`);
        console.log(`   - Bucket: ${uploadResult.bucket}`);
        console.log(`   - Region: ${uploadResult.region}`);

        // 3. Check metadata
        console.log("3. Checking file metadata...");
        const metadata = await getFileMetadata(s3Key);
        if (metadata) {
            console.log(`   - Content Type: ${metadata.contentType}`);
            console.log(`   - Content Length: ${metadata.contentLength} bytes`);
            console.log(`   - Last Modified: ${metadata.lastModified}`);
        } else {
            console.error("   FAIL: File metadata returned null!");
            process.exit(1);
        }

        // 4. Generate presigned URL
        console.log("4. Generating presigned URL...");
        const presignedUrl = await generatePresignedUrl(s3Key, 300); // 5 min expiry for test
        console.log(`   Presigned URL (300s expiry): ${presignedUrl.substring(0, 120)}...`);

        // 5. Delete test file
        console.log("5. Deleting test file from S3...");
        await deleteFile(s3Key);
        console.log("   Delete SUCCESS!");

        // 6. Verify deletion
        console.log("6. Verifying deletion...");
        const afterDelete = await getFileMetadata(s3Key);
        if (afterDelete === null) {
            console.log("   Verified: File no longer exists in S3.");
        } else {
            console.warn("   WARNING: File still exists after deletion.");
        }

        console.log("\n>>> ALL S3 INTEGRATION CHECKS PASSED SUCCESSFULLY! <<<");
        process.exit(0);
    } catch (err) {
        console.error("FAIL: S3 test error:", err.message || err);
        process.exit(1);
    }
}

runTest();
