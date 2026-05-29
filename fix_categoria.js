const fs = require('fs');
const file = 'js/admin-app.js';
let lines = fs.readFileSync(file, 'utf8').split('\n');

// Fix CATEGORÍA header at line 9455 (0-indexed: 9454)
lines[9454] = '                      <th class="px-6 py-5 text-left text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">CATEGORÍA</th>\r';

fs.writeFileSync(file, lines.join('\n'), 'utf8');
console.log('Fixed CATEGORÍA header encoding.');
