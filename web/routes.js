const { rootHandler } = require('./handlers/root');
const { chatHandler } = require('./handlers/chat');
const { decryptMdHandler } = require('./handlers/decrypt');

function setupRoutes(app) {
    // Root endpoints
    app.get('/', rootHandler);
    app.post('/', rootHandler);

    // Decrypt endpoints
    app.get('/decryptmd', decryptMdHandler);
    app.post('/decryptmd', decryptMdHandler);

    // Chat endpoint (handles both /chat and /chat/:gemId)
    app.post('/chat', chatHandler);
    app.post('/chat/:gemId', chatHandler);
}

module.exports = { setupRoutes };