const { Hono } = require('hono');
const { serve } = require('@hono/node-server');
const { logger } = require('hono/logger');
const jwt = require('jsonwebtoken');
const errorResponse = require('./utils/error.js');
const fs = require('fs');
const config = require('./config.env.js');
const { setupRoutes } = require('./web/routes.js');
const path = require('path');

// Use the custom client that skips browser cookie extraction
const { CustomGeminiClient } = require('./utils/CustomGeminiClient.js');
const { setLogLevel } = require('./utils/GeminiClient.js');

setLogLevel('DEBUG');

function getCookiesFromEnv() {
    try {
        // Ambil cookie header dari env
        const cookieHeader = config.COOKIE_HEADER?.trim();

        if (!cookieHeader) {
            console.warn('COOKIE_HEADER tidak ditemukan di env');
            return { secure1psid: null, secure1psidts: null };
        }

        let secure1psid = null;
        let secure1psidts = null;

        // Parse cookie string format: "name1=value1; name2=value2"
        const cookies = cookieHeader.split(';').map(c => c.trim());

        for (const cookie of cookies) {
            const [name, value] = cookie.split('=');
            if (name && value) {
                if (name === '__Secure-1PSID') {
                    secure1psid = value;
                }
                if (name === '__Secure-1PSIDTS') {
                    secure1psidts = value;
                }
            }
        }

        console.log('Parsed cookies:', { secure1psid, secure1psidts });
        return { secure1psid, secure1psidts };
    } catch (error) {
        console.error('Error parsing COOKIE_HEADER:', error);
        return { secure1psid: null, secure1psidts: null };
    }
}

async function initializeServer() {
    try {
        // Initialize GeminiClient at startup
        const { secure1psid, secure1psidts } = getCookiesFromEnv();
        
        // Validate cookies
        if (!secure1psid) {
            throw new Error('SECURE_1PSID cookie is required. Please check your COOKIE_HEADER environment variable');
        }

        const client = new CustomGeminiClient(secure1psid, secure1psidts, null);

        console.log('Initializing GeminiClient...');
        await client.init(30000, false, 300000, true, 540, true);
        console.log('GeminiClient initialized successfully');

        const app = new Hono();

        app.use('*', logger());

        // Middleware to attach client
        app.use('*', async (c, next) => {
            c.set('client', client);
            await next();
        });

        // JWT Authentication middleware
        app.use('/chat/*', async (c, next) => {
            const authHeader = c.req.header('Authorization');
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                throw errorResponse('Unauthorized', 401);
            }
            const token = authHeader.substring(7);

            try {
                const decoded = jwt.verify(token, config.SECRET_KEY);

                // Check revoked tokens
                let revokedPath;
                let revokedData;
                if (process.env.BUNDLED) {
                    revokedPath = path.join(__dirname, '.', 'revokeds.json');
                    revokedData = JSON.parse(fs.readFileSync(revokedPath, 'utf-8'));
                } else {
                    revokedData = require('./revokeds.json');
                }
                if (revokedData.revokeds.includes(token)) throw errorResponse('Revoked token', 403);

                c.set('user', decoded);
                await next();
            } catch (err) {
                if (err.code) {
                    throw err;
                }
                throw errorResponse('Invalid token', 401);
            }
        });

        // Setup routes
        setupRoutes(app);

        // Global error handler
        app.onError((err, c) => {
            return c.json({
                error: {
                    message: err.message,
                    code: err.code || 500
                }
            }, err.code || 500);
        });

        // Start server
        const port = config.PORT || 3000;
        serve({
            fetch: app.fetch,
            port: port
        });

        console.log(`Server running on port ${port}`);
        
        return { app, client };
        
    } catch (error) {
        console.error('Failed to initialize server:', error.message);
        process.exit(1);
    }
}

// Start the server
initializeServer().catch(error => {
    console.error('Server startup failed:', error);
    process.exit(1);
});