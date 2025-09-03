let config = {};
const path = require('path');


// Node.js style
if (typeof process !== 'undefined' && process.env) {
    require('dotenv').config({ path: path.join(__dirname, '.', '.env')});
    config.SECRET_KEY = process.env.SECRET_KEY;
    config.PORT = process.env.PORT;
    config.COOKIE_HEADER = process.env.COOKIE_HEADER;
}

module.exports = config;
