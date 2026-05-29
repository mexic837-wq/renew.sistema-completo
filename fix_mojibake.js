const fs = require('fs');
const file = 'js/admin-app.js';
let content = fs.readFileSync(file, 'utf8');

const replacements = {
  'ðŸ‡ªðŸ‡¸ ': '<i class="fa-solid fa-language"></i> ',
  'ðŸ‡ºðŸ‡¸ ': '<i class="fa-solid fa-language"></i> ',
  'ðŸŒ™ Modo Oscuro': '<i class="fa-solid fa-moon"></i> Modo Oscuro',
  'Ã¢Ëœâ‚¬Ã¯Â¸Â  Modo Claro': '<i class="fa-solid fa-sun"></i> Modo Claro',
  "emoji: 'ðŸ”µ'": "emoji: '<i class=\"fa-solid fa-circle text-[10px]\"></i>'",
  "emoji: 'ðŸŸ¡'": "emoji: '<i class=\"fa-solid fa-circle text-[10px]\"></i>'",
  "emoji: 'ðŸŸ¢'": "emoji: '<i class=\"fa-solid fa-circle text-[10px]\"></i>'",
  "emoji: 'ðŸ”´'": "emoji: '<i class=\"fa-solid fa-circle text-[10px]\"></i>'",
  'ðŸš§ ': '<i class="fa-solid fa-trowel-bricks"></i> ',
  'ðŸ   ': '<i class="fa-solid fa-house"></i> ',
  'ðŸŽ¨ ': '<i class="fa-solid fa-paint-roller"></i> ',
  'ðŸ›  ï¸  ': '<i class="fa-solid fa-toolbox"></i> ',
  'ðŸ› ï¸  ': '<i class="fa-solid fa-toolbox"></i> ',
  'ðŸ—‘ï¸  ': '<i class="fa-solid fa-trash"></i> ',
  'ðŸŒ§ï¸  ': '<i class="fa-solid fa-cloud-showers-water"></i> ',
  'ðŸªŸ ': '<i class="fa-solid fa-border-all"></i> ',
  'ðŸŽ‚ CumpleaÃ±os de ': '<i class="fa-solid fa-cake-candles"></i> Cumpleaños de ',
  'ðŸ‘ ': '<i class="fa-solid fa-thumbs-up"></i>',
  'ðŸ”¥': '<i class="fa-solid fa-fire"></i>',
  'ðŸ˜Š': '<i class="fa-solid fa-face-smile"></i>',
  'ðŸ‘€': '<i class="fa-solid fa-eye"></i>',
  'ðŸš€': '<i class="fa-solid fa-rocket"></i>',
  'ðŸ’§': '<i class="fa-solid fa-droplet"></i>',
  'ðŸ‘‹': '',
  'ðŸ”— ': '<i class="fa-solid fa-link"></i> ',
  'ðŸ”‘ ': '<i class="fa-solid fa-key"></i> ',
  'Sin telÃ©fono': 'Sin teléfono',
  'EspaÃ±ol': 'Español',
  'ContraseÃ±a': 'Contraseña'
};

for (const [key, val] of Object.entries(replacements)) {
  content = content.split(key).join(val);
}

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed mojibake in admin-app.js');
