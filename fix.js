const fs = require('fs');
let content = fs.readFileSync('js/admin-app.js', 'utf8');
content = content.replace(/<i class="fa-solid fa-link"><\/i>/g, '🔗');
content = content.replace(/âœ‰ï¸\s?/g, '✉️ ');
content = content.replace(/<i class="fa-solid fa-key"><\/i>/g, '🔑');
fs.writeFileSync('js/admin-app.js', content);
console.log('Fixed regex');
