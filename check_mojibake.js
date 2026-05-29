const fs = require('fs');
const c = fs.readFileSync('js/admin-app.js', 'utf8');
const matches = c.match(/\xc3[^\s'"<>`]{1,5}/g);
const unique = [...new Set(matches || [])];
console.log('Remaining mojibake count:', unique.length);
unique.slice(0, 30).forEach(p => console.log(JSON.stringify(p)));
