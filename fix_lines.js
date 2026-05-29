const fs = require('fs');
const file = 'js/admin-app.js';
let lines = fs.readFileSync(file, 'utf8').split('\n');

lines[3613] = '                              <span style="color:#00dfbf; font-weight:700;"><i class="fa-solid fa-user-tie"></i> Rep: ${repName}</span>\r';
lines[3615] = '                              <span style="font-size:11px; color:#0f8b78; background:#00f5d420; border:1px solid #00f5d450; border-radius:4px; padding:3px 6px; display:inline-block;"><i class="fa-solid fa-location-dot"></i> ${c.direccion}</span>\r';
lines[3617] = '                                <div style="font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; color:#94a3b8; margin-bottom:3px;"><i class="fa-solid fa-file-pen"></i> Nota del vendedor</div>\r';

fs.writeFileSync(file, lines.join('\n'), 'utf8');
console.log('Lines replaced exactly by index.');
