const fs = require('fs');
const path = require('path');
const statusHtml = require('../public/status.html');

async function rootHandler(c) {
    if (c.req.method === 'GET') {
        // Render status.html
        try {
            // const htmlPath = path.join(__dirname, '..', 'public', 'status.html');
            // const html = fs.readFileSync(htmlPath, 'utf-8');
            // return c.html(html);
            return c.html(statusHtml);
        } catch (error) {
            return c.text('Status page not found', 404);
        }
    } else if (c.req.method === 'POST') {
        // Verify init status
        const client = c.get('client');
        if (client && client.running) {
            return c.json({ status: 200, message: 'API is online and initialized' }, 200);
        } else {
            return c.json({ status: 503, message: 'API is offline or not initialized' }, 503);
        }
    }
    return c.text('Method not allowed', 405);
}

module.exports = { rootHandler };