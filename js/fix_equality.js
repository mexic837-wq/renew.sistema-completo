const fs = require('fs');
const file = 'c:/Users/LENOVO/Downloads/renew-sistema-completo-main/renew.sistema-completo-main/js/admin-app.js';
let content = fs.readFileSync(file, 'utf8');

// Fix c.id === r.campo_id
content = content.replace(/c\.id === r\.campo_id/g, 'String(c.id) === String(r.campo_id)');

// Fix r.campo_id === c.id
content = content.replace(/r\.campo_id === c\.id/g, 'String(r.campo_id) === String(c.id)');

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed strict equality in admin-app.js');
