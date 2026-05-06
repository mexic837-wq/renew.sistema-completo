const fs = require('fs');
const path = 'c:\\Users\\LENOVO\\Downloads\\renew-sistema-completo-main\\renew.sistema-completo-main\\js\\admin-app.js';
const content = fs.readFileSync(path, 'utf8');

let braces = 0;
let parens = 0;
let brackets = 0;

for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '{') braces++;
    if (char === '}') braces--;
    if (char === '(') parens++;
    if (char === ')') parens--;
    if (char === '[') brackets++;
    if (char === ']') brackets--;
}

console.log(`Braces: ${braces}`);
console.log(`Parens: ${parens}`);
console.log(`Brackets: ${brackets}`);

if (braces !== 0) {
    console.log('❌ UNBALANCED BRACES!');
}
if (parens !== 0) {
    console.log('❌ UNBALANCED PARENTHESES!');
}
if (brackets !== 0) {
    console.log('❌ UNBALANCED BRACKETS!');
}
