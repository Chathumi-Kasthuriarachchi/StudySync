const multer = require("multer");

/**
 * Chat Attachment Upload Middleware — Phase 18
 * Configures Multer in-memory storage, strict MIME type validation,
 * and configurable file size limits by category.
 */

// Category size limits (in bytes) with environment variable overrides
const LIMITS = {
    IMAGE: (parseInt(process.env.CHAT_MAX_IMAGE_SIZE, 10) || 10) * 1024 * 1024, // 10MB
    DOCUMENT: (parseInt(process.env.CHAT_MAX_DOCUMENT_SIZE, 10) || 25) * 1024 * 1024, // 25MB
    ARCHIVE: (parseInt(process.env.CHAT_MAX_ARCHIVE_SIZE, 10) || 50) * 1024 * 1024, // 50MB
    AUDIO: (parseInt(process.env.CHAT_MAX_AUDIO_SIZE, 10) || 50) * 1024 * 1024, // 50MB
    VIDEO: (parseInt(process.env.CHAT_MAX_VIDEO_SIZE, 10) || 100) * 1024 * 1024, // 100MB
};

// Map of allowed MIME types to their category and messageType
const ALLOWED_MIME_TYPES = {
    // Images
    "image/jpeg": { category: "IMAGE", messageType: "IMAGE", label: "Image (JPEG)" },
    "image/jpg": { category: "IMAGE", messageType: "IMAGE", label: "Image (JPG)" },
    "image/png": { category: "IMAGE", messageType: "IMAGE", label: "Image (PNG)" },
    "image/webp": { category: "IMAGE", messageType: "IMAGE", label: "Image (WebP)" },
    "image/gif": { category: "IMAGE", messageType: "IMAGE", label: "Image (GIF)" },

    // Documents
    "application/pdf": { category: "DOCUMENT", messageType: "FILE", label: "PDF Document" },
    "application/msword": { category: "DOCUMENT", messageType: "FILE", label: "Word Document (DOC)" },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
        category: "DOCUMENT",
        messageType: "FILE",
        label: "Word Document (DOCX)",
    },
    "application/vnd.ms-excel": { category: "DOCUMENT", messageType: "FILE", label: "Excel Spreadsheet (XLS)" },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
        category: "DOCUMENT",
        messageType: "FILE",
        label: "Excel Spreadsheet (XLSX)",
    },
    "application/vnd.ms-powerpoint": { category: "DOCUMENT", messageType: "FILE", label: "PowerPoint (PPT)" },
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
        category: "DOCUMENT",
        messageType: "FILE",
        label: "PowerPoint (PPTX)",
    },
    "text/plain": { category: "DOCUMENT", messageType: "FILE", label: "Text File (TXT)" },
    "text/csv": { category: "DOCUMENT", messageType: "FILE", label: "CSV Document" },

    // Archives
    "application/zip": { category: "ARCHIVE", messageType: "FILE", label: "ZIP Archive" },
    "application/x-zip-compressed": { category: "ARCHIVE", messageType: "FILE", label: "ZIP Archive" },
    "application/x-zip": { category: "ARCHIVE", messageType: "FILE", label: "ZIP Archive" },

    // Video
    "video/mp4": { category: "VIDEO", messageType: "VIDEO", label: "MP4 Video" },
    "video/webm": { category: "VIDEO", messageType: "VIDEO", label: "WebM Video" },
    "video/quicktime": { category: "VIDEO", messageType: "VIDEO", label: "QuickTime Video" },

    // Audio
    "audio/mpeg": { category: "AUDIO", messageType: "AUDIO", label: "MPEG Audio" },
    "audio/mp3": { category: "AUDIO", messageType: "AUDIO", label: "MP3 Audio" },
    "audio/wav": { category: "AUDIO", messageType: "AUDIO", label: "WAV Audio" },
    "audio/webm": { category: "AUDIO", messageType: "AUDIO", label: "WebM Audio" },
    "audio/ogg": { category: "AUDIO", messageType: "AUDIO", label: "OGG Audio" },
    "audio/x-m4a": { category: "AUDIO", messageType: "AUDIO", label: "M4A Audio" },
};

// Multer memory storage
const storage = multer.memoryStorage();

// File filter validates MIME type
const fileFilter = (req, file, cb) => {
    const mimeInfo = ALLOWED_MIME_TYPES[file.mimetype];
    if (!mimeInfo) {
        return cb(
            new Error(
                `Unsupported file type (${file.mimetype || "unknown"}). Allowed types: Images, Documents (PDF/Office/Text), ZIP archives, MP4/WebM videos, and Audio.`
            ),
            false
        );
    }
    cb(null, true);
};

// Maximum overall file size for multer: 100MB
const upload = multer({
    storage,
    limits: {
        fileSize: 100 * 1024 * 1024,
    },
    fileFilter,
});

/**
 * Middleware wrapper for single attachment upload with strict category size checks.
 */
const uploadChatAttachment = (fieldName = "file") => {
    const fieldsToAccept = Array.from(new Set([fieldName, "file", "attachment"])).map((name) => ({
        name,
        maxCount: 1,
    }));
    const uploadHandler = upload.fields(fieldsToAccept);

    return (req, res, next) => {
        uploadHandler(req, res, (err) => {
            if (err instanceof multer.MulterError) {
                if (err.code === "LIMIT_FILE_SIZE") {
                    return res.status(400).json({
                        success: false,
                        message: "File exceeds the maximum allowable upload limit of 100MB.",
                    });
                }
                return res.status(400).json({
                    success: false,
                    message: `Upload error: ${err.message}`,
                });
            } else if (err) {
                return res.status(400).json({
                    success: false,
                    message: err.message || "Invalid file upload.",
                });
            }

            // Normalize single file to req.file
            if (req.files) {
                req.file =
                    req.files[fieldName]?.[0] ||
                    req.files.file?.[0] ||
                    req.files.attachment?.[0] ||
                    null;
            }

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: "No attachment file provided.",
                });
            }

            // Perform category-specific size limit validation
            const mimeInfo = ALLOWED_MIME_TYPES[req.file.mimetype];
            if (mimeInfo) {
                const maxAllowed = LIMITS[mimeInfo.category];
                if (req.file.size > maxAllowed) {
                    const maxMb = Math.round(maxAllowed / (1024 * 1024));
                    return res.status(400).json({
                        success: false,
                        message: `${mimeInfo.category} files cannot exceed ${maxMb}MB in size.`,
                    });
                }
            }

            next();
        });
    };
};

module.exports = {
    uploadChatAttachment,
    ALLOWED_MIME_TYPES,
    LIMITS,
};
