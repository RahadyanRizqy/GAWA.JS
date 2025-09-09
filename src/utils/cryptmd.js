import crypto from 'crypto';

let defaultKey = 'gawadotjs'; // modifiable

function encryptMd(metadata) {
    const data = JSON.stringify(metadata);
    const iv = crypto.randomBytes(16);
    const key = crypto.createHash('sha256').update(defaultKey).digest();
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(data, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return iv.toString('base64') + ':' + encrypted;
}

function decryptMd(encryptedMetadata) {
    const [ivBase64, encrypted] = encryptedMetadata.split(':');
    const iv = Buffer.from(ivBase64, 'base64');
    const key = crypto.createHash('sha256').update(defaultKey).digest();
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
}

function setDefaultKey(newKey) {
    defaultKey = newKey;
}

export { encryptMd, decryptMd as decryptmd, setDefaultKey };