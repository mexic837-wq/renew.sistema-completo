const fs = require('fs');
const path = 'c:/Users/LENOVO/Downloads/renew-sistema-completo-main/renew.sistema-completo-main/js/admin-app.js';
let content = fs.readFileSync(path, 'utf8');

const badLine = /const\s+const isWorkOrder/;
content = content.replace(badLine, 'const isWorkOrder');

fs.writeFileSync(path, content, 'utf8');
console.log('Final fix applied');
