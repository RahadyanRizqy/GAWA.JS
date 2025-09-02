const { rootHandler } = require('../handlers/root.js');
const { chatHandler } = require('../handlers/chat.js');
const { decryptMdHandler } = require('../handlers/decrypt.js');

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