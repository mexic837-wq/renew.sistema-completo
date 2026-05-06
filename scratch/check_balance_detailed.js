const fs = require('fs');
const path = 'c:\\Users\\LENOVO\\Downloads\\renew-sistema-completo-main\\renew.sistema-completo-main\\js\\admin-app.js';
const content = fs.readFileSync(path, 'utf8');

let opens = 0;
let closes = 0;

for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '{') opens++;
    if (char === '}') closes++;
}

console.log(`Opens: ${opens}`);
console.log(`Closes: ${closes}`);
console.log(`Balance: ${opens - closes}`);
