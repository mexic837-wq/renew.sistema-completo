const fs = require('fs');
const file = 'js/admin-app.js';
// Read as latin1 / binary to detect raw bytes
const raw = fs.readFileSync(file);
console.log('Line 3835 raw hex around Area:');
const text = raw.toString('utf8');
const lines = text.split('\n');
const line = lines[3834];
const idx = line.indexOf('rea de Cobertura');
if (idx > 0) {
  const before = line.slice(idx - 4, idx);
  console.log('Characters before "rea de Cobertura":', [...before].map(c => `${c}(${c.charCodeAt(0).toString(16)})`).join(' '));
}
