const fs = require('fs');
const path = require('path');
const resolveFile = require('./path-resolve');

function renderHtml(c, filename) {
    const filePath = resolveFile('public/'+filename);
    const html = fs.readFileSync(filePath, 'utf-8');
    return c.html(html);
}

module.exports = renderHtml;