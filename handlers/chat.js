const GeminiClient = require('../utils/GeminiClient');
const { encryptMd, decryptMd, processChatMetadata } = require('../utils/metadata');
const errorResponse = require('../utils/error');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const config = require('../config.env');
const resolveFile = require('../utils/path-resolve');

// Shared chat handler function
async function handleChat(c, gemId) {
    const user = c.get('user');

    try {
        // Parse form data
        const formData = await c.req.formData();
        const message = formData.get('message');
        const file = formData.get('file');

        if (!message) throw errorResponse('Message is required', 400);

        // Handle file upload
        let files = [];
        if (file) {
            const tempDir = path.join(__dirname, '..', 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            const filePath = path.join(tempDir, file.name);
            const buffer = await file.arrayBuffer();
            fs.writeFileSync(filePath, Buffer.from(buffer));
            files.push(filePath);
        }

        // Check metadata
        const metadataHeader = c.req.header('X-Chat-Metadata');
        const { validEncryptedMetadata, isNewChat } = processChatMetadata(metadataHeader);

        let chat;
        let response;

        if (isNewChat) {
            chat = c.get('client').startChat(null, gemId);
            response = await chat.send_message(message, files);
        } else {
            const decryptedMetadata = decryptMd(validEncryptedMetadata, config.SECRET_KEY);
            chat = c.get('client').startChat(decryptedMetadata, gemId);
            response = await chat.send_message(message, files);
        }

        // Encrypt new metadata
        const encryptedMetadata = encryptMd(chat.metadata, config.SECRET_KEY);

        // Clean up temp files
        files.forEach(f => {
            try {
                fs.unlinkSync(f);
            } catch (e) {
                console.warn('Failed to delete temp file:', f);
            }
        });

        // Response
        const resData = {
            data: {
                message: response.text,
                newChat: isNewChat,
                user: user.username,
                gemId: gemId
            }
        };

        c.header('X-Chat-Metadata', encryptedMetadata);
        return c.json(resData);

    } catch (error) {
        console.error('Error processing request:', error);
        return c.json({
            error: {
                message: error.message,
                code: error.code || 500
            }
        }, error.code || 500);
    }
}

// Single chat handler that detects gemId
async function chatHandler(c) {
    // Try to get gemId from URL path
    const url = new URL(c.req.url);
    const pathParts = url.pathname.split('/').filter(p => p);
    let gemId = null;

    // If path has more than 1 part and second part exists, it's gemId
    if (pathParts.length > 1 && pathParts[1]) {
        gemId = pathParts[1];
    }

    return await handleChat(c, gemId);
}

module.exports = { chatHandler };