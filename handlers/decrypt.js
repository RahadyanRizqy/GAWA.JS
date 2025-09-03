const { decryptMd } = require('../utils/metadata.js');
const errorResponse = require('../utils/error.js');
const jwt = require('jsonwebtoken');
const fs = require("fs");
const path = require("path");
const config = require('../config.env.js');
const resolveFile = require('../utils/path-resolve.js');

let decryptHtml;
if (process.env.BUNDLED) {
    decryptHtml = require("../public/decrypt.html"); // hasil plugin esbuild
} else {
    const htmlPath = path.join(__dirname, "..", "public", "decrypt.html");
    decryptHtml = fs.readFileSync(htmlPath, "utf-8");
}

async function decryptMdHandler(c) {
    if (c.req.method === 'GET') {
        // Render decrypt.html
        try {
            return c.html(decryptHtml);
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
                let revokedPath;
                let revokedData;
                if (process.env.BUNDLED) {
                    revokedPath = path.join(__dirname, '.', 'revokeds.json');
                    revokedData = JSON.parse(fs.readFileSync(revokedPath, 'utf-8'));
                } else {
                    revokedData = require('../json/revokeds.json');
                }
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
