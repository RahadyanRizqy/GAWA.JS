const { Hono } = require('hono');
const { serve } = require('@hono/node-server');
const { logger } = require('hono/logger');
const jwt = require('jsonwebtoken');
const GeminiClient = require('./utils/GeminiClient.js');
const errorResponse = require('./utils/error.js');
const fs = require('fs');
const config = require('./config.env.js');
const resolveFile = require('./utils/path-resolve.js');
const { setupRoutes } = require('./web/routes.js');
const path = require('path');

// Function to extract cookies from cookies.txt
// function getCookiesFromFile() {
//     try {
//         let cookiesPath;
//         cookiesPath = path.join(__dirname, '.', 'cookies.txt');
//         const cookieHeader = fs.readFileSync(cookiesPath, 'utf-8').trim();

//         let secure1psid = null;
//         let secure1psidts = null;

//         // Parse cookie string format: "name1=value1; name2=value2"
//         const cookies = cookieHeader.split(';').map(c => c.trim());

//         for (const cookie of cookies) {
//             const [name, value] = cookie.split('=');
//             if (name && value) {
//                 if (name === '__Secure-1PSID') {
//                     secure1psid = value;
//                 }
//                 if (name === '__Secure-1PSIDTS') {
//                     secure1psidts = value;
//                 }
//             }
//         }

//         return { secure1psid, secure1psidts };
//     } catch (error) {
//         console.error('Error reading cookies.txt:', error);
//         return { secure1psid: null, secure1psidts: null };
//     }
// }

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

        return { secure1psid, secure1psidts };
    } catch (error) {
        console.error('Error parsing COOKIE_HEADER:', error);
        return { secure1psid: null, secure1psidts: null };
    }
}

// Initialize GeminiClient at startup
const { secure1psid, secure1psidts } = getCookiesFromEnv();
const client = new GeminiClient(secure1psid, secure1psidts);

console.log('Initializing GeminiClient...');
client.init(300000, true).then(() => {
    console.log('GeminiClient initialized successfully');
}).catch((error) => {
    console.error('Failed to initialize GeminiClient:', error);
});

const app = new Hono();

app.use('*', logger()); // logger dulu

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
        let revokedPath;
        let revokedData;
        if (process.env.BUNDLED) {
            revokedPath = path.join(__dirname, '.', 'revokeds.json');
            revokedData = JSON.parse(fs.readFileSync(revokedPath, 'utf-8'));
        } else {
            revokedData = require('./json/revokeds.json');
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