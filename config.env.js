let config = {};

// Node.js style
if (typeof process !== 'undefined' && process.env) {
    const resolveFile = require('./utils/path-resolve');
    require('dotenv').config({ path: resolveFile('.env')});
    config.SECRET_KEY = process.env.SECRET_KEY;
    config.PORT = process.env.PORT;
}

module.exports = config;
