const { Hono } = require('hono');
const { serve } = require('@hono/node-server');
const jwt = require('jsonwebtoken');
const GeminiClient = require('./utils/GeminiClient.js');
const errorResponse = require('./utils/error.js');
const fs = require('fs');
const config = require('./config.env.js');
const resolveFile = require('./utils/path-resolve.js');
const { setupRoutes } = require('./web/routes.js');

// Function to extract cookies from cookies.json
function getCookiesFromFile() {
    try {
        const cookiesPath = resolveFile('json/cookies.json');
        const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf-8'));

        let secure1psid = null;
        let secure1psidts = null;

        for (const cookie of cookies) {
        if (cookie.name === '__Secure-1PSID') {
            secure1psid = cookie.value;
        }
        if (cookie.name === '__Secure-1PSIDTS') {
            secure1psidts = cookie.value;
        }
        }

        return { secure1psid, secure1psidts };
    } catch (error) {
        console.error('Error reading cookies.json:', error);
        return { secure1psid: null, secure1psidts: null };
    }
}

// Initialize GeminiClient at startup
const { secure1psid, secure1psidts } = getCookiesFromFile();
const client = new GeminiClient(secure1psid, secure1psidts);

console.log('Initializing GeminiClient...');
client.init().then(() => {
    console.log('GeminiClient initialized successfully');
}).catch((error) => {
    console.error('Failed to initialize GeminiClient:', error);
});

const app = new Hono();

// Middleware to attach client
app.use('*', async (c, next) => {
    c.set('client', client);
    await next();
});

// JWT Authentication middleware with revoked token check (only for /chat routes)
app.use('/chat/*', async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw errorResponse('Unauthorized', 401);
    }
    const token = authHeader.substring(7);

    try {
        const decoded = jwt.verify(token, config.SECRET_KEY);

        // Check revoked tokens
        const revokedPath = resolveFile('json/revokeds.json');
        const revokedData = JSON.parse(fs.readFileSync(revokedPath, 'utf-8'));
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