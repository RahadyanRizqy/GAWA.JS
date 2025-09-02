const path = require("path");

function resolveFile(file) {
    return path.join(__dirname, "..", file); // naik dari utils → web/
}

module.exports = resolveFile;
