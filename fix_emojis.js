const fs = require('fs');
let code = fs.readFileSync('js/admin-app.js', 'utf8');

// The mojibake is:
// solar: â˜€ï¸ 
// hvac: â „ï¸ 
// general: âš™ï¸ 

code = code.replace(/â˜€ï¸ /g, '<i class="fa-solid fa-sun"></i>');
code = code.replace(/â „ï¸ /g, '<i class="fa-solid fa-snowflake"></i>');
code = code.replace(/âš™ï¸ /g, '<i class="fa-solid fa-gear"></i>');

fs.writeFileSync('js/admin-app.js', code);
console.log('Done');
