const multer = require("multer");

// Configure Multer to store uploaded files in memory as Buffers
const storage = multer.memoryStorage();

// File filter to restrict to standard image formats
const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/jpg",
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Invalid file type. Only JPG, PNG, WEBP, and GIF images are allowed."), false);
    }
};

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter,
});

/**
 * Middleware wrapper for single file upload with clean error handling.
 * Returns 400 JSON errors for file size limits or invalid formats.
 */
const uploadSingleImage = (fieldName = "image") => {
    const uploadHandler = upload.single(fieldName);
    return (req, res, next) => {
        uploadHandler(req, res, (err) => {
            if (err instanceof multer.MulterError) {
                if (err.code === "LIMIT_FILE_SIZE") {
                    return res.status(400).json({
                        success: false,
                        message: "File is too large. Maximum size allowed is 5MB.",
                    });
                }
                return res.status(400).json({
                    success: false,
                    message: `Upload error: ${err.message}`,
                });
            } else if (err) {
                return res.status(400).json({
                    success: false,
                    message: err.message || "Invalid image upload.",
                });
            }
            next();
        });
    };
};

module.exports = {
    upload,
    uploadSingleImage,
};
