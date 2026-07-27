const crypto = require('crypto');

// In production, this MUST come from your environment variables (.env).
// It must be exactly 32 bytes (256 bits) long.
let ENCRYPTION_KEY;
if (process.env.EMAIL_SECRET_KEY) {
    ENCRYPTION_KEY = Buffer.from(process.env.EMAIL_SECRET_KEY, 'hex');
} else {
    ENCRYPTION_KEY = crypto.randomBytes(32);
}

const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypts an email address
 * @param {string} text - The plaintext email address
 * @returns {string} - The format is "iv:authTag:encryptedData"
 */
function encryptEmail(text) {
    // 1. Generate a random Initialization Vector (12 bytes is standard for GCM)
    const iv = crypto.randomBytes(12);

    // 2. Create the cipher instance
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

    // 3. Encrypt the email
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // 4. Get the authentication tag
    const authTag = cipher.getAuthTag();

    // 5. Return the concatenated string for easy database storage
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts the stored email string
 * @param {string} encryptedTextString - The "iv:authTag:encryptedData" string from your DB
 * @returns {string} - The original plaintext email
 */
function decryptEmail(encryptedTextString) {
    // 1. Split the string back into its three parts
    const parts = encryptedTextString.split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted string format');

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedText = parts[2];

    // 2. Create the decipher instance
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

    // 3. Set the auth tag to verify data integrity
    decipher.setAuthTag(authTag);

    // 4. Decrypt the email
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

module.exports = {
    encryptEmail,
    decryptEmail
};
