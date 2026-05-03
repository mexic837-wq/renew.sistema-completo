const fs = require('fs');

let content = fs.readFileSync('./js/api.js', 'utf8');

// The file has a second duplicated block starting after the first clean `updateProyectoFase` closes.
// Strategy: find the FIRST occurrence of the closing "return { success: true, proyecto };\n}"
// and cut everything after it, then append a newline.

const marker = 'return { success: true, proyecto };\n}';
const firstIdx = content.indexOf(marker);

if (firstIdx === -1) {
  console.error('Marker not found!');
  process.exit(1);
}

// Keep everything up to and including the first occurrence
const clean = content.slice(0, firstIdx + marker.length) + '\n';

fs.writeFileSync('./js/api.js', clean);
console.log('✅ api.js cleaned. Lines:', clean.split('\n').length);
