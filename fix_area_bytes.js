const fs = require('fs');
const file = 'js/admin-app.js';
const text = fs.readFileSync(file, 'utf8');
const lines = text.split('\n');

// Replace the broken bytes: D1 81 C2 81 with the correct Á (C3 81) = Á
// The pattern "Ñ\x81Â\x81" should become "Á"
lines[3834] = lines[3834].replace('\u00d1\u0081\u00c2\u0081', '\u00c1');

fs.writeFileSync(file, lines.join('\n'), 'utf8');

// Verify
const verify = fs.readFileSync(file, 'utf8').split('\n')[3834];
const idx = verify.indexOf('rea de Cobertura');
console.log('Fixed! Char before "rea":', verify[idx-1], '(code:', verify.charCodeAt(idx-1), ')');
