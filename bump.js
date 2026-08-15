const fs = require('fs');

let app = fs.readFileSync('js/app.js', 'utf8');
app = app.replace(/dashboard\.js\?v=\d+/g, "dashboard.js?v=7");
fs.writeFileSync('js/app.js', app, 'utf8');

let index = fs.readFileSync('index.html', 'utf8');
index = index.replace(/app\.js\?v=\d+/g, "app.js?v=1007");
fs.writeFileSync('index.html', index, 'utf8');
