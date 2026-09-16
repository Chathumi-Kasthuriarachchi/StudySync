const multer = require("multer");
const cloudinary = require("../config/cloudinary");

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

/**
 * Upload a file buffer to Cloudinary using a readable stream.
 * Automatically resizes & optimizes images for avatar/profile use.
 *
 * @param {Buffer} fileBuffer
 * @param {Object} options Custom options (folder, transformation, etc.)
 * @returns {Promise<Object>} Cloudinary upload result
 */
const uploadToCloudinary = (fileBuffer, options = {}) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: options.folder || "studysync",
                resource_type: "image",
                transformation: [
                    { width: 400, height: 400, crop: "fill", gravity: "face" },
                    { quality: "auto", fetch_format: "auto" },
                ],
                ...options,
            },
            (error, result) => {
                if (error) {
                    return reject(error);
                }
                resolve(result);
            }
        );

        uploadStream.end(fileBuffer);
    });
};

/**
 * Delete an image asset from Cloudinary by public ID.
 *
 * @param {string} publicId
 * @returns {Promise<Object>}
 */
const deleteFromCloudinary = async (publicId) => {
    try {
        return await cloudinary.uploader.destroy(publicId);
    } catch (error) {
        console.error("Cloudinary destroy error:", error);
        throw error;
    }
};

module.exports = {
    cloudinary,
    upload,
    uploadSingleImage,
    uploadToCloudinary,
    deleteFromCloudinary,
};
