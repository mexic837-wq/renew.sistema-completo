const fs = require('fs');
const path = 'c:/Users/LENOVO/Downloads/renew-sistema-completo-main/renew.sistema-completo-main/js/admin-app.js';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/ðŸ”µ/g, '🔵');
content = content.replace(/ðŸŸ¡/g, '🟡');
content = content.replace(/ðŸŸ¢/g, '🟢');
content = content.replace(/ðŸ”´/g, '🔴');
content = content.replace(/Â·/g, '·');

fs.writeFileSync(path, content, 'utf8');
console.log('Done replacing garbled characters.');
