const fs = require('fs');
const file = 'js/admin-app.js';
let content = fs.readFileSync(file, 'utf8');

const replacements = [
  { pattern: /ðŸ§‘â€ ðŸ’¼/g, replacement: '<i class="fa-solid fa-user-tie"></i>' },
  { pattern: /ðŸ“ž/g, replacement: '<i class="fa-solid fa-phone"></i>' },
  { pattern: /ðŸ“ /g, replacement: '<i class="fa-solid fa-location-dot"></i>' },
  { pattern: /ðŸ  /g, replacement: '<i class="fa-solid fa-house"></i>' },
  { pattern: /ðŸ› ï¸ /g, replacement: '<i class="fa-solid fa-toolbox"></i>' },
  { pattern: /ðŸ—‘ï¸ /g, replacement: '<i class="fa-solid fa-trash"></i>' },
  { pattern: /ðŸŒ§ï¸ /g, replacement: '<i class="fa-solid fa-cloud-showers-water"></i>' },
  { pattern: /ðŸ‘ /g, replacement: '<i class="fa-solid fa-thumbs-up"></i>' }
];

for (const { pattern, replacement } of replacements) {
  content = content.replace(pattern, replacement);
}

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed more mojibake in admin-app.js using regex');
