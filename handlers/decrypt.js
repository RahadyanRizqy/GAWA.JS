const { decryptMd } = require('../utils/metadata');
const errorResponse = require('../utils/error');
const jwt = require('jsonwebtoken');
const fs = require("fs");
const path = require("path");
const config = require('../config.env');
const resolveFile = require('../utils/path-resolve');

async function decryptMdHandler(c) {
    if (c.req.method === 'GET') {
        // Render decrypt.html
        try {
            const htmlPath = path.join(__dirname, '..', 'public', 'decrypt.html');
            const html = fs.readFileSync(htmlPath, 'utf-8');
            return c.html(html);
        } catch (error) {
            return c.text('Decrypt page not found', 404);
        }
    } else if (c.req.method === 'POST') {
        // Handle decryption
        try {
            const url = new URL(c.req.url);
            let body = {};
            try {
                body = await c.req.json();
            } catch {
                throw errorResponse("Invalid JSON body", 400);
            }
            const { metadata, token } = body;

            if (!metadata) throw errorResponse("Query param 'metadata' is required", 400);

            if (!token) throw errorResponse("Query param 'token' is required", 400);

            let decoded;
            try {
                decoded = jwt.verify(token, config.SECRET_KEY);
            } catch {
                throw errorResponse("Invalid token", 403);
            }

            // === Check revoked token ===
            try {
                const revokedPath = resolveFile("json/revokeds.json");
                const revokedData = JSON.parse(fs.readFileSync(revokedPath, "utf-8"));
                if (revokedData.revokeds.includes(token)) throw errorResponse("Revoked token", 403);
            } catch (err) {
                throw errorResponse(err.message, 500);
            }

            const decrypted = decryptMd(metadata, config.SECRET_KEY);

            return c.json({
                decryptedMetadata: {
                    [decoded.username]: decrypted
                }
            }, 200);

        } catch (err) {
            return c.json({
            error: {
                message: err.message,
                code: err.code || 500,
            }
            }, err.code || 500);
        }
    }
    return c.text('Method not allowed', 405);
}

module.exports = { decryptMdHandler };
