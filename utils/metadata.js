const crypto = require('crypto');

function encryptMd(metadata, secretKey) {
    const data = JSON.stringify(metadata);
    const iv = crypto.randomBytes(16);
    const key = crypto.createHash('sha256').update(secretKey).digest();
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(data, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return iv.toString('base64') + ':' + encrypted;
}

function decryptMd(encryptedMetadata, secretKey) {
    const [ivBase64, encrypted] = encryptedMetadata.split(':');
    const iv = Buffer.from(ivBase64, 'base64');
    const key = crypto.createHash('sha256').update(secretKey).digest();
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
}

function processChatMetadata(headerValue) {
    if (!headerValue || typeof headerValue !== "string" || headerValue.trim() === "") {
        return { validEncryptedMetadata: null, isNewChat: true };
    }
    const parts = headerValue.split(":");
    if (parts.length !== 2) {
        return { validEncryptedMetadata: headerValue, isNewChat: true };
    }

    const [iv, encrypted] = parts;
    try {
        Buffer.from(iv, "base64");
        Buffer.from(encrypted, "base64");
        return { validEncryptedMetadata: headerValue, isNewChat: false };
    } catch {
        return { validEncryptedMetadata: headerValue, isNewChat: true };
    }
}

module.exports = { encryptMd, decryptMd, processChatMetadata };