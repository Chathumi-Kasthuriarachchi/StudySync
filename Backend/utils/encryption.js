const crypto = require("crypto");

/**
 * Encryption Utility — Phase 15
 *
 * Server-side encryption at rest for chat messages using AES-256-GCM.
 *
 * Storage format:  iv:authTag:ciphertext  (all hex-encoded)
 *
 * Security guarantees:
 * - Unique 12-byte random IV per message (never reused with same key)
 * - 16-byte authentication tag for integrity verification (GCM)
 * - Key derived from environment variable, never hardcoded
 * - Graceful failure on tampered ciphertext
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128-bit auth tag
const ENCODING = "hex";
const SEPARATOR = ":";

/**
 * Retrieve the encryption key from environment.
 * The key must be a 64-character hex string (32 bytes).
 * @returns {Buffer} 32-byte encryption key
 */
const getEncryptionKey = () => {
    const keyHex = process.env.CHAT_ENCRYPTION_KEY;

    if (!keyHex) {
        throw new Error("CHAT_ENCRYPTION_KEY environment variable is not set");
    }

    if (keyHex.length !== 64) {
        throw new Error(
            "CHAT_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)"
        );
    }

    return Buffer.from(keyHex, "hex");
};

/**
 * Encrypt plaintext message content.
 *
 * @param {string} plaintext - The message content to encrypt
 * @returns {string} Encrypted string in format "iv:authTag:ciphertext" (hex-encoded)
 * @throws {Error} If encryption fails or key is misconfigured
 */
const encrypt = (plaintext) => {
    if (!plaintext || typeof plaintext !== "string") {
        throw new Error("Plaintext must be a non-empty string");
    }

    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
        authTagLength: AUTH_TAG_LENGTH,
    });

    let encrypted = cipher.update(plaintext, "utf8", ENCODING);
    encrypted += cipher.final(ENCODING);

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:ciphertext
    return [
        iv.toString(ENCODING),
        authTag.toString(ENCODING),
        encrypted,
    ].join(SEPARATOR);
};

/**
 * Decrypt an encrypted message string.
 *
 * @param {string} encryptedString - The encrypted string in format "iv:authTag:ciphertext"
 * @returns {string} Decrypted plaintext
 * @throws {Error} If decryption fails (tampered data, wrong key, invalid format)
 */
const decrypt = (encryptedString) => {
    if (!encryptedString || typeof encryptedString !== "string") {
        throw new Error("Encrypted string must be a non-empty string");
    }

    const parts = encryptedString.split(SEPARATOR);
    if (parts.length !== 3) {
        throw new Error("Invalid encrypted data format");
    }

    const [ivHex, authTagHex, ciphertext] = parts;

    // Validate component lengths
    if (ivHex.length !== IV_LENGTH * 2) {
        throw new Error("Invalid IV length in encrypted data");
    }
    if (authTagHex.length !== AUTH_TAG_LENGTH * 2) {
        throw new Error("Invalid auth tag length in encrypted data");
    }

    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, ENCODING);
    const authTag = Buffer.from(authTagHex, ENCODING);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
        authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, ENCODING, "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
};

module.exports = { encrypt, decrypt };
