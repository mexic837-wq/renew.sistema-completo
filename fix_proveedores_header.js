const fs = require('fs');
const file = 'js/admin-app.js';
let lines = fs.readFileSync(file, 'utf8').split('\n');

// Fix line 3835 (0-indexed: 3834)
lines[3834] = lines[3834]
  .replace('ÑÂrea de Cobertura', 'Área de Cobertura')
  .replace('"Servicio"', '"Servicio"'); // already correct, just ensure

fs.writeFileSync(file, lines.join('\n'), 'utf8');
console.log('Fixed providers table header:', lines[3834].substring(lines[3834].indexOf('"Empresa'), lines[3834].indexOf('"Documentos')));
