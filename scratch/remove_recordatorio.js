const fs = require('fs');
const filepath = 'c:\\Users\\LENOVO\\Downloads\\renew-sistema-completo-main\\renew.sistema-completo-main\\js\\admin-app.js';
let content = fs.readFileSync(filepath, 'utf8');

// Replace usages
content = content.replace(/document\.getElementById\('ev-recordatorio'\)\.parentElement\.classList\.add\('hidden'\);\r?\n\s*/g, '');
content = content.replace(/document\.getElementById\('ev-recordatorio'\)\.parentElement\.classList\.remove\('hidden'\);\r?\n\s*/g, '');
content = content.replace(/const recordatorio = document\.getElementById\('ev-recordatorio'\)\.value;\r?\n\s*/g, '');
content = content.replace(/notificacion_recordatorio: recordatorio !== 'none' \? recordatorio : null\r?\n\s*/g, '');

fs.writeFileSync(filepath, content);
console.log('Done removing recordatorio references');
