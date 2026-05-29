const fs = require('fs');
const file = 'js/admin-app.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace('ðŸ§‘â€ ðŸ’¼', '<i class="fa-solid fa-user-tie"></i>');
content = content.replace('ðŸ“ ', '<i class="fa-solid fa-location-dot"></i>');
content = content.replace('ðŸ“ ', '<i class="fa-solid fa-location-dot"></i>');
content = content.replace('ðŸ  ', '<i class="fa-solid fa-house"></i>');
content = content.replace('ðŸ› ï¸ ', '<i class="fa-solid fa-toolbox"></i>');
content = content.replace('ðŸ—‘ï¸ ', '<i class="fa-solid fa-trash"></i>');
content = content.replace('ðŸŒ§ï¸ ', '<i class="fa-solid fa-cloud-showers-water"></i>');
content = content.replace('ðŸ‘ ', '<i class="fa-solid fa-thumbs-up"></i>');

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed more mojibake in admin-app.js using literal replace');
