const fs = require('fs');
const file = 'js/admin-app.js';
let content = fs.readFileSync(file, 'utf8');

const replacements = {
  'ðŸ§‘â€ ðŸ’¼': '<i class="fa-solid fa-user-tie"></i>',
  'ðŸ“ž': '<i class="fa-solid fa-phone"></i>',
  'ðŸ“ ': '<i class="fa-solid fa-location-dot"></i>',
  'ðŸ  ': '<i class="fa-solid fa-house"></i>',
  'ðŸ› ï¸ ': '<i class="fa-solid fa-toolbox"></i>',
  'ðŸ—‘ï¸ ': '<i class="fa-solid fa-trash"></i>',
  'ðŸŒ§ï¸ ': '<i class="fa-solid fa-cloud-showers-water"></i>',
  'ðŸ‘ ': '<i class="fa-solid fa-thumbs-up"></i>'
};

for (const [key, val] of Object.entries(replacements)) {
  content = content.split(key).join(val);
}

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed more mojibake in admin-app.js');
