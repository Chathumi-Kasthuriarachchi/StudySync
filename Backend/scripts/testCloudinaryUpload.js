require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { cloudinary, uploadToCloudinary, deleteFromCloudinary } = require("../middleware/uploadMiddleware");

async function runTest() {
    console.log("=== Testing Cloudinary Integration ===");
    console.log(`Cloud Name: ${process.env.CLOUDINARY_CLOUD_NAME}`);
    console.log(`API Key: ${process.env.CLOUDINARY_API_KEY ? "Present (Ends in " + process.env.CLOUDINARY_API_KEY.slice(-4) + ")" : "MISSING"}`);

    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        console.error("FAIL: Cloudinary environment variables missing in Backend/.env");
        process.exit(1);
    }

    try {
        // 1. Check API Connectivity via ping
        console.log("1. Testing Cloudinary ping...");
        const pingRes = await cloudinary.api.ping();
        console.log("Ping response:", pingRes);

        // 2. Upload a 1x1 transparent PNG buffer as test image
        console.log("2. Uploading sample buffer to folder 'studysync'...");
        // 1x1 base64 transparent PNG buffer
        const sampleBase64Png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
        const testBuffer = Buffer.from(sampleBase64Png, "base64");

        const uploadResult = await uploadToCloudinary(testBuffer, {
            folder: "studysync",
            public_id: "test_verification_image",
            overwrite: true,
        });

        console.log("Upload Success!");
        console.log("- Public ID:", uploadResult.public_id);
        console.log("- Secure URL:", uploadResult.secure_url);
        console.log("- Format:", uploadResult.format);
        console.log("- Width / Height:", `${uploadResult.width}x${uploadResult.height}`);

        // 3. Clean up the test image
        console.log("3. Deleting test image from Cloudinary...");
        const deleteRes = await deleteFromCloudinary(uploadResult.public_id);
        console.log("Delete response:", deleteRes);

        console.log("\n>>> ALL CLOUDINARY INTEGRATION CHECKS PASSED SUCCESSFULLY! <<<");
        process.exit(0);
    } catch (err) {
        console.error("FAIL: Cloudinary test error:", err.message || err);
        process.exit(1);
    }
}

runTest();
