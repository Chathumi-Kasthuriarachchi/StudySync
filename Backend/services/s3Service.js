const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

/**
 * S3 Service — Centralized AWS S3 Operations
 *
 * Provides reusable methods for file upload, deletion, presigned URL generation,
 * and metadata retrieval. All controllers should use this service instead of
 * scattering S3 SDK calls.
 *
 * Required environment variables:
 *   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET_NAME
 */

// ── Validate required environment variables ─────────────────────────────────
const REQUIRED_ENV_VARS = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION", "AWS_S3_BUCKET_NAME"];

const validateAwsConfig = () => {
    const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
    if (missing.length > 0) {
        throw new Error(`Missing required AWS environment variables: ${missing.join(", ")}`);
    }
};

// ── Initialize S3 Client ────────────────────────────────────────────────────
let s3Client = null;

const getS3Client = () => {
    if (!s3Client) {
        validateAwsConfig();
        s3Client = new S3Client({
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            },
        });
    }
    return s3Client;
};

const getBucketName = () => {
    if (!process.env.AWS_S3_BUCKET_NAME) {
        throw new Error("AWS_S3_BUCKET_NAME environment variable is not configured.");
    }
    return process.env.AWS_S3_BUCKET_NAME;
};

// ── Default presigned URL expiry: 7 days (in seconds) ───────────────────────
const DEFAULT_PRESIGNED_EXPIRY = 7 * 24 * 60 * 60; // 604800 seconds

/**
 * Upload a file buffer to S3.
 *
 * @param {Buffer} fileBuffer  - The file content as a Buffer
 * @param {string} s3Key       - The full S3 object key (e.g. "studysync/users/123/profile/avatar_1726600954_a1b2c3.jpg")
 * @param {string} contentType - MIME type (e.g. "image/jpeg")
 * @param {Object} [metadata]  - Optional metadata key-value pairs
 * @returns {Promise<Object>}  - { s3Key, bucket, region }
 */
const uploadFile = async (fileBuffer, s3Key, contentType, metadata = {}) => {
    try {
        const client = getS3Client();
        const bucket = getBucketName();

        const command = new PutObjectCommand({
            Bucket: bucket,
            Key: s3Key,
            Body: fileBuffer,
            ContentType: contentType,
            Metadata: metadata,
        });

        await client.send(command);

        return {
            s3Key,
            bucket,
            region: process.env.AWS_REGION,
        };
    } catch (error) {
        console.error("S3 uploadFile error:", error.message);

        // Map common AWS errors to application-level messages
        if (error.name === "AccessDenied" || error.Code === "AccessDenied") {
            throw new Error("S3 access denied. Check your AWS credentials and bucket permissions.");
        }
        if (error.name === "NoSuchBucket" || error.Code === "NoSuchBucket") {
            throw new Error("S3 bucket does not exist. Check your AWS_S3_BUCKET_NAME configuration.");
        }
        throw new Error(`Failed to upload file to S3: ${error.message}`);
    }
};

/**
 * Delete an object from S3.
 *
 * @param {string} s3Key - The full S3 object key
 * @returns {Promise<void>}
 */
const deleteFile = async (s3Key) => {
    try {
        if (!s3Key) {
            console.warn("S3 deleteFile called with empty key, skipping.");
            return;
        }

        const client = getS3Client();
        const bucket = getBucketName();

        const command = new DeleteObjectCommand({
            Bucket: bucket,
            Key: s3Key,
        });

        await client.send(command);
    } catch (error) {
        console.error("S3 deleteFile error:", error.message);

        if (error.name === "AccessDenied" || error.Code === "AccessDenied") {
            throw new Error("S3 access denied. Check your AWS credentials and bucket permissions.");
        }
        // NoSuchKey is not an error for delete — the object is already gone
        if (error.name === "NoSuchKey" || error.Code === "NoSuchKey") {
            console.warn(`S3 object not found (already deleted?): ${s3Key}`);
            return;
        }
        throw new Error(`Failed to delete file from S3: ${error.message}`);
    }
};

/**
 * Generate a temporary presigned URL for downloading/viewing an S3 object.
 *
 * @param {string} s3Key             - The full S3 object key
 * @param {number} [expiresIn]       - URL expiry in seconds (default: 7 days)
 * @returns {Promise<string>}        - The presigned URL
 */
const generatePresignedUrl = async (s3Key, expiresIn = DEFAULT_PRESIGNED_EXPIRY) => {
    try {
        if (!s3Key) {
            throw new Error("S3 key is required to generate a presigned URL.");
        }

        const client = getS3Client();
        const bucket = getBucketName();

        const command = new GetObjectCommand({
            Bucket: bucket,
            Key: s3Key,
        });

        const url = await getSignedUrl(client, command, { expiresIn });
        return url;
    } catch (error) {
        console.error("S3 generatePresignedUrl error:", error.message);

        if (error.name === "NoSuchKey" || error.Code === "NoSuchKey") {
            throw new Error("The requested file does not exist in S3.");
        }
        if (error.name === "AccessDenied" || error.Code === "AccessDenied") {
            throw new Error("S3 access denied when generating download URL.");
        }
        throw new Error(`Failed to generate presigned URL: ${error.message}`);
    }
};

/**
 * Check if an S3 object exists and retrieve its metadata.
 *
 * @param {string} s3Key - The full S3 object key
 * @returns {Promise<Object|null>} - { contentType, contentLength, lastModified, metadata } or null if not found
 */
const getFileMetadata = async (s3Key) => {
    try {
        if (!s3Key) return null;

        const client = getS3Client();
        const bucket = getBucketName();

        const command = new HeadObjectCommand({
            Bucket: bucket,
            Key: s3Key,
        });

        const response = await client.send(command);

        return {
            contentType: response.ContentType,
            contentLength: response.ContentLength,
            lastModified: response.LastModified,
            metadata: response.Metadata || {},
        };
    } catch (error) {
        // 404 / NoSuchKey means the object doesn't exist
        if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
            return null;
        }
        console.error("S3 getFileMetadata error:", error.message);
        throw new Error(`Failed to retrieve S3 object metadata: ${error.message}`);
    }
};

/**
 * Build a standardized S3 key for a user's profile avatar.
 *
 * @param {string} userId   - MongoDB user ID
 * @param {string} fileName - Original file name (used for extension extraction)
 * @returns {string}        - S3 object key
 */
const buildProfileImageKey = (userId, fileName) => {
    const ext = fileName ? fileName.split(".").pop().toLowerCase() : "jpg";
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `studysync/users/${userId}/profile/avatar_${timestamp}_${random}.${ext}`;
};

/**
 * Build a standardized S3 key for a chat attachment.
 * Path format: studysync/chat/<project|direct>/<conversationId>/<timestamp>_<random>_<safe_filename>
 *
 * @param {string} conversationId   - MongoDB conversation ID
 * @param {string} conversationType - "PROJECT" or "DIRECT"
 * @param {string} fileName         - Original file name
 * @returns {string}                - S3 object key
 */
const buildChatAttachmentKey = (conversationId, conversationType, fileName) => {
    const type = (conversationType || "direct").toLowerCase();
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    // Strip directory paths and sanitize filename
    const baseName = (fileName || "attachment").replace(/^.*[\\/]/, "");
    const safeName = baseName
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/\.{2,}/g, ".")
        .replace(/_{2,}/g, "_");
    return `studysync/chat/${type}/${conversationId}/${timestamp}_${random}_${safeName}`;
};

module.exports = {
    uploadFile,
    deleteFile,
    generatePresignedUrl,
    getFileMetadata,
    buildProfileImageKey,
    buildChatAttachmentKey,
    DEFAULT_PRESIGNED_EXPIRY,
};

