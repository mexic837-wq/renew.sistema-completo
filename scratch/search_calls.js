const fs = require('fs');
const path = 'c:\\Users\\LENOVO\\Downloads\\renew-sistema-completo-main\\renew.sistema-completo-main\\server.js';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
    if (line.includes('multer(')) {
        console.log(`Found multer at line ${idx + 1}: ${line.trim()}`);
    }
});
