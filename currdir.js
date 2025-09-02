console.log(__dirname);
console.log(__filename);
console.log(process.cwd());

const path = require('path');

console.log(path.join(__dirname, '.', 'json/revokeds.json'))