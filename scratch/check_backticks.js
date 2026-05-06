const fs = require('fs');
const path = 'c:\\Users\\LENOVO\\Downloads\\renew-sistema-completo-main\\renew.sistema-completo-main\\js\\admin-app.js';
const content = fs.readFileSync(path, 'utf8');

let backticks = 0;
for (let i = 0; i < content.length; i++) {
    if (content[i] === '`') backticks++;
}

console.log(`Backticks: ${backticks}`);
if (backticks % 2 !== 0) {
    console.log('❌ UNBALANCED BACKTICKS!');
}
