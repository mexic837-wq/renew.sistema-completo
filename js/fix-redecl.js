const fs = require('fs');
const file = 'c:/Users/LENOVO/Downloads/renew-sistema-completo-main/renew.sistema-completo-main/js/admin-app.js';
let content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');
// We want to remove lines 8083 and 8084 (0-indexed 8082 and 8083).
// Let's verify they contain 'galleryCont'
if (lines[8082].includes('galleryCont') && lines[8083].includes('badge')) {
    lines.splice(8082, 2);
    fs.writeFileSync(file, lines.join('\n'), 'utf8');
    console.log('Fixed');
} else {
    console.log('Lines mismatch');
}
