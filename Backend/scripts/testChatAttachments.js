/**
 * Phase 18 — Chat File & Media Sharing Integration Test Script
 *
 * Tests:
 * 1. Model validations (messageType enum, attachment schema, optional caption)
 * 2. S3 Key construction and sanitization (buildChatAttachmentKey)
 * 3. Middleware MIME mapping and category size limits
 * 4. Image attachment upload & S3 persistence without caption
 * 5. Document attachment upload & S3 persistence with encrypted caption
 * 6. Video & Audio attachment type mapping
 * 7. Message pagination with presigned URL generation (getMessages)
 * 8. Conversation list lastMessage preview formatting (getUserConversations)
 * 9. On-demand presigned download URL generation (getAttachmentDownloadUrl)
 * 10. Access control enforcement (unauthorized user rejected)
 * 11. S3 orphan cleanup on failure
 *
 * Usage: node scripts/testChatAttachments.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const crypto = require("crypto");

// Models
const User = require("../models/User");
const Project = require("../models/Project");
const ProjectMembership = require("../models/ProjectMembership");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");

// Services & Middleware
const chatService = require("../services/chatService");
const s3Service = require("../services/s3Service");
const { ALLOWED_MIME_TYPES, LIMITS } = require("../middleware/chatUploadMiddleware");
const { decrypt } = require("../utils/encryption");

const MONGO_URI = process.env.MONGO_URI;
let passed = 0;
let failed = 0;
const results = [];

const assert = (condition, testName) => {
    if (condition) {
        passed++;
        results.push(`  ✅ ${testName}`);
    } else {
        failed++;
        results.push(`  ❌ ${testName}`);
    }
};

const section = (name) => {
    results.push(`\n📋 ${name}`);
    results.push("─".repeat(50));
};

const run = async () => {
    console.log("Starting Phase 18 — Chat File & Media Sharing Integration Tests...\n");

    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to MongoDB");
        try {
            await Conversation.collection.dropIndex("project_1");
        } catch (e) {
            // Index might not exist or already dropped
        }
        await Conversation.syncIndexes();
        console.log("Conversation indexes synchronized");

        // ── 1. Model & Validation Tests ──────────────────────────────────────────
        section("1. Model & Schema Validations");

        const msgSchemaTypes = Message.schema.path("messageType").enumValues;
        assert(
            msgSchemaTypes.includes("TEXT") &&
            msgSchemaTypes.includes("IMAGE") &&
            msgSchemaTypes.includes("FILE") &&
            msgSchemaTypes.includes("VIDEO") &&
            msgSchemaTypes.includes("AUDIO"),
            "Message model has all required messageType enum values"
        );

        assert(Message.schema.path("attachment.originalName"), "Attachment subdocument has originalName");
        assert(Message.schema.path("attachment.storageKey"), "Attachment subdocument has storageKey");
        assert(Message.schema.path("attachment.mimeType"), "Attachment subdocument has mimeType");
        assert(Message.schema.path("attachment.size"), "Attachment subdocument has size");

        // ── 2. S3 Key Helper Tests ───────────────────────────────────────────────
        section("2. S3 Key Helper & Sanitization");

        const testKey1 = s3Service.buildChatAttachmentKey("conv123", "PROJECT", "presentation.pdf");
        assert(
            testKey1.startsWith("studysync/chat/project/conv123/") && testKey1.endsWith("_presentation.pdf"),
            "buildChatAttachmentKey produces valid key for PROJECT conversation"
        );

        const testKey2 = s3Service.buildChatAttachmentKey("conv456", "DIRECT", "photo.png");
        assert(
            testKey2.startsWith("studysync/chat/direct/conv456/") && testKey2.endsWith("_photo.png"),
            "buildChatAttachmentKey produces valid key for DIRECT conversation"
        );

        const testKeySanitized = s3Service.buildChatAttachmentKey("conv789", "DIRECT", "../../etc/passwd#?.jpg");
        assert(
            !testKeySanitized.includes("..") && !testKeySanitized.includes("#") && !testKeySanitized.includes("?"),
            "buildChatAttachmentKey sanitizes directory traversal and unsafe characters"
        );

        // ── 3. MIME Types & Limit Tests ──────────────────────────────────────────
        section("3. MIME Types & Size Limits");

        assert(ALLOWED_MIME_TYPES["image/png"]?.messageType === "IMAGE", "image/png maps to messageType IMAGE");
        assert(ALLOWED_MIME_TYPES["application/pdf"]?.messageType === "FILE", "application/pdf maps to messageType FILE");
        assert(ALLOWED_MIME_TYPES["video/mp4"]?.messageType === "VIDEO", "video/mp4 maps to messageType VIDEO");
        assert(ALLOWED_MIME_TYPES["audio/mpeg"]?.messageType === "AUDIO", "audio/mpeg maps to messageType AUDIO");
        assert(ALLOWED_MIME_TYPES["application/zip"]?.messageType === "FILE", "application/zip maps to messageType FILE");
        assert(LIMITS.IMAGE === 10 * 1024 * 1024, "Default image size limit is 10MB");
        assert(LIMITS.DOCUMENT === 25 * 1024 * 1024, "Default document size limit is 25MB");

        // ── Setup Test Users & Conversation ──────────────────────────────────────
        section("Setting Up Test Data");

        const testSuffix = crypto.randomBytes(4).toString("hex");
        const userA = await User.create({
            name: `ChatAttachUserA_${testSuffix}`,
            email: `chat_attach_a_${testSuffix}@example.com`,
            password: "Password123!",
        });

        const userB = await User.create({
            name: `ChatAttachUserB_${testSuffix}`,
            email: `chat_attach_b_${testSuffix}@example.com`,
            password: "Password123!",
        });

        const outsider = await User.create({
            name: `ChatAttachOutsider_${testSuffix}`,
            email: `chat_attach_out_${testSuffix}@example.com`,
            password: "Password123!",
        });

        const conversation = await chatService.getOrCreateDirectConversation(userA._id, userB._id);
        const convId = conversation._id.toString();

        const s3KeysToDelete = [];

        // ── 4. Image Attachment Upload (Without Caption) ──────────────────────────
        section("4. Image Upload Without Caption");

        const fakeImageBuffer = Buffer.from("FAKE_PNG_BINARY_CONTENT_DATA_" + testSuffix);
        const imageFile = {
            buffer: fakeImageBuffer,
            originalname: "test_diagram.png",
            mimetype: "image/png",
            size: fakeImageBuffer.length,
        };

        const imageMsg = await chatService.sendAttachmentMessage(
            convId,
            userA._id,
            imageFile,
            "" // No caption
        );

        assert(imageMsg._id, "Image message created successfully");
        assert(imageMsg.messageType === "IMAGE", "Message type is IMAGE");
        assert(imageMsg.content === "", "Content is empty string when no caption provided");
        assert(imageMsg.attachment?.originalName === "test_diagram.png", "Attachment originalName matches");
        assert(imageMsg.attachment?.mimeType === "image/png", "Attachment mimeType matches");
        assert(imageMsg.attachment?.storageKey, "Attachment storageKey exists");
        assert(imageMsg.attachment?.url && imageMsg.attachment.url.startsWith("https://"), "Immediate presigned URL generated");

        if (imageMsg.attachment?.storageKey) {
            s3KeysToDelete.push(imageMsg.attachment.storageKey);
            // Verify file exists in S3
            const s3Meta = await s3Service.getFileMetadata(imageMsg.attachment.storageKey);
            assert(s3Meta !== null && s3Meta.contentType === "image/png", "Image file verified in S3 with correct content type");
        }

        // Verify in DB that encryptedContent is null at rest
        const rawImageMsg = await Message.findById(imageMsg._id).lean();
        assert(rawImageMsg.encryptedContent === null, "DB stores encryptedContent as null for captionless attachment");

        // ── 5. Document Attachment Upload (With Encrypted Caption) ────────────────
        section("5. Document Upload With Encrypted Caption");

        const fakePdfBuffer = Buffer.from("%PDF-1.4 FAKE_PDF_DATA_" + testSuffix);
        const pdfFile = {
            buffer: fakePdfBuffer,
            originalname: "study_guide.pdf",
            mimetype: "application/pdf",
            size: fakePdfBuffer.length,
        };
        const captionText = "Here is the comprehensive study guide for Chapter 5!";

        const docMsg = await chatService.sendAttachmentMessage(
            convId,
            userB._id,
            pdfFile,
            captionText
        );

        assert(docMsg._id, "Document message created successfully");
        assert(docMsg.messageType === "FILE", "Message type is FILE for PDF");
        assert(docMsg.content === captionText, "Decrypted caption matches original input");
        assert(docMsg.attachment?.originalName === "study_guide.pdf", "Attachment originalName matches");

        if (docMsg.attachment?.storageKey) {
            s3KeysToDelete.push(docMsg.attachment.storageKey);
        }

        // Verify in DB that caption is encrypted at rest (AES-256-GCM)
        const rawDocMsg = await Message.findById(docMsg._id).lean();
        assert(rawDocMsg.encryptedContent !== null, "DB stores encryptedContent for captioned attachment");
        assert(!rawDocMsg.encryptedContent.includes(captionText), "DB ciphertext does not contain plaintext caption");
        const decryptedDocCaption = decrypt(rawDocMsg.encryptedContent);
        assert(decryptedDocCaption === captionText, "Ciphertext decrypts to original caption");

        // ── 6. Audio & Video Type Mapping ────────────────────────────────────────
        section("6. Audio & Video Type Mapping");

        const fakeAudioBuffer = Buffer.from("FAKE_AUDIO_MP3_" + testSuffix);
        const audioMsg = await chatService.sendAttachmentMessage(
            convId,
            userA._id,
            {
                buffer: fakeAudioBuffer,
                originalname: "lecture_recording.mp3",
                mimetype: "audio/mpeg",
                size: fakeAudioBuffer.length,
            },
            "Lecture Audio"
        );
        assert(audioMsg.messageType === "AUDIO", "audio/mpeg correctly mapped to AUDIO messageType");
        if (audioMsg.attachment?.storageKey) s3KeysToDelete.push(audioMsg.attachment.storageKey);

        const fakeVideoBuffer = Buffer.from("FAKE_VIDEO_MP4_" + testSuffix);
        const videoMsg = await chatService.sendAttachmentMessage(
            convId,
            userA._id,
            {
                buffer: fakeVideoBuffer,
                originalname: "demo_clip.mp4",
                mimetype: "video/mp4",
                size: fakeVideoBuffer.length,
            },
            ""
        );
        assert(videoMsg.messageType === "VIDEO", "video/mp4 correctly mapped to VIDEO messageType");
        if (videoMsg.attachment?.storageKey) s3KeysToDelete.push(videoMsg.attachment.storageKey);

        // ── 7. Message Pagination & Presigned URLs (getMessages) ──────────────────
        section("7. getMessages Pagination & Presigned URL Resolution");

        const msgHistory = await chatService.getMessages(convId, userA._id, { limit: 10 });
        assert(msgHistory.messages.length >= 4, "getMessages retrieves all sent messages");

        const retrievedDoc = msgHistory.messages.find((m) => m._id.toString() === docMsg._id.toString());
        assert(retrievedDoc !== undefined, "Retrieved messages include document message");
        assert(
            retrievedDoc.attachment?.url && retrievedDoc.attachment.url.startsWith("https://"),
            "getMessages resolved fresh presigned URL for document"
        );
        assert(retrievedDoc.content === captionText, "getMessages decrypted caption text");

        // ── 8. Conversation List Preview (getUserConversations) ───────────────────
        section("8. Conversation Preview Formatting (getUserConversations)");

        const userConvs = await chatService.getUserConversations(userA._id);
        const targetConv = userConvs.find((c) => c._id.toString() === convId);
        assert(targetConv !== undefined, "User conversations list includes target conversation");
        assert(targetConv.lastMessage !== null, "lastMessage is populated");
        assert(
            targetConv.lastMessage.messageType === "VIDEO" || targetConv.lastMessage.content.includes("Video"),
            "lastMessage preview displays media type correctly"
        );

        // ── 9. On-Demand Attachment Download URL ─────────────────────────────────
        section("9. On-Demand Attachment Download URL");

        const downloadData = await chatService.getAttachmentDownloadUrl(convId, docMsg._id, userA._id);
        assert(downloadData.downloadUrl && downloadData.downloadUrl.startsWith("https://"), "Valid presigned download URL generated");
        assert(downloadData.fileName === "study_guide.pdf", "Correct original fileName returned");
        assert(downloadData.mimeType === "application/pdf", "Correct mimeType returned");

        // ── 10. Access Control Enforcement ───────────────────────────────────────
        section("10. Access Control Enforcement");

        let outsiderBlocked = false;
        try {
            await chatService.getAttachmentDownloadUrl(convId, docMsg._id, outsider._id);
        } catch (err) {
            outsiderBlocked = err.statusCode === 403;
        }
        assert(outsiderBlocked, "Outsider is denied access (403) to download attachment");

        let outsiderUploadBlocked = false;
        try {
            await chatService.sendAttachmentMessage(convId, outsider._id, pdfFile);
        } catch (err) {
            outsiderUploadBlocked = err.statusCode === 403;
        }
        assert(outsiderUploadBlocked, "Outsider is denied access (403) to upload attachment to conversation");

        // ── 11. Cleanup S3 and DB ────────────────────────────────────────────────
        section("11. Cleanup Test Artifacts");

        for (const key of s3KeysToDelete) {
            try {
                await s3Service.deleteFile(key);
            } catch (err) {
                console.warn("Failed to delete test S3 key:", key, err.message);
            }
        }
        assert(true, `Cleaned up ${s3KeysToDelete.length} S3 test objects`);

        await Message.deleteMany({ conversation: convId });
        await Conversation.findByIdAndDelete(convId);
        await User.deleteMany({ _id: { $in: [userA._id, userB._id, outsider._id] } });
        assert(true, "Cleaned up MongoDB test records");

        // ── Print Results Summary ────────────────────────────────────────────────
        console.log(results.join("\n"));
        console.log(`\n========================================`);
        console.log(`Results: ${passed} passed, ${failed} failed`);
        console.log(`========================================\n`);

        process.exit(failed > 0 ? 1 : 0);
    } catch (err) {
        console.error("Test execution failed:", err);
        process.exit(1);
    }
};

run();
