const { encryptMd, decryptMd, processChatMetadata } = require('../utils/metadata.js');
const errorResponse = require('../utils/error.js');
const fs = require('fs');
const path = require('path');
const config = require('../config.env.js');

// Shared chat handler function
async function handleChat(c, gemId) {
    const user = c.get('user');

    try {
        // Parse form data
        const formData = await c.req.formData();
        const message = formData.get('message');
        const files = formData.get('files');

        if (!message) throw errorResponse('Message is required', 400);

        // Handle file upload
        let files_arr = [];
        if (files) {
            let tempDir;
            if (process.env.BUNDLED) {
                tempDir = path.join(__dirname, '.', 'temp');
            } else {
                tempDir = path.join(__dirname, '..', 'temp');
            }
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            const filePath = path.join(tempDir, files.name);
            const buffer = await files.arrayBuffer();
            fs.writeFileSync(filePath, Buffer.from(buffer));
            files_arr.push(filePath);
        }

        // Check metadata
        const metadataHeader = c.req.header('X-Chat-Metadata');
        const { validEncryptedMetadata, isNewChat } = processChatMetadata(metadataHeader);

        let chat;
        let response;
        let decryptedMetadata;

        if (isNewChat) {
            chat = c.get('client').startChat(null, 'unspecified', gemId);
            response = await chat.sendMessage(message, files_arr);
        } else {
            decryptedMetadata = decryptMd(validEncryptedMetadata, config.SECRET_KEY);
            chat = c.get('client').startChat(decryptedMetadata, 'unspecified', gemId);
            response = await chat.sendMessage(message, files_arr);
        }

        // Encrypt new metadata
        const encryptedMetadata = encryptMd(chat.metadata, config.SECRET_KEY);

        console.log({
            message: message,
            user: user.username,
            encryptedMetada: metadataHeader,
            decrytedMetadata: decryptedMetadata,
            ...(gemId ? { gemId: gemId } : {}),
            ...(files_arr ? { files: files_arr } : {})
        });
        
        // Clean up temp files
        files_arr.forEach(f => {
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
                ...(gemId ? { gemId: gemId } : {})
            }
        };

        c.header('X-Chat-Metadata', encryptedMetadata);
        return c.json(resData);

    } catch (error) {
        console.error('Error processing request:', error);
        files_arr.forEach(f => {
            try {
                fs.unlinkSync(f);
            } catch (e) {
                console.warn('Failed to delete temp file:', f);
            }
        });
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